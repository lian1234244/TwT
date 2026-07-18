'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const rows = new Map();

for (const [location, metadata] of Object.entries(lock.packages || {})) {
  if (!location.startsWith('node_modules/')) continue;
  const name = location.slice('node_modules/'.length);
  if (!name || name.includes('/node_modules/')) continue;
  rows.set(name, {
    name,
    version: metadata.version || 'unknown',
    license: metadata.license || 'SEE PACKAGE',
    resolved: metadata.resolved || ''
  });
}

const lines = [
  '# npm Dependency License Inventory',
  '',
  'Generated from `package-lock.json`. This inventory is informational; the',
  'license files and package metadata distributed with each dependency control.',
  '',
  '| Package | Version | License | Registry source |',
  '| --- | --- | --- | --- |'
];

for (const row of [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const source = row.resolved ? `[tarball](${row.resolved})` : '';
  lines.push(`| \`${row.name}\` | ${row.version} | ${row.license} | ${source} |`);
}

lines.push('');
fs.writeFileSync(path.join(root, 'docs', 'DEPENDENCY_LICENSES.md'), `${lines.join('\n')}\n`);
