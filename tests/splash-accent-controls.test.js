const assert = require('assert');
const fs = require('fs');
const path = require('path');

const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert.match(uiSource, /id="splash-accent-picker"/);
assert.match(uiSource, /id="splash-accent-value"/);
assert.match(uiSource, /splashAccentColor: '#7ad7c2'/);
assert.match(uiSource, /splashAccentColor: normalizeHexColor\(raw\.splashAccentColor/);
assert.match(uiSource, /splashAccentColor: normalizeHexColor\(fx\.splashAccentColor/);
assert.match(uiSource, /function setSplashAccentColor/);
assert.match(uiSource, /uniform vec3 uAccent/);
assert.match(uiSource, /uniform3f\(splashGlUniforms\.accent/);
assert.match(uiSource, /\.splash-word-radio\{background-image:/);
assert.doesNotMatch(uiSource, /\.splash-word-radio\{background:linear-gradient\(94deg,rgba\(255,255,255,\.06\)/);
assert.doesNotMatch(uiSource, /id="t-wallpaperMode"/);
assert.doesNotMatch(uiSource, /id="fx-wallpaperopacity"/);

console.log('splash accent controls tests passed');
