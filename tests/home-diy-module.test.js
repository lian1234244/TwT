const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

[
  'id="home-diy-clock"',
  'id="home-diy-date"',
  'id="home-diy-temp"',
  'id="home-diy-location"',
  'id="home-diy-wallpaper-status"',
  'id="home-audio-wave-canvas"',
  'id="home-audio-signal-track"',
  'id="home-now-title"',
  'id="home-now-lyric"',
  'id="home-now-progress-fill"',
  'function renderHomeDiy()',
  'function drawHomeAudioWaveform(nowMs, force)',
  'function updateHomeNowPlaying(song, live)',
  'function seekFromHomeProgress(event)',
  'function toggleHomeNowPlaying(event)',
  "document.body.classList.contains('empty-home-active')",
  'timeDomainData',
  'function chooseHomeWallpaper()',
  'function refreshHomeDiyWeather()',
  'function updateHomeDiyWallpaperStatus()',
  'syncHomeDiyClock(show)',
  'updateHomeDiyWallpaperStatus();',
  'Date.now() - homeWeatherRadioState.updatedAt > 20 * 60 * 1000',
].forEach((contract) => {
  assert(source.includes(contract), `missing Home DIY contract: ${contract}`);
});

assert(!source.includes('此处施工，敬请期待'), 'construction placeholder should be removed');
assert(source.includes("document.getElementById('background-image-input')"), 'wallpaper picker must reuse the existing background input');
assert(source.includes('locateWeatherRadio()'), 'Home DIY must expose local weather location');

console.log('home DIY module contract tests passed');
