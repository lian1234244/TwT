const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.resolve(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptPattern = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let match = null;
let checked = 0;

while ((match = scriptPattern.exec(html))) {
  const attributes = match[1] || '';
  if (/type=["'](?:application\/json|importmap)["']/i.test(attributes)) continue;
  checked += 1;
  new vm.Script(match[2], { filename: `public/index.html:inline-${checked}` });
}

console.log(`inline scripts syntax ok: ${checked}`);
