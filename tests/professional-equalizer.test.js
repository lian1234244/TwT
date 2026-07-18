const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  'id="eq-response-canvas"',
  'id="eq-headroom-status"',
  'class="eq-band-fader"',
  "pop: { label:'流行增强'",
  "bass: { label:'低频下潜'",
  "vocal: { label:'人声靠前'",
  "bright: { label:'清晰通透'",
  "night: { label:'柔和夜听'",
  'audioCtx.createDynamicsCompressor()',
  'equalizerLimiter.ratio.setTargetAtTime(enabled ? 20 : 1',
  'function drawEqualizerDisplay(nowMs)',
  'function setEqualizerBandFromCanvas(index, clientY, canvas)',
  "fx.eqPreset = 'pop';",
  'drawEqualizerDisplay(now);',
].forEach((contract) => {
  assert(source.includes(contract), `missing professional equalizer contract: ${contract}`);
});

assert(source.includes('grid-template-columns:repeat(10,minmax(0,1fr))'), 'equalizer must retain a stable ten-band layout');
assert(!source.includes('class="fx-toggle" id="t-eqEnabled"'), 'legacy generic equalizer toggle should be removed');

console.log('professional equalizer contract tests passed');
