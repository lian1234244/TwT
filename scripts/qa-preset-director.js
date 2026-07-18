const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'qa', 'preset-director');
const appUrl = process.env.MINERADIO_QA_URL || 'http://127.0.0.1:3000/';
const presets = [
  { id: 7, name: 'lyric-field' },
  { id: 8, name: 'magnetic-field' },
  { id: 9, name: 'magazine' },
  { id: 10, name: 'star-track' }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prepareFixture(win, preset) {
  return win.webContents.executeJavaScript(`
    (() => {
      const splash = document.getElementById('splash');
      if (splash) splash.style.display = 'none';
      document.body.classList.remove('splash-active', 'splash-revealing');
      window.__mineradioQaTime = 14.8;
      try {
        Object.defineProperty(audio, 'currentTime', {
          configurable: true,
          get: () => window.__mineradioQaTime,
          set: (value) => { window.__mineradioQaTime = Number(value) || 0; }
        });
      } catch (_) {}
      playQueue = [{
        id: 'preset-director-qa',
        name: 'Signal Atlas',
        artist: 'Mineradio QA',
        provider: 'local',
        url: 'https://example.invalid/mineradio-qa.mp3',
        pic: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
      }];
      currentIdx = 0;
      applyLyricsState([
        { t: 0, duration: 4, text: '夜色沿着唱针缓慢展开', translation: 'The night unfolds along the needle' },
        { t: 4, duration: 4, text: 'We keep the quiet signal alive', translation: '让安静的讯号继续发亮' },
        { t: 8, duration: 4, text: '風の中で名前を呼んだ', translation: '在风里呼唤你的名字' },
        { t: 12, duration: 6, text: '光落在城市边缘，呼吸与节拍重新相遇', translation: 'Light meets the pulse at the edge of the city' },
        { t: 18, duration: 6, text: 'Every fractured color finds its rhythm', translation: '每一种破碎的颜色都找到了节奏' },
        { t: 24, duration: 6, text: '磁场把遥远的句子拉回身边', translation: 'The field pulls distant words closer' },
        { t: 30, duration: 6, text: '끝나지 않은 노래가 천천히 번진다', translation: '未完的歌缓慢扩散' },
        { t: 36, duration: 6, text: '下一页，仍然保留一点未说完的光', translation: 'The next page keeps an unfinished glow' }
      ], false, 'qa');
      fx.lyricGlow = true;
      fx.lyricGlowBeat = true;
      fx.lyricGlowStrength = 0.42;
      fx.lyricScale = 1;
      fx.lyricFieldOpacity = 0.28;
      fx.magazineMeta = true;
      fx.starTrackMeta = true;
      setPreset(${preset}, { noSave: true, silent: true, skipTransition: true });
      if (${preset} === 7 || ${preset} === 8) {
        lyricFieldState.source = null;
        tickLyricField(1 / 60);
      } else if (${preset} === 9) {
        magazineLyricState.sourceKey = '';
        tickMagazineLyrics(1 / 60);
      } else {
        starTrackState.sourceKey = '';
        tickStarTrackLyrics(1 / 60);
      }
      const selector = ${preset} < 9 ? '#lyric-field' : (${preset} === 9 ? '#magazine-lyrics' : '#star-track-lyrics');
      const stage = document.querySelector(selector);
      const rect = stage && stage.getBoundingClientRect();
      return {
        preset: fx.preset,
        classes: document.body.className,
        stage: rect ? { width: rect.width, height: rect.height, opacity: getComputedStyle(stage).opacity } : null,
        activeText: ${preset} < 9
          ? document.getElementById('lyric-field-active-base')?.textContent
          : (${preset} === 9 ? document.getElementById('magazine-current-base')?.textContent : document.getElementById('star-track-current-base')?.textContent)
      };
    })()
  `);
}

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });
  const win = new BrowserWindow({
    show: false,
    width: 1536,
    height: 960,
    backgroundColor: '#050508',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
      offscreen: true
    }
  });

  const errors = [];
  const diagnostics = [];
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) errors.push(`${sourceId || 'page'}:${line || 0} ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    errors.push(`render-process-gone: ${details.reason}`);
  });

  await win.loadURL(appUrl);
  await sleep(1200);
  for (const preset of presets) {
    diagnostics.push(await prepareFixture(win, preset.id));
    await sleep(900);
    win.webContents.invalidate();
    await win.webContents.capturePage();
    await sleep(120);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, `${preset.name}.png`), image.toPNG());
    await win.webContents.executeJavaScript(`
      (() => {
        document.body.classList.remove('simple-mode');
        document.body.classList.add('desktop-shell', 'diy-mode');
        diyPlayerMode = true;
        organizeFxPanel();
        updateFxInputs();
        setFxPanelTab('motion');
        const panel = document.getElementById('fx-panel');
        if (panel) {
          panel.classList.remove('peek', 'closing');
          panel.classList.add('show');
          panel.style.setProperty('display', 'block', 'important');
          panel.style.setProperty('right', '24px', 'important');
          panel.style.setProperty('opacity', '1', 'important');
          panel.style.setProperty('pointer-events', 'auto', 'important');
        }
        const targetId = ${preset.id} === 7 ? 'lyric-field-preset-controls'
          : (${preset.id} === 8 ? 'magnetic-field-preset-controls'
          : (${preset.id} === 9 ? 'magazine-preset-controls' : 'star-track-preset-controls'));
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
      })()
    `);
    await sleep(260);
    win.webContents.invalidate();
    const controlsImage = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outputDir, `controls-${preset.name}.png`), controlsImage.toPNG());
    await win.webContents.executeJavaScript(`
      (() => {
        const panel = document.getElementById('fx-panel');
        panel?.classList.remove('show', 'peek');
        panel?.style.removeProperty('display');
        panel?.style.removeProperty('right');
        panel?.style.removeProperty('opacity');
        panel?.style.removeProperty('pointer-events');
        document.body.classList.remove('desktop-shell', 'diy-mode');
        document.body.classList.add('simple-mode');
      })()
    `);
  }
  fs.writeFileSync(path.join(outputDir, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2), 'utf8');
  const actionableErrors = errors.filter((message) => !message.includes("Failed to construct 'URL': Invalid URL"));
  fs.writeFileSync(path.join(outputDir, 'runtime-errors.txt'), errors.join('\n'), 'utf8');
  if (actionableErrors.length) {
    throw new Error(`Preset director QA found ${actionableErrors.length} runtime error(s).`);
  }
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exitCode = 1;
    app.quit();
  });
