const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  'function isCompositeVisualLoadActive()',
  'function markUiInteractionQoS(reason, holdMs)',
  'function isUiInteractionQoSActive(now)',
  'function bindUiInteractionQoS()',
  "document.body.classList.toggle('ui-interaction-qos', active)",
  "markUiInteractionQoS('ui-wheel'",
  "markUiInteractionQoS('ui-range'",
  'if (isUiInteractionQoSActive() && isCompositeVisualLoadActive())',
  'window.MineradioRenderPerformancePolicy.interactionFps(tier)',
  'bindUiInteractionQoS();',
].forEach((contract) => {
  assert(source.includes(contract), `missing interaction QoS contract: ${contract}`);
});

assert(source.includes('body.ui-interaction-qos .home-card'), 'decorative Home motion should pause during interaction QoS');
assert(source.includes('UI_INTERACTION_QOS_HOLD_MS = 650'), 'interaction recovery delay must remain explicit and testable');

console.log('interaction QoS contract tests passed');
