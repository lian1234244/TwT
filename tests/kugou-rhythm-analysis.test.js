const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'scripts', 'pack-preview.js'), 'utf8');

assert.match(
  ui,
  /provider === 'kugou'[\s\S]{0,260}return 'kugou:' \+ stableId/,
  'Kugou beat maps need a provider-scoped cache key based on hash/audio id',
);
assert.match(
  ui,
  /async function resolveBeatAnalysisAudioUrl\(song, playbackAudioUrl\)[\s\S]{0,500}fetchBeatPrefetchAudioUrl\(song\)/,
  'Kugou rhythm analysis should request a decoder-friendly standard stream',
);
assert.match(
  ui,
  /async function analyzeSongAudioBeats\([\s\S]{0,900}compatibleUrl !== playbackAudioUrl[\s\S]{0,350}analyzeAudioBeats\(playbackAudioUrl/,
  'Kugou rhythm analysis should retry the active playback stream when the standard stream fails',
);
assert.match(
  ui,
  /scheduleBeatAnalysis[\s\S]{0,1800}analyzeSongAudioBeats\(song, audioUrl/,
  'Scheduled playback analysis must use the provider-aware rhythm analysis path',
);
assert.match(preview, /kugou rhythm analysis/);

console.log('Kugou rhythm analysis tests passed');
