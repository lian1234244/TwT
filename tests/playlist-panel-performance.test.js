const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'index.html'), 'utf8');
const panelRule = html.match(/#playlist-panel\{([^}]*)\}/);
const queueRule = html.match(/\.queue-item\{([^}]*)\}/);

assert(panelRule, 'playlist panel CSS rule missing');
assert(!/transition:[^;}]*\bleft\b/.test(panelRule[1]), 'playlist panel must not animate layout through left');
assert(/transform:translate3d/.test(panelRule[1]), 'playlist panel must use compositor transform');
assert(/contain:layout paint style/.test(panelRule[1]), 'playlist panel must isolate layout and paint');

assert(queueRule, 'queue item CSS rule missing');
assert(/content-visibility:auto/.test(queueRule[1]), 'offscreen queue items must skip rendering');
assert(!/will-change/.test(queueRule[1]), 'queue items must not keep permanent compositor layers');

assert(html.includes("schedulePlaylistPanelOpenWork(el);"), 'playlist panel heavy work must be deferred until after opening');
assert(html.includes("data-queue-index=\"' + i + '\""), 'queue rows need stable indices for selection-only updates');
assert(html.includes('function updateQueueCurrentState()'), 'selection-only queue update is missing');

console.log('playlist panel performance contract tests passed');
