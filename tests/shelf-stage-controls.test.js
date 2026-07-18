const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ui = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

const suppression = ui.match(/function isBottomControlsSuppressedForShelf\(\) \{([\s\S]*?)\n\}/);
assert(suppression, 'bottom control suppression function should exist');
assert.match(suppression[1], /if \(shelfMode !== 'side'\) return false/);

const setMode = ui.match(/function setShelfMode\(m\) \{([\s\S]*?)\n\}/);
assert(setMode, 'shelf mode setter should exist');
assert.match(setMode[1], /if \(m !== 'side'\)/);
assert.match(setMode[1], /controlsShelfSuppressUntil = 0/);
assert.match(setMode[1], /setShelfPinnedOpen\(false, true\)/);
assert.match(setMode[1], /m === 'stage'.*revealBottomControls\(900\)/);

console.log('shelf stage controls tests passed');
