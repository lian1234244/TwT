const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createKugouProvider, normalizePlaylist, normalizeTrack } = require('../providers/kugou');
const { createKuwoProvider } = require('../providers/kuwo');

for (const dependency of ['axios', 'dotenv', 'express', 'pako', 'qrcode', 'safe-decode-uri-component']) {
  assert.doesNotThrow(
    () => require.resolve(dependency),
    `Packaged music providers require the explicit runtime dependency: ${dependency}`,
  );
}

assert.doesNotThrow(
  () => require('../resources/vendor/kugoumusicapi/main'),
  'The bundled Kugou provider must load before Electron creates its main window',
);

const playlist = normalizePlaylist({ global_collection_id: 'kg-list-1', name: '收藏', count: 12, pic: 'https://x/{size}.jpg' });
assert.deepStrictEqual({ id: playlist.id, provider: playlist.provider, count: playlist.trackCount }, { id: 'kg-list-1', provider: 'kugou', count: 12 });
assert.strictEqual(playlist.cover, 'https://x/300.jpg');

const track = normalizeTrack({ audio_id: 7, hash: 'ABC', songname: '测试歌曲', author_name: '歌手', album_id: 3 });
assert.strictEqual(track.provider, 'kugou');
assert.strictEqual(track.hash, 'ABC');
assert.strictEqual(track.name, '测试歌曲');

const capitalizedTrack = normalizeTrack({ AudioID: 8, FileHash: 'DEF', SongName: '酷狗字段', SingerName: '酷狗歌手', AlbumID: 4 });
assert.strictEqual(capitalizedTrack.id, '8');
assert.strictEqual(capitalizedTrack.hash, 'DEF');
assert.strictEqual(capitalizedTrack.name, '酷狗字段');
assert.strictEqual(capitalizedTrack.artist, '酷狗歌手');

const playlistTrack = normalizeTrack({
  audio_id: 9,
  hash: 'PLAYLIST_HASH',
  mixsongid: 99,
  name: '王靖雯 - 沦陷.mp3',
  singerinfo: [{ id: 1054058, name: '王靖雯' }],
  albuminfo: { id: 42111216, name: '沦陷' },
});
assert.strictEqual(playlistTrack.name, '沦陷');
assert.strictEqual(playlistTrack.artist, '王靖雯');
assert.strictEqual(playlistTrack.artistId, 1054058);
assert.strictEqual(playlistTrack.album, '沦陷');
assert.strictEqual(playlistTrack.albumAudioId, 99);

const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
assert.match(uiSource, /id="search-mode-kugou"/);
assert.match(uiSource, /api\/kugou\/search/);
assert.match(uiSource, /kugouPlaylistId/);
assert.match(uiSource, /sourceProvider === 'kugou'/);
assert.doesNotMatch(uiSource, /slice\(7\).*kugou|kugou[^\n]*slice\(7\)/, 'kugou: is six characters and must not drop the first playlist-id character');
assert.strictEqual((uiSource.match(/slice\('kugou:'\.length\)/g) || []).length, 2, 'Both Kugou playlist consumers must preserve the complete playlist id');
assert.match(uiSource, />全都要</);
assert.match(uiSource, /data-pl-detail-collapse="1">收起歌单/);
assert.match(uiSource, /function collapsePlaylistPanelDetail\(\)/);

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert.match(serverSource, /pn === '\/api\/kugou\/search'/);
assert.match(serverSource, /error\.code !== 'EPIPE'/);
assert.match(serverSource, /\^collection_\\d\+_\\d\+_\\d\+_\\d\+\$/);

const previewSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'pack-preview.js'), 'utf8');
assert.match(previewSource, /RedirectStandardOutput \$stdout/);
assert.match(previewSource, /RedirectStandardError \$stderr/);

const desktopSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
assert.match(desktopSource, /did-finish-load[\s\S]*!mainWindow\.isVisible\(\)[\s\S]*mainWindow\.show\(\)/);
assert.match(uiSource, /id="playlist-provider-hint"/);
assert.match(uiSource, /function updatePlaylistProviderHint\(\)/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-kuwo-provider-'));
const provider = createKuwoProvider(path.join(temp, '.kuwo-cookie'));
(async () => {
  const status = await provider.status();
  assert.strictEqual(status.loggedIn, false);
  assert.strictEqual(status.provider, 'kuwo');

  let oldTrackCalls = 0;
  const fakeKugou = {
    playlist_detail: async () => ({ body: { data: { info: [{ global_collection_id: 'collection_3_9_2_0', name: '重试歌单' }] } } }),
    playlist_track_all: async () => {
      oldTrackCalls += 1;
      return oldTrackCalls === 1
        ? { body: { data: { songs: [] } } }
        : { body: { data: { songs: [{ audio_id: 77, songname: '恢复歌曲', author_name: '恢复歌手' }] } } };
    },
    playlist_track_all_new: async () => ({ body: { data: { songs: [] } } }),
  };
  const kugouProvider = createKugouProvider(path.join(temp, '.kugou-cookie'), fakeKugou, {
    playlistRetryDelayMs: 1,
    playlistCacheMs: 5000,
  });
  const [first, concurrent] = await Promise.all([
    kugouProvider.playlist('collection_3_9_2_0'),
    kugouProvider.playlist('collection_3_9_2_0'),
  ]);
  assert.strictEqual(first.tracks.length, 1, 'An empty Kugou response should be retried');
  assert.strictEqual(concurrent.tracks.length, 1, 'Concurrent playlist consumers should share the successful request');
  assert.strictEqual(oldTrackCalls, 2, 'Concurrent consumers must not start duplicate upstream retry loops');
  const cached = await kugouProvider.playlist('collection_3_9_2_0');
  assert.strictEqual(cached.tracks.length, 1);
  assert.strictEqual(oldTrackCalls, 2, 'A successful playlist should be reused from the short cache');

  fs.rmSync(temp, { recursive: true, force: true });
  console.log('music provider expansion tests passed');
})().catch(error => {
  fs.rmSync(temp, { recursive: true, force: true });
  throw error;
});
