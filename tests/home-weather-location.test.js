const assert = require('assert');
const path = require('path');

const locationAdapter = require(path.join(__dirname, '..', 'public', 'home-weather-location.js'));

async function run() {
  const precise = await locationAdapter.requestSystemLocation({
    getCurrentPosition(success) {
      success({ coords: { latitude: 31.2299, longitude: 121.4737, accuracy: 42 } });
    },
  }, { timeoutMs: 50 });

  assert.deepStrictEqual(precise, {
    latitude: 31.2299,
    longitude: 121.4737,
    accuracy: 42,
    provider: 'system',
  });

  await assert.rejects(
    locationAdapter.requestSystemLocation({
      getCurrentPosition(success, error) {
        error({ code: 1, message: 'denied' });
      },
    }, { timeoutMs: 50 }),
    /GEOLOCATION_DENIED/
  );

  await assert.rejects(
    locationAdapter.requestSystemLocation({
      getCurrentPosition() {},
    }, { timeoutMs: 15 }),
    /GEOLOCATION_TIMEOUT/
  );

  await assert.rejects(
    locationAdapter.requestSystemLocation({
      getCurrentPosition(success) {
        success({ coords: { latitude: 120, longitude: 240 } });
      },
    }, { timeoutMs: 50 }),
    /GEOLOCATION_INVALID/
  );

  console.log('home weather location tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
