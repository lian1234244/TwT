const assert = require('assert');
const path = require('path');

const policy = require(path.join(__dirname, '..', 'public', 'render-performance-policy.js'));

function runWindow(frameMs, targetFps, taskMask) {
  const observer = policy.createObserver({ sampleWindowMs: 1000, historyLimit: 4 });
  let snapshot = null;
  let now = 100;
  while (!snapshot && now < 5000) {
    snapshot = observer.recordFrame(now, frameMs, targetFps, taskMask);
    now += frameMs;
  }
  return { observer, snapshot };
}

assert.strictEqual(typeof policy.createObserver, 'function');

const stable = runWindow(1000 / 60, 60, 1 | 8);
assert(stable.snapshot, 'stable sample window should complete');
assert.strictEqual(stable.snapshot.observeOnly, true);
assert.strictEqual(stable.snapshot.status, 'stable');
assert.strictEqual(stable.snapshot.activeTaskMask, 9);
assert(Math.abs(stable.snapshot.fps - 60) <= 1);

const critical = runWindow(40, 60, 4);
assert(critical.snapshot, 'critical sample window should complete');
assert.strictEqual(critical.snapshot.status, 'critical');
assert(critical.snapshot.p95FrameMs >= 40);

const longTaskObserver = policy.createObserver({ sampleWindowMs: 1000 });
let longTaskSnapshot = null;
let longTaskRecorded = false;
for (let now = 100; now < 1500 && !longTaskSnapshot; now += 1000 / 60) {
  if (!longTaskRecorded && now > 450) {
    longTaskRecorded = true;
    longTaskObserver.recordLongTask(80);
  }
  longTaskSnapshot = longTaskObserver.recordFrame(now, 1000 / 60, 60, 2);
}
assert(longTaskSnapshot, 'long-task sample window should complete');
assert.strictEqual(longTaskSnapshot.status, 'pressured');
assert.strictEqual(longTaskSnapshot.longTaskCount, 1);

const exported = longTaskObserver.snapshot();
assert.strictEqual(exported.observeOnly, true);
assert.strictEqual(exported.history.length, 1);

console.log('adaptive performance observer tests passed');
