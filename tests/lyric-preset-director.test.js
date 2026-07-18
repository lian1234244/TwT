const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert(source.includes('function lyricDirectorFrame(kind, time, progress, index)'), 'fullscreen lyric presets need one shared director frame');
assert(source.includes('lyricRhythmEnvelope.onset'), 'director must use a smoothed onset signal');

const persisted = [
  'lyricFieldDirector', 'lyricFieldFocus', 'lyricFieldTrail', 'lyricFieldInertia',
  'magneticMode', 'magneticGravity', 'magneticDamping', 'magneticAnticipation',
  'magazineDirector', 'magazineTransitionMode', 'magazineTension', 'magazineRhythm',
  'starTrackCamera', 'starTrackTrail', 'starTrackPulse',
];
for (const key of persisted) {
  const hits = source.match(new RegExp(`\\b${key}\\b`, 'g')) || [];
  assert(hits.length >= 5, `${key} must cover defaults, restore, archives, controls, and rendering`);
}

assert(source.includes('id="lyric-field-preset-controls"') && source.includes('id="magnetic-field-preset-controls"'), 'field presets need separate director controls');
assert(source.includes('data-magazine-director="narrative"') && source.includes('data-magazine-transition="auto"'), 'magazine needs semantic director controls');
assert(source.includes('data-star-track-camera="follow"') && source.includes('id="fx-startracktrail"'), 'star track needs camera and trail controls');
assert(source.includes("setFieldDirector(btn.dataset.fieldDirector)") && source.includes("setMagazineDirector(btn.dataset.magazineDirector)"), 'director segments must be bound');
assert(source.includes("archiveMode(raw, 'magazineDirector'") && source.includes("archiveMode(raw, 'starTrackCamera'"), 'director modes must survive archive import');
assert(source.includes("lyricDirectorFrame('magazine'") && source.includes("lyricDirectorFrame('star'") && source.includes("lyricDirectorFrame(magnetic ? 'magnetic' : 'field'"), 'all four presets must consume the shared director');

console.log('lyric preset director contract tests passed');
