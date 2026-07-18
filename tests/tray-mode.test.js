const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const runtimeTrayIcon = path.join(__dirname, '..', 'desktop', 'assets', 'icon.ico');

assert.match(mainSource, /Menu, Tray/);
assert.match(mainSource, /function hideMainWindowToTray/);
assert.match(mainSource, /function loadTrayIcon/);
assert.match(mainSource, /Tray creation failed/);
assert.doesNotMatch(mainSource, /new Tray\(APP_ICON_ICO\)/);
assert.match(mainSource, /tray\.on\('double-click', restoreMainWindowFromTray\)/);
assert.match(mainSource, /label: '上一首'/);
assert.match(mainSource, /label: '下一首'/);
assert.match(mainSource, /label: '退出'/);
assert.match(mainSource, /appIsQuitting/);
assert.match(mainSource, /mineradio-tray-playback-state/);
assert.match(preloadSource, /onTrayAction/);
assert.match(preloadSource, /updateTrayPlaybackState/);
assert.match(uiSource, /function executeTrayAction/);
assert.match(uiSource, /function syncBackgroundMediaPowerState/);
assert.match(uiSource, /runtimePausedBackgroundVideo/);
assert.ok(fs.existsSync(runtimeTrayIcon), 'packaged runtime tray icon is missing');

console.log('tray mode tests passed');
