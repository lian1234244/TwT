const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert(
  /#lyric-field-active-highlight\{[^}]*clip-path:inset\([^}]*var\(--lyric-field-progress/s.test(source),
  'lyric-field highlight must clip only the painted glyph layer',
);
assert(
  !/#lyric-field-active-shine\{[^}]*clip-path:/s.test(source),
  'lyric-field shine must not use a hard clip-path beam',
);
assert(
  !/#lyric-field-active-highlight\{[^}]*-webkit-mask-image:/s.test(source),
  'lyric-field progress must avoid whole-element mask compositing artifacts',
);
assert(
  source.includes('motionPulse: 0') && source.includes('motionBass: 0') && source.includes('motionKick: 0'),
  'lyric-field needs smoothed local music-response state',
);
assert(
  source.includes('updateLyricFieldMotion(time, dt)'),
  'lyric-field motion needs frame-time smoothing',
);
assert(
  source.includes('beatCam.punch') && source.includes('cameraBeat'),
  'lyric-field rhythm needs the same beat-camera impulse used by the Emily preset',
);
assert(
  /#lyric-field-active\{[^}]*line-height:1\.26/s.test(source)
    && /\.lyric-field-text\{[^}]*padding:\.12em \.10em \.30em/s.test(source),
  'lyric-field text needs enough line-box room for Latin descenders',
);

console.log('lyric-field motion contract tests passed');
