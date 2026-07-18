const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  "eqEnabled: raw.eqEnabled === true",
  "eqPreset: normalizeEqualizerPreset(raw.eqPreset)",
  "eqPreamp: archiveNumber(raw, 'eqPreamp', fxDefaults.eqPreamp, -12, 6)",
  'eqBands: normalizeEqualizerBands(raw.eqBands)',
  "var ACTIVE_USER_FX_ARCHIVE_STORE_KEY = 'mineradio-active-user-fx-archive-v1'",
  "setActiveUserFxArchiveId(slot.id)",
  "(isCurrent ? ' is-current' : '')",
  "aria-current=\"true\"",
  ".user-archive-slot.is-current",
  "if (slot.id === activeUserFxArchiveId) setActiveUserFxArchiveId('')",
].forEach((contract) => {
  assert(source.includes(contract), `missing user archive EQ contract: ${contract}`);
});

assert(source.includes('updateEqualizerControls();\n  applyEqualizerAudio();'), 'archive apply path must refresh EQ UI and audio through updateFxInputs');
assert(source.includes('完整保存视觉、音效、背景与入场设置'), 'archive copy should describe its complete scope');

console.log('user archive equalizer contract tests passed');
