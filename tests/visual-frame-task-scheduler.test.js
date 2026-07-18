const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const policySource = fs.readFileSync(path.join(__dirname, '..', 'public', 'render-performance-policy.js'), 'utf8');

[
  'var FRAME_TASK_HOME = 1 << 0;',
  'var FRAME_TASK_LYRIC_FIELD = 1 << 1;',
  'var FRAME_TASK_MAGAZINE = 1 << 2;',
  'var FRAME_TASK_STAR_TRACK = 1 << 3;',
  'var FRAME_TASK_SHELF = 1 << 4;',
  'var FRAME_TASK_SKULL = 1 << 5;',
  'var FRAME_TASK_PARTICLE_LYRICS = 1 << 6;',
  'var FRAME_TASK_DESKTOP_OVERLAY = 1 << 7;',
  'function getActiveVisualFrameTaskMask()',
  'function describeVisualFrameTaskMask(mask)',
  'window.__mineradioVisualFrameTasks',
  'adaptivePerformanceObserver.recordFrame(now, dt * 1000, renderPerfState.targetFps, taskMask)',
  'window.__mineradioPerformanceObserver = adaptivePerformanceObserver;',
  'if (frameTaskMask & FRAME_TASK_HOME) drawHomeAudioWaveform(now);',
  'if (frameTaskMask & FRAME_TASK_SHELF) shelfManager.update(dt);',
  'if (frameTaskMask & FRAME_TASK_LYRIC_FIELD) tickLyricField(dt);',
  'if (frameTaskMask & FRAME_TASK_MAGAZINE) tickMagazineLyrics(dt);',
  'if (frameTaskMask & FRAME_TASK_STAR_TRACK) tickStarTrackLyrics(dt);',
  'if (frameTaskMask & FRAME_TASK_SKULL) updateSkullParticleLayer(dt);',
].forEach((contract) => {
  assert(source.includes(contract), `missing visual frame task contract: ${contract}`);
});

const animateMatch = source.match(/function animate\(\) \{([\s\S]*?)\n\}\nanimate\(\);/);
assert(animateMatch, 'main animation loop should remain discoverable');
assert(!animateMatch[1].includes('updateFloatLayer(dt);'), 'no-op float-layer JS update should not run every frame');

assert(!policySource.includes('setPixelRatio'), 'observe-only policy must not modify renderer pixel ratio');
assert(!policySource.includes('performanceQuality ='), 'observe-only policy must not mutate quality settings');
assert(!policySource.includes('particleCount'), 'observe-only policy must not mutate particle counts');

console.log('visual frame task scheduler tests passed');
