const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert(source.includes('var MAGAZINE_LYRIC_PRESET_INDEX = 9;') && source.includes('var STAR_TRACK_LYRIC_PRESET_INDEX = 10;'), 'new lyric presets need stable indexes');
assert(source.includes("{ name: '杂志排版', desc: '动态海报 · 安静叙事' }") && source.includes("{ name: '音轨星图', desc: '路径歌词 · 节奏巡航' }"), 'preset cards must be visible');
assert(source.includes('id="magazine-lyrics"') && source.includes('id="star-track-canvas"'), 'both visual layers must exist');
assert(source.includes('function tickMagazineLyrics(dt)') && source.includes('function tickStarTrackLyrics(dt)'), 'both presets need frame updates');
assert(source.includes('body.magazine-lyric-mode #magazine-preset-controls') && source.includes('body.star-track-lyric-mode #star-track-preset-controls'), 'preset-specific controls must only appear for their preset');

const persisted = [
  'lyricTextureStrength', 'lyricTextureBeat',
  'magazineLayout', 'magazineSpacing', 'magazineAlign', 'magazineTransition', 'magazineMeta',
  'starTrackShape', 'starTrackSpeed', 'starTrackCurve', 'starTrackSpacing', 'starTrackRhythm', 'starTrackBrightness', 'starTrackMeta',
];
for (const key of persisted) {
  const hits = source.match(new RegExp(`\\b${key}\\b`, 'g')) || [];
  assert(hits.length >= 5, `${key} must cover defaults, local storage, archives, controls, and rendering`);
}
assert(source.includes("magazineLayout: archiveMode(raw, 'magazineLayout'") && source.includes("starTrackShape: archiveMode(raw, 'starTrackShape'"), 'user archive normalization must include preset modes');
assert(source.includes("['fx-magazinespacing','magazineSpacing']") && source.includes("['fx-startrackbrightness','starTrackBrightness']"), 'preset sliders must use the shared persisted binding path');
assert(source.includes('setMagazineLyricMode(p === MAGAZINE_LYRIC_PRESET_INDEX)') && source.includes('setStarTrackLyricMode(p === STAR_TRACK_LYRIC_PRESET_INDEX)'), 'preset switching must own visual layer visibility');
assert(source.includes('var lyricFieldPresetActive = isAnyFullscreenLyricPreset();') && source.includes('particles.visible = !skullPresetActive && !lyricFieldPresetActive;'), 'legacy particles must be suspended for fullscreen lyric presets');
assert(source.includes('if (isMagazineLyricPreset()) mask |= FRAME_TASK_MAGAZINE;') && source.includes('if (isStarTrackLyricPreset()) mask |= FRAME_TASK_STAR_TRACK;'), 'fullscreen lyric presets must use the active frame-task scheduler');
assert(source.includes('function fullscreenLyricSourceKey()') && source.includes('fullscreenLyricSourceKey(),fx.starTrackShape'), 'async lyric updates must invalidate editorial and star-track layouts');
assert(source.includes("id=\"t-starTrackMeta\"") && source.includes("meta.hidden=fx.starTrackMeta===false"), 'star-track needs a persisted song-info toggle');
assert(source.includes("root.style.setProperty('--mag-font-family',lyricFontStackForKey(fx.lyricFont))") && source.includes("root.style.setProperty('--star-font-family',lyricFontStackForKey(fx.lyricFont))"), 'shared lyric font controls must affect both new presets');
assert(source.includes("root.style.setProperty('--mag-glow-color'") && source.includes("root.style.setProperty('--star-glow-color'"), 'shared lyric glow color must affect both new presets');
assert(source.includes('var visibleStart=Math.max(0,index-18),visibleEnd=Math.min(starTrackState.layout.length,index+25);'), 'star-track rendering must be bounded near the camera focus');
assert(!source.includes('var diskBeatMap = bmKey ? await readBeatDiskCache(bmKey) : null;'), 'track switching must not wait for disk beat-cache I/O before audio starts');
assert(source.includes('function drawLyricDistressCuts(') && source.includes('function lyricDistressMaskUrl('), 'stone-print lyrics need a shared deterministic distress generator');
assert(source.includes('function getDistressedLyricCanvas(') && source.includes('drawDistressedStarTrackText(ctx,item,color)'), 'star-track canvas lyrics must use the shared cached distress surface');
assert(source.includes("applyLyricDistressSurface(document.getElementById('lyric-field')") && source.includes("applyLyricDistressSurface(root,text,'magazine')") && source.includes("applyLyricDistressSurface(root,text,'star-track')"), 'lyric-field, magnetic, magazine, and star-track focus text must share the distress surface');
assert(!source.includes('#lyric-field.distressed-lyric #lyric-field-active,') && !source.includes('#magazine-lyrics.distressed-lyric #magazine-current,'), 'distress masks must never clip a whole lyric wrapper into a rectangular glow surface');
assert(source.includes('#lyric-field-active-glow') && source.includes('#magazine-current-glow') && source.includes('#star-track-current-glow'), 'each DOM lyric preset needs an independent glyph-alpha glow layer');
assert(source.includes('filter:drop-shadow(') && source.includes('#lyric-field.distressed-lyric #lyric-field-active-base') && source.includes('#magazine-lyrics.distressed-lyric #magazine-current-base'), 'distress belongs on text layers while glow follows glyph alpha');
assert(source.includes("['fx-lyrictexture','lyricTextureStrength']") && source.includes("id=\"t-lyricTextureBeat\""), 'visual console must expose persisted distress strength and beat response controls');
assert(source.includes('function updateLyricRhythmEnvelope(dt)') && source.includes('function lyricGlowVisual(strength)'), 'all lyric presets need one smoothed rhythm and glow response');
assert(source.includes('updateLyricRhythmEnvelope(dt);') && source.includes('var rhythm=lyricRhythmEnvelope'), 'the shared lyric rhythm envelope must update once per frame and drive each DOM preset');
assert(!source.includes('transform:scale(var(--mag-spacing,1))'), 'magazine spacing must not scale the whole layout beyond its safe viewport');
assert(source.includes('function fitMagazineLyricText(text)') && source.includes('fitMagazineLyricText(text);'), 'magazine lyrics must fit long lines to their actual grid width');
assert(source.includes('function fitLyricPresetFont(text,base,width,maxLines,min)') && source.includes('fitLyricPresetFont(text,base,width,2,26)'), 'all new lyric presets need measured font fitting, not character-count guesses alone');
assert(/#magazine-current-progress\{[^}]*mask-image:none!important[^}]*clip-path:inset/s.test(source), 'magazine progress must clip glyph paint without rectangular mask surfaces');
assert(/#star-track-current-progress\{[^}]*mask-image:none!important[^}]*clip-path:inset/s.test(source), 'star-track progress must clip glyph paint without rectangular mask surfaces');
assert(source.includes("--mag-line-height',Math.max(1.12,lyricLineHeightFactor())") && source.includes("--star-line-height',Math.max(1.12,lyricLineHeightFactor())"), 'new lyric presets need a safe line-height floor for every font family');

console.log('editorial and star-track preset contract tests passed');
