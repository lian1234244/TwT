const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKugouProvider, normalizeTrack } = require('../providers/kugou');

const root = path.join(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.match(uiSource, /provider === 'kugou'[\s\S]{0,300}\/api\/kugou\/lyric\?/,
  'Kugou lyrics must use the Kugou route');
assert.match(uiSource, /detailProvider === 'kugou'[\s\S]{0,220}\/api\/kugou\/artist\/detail\?/,
  'Kugou artist details must use the Kugou route');
assert.match(uiSource, /provider === 'kugou'[\s\S]{0,220}\/api\/kugou\/search\?/,
  'Kugou artist fallback search must stay inside Kugou');
assert.match(serverSource, /pn === '\/api\/kugou\/lyric'/);
assert.match(serverSource, /pn === '\/api\/kugou\/artist\/detail'/);

const normalized = normalizeTrack({
  hash: 'HASH-1',
  SongName: '测试歌曲',
  SingerName: '测试歌手',
  SingerId: 9527,
});
assert.strictEqual(normalized.artistId, 9527, 'top-level Kugou singer IDs must survive normalization');
assert.strictEqual(normalized.provider, 'kugou');

const artistAudio = normalizeTrack({
  audio_id: 22399633,
  hash: 'AFEA9FFE5D7F0EF0874119A363820D33',
  audio_name: '小半',
  author_name: '陈粒',
  album_name: '小梦大半',
  timelength: 297273,
  trans_param: { union_cover: 'http://example.invalid/{size}/cover.jpg' },
});
assert.strictEqual(artistAudio.name, '小半', 'artist_audios audio_name must be normalized');
assert.strictEqual(artistAudio.duration, 297273);
assert.strictEqual(artistAudio.cover, 'http://example.invalid/300/cover.jpg');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-kugou-detail-'));
const fakeClient = {
  search: async () => ({
    body: { data: { lists: [{ hash: 'HASH-1', SongName: '测试歌曲', SingerName: '测试歌手', SingerId: 9527, Image: 'artist-song.jpg' }] } },
  }),
  artist_detail: async ({ id }) => ({ body: { data: { author_info: { author_id: id, author_name: '测试歌手', avatar: 'artist-{size}.jpg' } } } }),
  artist_audios: async () => ({
    body: { data: { songs: [{ hash: 'HASH-2', audio_name: '热门歌曲', author_name: '测试歌手', timelength: 180000 }] } },
  }),
  search_lyric: async () => ({
    body: { candidates: [{ id: 'lyric-1', accesskey: 'key-1', song: '测试歌曲', singer: '测试歌手', duration: 180000, score: 60 }] },
  }),
  lyric: async params => {
    assert.strictEqual(params.fmt, 'lrc');
    assert.strictEqual(params.decode, true);
    return { body: { decodeContent: '[00:01.00]第一句\n[00:05.00]第二句' } };
  },
};

(async () => {
  const provider = createKugouProvider(path.join(temp, '.cookie'), fakeClient);
  const artist = await provider.artistDetail({ name: '测试歌手', limit: 20 });
  assert.strictEqual(artist.provider, 'kugou');
  assert.strictEqual(artist.artist.id, 9527);
  assert.strictEqual(artist.artist.name, '测试歌手');
  assert.strictEqual(artist.songs.length, 1);
  assert.strictEqual(artist.songs[0].name, '热门歌曲');
  assert.strictEqual(artist.songs[0].artistId, 9527);
  assert.ok(artist.songs.every(song => song.provider === 'kugou'), 'artist songs must remain Kugou tracks');

  const lyric = await provider.lyrics({ hash: 'HASH-1', name: '测试歌曲', artist: '测试歌手', duration: 180 });
  assert.strictEqual(lyric.provider, 'kugou');
  assert.match(lyric.lyric, /\[00:01\.00\]第一句/);
  assert.strictEqual(lyric.error, '');
  console.log('kugou artist and lyric tests passed');
})().finally(() => fs.rmSync(temp, { recursive: true, force: true }));
