const assert = require('assert');
const fs = require('fs');
const path = require('path');

const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert.match(uiSource, /USER_FX_ARCHIVE_SCHEMA = 5/);
assert.match(uiSource, /splashAccentColor: normalizeHexColor\(raw\.splashAccentColor/);
assert.match(uiSource, /backgroundImage: normalizedBackgroundImage/);
assert.match(uiSource, /backgroundMedia: normalizedBackgroundMedia/);
assert.match(uiSource, /wallpaper: normalizedWallpaper/);
assert.match(uiSource, /function captureFxArchiveSnapshot\(\)/);
assert.match(uiSource, /wallpaper:\s*\{\s*currentId: activeWallpaperId/);
assert.match(uiSource, /wallpaperLibraryState\.currentId = wallpaper\.currentId \|\| ''/);
assert.match(uiSource, /setSplashAccentColor\(data\.splashAccentColor, true\)/);
assert.match(uiSource, /function restoreArchivedWallpaperMedia\([\s\S]*?setCustomBackgroundMedia\(media, true\)/);
assert.match(uiSource, /restoreArchivedWallpaperMedia\(data\.wallpaper, data\.backgroundMedia \|\| data\.backgroundImage\)/);
assert.match(uiSource, /完整保存视觉、音效、背景与入场设置/);

console.log('user FX archive completeness tests passed');
