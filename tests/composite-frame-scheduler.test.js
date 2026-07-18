const assert = require('assert');
const path = require('path');

const policy = require(path.join(__dirname, '..', 'public', 'render-performance-policy.js'));

assert.strictEqual(policy.compositePlaybackFps('eco', 0), 36);
assert.strictEqual(policy.compositePlaybackFps('balanced', 0), 48);
assert.strictEqual(policy.compositePlaybackFps('high', 0), 60);
assert.strictEqual(policy.compositePlaybackFps('ultra', 0), 72);
assert.strictEqual(policy.compositePlaybackFps('ultra', 2), 60);
assert.strictEqual(policy.compositePlaybackFps('unknown', 0), 60);

assert.strictEqual(policy.interactionFps(0), 40);
assert.strictEqual(policy.interactionFps(1), 30);
assert.strictEqual(policy.interactionFps(2), 24);

assert.strictEqual(policy.normalizeVisualFps(-1), -1);
assert.strictEqual(policy.normalizeVisualFps(0), 0);
assert.strictEqual(policy.normalizeVisualFps(120), 120);
assert.strictEqual(policy.resolveVisualFps(-1, 60, 0), 60);
assert.strictEqual(policy.resolveVisualFps(120, 60, 0), 120);
assert.strictEqual(policy.resolveVisualFps(0, 60, 0), 0);
assert.strictEqual(policy.resolveVisualFps(24, 60, 40), 24);
assert.strictEqual(policy.resolveVisualFps(120, 60, 30), 30);
assert.strictEqual(policy.resolveVisualFps(0, 60, 30), 30);

console.log('composite frame scheduler tests passed');
