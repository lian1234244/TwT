const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKugouProvider, normalizePlaylist, normalizeTrack } = require('../providers/kugou');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');

assert.match(server, /async function handleQQPlaylistWrite\(/, 'QQ playlist writes need a dedicated authenticated adapter');
assert.match(server, /music\.musicasset\.PlaylistDetailWrite/, 'QQ writes must use the current musicu playlist service');
assert.match(server, /method:\s*removing\s*\?\s*'DelSonglist'\s*:\s*'AddSonglist'/, 'QQ add and remove must share the current PlaylistDetailWrite protocol');
assert.match(server, /v_songInfo:\s*\[\{\s*songType,\s*songId\s*\}\]/, 'QQ writes must send the numeric song type and song id expected by the web client');
assert.doesNotMatch(server, /fcg_music_add2songdir\.fcg|fcg_music_delbatchsong\.fcg/, 'Retired QQ playlist CGIs must not remain in the write path');
assert.match(server, /provider === 'kugou'[\s\S]{0,500}kugouProvider\.setLiked/, 'Kugou heart writes must reach the provider');
assert.match(server, /provider === 'qq'[\s\S]{0,500}handleQQPlaylistWrite/, 'QQ heart writes must reach the QQ adapter');
assert.match(server, /verifyQQLikeState/, 'QQ heart writes must verify the real remote favorite state');
assert.match(server, /verifyQQPlaylistSongState/, 'QQ collection writes must verify the real target playlist state');
assert.match(server, /pn === '\/api\/platform\/playlist\/add-song'/, 'All collection surfaces need one provider-aware route');
assert.match(desktop, /music\.musicasset\.PlaylistDetailWrite/, 'Electron must use QQ Music current official playlist service');
assert.match(desktop, /window\.__mineradioWebpackRequire\(8\)/, 'QQ writes must reuse the official web request signer');
assert.match(desktop, /ipcMain\.handle\('qq-music-playlist-write'/, 'All QQ collection surfaces need one Electron bridge');
assert.match(preload, /writeQQMusicPlaylist/, 'The official QQ write bridge must be exposed to the renderer');

assert.match(ui, /function providerSongActionKey\(/, 'Liked state must be namespaced by provider');
assert.match(ui, /\/api\/platform\/song\/like/, 'Heart buttons must use the provider-aware route');
assert.match(ui, /r\.verified !== true/, 'QQ and Kugou hearts must not keep an optimistic state without backend confirmation');
assert.match(ui, /provider === 'qq' && r\.verified !== true/, 'QQ collection UI must require a verified remote playlist write');
assert.match(ui, /\/api\/platform\/playlist\/add-song/, 'Collection buttons must use the provider-aware route');
assert.match(ui, /function writeQQPlaylistFromDesktop\(/, 'QQ hearts and collection menus must share the official web write path');
assert.match(ui, /verifyQQLikeFromUi/, 'QQ heart UI must confirm the remote state after an official write');
assert.doesNotMatch(ui, /QQ[^\n]{0,24}(待登录接口接入|待登录接口接入)/, 'QQ actions must not remain placeholder toasts');
assert.match(ui, /function moveQueueItem\(/, 'The queue needs a stable reorder operation');
assert.match(ui, /function armQueueRowDrag\(/, 'Queue rows need to exclude action buttons from whole-row dragging');
assert.match(ui, /class="mini-queue-item[^\n]+draggable="true"/, 'The mini queue card must be the drag surface');
assert.match(ui, /class="queue-item[^\n]+draggable="true"/, 'The side queue card must be the drag surface');
assert.doesNotMatch(ui, /class="(?:mini-queue-drag|queue-drag-handle)"/, 'The old six-dot drag buttons should be removed');
assert.match(ui, /suppressClickUntil/, 'Dropping a row must not accidentally play it');
assert.match(ui, /mini-queue-collect[\s\S]{0,220}mini-queue-next/, 'Mini queue collection belongs before Next');
assert.match(ui, /class="qi-act pl-detail-row-actions"/, 'Expanded playlist tracks need the shared hover action group');
assert.match(ui, /toggleLikePlaylistDetailTrack/, 'Expanded playlist hearts must reuse the provider-aware like action');
assert.match(ui, /collectPlaylistDetailTrack/, 'Expanded playlist tracks must open the same-provider collection picker');
assert.match(ui, /removePlaylistDetailTrack/, 'Writable expanded playlists need a remove-track action');
assert.match(ui, /\/api\/platform\/playlist\/remove-song/, 'Removing a playlist detail track needs a provider-aware route');
assert.match(ui, /schedulePlaylistMutationReconcile/, 'Playlist writes need a coalesced background reconciliation pass');
assert.match(ui, /applyPlaylistDetailMutation/, 'Playlist writes need an immediate local detail update');
assert.match(server, /pn === '\/api\/platform\/playlist\/remove-song'/, 'The backend must expose provider-aware playlist removal');
assert.match(server, /kugouProvider\.removeSongFromPlaylist/, 'Kugou playlist removal must use its real provider adapter');
assert.match(server, /playlist_tracks\(\{ op: 'del'/, 'Netease playlist removal must use the platform API');
assert.match(server, /pn === '\/api\/platform\/song\/like\/snapshot'/, 'Each provider must expose an authoritative liked-song snapshot');
assert.match(server, /qqLikedSnapshot/, 'QQ liked state must be rebuilt from the real favorite playlist');
assert.match(server, /kugouProvider\.likedSnapshot/, 'Kugou liked state must be rebuilt from the real favorite playlist');
assert.match(ui, /function hydrateAuthoritativeLikedState\(/, 'The renderer must hydrate provider liked state after login');
assert.match(ui, /function renderAuthoritativeLikeState\(/, 'Every liked-state surface must share one refresh path');
assert.match(ui, /function hydrateLikedStateFromFavoritePlaylist\(/, 'A failed snapshot must fall back to the real favorite playlist');
assert.match(ui, /state\.source = complete \? 'favorite-playlist' : 'favorite-playlist-partial'/, 'Partial favorite playlists must not create authoritative false negatives');
assert.match(ui, /safeShelfRebuild\('liked-state-authoritative'/, 'The 3D shelf must redraw when authoritative liked state arrives');
assert.match(ui, /isFavoriteUserPlaylist\(pl, provider\)[\s\S]{0,160}markSongsLiked/, 'Tracks loaded from a favorite playlist must render liked immediately');
assert.doesNotMatch(ui, /if \(!qqPlaylistId && !kugouPlaylistId\) syncLikeStatusForSongs/, 'QQ and Kugou playlist tracks must not be excluded from real liked-state sync');

const normalizedPlaylist = normalizePlaylist({
  global_collection_id: 'collection_1_2_7788_0',
  listid: 7788,
  listname: '我喜欢',
  count: 1,
});
assert.strictEqual(normalizedPlaylist.listId, '7788');

const normalizedTrack = normalizeTrack({
  audio_id: 42,
  fileid: 9001,
  hash: 'KG_HASH',
  songname: '测试歌曲',
  author_name: '测试歌手',
  album_id: 7,
  mixsongid: 8,
});
assert.strictEqual(normalizedTrack.fileId, 9001);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-platform-write-'));
const calls = [];
let userPlaylistCalls = 0;
const fakeClient = {
  user_detail: async () => ({ body: { data: { user_info: { nickname: 'tester' } } } }),
  user_playlist: async () => { userPlaylistCalls += 1; return ({ body: { data: { info: [
    { global_collection_id: 'collection_1_2_7700_0', listid: 7700, listname: '默认收藏', count: 0 },
    { global_collection_id: 'collection_1_2_7788_0', listid: 7788, listname: '我喜欢', count: 0 },
    { global_collection_id: 'collection_1_2_7799_0', listid: 7799, listname: '通勤', count: 0 },
  ] } } }); },
  playlist_detail: async ({ ids }) => ({ body: { data: { info: [{ global_collection_id: ids, listid: ids.includes('7799') ? 7799 : 7788, listname: 'list' }] } } }),
  playlist_track_all: async ({ id }) => ({ body: { data: { songs: String(id).includes('7788') ? [{
    audio_id: 42,
    fileid: 9001,
    hash: 'KG_HASH',
    songname: '测试歌曲',
    author_name: '测试歌手',
  }] : [] } } }),
  playlist_track_all_new: async () => ({ body: { data: { songs: [] } } }),
  playlist_tracks_add: async args => { calls.push(args); return { body: { status: 1 } }; },
  playlist_tracks_del: async args => { calls.push(args); return { body: { status: 1 } }; },
};

(async () => {
  const cookieFile = path.join(temp, '.cookie');
  fs.writeFileSync(cookieFile, 'userid=123; token=abc', 'utf8');
  const provider = createKugouProvider(cookieFile, fakeClient, { playlistRetryDelayMs: 0 });
  await provider.addSongToPlaylist('collection_1_2_7799_0', normalizedTrack);
  assert.strictEqual(String(calls[0].listid), '7799');
  assert.match(calls[0].data, /测试歌曲\|KG_HASH\|7\|8/);
  await provider.setLiked(normalizedTrack, true);
  assert.strictEqual(String(calls[1].listid), '7788');
  const callsBeforeUnlike = userPlaylistCalls;
  const status = await provider.likedStatus(['KG_HASH']);
  assert.strictEqual(status.liked.KG_HASH, true);
  await provider.setLiked({ ...normalizedTrack, fileId: 42 }, false);
  assert.strictEqual(String(calls[2].listid), '7788');
  assert.strictEqual(String(calls[2].fileids), '9001', 'Unlike must delete the real playlist entry fileid, not search audio_id');
  assert.strictEqual(userPlaylistCalls, callsBeforeUnlike, 'Favorite metadata should be reused instead of refetched for every heart action');
  const afterUnlike = await provider.likedStatus(['KG_HASH']);
  assert.strictEqual(afterUnlike.liked.KG_HASH, false, 'Unlike should update the local favorite state immediately');
  console.log('platform collection and queue tests passed');
})().finally(() => fs.rmSync(temp, { recursive: true, force: true }));
