const assert = require('assert');
const { waitForObsRecordStart, nextObsCaptureProfile } = require('../desktop/wallpaper-obs-state');

async function run() {
  let calls = 0;
  const eventuallyActive = {
    async request(type) {
      assert.strictEqual(type, 'GetRecordStatus');
      calls += 1;
      return { outputActive: calls >= 3 };
    },
  };
  const activeResult = await waitForObsRecordStart(eventuallyActive, async () => {}, {
    attempts: 5,
    intervalMs: 0,
  });
  assert.strictEqual(activeResult.ok, true);
  assert.strictEqual(calls, 3);

  const neverActive = {
    async request() {
      return { outputActive: false, outputBytes: 0 };
    },
  };
  const failedResult = await waitForObsRecordStart(neverActive, async () => {}, {
    attempts: 3,
    intervalMs: 0,
  });
  assert.strictEqual(failedResult.ok, false);
  assert.deepStrictEqual(failedResult.status, { outputActive: false, outputBytes: 0 });

  assert.strictEqual(nextObsCaptureProfile('Mineradio Capture A'), 'Mineradio Capture B');
  assert.strictEqual(nextObsCaptureProfile('Mineradio Capture B'), 'Mineradio Capture A');
  assert.strictEqual(nextObsCaptureProfile('Default'), 'Mineradio Capture A');

  console.log('wallpaper OBS state tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
