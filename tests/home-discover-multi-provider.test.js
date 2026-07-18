const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const frontend = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const kugou = fs.readFileSync(path.join(root, 'providers', 'kugou.js'), 'utf8');

[
  'async function handleDiscoverHomeMulti(options)',
  'async function buildHomeDiscoverMulti()',
  'Promise.allSettled([',
  'getQQLoginInfo()',
  'kugouProvider.status()',
  'loadQQHomeDiscover(status.qq)',
  'loadKugouHomeDiscover(status.kugou)',
  'interleaveHomeDiscoverSongs',
  "id: provider === 'netease' ? rawId : `${provider}:${rawId}`",
  "force: url.searchParams.get('refresh') === '1'",
].forEach((contract) => {
  assert(server.includes(contract), `missing multi-provider Home contract: ${contract}`);
});

[
  "var HOME_DISCOVER_CACHE_KEY = 'mineradio-home-discover-v2'",
  'function readHomeDiscoverCache()',
  'function writeHomeDiscoverCache()',
  'function applyHomeDiscoverPayload(data)',
  "'/api/discover/home?refresh=' + (force ? '1' : '0')",
  'homeDiscoverState.providers',
].forEach((contract) => {
  assert(frontend.includes(contract), `missing Home cache/frontend contract: ${contract}`);
});

assert(server.includes('handleQQUserPlaylists({ hydrateCovers: false })'), 'Home must avoid eager QQ cover fan-out');
assert(server.includes('kugouProvider.playlists({ hydrateCovers: false })'), 'Home must avoid eager Kugou cover fan-out');
assert(kugou.includes('options.hydrateCovers === false'), 'Kugou playlist loader must support lightweight Home requests');

console.log('multi-provider Home discovery tests passed');
