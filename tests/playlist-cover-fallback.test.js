const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ui = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const kugou = fs.readFileSync(path.join(__dirname, '..', 'providers', 'kugou.js'), 'utf8');

assert.match(ui, /function hydratePlaylistCoverFallback\(provider, pid\)/);
assert.match(ui, /songCoverSrc\(tracks\[0\], 300\)/);
assert.match(ui, /function handlePlaylistCoverImageError\(provider, pid, image\)/);
assert.match(ui, /scheduleShelfRebuild\('playlist-cover-fallback', true\)/);
assert.match(ui, /coverOnly=1/);
assert.match(server, /song_num: limit/);
assert.match(server, /coverOnly === '1'/);
assert.match(server, /function normalizeQQPlaylistCover\(value\)/);
assert(server.includes("return /^https?:\\/\\//i.test(cover) ? cover : '';"));
assert.match(server, /playlists\.filter\(pl => !pl\.cover && pl\.trackCount > 0\)/);
assert.match(server, /handleQQPlaylistTracks\(pl\.id, \{ limit: 1, loginInfo: info \}\)/);
assert.match(server, /if \(first && first\.cover\) pl\.cover = first\.cover/);
assert.match(kugou, /normalized\.filter\(item => !item\.cover && item\.trackCount > 0\)/);
assert.match(kugou, /const detail = await fetchPlaylist\(item\.id, 1\)/);
assert.match(kugou, /if \(first && first\.cover\) item\.cover = first\.cover/);
assert.match(kugou, /pagesize: limit/);

console.log('playlist cover fallback tests passed');
