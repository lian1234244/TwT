const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  'id="app-visual-fps-seg"',
  'data-app-visual-fps="-1">自动',
  'data-app-visual-fps="24">24',
  'data-app-visual-fps="30">30',
  'data-app-visual-fps="60">60',
  'data-app-visual-fps="120">120',
  'data-app-visual-fps="0">无上限',
  'appVisualFps: -1',
  'function normalizeAppVisualFps(value)',
  'function setAppVisualFps(value, silent)',
  'appVisualFps: normalizeAppVisualFps(fx.appVisualFps)',
  "setAppVisualFps(btn.getAttribute('data-app-visual-fps'))",
  'var selectedFps = normalizeAppVisualFps(fx && fx.appVisualFps)',
].forEach((contract) => {
  assert(source.includes(contract), `missing app visual FPS contract: ${contract}`);
});

console.log('app visual FPS control contract tests passed');
