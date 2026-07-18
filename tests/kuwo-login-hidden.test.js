const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'scripts', 'pack-preview.js'), 'utf8');

for (const id of ['login-provider-kuwo', 'user-provider-kuwo', 'account-add-kuwo']) {
  assert.doesNotMatch(ui, new RegExp(`id=["']${id}["']`), `${id} must not remain in the visible login UI`);
}

assert.match(ui, /var LOGIN_UI_PROVIDERS = \['netease','qq','kugou'\]/);
const startupBegin = ui.indexOf('var startupLoginStatusPromise = Promise.all([');
const startupEnd = ui.indexOf('startQQLoginStatusAutoRefresh();', startupBegin);
assert.ok(startupBegin >= 0 && startupEnd > startupBegin, 'Startup login status block must remain detectable');
assert.doesNotMatch(
  ui.slice(startupBegin, startupEnd),
  /refreshExtendedLoginStatus\('kuwo'\)/,
  'Startup must not probe the disabled Kuwo login',
);
assert.match(preview, /Kuwo login UI disabled/);

console.log('Kuwo login UI disabled tests passed');
