const assert = require('assert');
const fs = require('fs');
const path = require('path');

const locationUtils = require(path.join(__dirname, '..', 'desktop', 'weather-location-utils.js'));

assert.strictEqual(locationUtils.isValidCoordinatePair(28.6564, 121.4208), true);
assert.strictEqual(locationUtils.isValidCoordinatePair(128.6564, 121.4208), false);

assert.deepStrictEqual(locationUtils.fromBigDataCloud({
  city: '台州市',
  locality: '椒江区',
  principalSubdivision: '浙江省',
  countryName: '中国',
  latitude: 28.6564,
  longitude: 121.4208,
}), {
  city: '浙江省台州市',
  locality: '椒江区',
  region: '浙江省',
  country: '中国',
  latitude: 28.6564,
  longitude: 121.4208,
  provider: 'bigdatacloud',
});

assert.strictEqual(locationUtils.fromNominatim({
  lat: '28.6564',
  lon: '121.4208',
  address: { city: '台州市', state: '浙江省', country: '中国', suburb: '椒江区' },
}).city, '浙江省台州市');

assert.strictEqual(locationUtils.nearestAdministrativeCity([
  ['金华', 'CN', 29.079, 119.647],
  ['台州', 'CN', 28.662, 121.433],
  ['温州', 'CN', 27.994, 120.699],
], 28.6564, 121.4208).name, '台州');

assert.strictEqual(locationUtils.localizedCityLabel('浙江', '台州'), '浙江省台州市');

const offlineCities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'resources', 'location', 'world-admin-cities.json'), 'utf8'));
const embeddedMatch = locationUtils.nearestAdministrativeCity(offlineCities, 28.6564, 121.4208);
assert.strictEqual(embeddedMatch.name, 'Taizhou');
assert.strictEqual(embeddedMatch.country, 'CN');

console.log('weather reverse location tests passed');
