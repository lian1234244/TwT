const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  'id="home-cassette-deck"',
  'id="home-cassette-label"',
  'id="home-cassette-counter"',
  'id="home-cassette-prev"',
  'id="home-cassette-play"',
  'id="home-cassette-next"',
  'id="home-cassette-volume"',
  'data-cassette-reel="left"',
  'data-cassette-reel="right"',
  'function bindHomeCassetteDeck()',
  'function updateHomeCassetteDeck(nowMs, force)',
  'function finishHomeCassetteDrag(event, commit)',
  'function updateHomeCassetteVolumeUi()',
].forEach((needle) => assert(source.includes(needle), `Missing cassette deck contract: ${needle}`));

assert(source.includes('updateHomeCassetteDeck(now);'), 'Cassette deck must share the existing Home frame task');
assert(source.includes("'.home-cassette-deck',") && source.includes('function isHomeBlankDismissClick(e)'), 'Cassette interaction must not dismiss Home');
assert(source.includes("audio.currentTime = homeCassetteState.previewRatio * audio.duration;"), 'Cassette drag must commit playback position');
assert(source.includes("event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'"), 'Cassette reels must support keyboard seeking');
assert(source.includes("prevButton.addEventListener('click'") && source.includes('playHomeCassetteAdjacent(-1);'), 'Cassette previous button must use the Home-preserving playback path');
assert(source.includes("playButton.addEventListener('click'") && source.includes('toggleHomeNowPlaying(event);'), 'Cassette play button must use the shared playback core');
assert(source.includes("nextButton.addEventListener('click'") && source.includes('playHomeCassetteAdjacent(1);'), 'Cassette next button must use the Home-preserving playback path');
assert(source.includes("volumeKnob.addEventListener('wheel'") && source.includes('setVolume(nextVolume, true);'), 'Cassette volume knob must use the shared persistent volume core');
assert(source.includes("event.stopPropagation();\n      setVolume(nextVolume, true);"), 'Cassette volume keyboard control must not double-trigger global shortcuts');
assert(source.includes("playQueueAt(currentIdx, { preserveHomeState: true, source: 'home-cassette' })"), 'Cassette track switching must preserve Home');
assert(source.includes("if (!opts.preserveHomeState) homeForcedOpen = false;"), 'Playback core must honor preserveHomeState before changing Home state');
assert(source.includes("if (!opts.preserveHomeState) switchPlaybackVisualToEmily();"), 'Home-preserving playback must not replace the Home visual surface');
assert(source.includes("playAudio({ silent: isQQPlayback, preserveHomeState: !!opts.preserveHomeState })"), 'Home preservation must reach the async audio start path');
assert(source.includes("if (opts.preserveHomeState && token === trackSwitchToken)"), 'Playback completion must verify that Home remains open');
assert(source.includes("function shouldPreserveHomePlaybackSurface()"), 'Audio events must recognize the Home playback surface');
assert(source.includes("shell.style.setProperty('--cassette-art'"), 'Cassette ambience must follow the current song cover');
assert(source.includes('@media (max-height:700px){.home-cassette-deck{display:none}}'), 'Cassette deck must yield space on short windows');
assert(source.includes('@media (max-width:620px)') && source.includes('.home-cassette-deck{display:none}'), 'Cassette deck must yield space on narrow windows');
assert(source.includes("'(prefers-reduced-motion: reduce)'"), 'Cassette reel motion must respect reduced motion');
assert(!source.includes('setInterval(updateHomeCassetteDeck'), 'Cassette deck must not create a competing timer');
assert(!source.includes('requestAnimationFrame(updateHomeCassetteDeck'), 'Cassette deck must not create a competing RAF loop');

console.log('home cassette deck test passed');
