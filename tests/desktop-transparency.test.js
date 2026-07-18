const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');

assert(/mainWindow\s*=\s*new BrowserWindow\(\{[\s\S]*?transparent:\s*true,[\s\S]*?backgroundColor:\s*'#00000000'/.test(main), 'main window must support transparent composition');
assert(html.includes('id="t-desktopTransparency"'), 'desktop transparency control is missing');
assert(html.includes('body.desktop-transparency-mode #custom-bg'), 'custom background must be hidden in transparency mode');
assert(html.includes('body.desktop-transparency-mode #album-bg'), 'album background must be hidden in transparency mode');
assert(html.includes('function toggleDesktopTransparency()'), 'desktop transparency toggle handler is missing');
assert(html.includes('desktopTransparency: raw.desktopTransparency === true'), 'desktop transparency preference must be restored');
assert(html.includes('desktopTransparency: fx.desktopTransparency === true'), 'desktop transparency preference must be saved');
assert(/if \(desktopTransparency\) \{[\s\S]*?video\.pause\(\);/.test(html), 'background video must pause while transparent');

console.log('desktop transparency contract tests passed');
