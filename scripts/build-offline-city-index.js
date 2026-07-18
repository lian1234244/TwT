const fs = require('fs');
const path = require('path');
const cities = require('all-the-cities');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'resources', 'location', 'world-admin-cities.json');
const keep = /^(PPLC|PPLA|PPLA2)$/;

const records = cities
  .filter(city => city && keep.test(city.featureCode) && city.loc && Array.isArray(city.loc.coordinates))
  .map(city => [
    String(city.name || ''),
    String(city.country || ''),
    Number(city.loc.coordinates[1]),
    Number(city.loc.coordinates[0]),
  ])
  .filter(city => city[0] && Number.isFinite(city[2]) && Number.isFinite(city[3]));

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(records));
console.log(`offline city index: ${records.length} entries, ${fs.statSync(output).size} bytes`);
