const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert.match(source, /var EMILY_CUSTOM_COVER_PRESET_INDEX = 11;/);
assert.match(source, /emily自定义封面/);
assert.match(source, /var presetDisplayOrder = \[0, 11,/);
assert.match(source, /id="emily-custom-cover-controls"/);
assert.match(source, /id="emily-custom-cover-input"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(source, /function shaderPresetForFxPreset\(preset\)[\s\S]*EMILY_CUSTOM_COVER_PRESET_INDEX[\s\S]*return 0/);
assert.match(source, /function applyEmilyCustomParticleCover\(/);
assert.match(source, /preserveUiCover: true/);
assert.match(source, /function openCoverCropModal\(img, dataUrl, purpose\)/);
assert.match(source, /purpose: purpose === 'emily-particles' \? 'emily-particles' : 'song-cover'/);
assert.match(source, /coverCropState\.purpose === 'emily-particles'/);
assert.match(source, /emilyCustomCover: normalizeEmilyCustomCover\(raw\.emilyCustomCover\)/);
assert.match(source, /emilyCustomCover: normalizeEmilyCustomCover\(fx\.emilyCustomCover\)/);
assert.match(source, /fx\.emilyCustomCover = data\.emilyCustomCover/);

console.log('Emily custom particle cover contract tests passed');
