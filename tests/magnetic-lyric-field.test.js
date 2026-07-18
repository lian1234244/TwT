const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert(
  source.includes('var LYRIC_FIELD_PRESET_INDEX = 7;')
    && source.includes('var MAGNETIC_LYRIC_FIELD_PRESET_INDEX = 8;'),
  'magnetic lyric field must be independent while preserving the classic preset index',
);
assert(
  source.includes("{ name: '磁性词场', desc: '歌词引力 · 景深追焦' }"),
  'preset grid must expose magnetic lyric field as its own card',
);
assert(
  source.includes('function isAnyLyricFieldPreset()')
    && source.includes("document.body.classList.toggle('magnetic-lyric-field-mode'"),
  'shared lyric-field routing and the magnetic visual state must both exist',
);
assert(
  source.includes('var depthBand = decorative ? 0 : (lineDistance <= 3 ? 2 : 1);')
    && source.includes('depthBand === 0 ? 0.52')
    && source.includes('depthBand === 1 ? 0.76'),
  'magnetic lyric field needs three distinct parallax depth bands',
);
assert(
  source.includes('var anticipationStart = 1 - clampRange(Number(fx.magneticAnticipation) || 0.68, 0, 1) * 0.47;')
    && source.includes('var dampingAmount = clampRange(Number(fx.magneticDamping) || 1, .55, 1.55);')
    && source.includes('var gravity = clampRange(Number(fx.magneticGravity) || 1, .45, 1.65);')
    && source.includes('cameraVX')
    && source.includes('var damping = Math.exp(-dt * 8.4 * dampingAmount);'),
  'magnetic camera must expose persisted anticipation, gravity, and damped spring motion',
);
assert(
  /#lyric-field-focus\{[^}]*--lyric-field-focus-offset-x[^}]*--lyric-field-focus-offset-y/s.test(source)
    && !/#lyric-field-focus\{[^}]*transition:[^}]*left/s.test(source),
  'magnetic focus needs compositor-only two-axis positioning without left/top transitions',
);
assert(
  source.includes('id="lyric-field-active-glyphs"')
    && source.includes('function splitMagneticLyricSegments(text)')
    && source.includes("/[A-Za-z0-9]+(?:['’\\-][A-Za-z0-9]+)*|\\s+|./gu")
    && source.includes('function rebuildMagneticLyricGlyphs(text)')
    && source.includes("glyph.className = 'lyric-field-glyph'")
    && source.includes("currentGlyph.style.setProperty('--lyric-field-glyph-scale'"),
  'magnetic lyric field needs a language-aware current-word attraction layer',
);
assert(
  /body\.magnetic-lyric-field-mode #lyric-field-active\.glyphs-ready #lyric-field-active-base,body\.magnetic-lyric-field-mode #lyric-field-active\.glyphs-ready #lyric-field-active-glow,body\.magnetic-lyric-field-mode #lyric-field-active\.glyphs-ready #lyric-field-active-highlight\{opacity:0\}/.test(source)
    && source.includes("glyphNode.classList.toggle('past'")
    && /body\.magnetic-lyric-field-mode \.lyric-field-glyph\.past\{opacity:0/.test(source),
  'magnetic word motion must hide the duplicate base layer and already-played segments',
);
assert(
  source.includes("lyricFieldState.active.classList.toggle('glyphs-ready', lyricFieldState.glyphNodes.length > 0)")
    && source.includes('body.magnetic-lyric-field-mode #lyric-field-active.glyphs-ready #lyric-field-active-base')
    && !source.includes("#lyric-field.distressed-lyric .lyric-field-glyph:not(.current)"),
  'magnetic lyrics need a visible fallback and must never let a per-glyph distress mask erase short words',
);
assert(
  source.includes('var pixelBudget = isMagneticLyricFieldPreset() ? 3400000 : 5200000;')
    && source.includes('Number(fx.preset) === MAGNETIC_LYRIC_FIELD_PRESET_INDEX) return false;'),
  'magnetic mode must avoid oversized background canvases and inappropriate composite-load frame caps',
);

console.log('magnetic lyric-field contract tests passed');
