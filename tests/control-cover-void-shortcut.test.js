const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  'aria-label="双击切换虚空桌面模式"',
  "cover.addEventListener('dblclick', toggleControlCoverVoidDesktopMode)",
  'function toggleControlCoverVoidDesktopMode(event)',
  "setPreset(3, { silent:true, preserveCamera:false, skipTransition:true })",
  'setDesktopTransparency(true, true)',
  'CONTROL_COVER_VOID_STATE_KEY',
  "cover.classList.toggle('void-desktop-active', active)",
  'bindControlCoverVoidShortcut();',
].forEach((contract) => {
  assert(source.includes(contract), `missing control-cover void shortcut contract: ${contract}`);
});

assert(source.includes("showToast('已恢复进入前的视觉与背景')"), 'shortcut must support restoring the previous state');

console.log('control cover void shortcut contract tests passed');
