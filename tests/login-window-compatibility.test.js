const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { fitLoginWindowBounds } = require('../desktop/login-window-policy');

const compact = fitLoginWindowBounds(
  { x: 0, y: 0, width: 911, height: 512 },
  { width: 940, height: 760, minWidth: 780, minHeight: 580 },
);
assert.ok(compact.width <= 911 && compact.height <= 512, 'Login window must fit a high-DPI compact work area');
assert.ok(compact.x >= 0 && compact.y >= 0, 'Login window must stay inside the active display');
assert.ok(compact.minWidth <= compact.width && compact.minHeight <= compact.height, 'Minimum size must not force the window off-screen');

const secondary = fitLoginWindowBounds(
  { x: -1600, y: 40, width: 1600, height: 860 },
  { width: 900, height: 720, minWidth: 760, minHeight: 560 },
);
assert.ok(secondary.x >= -1600 && secondary.x + secondary.width <= 0, 'Login window must remain on the selected monitor');
assert.ok(secondary.y >= 40 && secondary.y + secondary.height <= 900);

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
assert.match(mainSource, /function bindLoginWindowReliability/);
assert.match(mainSource, /did-fail-load/);
assert.match(mainSource, /render-process-gone/);
assert.match(mainSource, /setTimeout\(reveal, 900\)/);

const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
assert.match(uiSource, /max-height:calc\(100vh - 32px\)/);
assert.match(uiSource, /meta\.label \+ '会话'/);

console.log('login window compatibility tests passed');
