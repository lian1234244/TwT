const { app, BrowserWindow, ipcMain, shell, screen, session, globalShortcut, dialog, Menu, Tray, nativeImage } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { obsCanvasSize, obsClientCrop } = require('./wallpaper-capture-geometry');
const { waitForObsRecordStart, nextObsCaptureProfile } = require('./wallpaper-obs-state');
const { isAllowedPermissionCheck, isAllowedPermissionRequest } = require('./permission-policy');
const { fitLoginWindowBounds } = require('./login-window-policy');
const { chromiumPerformanceSwitches } = require('./startup-policy');

let mainWindow = null;
let localServer = null;
let mainServerPort = 0;
let desktopLyricsWindow = null;
let desktopLyricsState = {};
let desktopLyricsUserBounds = null;
let desktopLyricsProgrammaticMove = false;
let desktopLyricsPointerCapture = false;
let desktopLyricsMouseIgnored = null;
let desktopLyricsMousePoller = null;
let desktopLyricsMousePollerBuffer = '';
let desktopLyricsHotBounds = null;
let desktopLyricsLastMiddleAt = 0;
let wallpaperWindow = null;
let wallpaperState = {};
let htmlFullscreenActive = false;
let windowFullscreenActive = false;
let mainWindowStateTimer = null;
const registeredGlobalHotkeys = new Map();
let tray = null;
let appIsQuitting = false;
let trayPlaybackState = { playing: false, muted: false };
let qqWebApiWindow = null;
let qqWebApiReady = null;
let qqWebApiIdleTimer = null;
let mainWindowCreation = null;
let mainPageReady = false;
let startupRecoveryStarted = false;
let startupFailureDialogShown = false;

const WINDOWED_ASPECT = 16 / 9;
const WINDOWED_SCALE = 3 / 4;
const WINDOWED_MARGIN = 32;
const MIN_WINDOWED_WIDTH = 960;
const MIN_WINDOWED_HEIGHT = 540;
const APP_NAME = 'Mineradio';
const APP_USER_MODEL_ID = 'com.mineradio.desktop';
const APP_ICON_CANDIDATES = [
  path.join(__dirname, 'assets', 'icon.ico'),
  path.join(__dirname, 'assets', 'icon.png'),
  path.join(__dirname, '..', 'build', 'icon.ico'),
  path.join(__dirname, '..', 'build', 'icon.png'),
];
const APP_ICON_ICO = APP_ICON_CANDIDATES.find((candidate) => fs.existsSync(candidate))
  || APP_ICON_CANDIDATES[0];
const NETEASE_LOGIN_PARTITION = 'persist:mineradio-netease-login';
const NETEASE_LOGIN_URL = 'https://music.163.com/#/login';
const QQ_LOGIN_PARTITION = 'persist:mineradio-qqmusic-login';
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile';
const KUWO_LOGIN_PARTITION = 'persist:mineradio-kuwo-login';
const KUWO_LOGIN_URL = 'https://www.kuwo.cn/';

const customUserDataArg = process.argv.find(arg => arg.startsWith('--mineradio-user-data-dir='));
if (customUserDataArg) {
  const customUserDataDir = path.resolve(customUserDataArg.slice('--mineradio-user-data-dir='.length));
  try {
    fs.mkdirSync(customUserDataDir, { recursive: true });
    app.setPath('userData', customUserDataDir);
  } catch (error) {
    console.error('Custom Mineradio user data directory rejected:', error.message);
  }
}

const CHROMIUM_PERFORMANCE_SWITCHES = chromiumPerformanceSwitches(process.env);
for (const [name, value] of CHROMIUM_PERFORMANCE_SWITCHES) {
  if (value == null) app.commandLine.appendSwitch(name);
  else app.commandLine.appendSwitch(name, value);
}
const SAFE_GPU_MODE = process.argv.includes('--mineradio-safe-gpu');
if (SAFE_GPU_MODE) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const QQ_LOGIN_COOKIE_PRIORITY = [
  'uin',
  'qqmusic_uin',
  'wxuin',
  'login_type',
  'qm_keyst',
  'qqmusic_key',
  'p_skey',
  'skey',
  'psrf_qqopenid',
  'psrf_qqunionid',
  'psrf_qqaccess_token',
  'psrf_qqrefresh_token',
  'wxopenid',
  'wxunionid',
  'wxrefresh_token',
  'wxskey',
  'p_uin',
  'ptcz',
  'RK',
];
const NETEASE_LOGIN_COOKIE_PRIORITY = [
  'MUSIC_U',
  '__csrf',
  'NMTID',
  'MUSIC_A',
  '__remember_me',
  '_ntes_nuid',
  '_ntes_nnid',
  'WEVNSM',
  'WNMCID',
  'JSESSIONID-WYYY',
];

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const tester = net.createServer();

      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryPort(port + 1);
          return;
        }
        reject(err);
      });

      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port, '127.0.0.1');
    }

    tryPort(startPort);
  });
}

function waitForServer(server) {
  if (!server || server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function startupLogPath() {
  try {
    return path.join(app.getPath('userData'), 'startup.log');
  } catch (error) {
    return path.join(process.env.TEMP || process.cwd(), 'Mineradio-startup.log');
  }
}

function appendStartupLog(stage, detail = '') {
  try {
    const file = startupLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > 256 * 1024) {
      fs.renameSync(file, `${file}.previous`);
    }
    const suffix = detail ? ` ${String(detail).replace(/[\r\n]+/g, ' ').slice(0, 1000)}` : '';
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${stage}${suffix}\n`, 'utf8');
  } catch (error) {}
}

function relaunchInSafeGpuMode(reason) {
  if (SAFE_GPU_MODE || startupRecoveryStarted || appIsQuitting) return false;
  startupRecoveryStarted = true;
  appendStartupLog('startup-recovery:safe-gpu', reason);
  app.relaunch({ args: [...process.argv.slice(1), '--mineradio-safe-gpu'] });
  appIsQuitting = true;
  app.exit(0);
  return true;
}

function handleStartupFailure(error) {
  const message = error && (error.stack || error.message) || String(error || 'UNKNOWN_STARTUP_ERROR');
  appendStartupLog('startup-failed', message);
  if (relaunchInSafeGpuMode(message)) return;
  if (startupFailureDialogShown) return;
  startupFailureDialogShown = true;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  const logFile = startupLogPath();
  dialog.showMessageBox({
    type: 'error',
    title: 'Mineradio 启动失败',
    message: 'Mineradio 未能完成启动。',
    detail: `请重新打开软件；若问题持续，请提供启动日志：\n${logFile}`,
    buttons: ['确定'],
    noLink: true,
  }).finally(() => {
    appIsQuitting = true;
    app.quit();
  });
}

function loadMainPageWithTimeout(win, url, timeoutMs = 30000) {
  let timeout = null;
  return Promise.race([
    win.loadURL(url),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`MAIN_PAGE_LOAD_TIMEOUT_${timeoutMs}`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

process.on('uncaughtException', error => {
  appendStartupLog('uncaught-exception', error && (error.stack || error.message));
  if (!mainPageReady) handleStartupFailure(error);
  else throw error;
});

process.on('unhandledRejection', error => {
  appendStartupLog('unhandled-rejection', error && (error.stack || error.message));
  if (!mainPageReady) handleStartupFailure(error);
});

function sendWindowState(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('desktop-window-state', getWindowState(win));
}

function sendGlobalHotkeyAction(action) {
  if (!mainWindow || mainWindow.isDestroyed() || !action) return;
  mainWindow.webContents.send('mineradio-global-hotkey', { action });
}

function sendTrayAction(action) {
  if (!mainWindow || mainWindow.isDestroyed() || !action) return;
  mainWindow.webContents.send('mineradio-tray-action', { action });
}

function restoreMainWindowFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  sendWindowState(mainWindow);
  return true;
}

function rebuildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Mineradio', click: restoreMainWindowFromTray },
    { type: 'separator' },
    { label: trayPlaybackState.playing ? '暂停' : '播放', click: () => sendTrayAction('togglePlay') },
    { label: '上一首', click: () => sendTrayAction('prevTrack') },
    { label: '下一首', click: () => sendTrayAction('nextTrack') },
    { label: trayPlaybackState.muted ? '取消静音' : '静音', click: () => sendTrayAction('toggleMute') },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        appIsQuitting = true;
        app.quit();
      },
    },
  ]));
}

function loadTrayIcon() {
  for (const candidate of APP_ICON_CANDIDATES) {
    if (!fs.existsSync(candidate)) continue;
    const icon = nativeImage.createFromPath(candidate);
    if (!icon.isEmpty()) return icon;
  }
  throw new Error(`No usable tray icon found in: ${APP_ICON_CANDIDATES.join(', ')}`);
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  try {
    tray = new Tray(loadTrayIcon());
    tray.setToolTip(APP_NAME);
    tray.on('double-click', restoreMainWindowFromTray);
    rebuildTrayMenu();
    return tray;
  } catch (error) {
    tray = null;
    console.error('Tray creation failed:', error);
    return null;
  }
}

function hideMainWindowToTray(win) {
  win = win || mainWindow;
  if (!win || win.isDestroyed()) return false;
  if (!createTray()) {
    win.minimize();
    sendWindowState(win);
    return false;
  }
  win.hide();
  sendWindowState(win);
  return true;
}

function unregisterMineradioGlobalHotkeys() {
  for (const accelerator of registeredGlobalHotkeys.keys()) {
    try { globalShortcut.unregister(accelerator); } catch (e) {}
  }
  registeredGlobalHotkeys.clear();
}

function configureMineradioGlobalHotkeys(bindings = []) {
  unregisterMineradioGlobalHotkeys();
  const results = [];
  const seen = new Set();
  for (const item of Array.isArray(bindings) ? bindings : []) {
    const action = item && String(item.action || '').trim();
    const accelerator = item && String(item.accelerator || '').trim();
    if (!action || !accelerator || seen.has(accelerator)) continue;
    seen.add(accelerator);
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => sendGlobalHotkeyAction(action));
    } catch (error) {
      registered = false;
    }
    if (registered) {
      registeredGlobalHotkeys.set(accelerator, action);
      results.push({ action, accelerator, ok: true });
    } else {
      results.push({
        action,
        accelerator,
        ok: false,
        conflict: {
          sourceName: '系统 / 其他软件',
          sourceIcon: 'warning',
          reason: '该组合键已被占用或被系统保留',
        },
      });
    }
  }
  return { ok: true, results };
}

function scheduleWindowStateSend(win, delay = 80) {
  if (!win || win.isDestroyed()) return;
  if (mainWindowStateTimer) clearTimeout(mainWindowStateTimer);
  mainWindowStateTimer = setTimeout(() => {
    mainWindowStateTimer = null;
    sendWindowState(win);
  }, delay);
}

function rectsOverlapOnY(a, b) {
  if (!a || !b) return false;
  const aTop = Number(a.y) || 0;
  const bTop = Number(b.y) || 0;
  const aBottom = aTop + (Number(a.height) || 0);
  const bBottom = bTop + (Number(b.height) || 0);
  return aBottom > bTop && bBottom > aTop;
}

function getDisplayState(win) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : primary;
  const bounds = display && display.bounds ? display.bounds : primary.bounds;
  const displayId = display && display.id;
  const primaryId = primary && primary.id;
  const edgeTolerance = 2;
  const hasDisplayOnLeft = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((candidate.bounds.x + candidate.bounds.width) - bounds.x) <= edgeTolerance;
  });
  const hasDisplayOnRight = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((bounds.x + bounds.width) - candidate.bounds.x) <= edgeTolerance;
  });
  return {
    displayId,
    primaryDisplayId: primaryId,
    isPrimaryDisplay: !!(display && primary && display.id === primary.id),
    hasDisplayOnLeft,
    hasDisplayOnRight,
    displayBounds: bounds ? {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    } : null,
  };
}

function getWindowState(win) {
  if (!win || win.isDestroyed()) return {
    isMaximized: false,
    isNativeFullScreen: false,
    isHtmlFullScreen: false,
    isWindowFullScreen: false,
    isFullScreen: false,
    isMinimized: false,
    isVisible: false,
    isFocused: false,
    isPrimaryDisplay: true,
    hasDisplayOnLeft: false,
    hasDisplayOnRight: false,
    displayBounds: null,
  };
  return {
    isMaximized: win.isMaximized(),
    isNativeFullScreen: win.isFullScreen(),
    isHtmlFullScreen: htmlFullscreenActive,
    isWindowFullScreen: windowFullscreenActive,
    isFullScreen: win.isFullScreen() || htmlFullscreenActive || windowFullscreenActive,
    isMinimized: win.isMinimized(),
    isVisible: win.isVisible(),
    isFocused: win.isFocused(),
    ...getDisplayState(win),
  };
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  sendWindowState(mainWindow);
  return true;
}

function getUpdateDownloadDir() {
  return path.join(app.getPath('userData'), 'updates');
}

function shouldEnsureDesktopShortcut() {
  if (process.platform !== 'win32') return false;
  if (process.env.MINERADIO_NO_DESKTOP_SHORTCUT === '1') return false;
  return app.isPackaged || process.env.MINERADIO_CREATE_DESKTOP_SHORTCUT === '1';
}

function ensureDesktopShortcut() {
  if (!shouldEnsureDesktopShortcut()) return { ok: false, skipped: true };
  try {
    const shortcutPath = path.join(app.getPath('desktop'), `${APP_NAME}.lnk`);
    const target = process.execPath;
    const shortcut = {
      target,
      cwd: path.dirname(target),
      args: '',
      description: 'Mineradio desktop music player',
      icon: fs.existsSync(APP_ICON_ICO) ? APP_ICON_ICO : target,
      iconIndex: 0,
      appUserModelId: APP_USER_MODEL_ID,
    };

    if (fs.existsSync(shortcutPath) && shell.readShortcutLink) {
      try {
        const existing = shell.readShortcutLink(shortcutPath);
        if (existing && path.resolve(existing.target || '') === path.resolve(target) && String(existing.args || '') === '') {
          return { ok: true, path: shortcutPath, existing: true };
        }
      } catch (_) {}
      shell.writeShortcutLink(shortcutPath, 'replace', shortcut);
    } else {
      shell.writeShortcutLink(shortcutPath, 'create', shortcut);
    }
    return { ok: true, path: shortcutPath, created: true };
  } catch (e) {
    console.warn('Desktop shortcut creation skipped:', e.message);
    return { ok: false, error: e.message || 'DESKTOP_SHORTCUT_FAILED' };
  }
}

function parseCookieHeader(cookieText) {
  const out = {};
  String(cookieText || '').split(';').forEach((part) => {
    const raw = String(part || '').trim();
    if (!raw) return;
    const idx = raw.indexOf('=');
    if (idx <= 0) return;
    out[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
  });
  return out;
}

function qqCookieHasLogin(cookieText) {
  const obj = parseCookieHeader(cookieText);
  const rawUin = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '');
  const uin = String(rawUin).replace(/\D/g, '');
  const musicKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.p_skey || obj.skey ||
    obj.psrf_qqaccess_token || obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey || '';
  return !!(uin && musicKey);
}

function qqCookieHasPlaybackLogin(cookieText) {
  const obj = parseCookieHeader(cookieText);
  const rawUin = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '');
  const uin = String(rawUin).replace(/\D/g, '');
  const playbackKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.wxskey || '';
  return !!(uin && playbackKey);
}

function neteaseCookieHasLogin(cookieText) {
  const obj = parseCookieHeader(cookieText);
  return !!obj.MUSIC_U;
}

function isQQCookieDomain(domain) {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase();
  return normalized === 'qq.com' || normalized.endsWith('.qq.com') || normalized.endsWith('qqmusic.qq.com');
}

function isNeteaseCookieDomain(domain) {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase();
  return normalized === '163.com' || normalized.endsWith('.163.com') ||
    normalized === 'music.163.com' || normalized.endsWith('.music.163.com') ||
    normalized === 'netease.com' || normalized.endsWith('.netease.com');
}

function isKuwoCookieDomain(domain) {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase();
  return normalized === 'kuwo.cn' || normalized.endsWith('.kuwo.cn');
}

function buildCookieHeaderFor(cookies, isAllowedDomain, priority) {
  const picked = new Map();
  (cookies || []).forEach((cookie) => {
    if (!cookie || !cookie.name || !isAllowedDomain(cookie.domain)) return;
    picked.set(cookie.name, cookie.value || '');
  });

  const ordered = [];
  (priority || []).forEach((name) => {
    if (picked.has(name)) {
      ordered.push([name, picked.get(name)]);
      picked.delete(name);
    }
  });
  picked.forEach((value, name) => ordered.push([name, value]));

  return ordered
    .filter(([name, value]) => name && value != null && String(value) !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function buildCookieHeader(cookies) {
  return buildCookieHeaderFor(cookies, isQQCookieDomain, QQ_LOGIN_COOKIE_PRIORITY);
}

async function readQQLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeader(cookies);
}

async function readNeteaseLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeaderFor(cookies, isNeteaseCookieDomain, NETEASE_LOGIN_COOKIE_PRIORITY);
}

async function readKuwoLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeaderFor(cookies, isKuwoCookieDomain, ['kw_token', 'Hm_Iuvt', 'uid', 'userid']);
}

function loginWindowBounds(owner, preferred) {
  const display = owner && !owner.isDestroyed()
    ? screen.getDisplayMatching(owner.getBounds())
    : screen.getPrimaryDisplay();
  return fitLoginWindowBounds(display && display.workArea, preferred);
}

function bindLoginWindowReliability(loginWindow, label, onFailure) {
  let revealed = false;
  const reveal = () => {
    if (revealed || !loginWindow || loginWindow.isDestroyed()) return;
    revealed = true;
    loginWindow.show();
    loginWindow.focus();
  };
  const revealTimer = setTimeout(reveal, 900);
  loginWindow.once('ready-to-show', reveal);
  loginWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    reveal();
    const message = `${label}页面加载失败 (${code}): ${description || url || '网络不可用'}`;
    console.warn(message);
    if (typeof onFailure === 'function') onFailure(new Error(message));
  });
  loginWindow.webContents.on('render-process-gone', (_event, details) => {
    const message = `${label}窗口渲染异常: ${(details && details.reason) || 'unknown'}`;
    console.warn(message);
    if (typeof onFailure === 'function') onFailure(new Error(message));
  });
  loginWindow.on('unresponsive', () => {
    reveal();
    console.warn(`${label}窗口暂时无响应`);
  });
  loginWindow.once('closed', () => clearTimeout(revealTimer));
}

async function openKuwoMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(KUWO_LOGIN_PARTITION);
  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    const loginWindow = new BrowserWindow({
      ...loginWindowBounds(owner, { width: 1080, height: 760, minWidth: 860, minHeight: 620 }),
      title: '酷我音乐登录', parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false, show: false, autoHideMenuBar: true,
      webPreferences: { partition: KUWO_LOGIN_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (!loginWindow.isDestroyed()) loginWindow.destroy();
      resolve(result);
    };
    bindLoginWindowReliability(loginWindow, '酷我音乐登录', error => finish({ ok: false, error: error.message }));
    const check = async () => {
      try {
        const cookie = await readKuwoLoginCookieHeader(cookieSession);
        const parsed = parseCookieHeader(cookie);
        if (parsed.kw_token && (parsed.Hm_Iuvt || parsed.uid || parsed.userid)) finish({ ok: true, cookie });
      } catch (_) {}
    };
    loginWindow.on('closed', async () => {
      if (settled) return;
      const cookie = await readKuwoLoginCookieHeader(cookieSession).catch(() => '');
      finish(cookie ? { ok: true, cookie, requiresValidation: true } : { ok: false, canceled: true });
    });
    pollTimer = setInterval(check, 1200);
    loginWindow.loadURL(KUWO_LOGIN_URL).catch(error => finish({ ok: false, error: error.message }));
  });
}

async function clearKuwoMusicLoginSession() {
  const cookieSession = session.fromPartition(KUWO_LOGIN_PARTITION);
  await cookieSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] });
  return { ok: true };
}

async function openNeteaseMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  const initialCookie = await readNeteaseLoginCookieHeader(cookieSession);
  if (neteaseCookieHasLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;

    const loginWindow = new BrowserWindow({
      ...loginWindowBounds(owner, { width: 940, height: 760, minWidth: 780, minHeight: 580 }),
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: '网易云音乐登录',
      backgroundColor: '#111111',
      icon: APP_ICON_ICO,
      webPreferences: {
        partition: NETEASE_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const finish = async (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      resolve(result);
    };
    bindLoginWindowReliability(loginWindow, '网易云音乐登录', error => finish({ ok: false, error: error.message }));

    const checkCookies = async () => {
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession);
        if (neteaseCookieHasLogin(cookie)) {
          finish({ ok: true, cookie });
        }
      } catch (e) {
        console.warn('Netease login cookie check failed:', e.message);
      }
    };

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\/([^/]+\.)?(163|music\.163|netease)\.com/i.test(url)) {
        loginWindow.loadURL(url).catch((e) => console.warn('Netease login popup navigation failed:', e.message));
      } else if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies();
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const docs = [document];
          document.querySelectorAll('iframe').forEach((frame) => {
            try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
          });
          for (const doc of docs) {
            const nodes = Array.from(doc.querySelectorAll('a, button, span, div'));
            const loginNode = nodes.find((node) => {
              const text = (node.textContent || '').trim();
              if (!/登录|立即登录/.test(text)) return false;
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            if (loginNode) { loginNode.click(); return true; }
          }
          return false;
        }, 900);
      `, true).catch(() => {});
    });

    loginWindow.on('closed', async () => {
      if (settled) return;
      if (pollTimer) clearInterval(pollTimer);
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession);
        resolve(neteaseCookieHasLogin(cookie)
          ? { ok: true, cookie, partial: !qqCookieHasPlaybackLogin(cookie) }
          : { ok: false, cancelled: true, message: '网易云登录窗口已关闭' });
      } catch (e) {
        resolve({ ok: false, error: e.message || '网易云登录窗口已关闭' });
      }
    });

    pollTimer = setInterval(checkCookies, 1200);
    loginWindow.loadURL(NETEASE_LOGIN_URL).catch((e) => finish({ ok: false, error: e.message }));
  });
}

async function openQQMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION);
  const initialCookie = await readQQLoginCookieHeader(cookieSession);
  if (qqCookieHasPlaybackLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    let warmupStarted = false;

    const loginWindow = new BrowserWindow({
      ...loginWindowBounds(owner, { width: 900, height: 720, minWidth: 760, minHeight: 560 }),
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: 'QQ 音乐登录',
      backgroundColor: '#111111',
      icon: APP_ICON_ICO,
      webPreferences: {
        partition: QQ_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const finish = async (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      resolve(result);
    };
    bindLoginWindowReliability(loginWindow, 'QQ 音乐登录', error => finish({ ok: false, error: error.message }));

    const checkCookies = async () => {
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession);
        if (qqCookieHasPlaybackLogin(cookie)) {
          finish({ ok: true, cookie });
        } else if (qqCookieHasLogin(cookie) && !warmupStarted) {
          warmupStarted = true;
          setTimeout(() => {
            if (!settled && loginWindow && !loginWindow.isDestroyed()) {
              loginWindow.loadURL('https://y.qq.com/n/ryqq/player').catch((e) => console.warn('QQ login warmup navigation failed:', e.message));
            }
          }, 900);
        }
      } catch (e) {
        console.warn('QQ login cookie check failed:', e.message);
      }
    };

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        loginWindow.loadURL(url).catch((e) => console.warn('QQ login popup navigation failed:', e.message));
      } else {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies();
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
          const loginNode = nodes.find((node) => {
            const text = (node.textContent || '').trim();
            if (!/登录|登陆/.test(text)) return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (loginNode) loginNode.click();
        }, 700);
      `, true).catch(() => {});
    });

    loginWindow.on('closed', async () => {
      if (settled) return;
      if (pollTimer) clearInterval(pollTimer);
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession);
        resolve(qqCookieHasLogin(cookie)
          ? { ok: true, cookie }
          : { ok: false, cancelled: true, message: 'QQ 登录窗口已关闭' });
      } catch (e) {
        resolve({ ok: false, error: e.message || 'QQ 登录窗口已关闭' });
      }
    });

    pollTimer = setInterval(checkCookies, 1200);
    loginWindow.loadURL(QQ_LOGIN_URL).catch((e) => finish({ ok: false, error: e.message }));
  });
}

async function clearQQMusicLoginSession() {
  closeQQWebApiWindow();
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION);
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  });
  return { ok: true };
}

function closeQQWebApiWindow() {
  if (qqWebApiIdleTimer) clearTimeout(qqWebApiIdleTimer);
  qqWebApiIdleTimer = null;
  qqWebApiReady = null;
  if (qqWebApiWindow && !qqWebApiWindow.isDestroyed()) qqWebApiWindow.destroy();
  qqWebApiWindow = null;
}

function scheduleQQWebApiWindowClose() {
  if (qqWebApiIdleTimer) clearTimeout(qqWebApiIdleTimer);
  qqWebApiIdleTimer = setTimeout(closeQQWebApiWindow, 5 * 60 * 1000);
}

async function ensureQQWebApiWindow() {
  if (qqWebApiWindow && !qqWebApiWindow.isDestroyed() && qqWebApiReady) return qqWebApiReady;
  closeQQWebApiWindow();
  qqWebApiWindow = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    webPreferences: {
      partition: QQ_LOGIN_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  qqWebApiWindow.on('closed', () => {
    qqWebApiWindow = null;
    qqWebApiReady = null;
  });
  qqWebApiReady = (async () => {
    await qqWebApiWindow.loadURL(QQ_LOGIN_URL);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        const ready = await qqWebApiWindow.webContents.executeJavaScript(`(() => {
          if (!window.webpackJsonp || typeof window.webpackJsonp.push !== 'function') return false;
          if (!window.__mineradioWebpackRequire) {
            const moduleId = 900000 + Math.floor(Math.random() * 9999);
            window.webpackJsonp.push([[moduleId], {
              [moduleId]: function(module, exports, require) { window.__mineradioWebpackRequire = require; }
            }, [[moduleId]]]);
          }
          const api = window.__mineradioWebpackRequire && window.__mineradioWebpackRequire(8);
          return !!(api && typeof api.j === 'function');
        })()`, true);
        if (ready) return qqWebApiWindow;
      } catch (error) {}
      await new Promise(resolve => setTimeout(resolve, 220));
    }
    throw new Error('QQ_WEB_REQUEST_MODULE_UNAVAILABLE');
  })().catch(error => {
    closeQQWebApiWindow();
    throw error;
  });
  return qqWebApiReady;
}

async function writeQQPlaylistThroughOfficialWeb(payload = {}) {
  const operation = payload.operation === 'remove' ? 'remove' : 'add';
  const dirId = Number(payload.dirId);
  const songId = Number(payload.songId);
  const songType = Number(payload.songType || 0);
  if (!Number.isInteger(dirId) || dirId <= 0) throw new Error('QQ_PLAYLIST_DIRID_REQUIRED');
  if (!Number.isInteger(songId) || songId <= 0) throw new Error('QQ_SONG_ID_REQUIRED');
  const win = await ensureQQWebApiWindow();
  const request = {
    module: 'music.musicasset.PlaylistDetailWrite',
    method: operation === 'remove' ? 'DelSonglist' : 'AddSonglist',
    param: { dirId, v_songInfo: [{ songType, songId }] },
  };
  const response = await win.webContents.executeJavaScript(`(async () => {
    const api = window.__mineradioWebpackRequire && window.__mineradioWebpackRequire(8);
    if (!api || typeof api.j !== 'function') throw new Error('QQ_WEB_REQUEST_MODULE_UNAVAILABLE');
    return api.j().request([${JSON.stringify(request)}]);
  })()`, true);
  scheduleQQWebApiWindowClose();
  const result = Array.isArray(response) ? response[0] : null;
  if (!result || Number(result.code) !== 0) {
    throw new Error(String(result && (result.message || result.msg || result.code) || 'QQ_PLAYLIST_WRITE_FAILED'));
  }
  return { ok: true, success: true, provider: 'qq', operation, dirId, songId, songType, body: result };
}

async function clearNeteaseMusicLoginSession() {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  });
  return { ok: true };
}

function getWindowedBounds(win) {
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const basis = display.bounds || area;
  const maxWidth = Math.max(640, area.width - WINDOWED_MARGIN);
  const maxHeight = Math.max(360, area.height - WINDOWED_MARGIN);

  let width = Math.round(basis.width * WINDOWED_SCALE);
  let height = Math.round(width / WINDOWED_ASPECT);
  const scaledHeight = Math.round(basis.height * WINDOWED_SCALE);

  if (height > scaledHeight) {
    height = scaledHeight;
    width = Math.round(height * WINDOWED_ASPECT);
  }

  if (width < MIN_WINDOWED_WIDTH && maxWidth >= MIN_WINDOWED_WIDTH && maxHeight >= MIN_WINDOWED_HEIGHT) {
    width = MIN_WINDOWED_WIDTH;
    height = MIN_WINDOWED_HEIGHT;
  }

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / WINDOWED_ASPECT);
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * WINDOWED_ASPECT);
  }

  width = Math.round(width);
  height = Math.round(height);

  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  };
}

function applyWindowedBounds(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMaximized()) win.unmaximize();
  win.setMinimumSize(MIN_WINDOWED_WIDTH, MIN_WINDOWED_HEIGHT);
  win.setBounds(getWindowedBounds(win), false);
  sendWindowState(win);
}

function exitFullscreenToWindow(win) {
  if (!win || win.isDestroyed()) return;
  windowFullscreenActive = false;

  if (!win.isFullScreen()) {
    applyWindowedBounds(win);
    return;
  }

  let applied = false;
  const applyOnce = () => {
    if (applied || !win || win.isDestroyed() || win.isFullScreen()) return;
    applied = true;
    applyWindowedBounds(win);
  };

  win.once('leave-full-screen', () => setTimeout(applyOnce, 50));
  win.setFullScreen(false);
  setTimeout(applyOnce, 500);
}

function toggleFullscreen(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isFullScreen() || windowFullscreenActive) {
    exitFullscreenToWindow(win);
    return;
  }
  windowFullscreenActive = true;
  win.setFullScreen(true);
  sendWindowState(win);
}

function overlayUrl(page) {
  const port = mainServerPort || process.env.PORT || 3000;
  return `http://127.0.0.1:${port}/${page}`;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function desktopLyricsDefaultBounds(payload = desktopLyricsState) {
  const display = desktopLyricsUserBounds
    ? screen.getDisplayMatching(desktopLyricsUserBounds)
    : screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const yRatio = clampNumber(payload.y, 0.08, 0.92, 0.76);
  const width = Math.round(Math.min(Math.max(880, bounds.width * 0.72), bounds.width - 96));
  const height = Math.round(Math.min(Math.max(340, bounds.height * 0.38), 560, bounds.height - 96));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + bounds.height * yRatio - height / 2),
    width,
    height,
  };
}

function constrainDesktopLyricsBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.bounds;
  const next = {
    ...bounds,
    width: Math.round(Math.min(Math.max(320, bounds.width), area.width)),
    height: Math.round(Math.min(Math.max(180, bounds.height), area.height)),
  };
  const maxX = area.x + Math.max(0, area.width - next.width);
  const maxY = area.y + Math.max(0, area.height - next.height);
  next.x = Math.round(clampNumber(next.x, area.x, maxX, area.x));
  next.y = Math.round(clampNumber(next.y, area.y, maxY, area.y));
  return next;
}

function setDesktopLyricsBounds(bounds) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const nextBounds = constrainDesktopLyricsBounds(bounds);
  const currentBounds = desktopLyricsWindow.getBounds();
  if (
    currentBounds.x === nextBounds.x
    && currentBounds.y === nextBounds.y
    && currentBounds.width === nextBounds.width
    && currentBounds.height === nextBounds.height
  ) {
    return;
  }
  desktopLyricsProgrammaticMove = true;
  desktopLyricsWindow.setBounds(nextBounds, false);
  setTimeout(() => {
    desktopLyricsProgrammaticMove = false;
  }, 120);
}

function rememberDesktopLyricsBounds() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed() || desktopLyricsProgrammaticMove) return;
  desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
}

function applyDesktopLyricsMouseBehavior() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const locked = desktopLyricsState.clickThrough !== false;
  const shouldIgnore = locked || !desktopLyricsPointerCapture;
  if (desktopLyricsMouseIgnored === shouldIgnore) return;
  desktopLyricsMouseIgnored = shouldIgnore;
  desktopLyricsWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
}

function desktopLyricsHotBoundsOnScreen() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return null;
  const winBounds = desktopLyricsWindow.getBounds();
  const rel = desktopLyricsHotBounds;
  if (!rel) return winBounds;
  return {
    x: winBounds.x + rel.left,
    y: winBounds.y + rel.top,
    width: Math.max(1, rel.right - rel.left),
    height: Math.max(1, rel.bottom - rel.top),
  };
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function handleDesktopLyricsGlobalMiddleClick() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  if (!desktopLyricsState.enabled) return;
  const now = Date.now();
  if (now - desktopLyricsLastMiddleAt < 260) return;
  const point = screen.getCursorScreenPoint();
  if (!pointInBounds(point, desktopLyricsHotBoundsOnScreen())) return;
  desktopLyricsLastMiddleAt = now;
  const nextLocked = desktopLyricsState.clickThrough === false;
  desktopLyricsState = { ...desktopLyricsState, clickThrough: nextLocked };
  desktopLyricsPointerCapture = !nextLocked;
  applyDesktopLyricsMouseBehavior();
  broadcastDesktopLyricsLockState();
}

function startDesktopLyricsMousePoller() {
  if (process.platform !== 'win32' || desktopLyricsMousePoller) return;
  const script = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MineradioMousePoll {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
$prev = $false
while ($true) {
  $down = (([MineradioMousePoll]::GetAsyncKeyState(4) -band 0x8000) -ne 0)
  if ($down -and -not $prev) {
    [Console]::Out.WriteLine("MMB")
    [Console]::Out.Flush()
  }
  $prev = $down
  Start-Sleep -Milliseconds 24
}
`;
  try {
    desktopLyricsMousePoller = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    desktopLyricsMousePoller.stdout.on('data', (chunk) => {
      desktopLyricsMousePollerBuffer += chunk.toString('utf8');
      const lines = desktopLyricsMousePollerBuffer.split(/\r?\n/);
      desktopLyricsMousePollerBuffer = lines.pop() || '';
      lines.forEach((line) => {
        if (line.trim() === 'MMB') handleDesktopLyricsGlobalMiddleClick();
      });
    });
    desktopLyricsMousePoller.on('exit', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
    desktopLyricsMousePoller.on('error', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
  } catch (e) {
    desktopLyricsMousePoller = null;
    desktopLyricsMousePollerBuffer = '';
  }
}

function stopDesktopLyricsMousePoller() {
  if (!desktopLyricsMousePoller) return;
  try {
    desktopLyricsMousePoller.kill();
  } catch (e) {}
  desktopLyricsMousePoller = null;
  desktopLyricsMousePollerBuffer = '';
}

function broadcastDesktopLyricsLockState() {
  const locked = desktopLyricsState.clickThrough !== false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-lock-state', { locked });
  }
  sendDesktopLyricsState();
}

function broadcastDesktopLyricsEnabledState(enabled) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-enabled-state', { enabled: !!enabled });
  }
}

function positionDesktopLyricsWindow(payload = desktopLyricsState, options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const shouldUseManualBounds = desktopLyricsUserBounds && !options.force;
  setDesktopLyricsBounds(shouldUseManualBounds ? desktopLyricsUserBounds : desktopLyricsDefaultBounds(payload));
  if (typeof desktopLyricsWindow.setOpacity === 'function') {
    desktopLyricsWindow.setOpacity(clampNumber(payload.opacity, 0.28, 1, 0.92));
  }
}

function sendDesktopLyricsState() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-state', desktopLyricsState);
}

function createDesktopLyricsWindow(payload = {}) {
  const previousY = desktopLyricsState.y;
  const previousOpacity = desktopLyricsState.opacity;
  desktopLyricsState = { ...desktopLyricsState, ...payload, enabled: true };
  const hasY = Object.prototype.hasOwnProperty.call(payload || {}, 'y');
  const nextY = clampNumber(desktopLyricsState.y, 0.08, 0.92, 0.76);
  const yChanged = hasY && Number.isFinite(Number(previousY)) && Math.abs(nextY - clampNumber(previousY, 0.08, 0.92, 0.76)) > 0.001;
  const opacityChanged = Object.prototype.hasOwnProperty.call(payload || {}, 'opacity')
    && Math.abs(clampNumber(desktopLyricsState.opacity, 0.28, 1, 0.92) - clampNumber(previousOpacity, 0.28, 1, 0.92)) > 0.001;
  if (yChanged) desktopLyricsUserBounds = null;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    if (yChanged) {
      positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged });
    } else if (opacityChanged && typeof desktopLyricsWindow.setOpacity === 'function') {
      desktopLyricsWindow.setOpacity(clampNumber(desktopLyricsState.opacity, 0.28, 1, 0.92));
    }
    applyDesktopLyricsMouseBehavior();
    sendDesktopLyricsState();
    return desktopLyricsWindow;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 920,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'Mineradio Desktop Lyrics',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  try {
    desktopLyricsWindow.setAlwaysOnTop(true, 'screen-saver');
    desktopLyricsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (e) {
    console.warn('Desktop lyrics topmost setup skipped:', e.message);
  }
  startDesktopLyricsMousePoller();
  applyDesktopLyricsMouseBehavior();
  positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged || !desktopLyricsUserBounds });
  desktopLyricsWindow.once('ready-to-show', () => {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
    desktopLyricsWindow.showInactive();
    sendDesktopLyricsState();
  });
  desktopLyricsWindow.webContents.once('did-finish-load', sendDesktopLyricsState);
  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
    desktopLyricsMouseIgnored = null;
  });
  desktopLyricsWindow.on('moved', rememberDesktopLyricsBounds);
  desktopLyricsWindow.loadURL(overlayUrl('desktop-lyrics.html')).catch((e) => console.warn('Desktop lyrics load failed:', e.message));
  return desktopLyricsWindow;
}

function closeDesktopLyricsWindow() {
  desktopLyricsState = { ...desktopLyricsState, enabled: false };
  desktopLyricsPointerCapture = false;
  desktopLyricsMouseIgnored = null;
  desktopLyricsHotBounds = null;
  stopDesktopLyricsMousePoller();
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    sendDesktopLyricsState();
    desktopLyricsWindow.close();
  }
  desktopLyricsWindow = null;
  broadcastDesktopLyricsEnabledState(false);
}

function nativeWindowHandleDecimal(win) {
  const handle = win.getNativeWindowHandle();
  if (process.arch === 'x64') return handle.readBigUInt64LE(0).toString();
  return String(handle.readUInt32LE(0));
}

function attachWallpaperToWorkerW(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  const hwnd = nativeWindowHandleDecimal(win);
  const script = `
$ErrorActionPreference = "Stop"
if (-not ("MineradioNativeWin" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MineradioNativeWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
}
$progman = [MineradioNativeWin]::FindWindow("Progman", $null)
$result = [IntPtr]::Zero
[MineradioNativeWin]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result) | Out-Null
$script:workerw = [IntPtr]::Zero
$enum = [MineradioNativeWin+EnumWindowsProc]{
  param([IntPtr]$top, [IntPtr]$param)
  $shell = [MineradioNativeWin]::FindWindowEx($top, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
  if ($shell -ne [IntPtr]::Zero) {
    $script:workerw = [MineradioNativeWin]::FindWindowEx([IntPtr]::Zero, $top, "WorkerW", $null)
  }
  return $true
}
[MineradioNativeWin]::EnumWindows($enum, [IntPtr]::Zero) | Out-Null
if ($script:workerw -eq [IntPtr]::Zero) { $script:workerw = $progman }
$target = [IntPtr]::new([Int64]${hwnd})
[MineradioNativeWin]::SetParent($target, $script:workerw) | Out-Null
[MineradioNativeWin]::SetWindowPos($target, [IntPtr]::Zero, 0, 0, 0, 0, 0x0013) | Out-Null
`;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    timeout: 5000,
  }, (error) => {
    if (error) console.warn('Wallpaper WorkerW attach failed:', error.message);
  });
}

function positionWallpaperWindow() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  const bounds = screen.getPrimaryDisplay().bounds;
  wallpaperWindow.setBounds(bounds, false);
}

function sendWallpaperState() {
  if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
  wallpaperWindow.webContents.send('mineradio-wallpaper-state', wallpaperState);
}

function createWallpaperWindow(payload = {}) {
  wallpaperState = { ...wallpaperState, ...payload, enabled: true };
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    positionWallpaperWindow();
    sendWallpaperState();
    return wallpaperWindow;
  }
  const bounds = screen.getPrimaryDisplay().bounds;
  wallpaperWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#050608',
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'Mineradio Wallpaper',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  wallpaperWindow.setIgnoreMouseEvents(true, { forward: true });
  wallpaperWindow.once('ready-to-show', () => {
    if (!wallpaperWindow || wallpaperWindow.isDestroyed()) return;
    positionWallpaperWindow();
    wallpaperWindow.showInactive();
    attachWallpaperToWorkerW(wallpaperWindow);
    sendWallpaperState();
  });
  wallpaperWindow.webContents.once('did-finish-load', sendWallpaperState);
  wallpaperWindow.on('closed', () => {
    wallpaperWindow = null;
  });
  wallpaperWindow.loadURL(overlayUrl('wallpaper.html')).catch((e) => console.warn('Wallpaper load failed:', e.message));
  return wallpaperWindow;
}

function closeWallpaperWindow() {
  wallpaperState = { ...wallpaperState, enabled: false };
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    sendWallpaperState();
    wallpaperWindow.close();
  }
  wallpaperWindow = null;
}

function closeOverlayWindows() {
  closeDesktopLyricsWindow();
  closeWallpaperWindow();
}

ipcMain.handle('desktop-window-minimize', (event) => {
  getSenderWindow(event)?.minimize();
});

ipcMain.handle('desktop-window-toggle-maximize', (event) => {
  toggleFullscreen(getSenderWindow(event));
});

ipcMain.handle('desktop-window-toggle-fullscreen', (event) => {
  toggleFullscreen(getSenderWindow(event));
});

ipcMain.handle('desktop-window-exit-fullscreen-windowed', (event) => {
  exitFullscreenToWindow(getSenderWindow(event));
});

ipcMain.handle('desktop-window-get-state', (event) => {
  return getWindowState(getSenderWindow(event));
});

ipcMain.handle('desktop-window-close', (event) => {
  return hideMainWindowToTray(getSenderWindow(event));
});

ipcMain.handle('mineradio-tray-playback-state', (_event, state) => {
  trayPlaybackState = {
    playing: !!(state && state.playing),
    muted: !!(state && state.muted),
  };
  rebuildTrayMenu();
  return { ok: true };
});

ipcMain.handle('mineradio-hotkeys-configure-global', (_event, bindings) => {
  return configureMineradioGlobalHotkeys(bindings);
});

ipcMain.handle('mineradio-export-json-file', async (event, payload = {}) => {
  try {
    const owner = getSenderWindow(event);
    const defaultName = String(payload.defaultName || 'mineradio-export.json').replace(/[\\/:*?"<>|]+/g, '-');
    const result = await dialog.showSaveDialog(owner, {
      title: '导出 Mineradio 存档',
      defaultPath: defaultName.toLowerCase().endsWith('.json') ? defaultName : `${defaultName}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const text = typeof payload.text === 'string' ? payload.text : JSON.stringify(payload.data || {}, null, 2);
    fs.writeFileSync(result.filePath, text, 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message || 'EXPORT_FAILED' };
  }
});

ipcMain.handle('mineradio-import-json-file', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '导入 Mineradio 存档',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, filePath, text };
  } catch (e) {
    return { ok: false, error: e.message || 'IMPORT_FAILED' };
  }
});

ipcMain.handle('mineradio-select-wallpaper-folder', async (event, defaultPath) => {
  try {
    const owner = getSenderWindow(event);
    const opts = {
      title: '选择 Wallpaper Engine 订阅目录',
      properties: ['openDirectory'],
    };
    const initial = String(defaultPath || '').trim();
    if (initial && fs.existsSync(initial)) opts.defaultPath = initial;
    const result = await dialog.showOpenDialog(owner, opts);
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    return { ok: true, folderPath: result.filePaths[0] };
  } catch (e) {
    return { ok: false, error: e.message || 'SELECT_WALLPAPER_FOLDER_FAILED' };
  }
});

function firstExistingFile(candidates) {
  return candidates.find(file => {
    try { return file && fs.existsSync(file) && fs.statSync(file).isFile(); } catch (e) { return false; }
  }) || '';
}
function wallpaperToolsConfigPath() {
  try { return path.join(app.getPath('userData'), 'wallpaper-tools.json'); } catch (e) { return path.join(__dirname, '..', 'wallpaper-tools.json'); }
}
function readWallpaperToolsConfig() {
  try { return JSON.parse(fs.readFileSync(wallpaperToolsConfigPath(), 'utf8')) || {}; } catch (e) { return {}; }
}
function saveWallpaperToolsConfig(config) {
  try {
    fs.mkdirSync(path.dirname(wallpaperToolsConfigPath()), { recursive: true });
    fs.writeFileSync(wallpaperToolsConfigPath(), JSON.stringify(config || {}, null, 2));
  } catch (e) {}
}
function findWallpaperEngineExe() {
  return firstExistingFile([
    process.env.WALLPAPER_ENGINE_EXE,
    'E:\\steam\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe',
    'D:\\steam\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe',
    'C:\\Program Files\\Steam\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe',
  ]);
}
function findFfmpegExe() {
  let installerPath = '';
  try { installerPath = require('@ffmpeg-installer/ffmpeg').path; } catch (e) {}
  const config = readWallpaperToolsConfig();
  const bundled = [
    installerPath,
    config.ffmpegPath,
    path.join(process.resourcesPath || '', 'bin', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'bin', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'vendor', 'ffmpeg.exe'),
  ];
  const pathCandidates = String(process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, 'ffmpeg.exe'));
  return firstExistingFile(bundled.concat(pathCandidates));
}
function findObsExe() {
  const config = readWallpaperToolsConfig();
  const roots = [
    process.resourcesPath,
    path.join(__dirname, '..'),
    app.isPackaged ? path.dirname(process.execPath) : '',
  ].filter(Boolean);
  const bundled = [];
  roots.forEach(root => {
    bundled.push(path.join(root, 'obs', 'bin', '64bit', 'obs64.exe'));
    bundled.push(path.join(root, 'resources', 'obs', 'bin', '64bit', 'obs64.exe'));
  });
  return firstExistingFile([
    process.env.MINERADIO_OBS_EXE,
    config.obsPath,
    ...bundled,
    'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
    'C:\\Program Files (x86)\\obs-studio\\bin\\64bit\\obs64.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'obs-studio', 'bin', '64bit', 'obs64.exe'),
  ]);
}
function obsRootDir(obsExe) {
  const bin64 = path.dirname(obsExe || '');
  return path.resolve(bin64, '..', '..');
}
function obsWorkingDir(obsExe) {
  return path.dirname(obsExe || '');
}
function psSingleQuote(value) {
  return "'" + String(value || '').replace(/'/g, "''") + "'";
}
function appendWallpaperObsLog(message) {
  try {
    const file = path.join(wallpaperConversionCacheDir(), 'mineradio-obs.log');
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (e) {}
}
function wallpaperConversionCacheDir() {
  const config = readWallpaperToolsConfig();
  const dir = path.resolve(process.env.MINERADIO_WALLPAPER_CACHE_DIR || config.cacheDir || path.join(app.getPath('userData'), 'wallpaper-cache'));
  fs.mkdirSync(dir, { recursive: true });
  process.env.MINERADIO_WALLPAPER_CACHE_DIR = dir;
  return dir;
}
function safeWallpaperFileName(input) {
  return String(input || 'wallpaper').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'wallpaper';
}
function wallpaperConvertedFileUrl(filePath) {
  return '/api/wallpaper/converted?file=' + encodeURIComponent(filePath);
}
function isPathInsideDir(parent, child) {
  const root = path.resolve(parent);
  const target = path.resolve(child);
  return target === root || target.startsWith(root + path.sep);
}
function runFfmpegCapture(args, timeoutMs) {
  return new Promise((resolve) => {
    let stderr = '';
    const ff = spawn(args.exe, args.argv, { windowsHide: true });
    const timer = setTimeout(() => {
      try { ff.kill('SIGKILL'); } catch (e) {}
      resolve({ ok: false, error: 'CAPTURE_TIMEOUT', stderr });
    }, timeoutMs);
    ff.stderr.on('data', chunk => { stderr += String(chunk || '').slice(0, 4000); });
    ff.on('error', error => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message || 'FFMPEG_FAILED', stderr });
    });
    ff.on('close', code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stderr });
    });
  });
}
function runPowerShellText(script, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    const timer = setTimeout(() => {
      try { ps.kill('SIGKILL'); } catch (e) {}
      resolve({ ok: false, error: 'POWERSHELL_TIMEOUT', stdout, stderr });
    }, timeoutMs || 10000);
    ps.stdout.on('data', chunk => { stdout += String(chunk || ''); });
    ps.stderr.on('data', chunk => { stderr += String(chunk || ''); });
    ps.on('error', error => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message || 'POWERSHELL_FAILED', stdout, stderr });
    });
    ps.on('close', code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}
async function findWallpaperPopoutWindow() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Win32WindowScan {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
}
"@
$items = New-Object System.Collections.Generic.List[object]
[Win32WindowScan]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if (-not [Win32WindowScan]::IsWindowVisible($hWnd)) { return $true }
  $titleBuilder = New-Object System.Text.StringBuilder 512
  $classBuilder = New-Object System.Text.StringBuilder 256
  [void][Win32WindowScan]::GetWindowText($hWnd, $titleBuilder, $titleBuilder.Capacity)
  [void][Win32WindowScan]::GetClassName($hWnd, $classBuilder, $classBuilder.Capacity)
  $processId = 0
  [void][Win32WindowScan]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
  $title = $titleBuilder.ToString()
  $class = $classBuilder.ToString()
  $exe = if ($proc -and $proc.Path) { [System.IO.Path]::GetFileName($proc.Path) } else { "" }
  if ($title -like "*Wallpaper Pop-out*" -or (($exe -like "wallpaper*.exe" -or $exe -eq "wallpaper64.exe") -and $title -like "*Pop-out*")) {
    $windowRect = New-Object Win32WindowScan+RECT
    $clientRect = New-Object Win32WindowScan+RECT
    $clientPoint = New-Object Win32WindowScan+POINT
    [void][Win32WindowScan]::GetWindowRect($hWnd, [ref]$windowRect)
    [void][Win32WindowScan]::GetClientRect($hWnd, [ref]$clientRect)
    [void][Win32WindowScan]::ClientToScreen($hWnd, [ref]$clientPoint)
    $items.Add([pscustomobject]@{
      title=$title
      class=$class
      exe=$exe
      pid=$processId
      windowX=$windowRect.Left
      windowY=$windowRect.Top
      windowWidth=[Math]::Max(0, $windowRect.Right - $windowRect.Left)
      windowHeight=[Math]::Max(0, $windowRect.Bottom - $windowRect.Top)
      clientWidth=[Math]::Max(0, $clientRect.Right - $clientRect.Left)
      clientHeight=[Math]::Max(0, $clientRect.Bottom - $clientRect.Top)
      clientX=$clientPoint.X
      clientY=$clientPoint.Y
    }) | Out-Null
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
$items | Select-Object -First 1 | ConvertTo-Json -Compress
`;
  const result = await runPowerShellText(script, 12000);
  if (!result.ok || !String(result.stdout || '').trim()) {
    appendWallpaperObsLog(`POP_OUT_SCAN_FAILED ${result.error || ''} ${String(result.stderr || '').slice(0, 500)}`);
    return null;
  }
  try {
    const parsed = JSON.parse(String(result.stdout || '').trim());
    if (parsed && parsed.title && parsed.class && parsed.exe) return parsed;
  } catch (e) {
    appendWallpaperObsLog(`POP_OUT_SCAN_PARSE_FAILED ${String(result.stdout || '').slice(0, 500)}`);
  }
  return null;
}
function obsWindowSelector(info) {
  if (!info) return '';
  return `${String(info.title || '').replace(/:/g, '')}:${String(info.class || '').replace(/:/g, '')}:${String(info.exe || '').replace(/:/g, '')}`;
}
function obsRecordingBitrate(payload, canvas, fps) {
  const mode = String(payload && payload.bitrate || 'high');
  const base = mode === 'master' ? 120000 : (mode === 'ultra' ? 65000 : (mode === 'standard' ? 16000 : 32000));
  const pixels = Math.max(1, Number(canvas && canvas.width) * Number(canvas && canvas.height));
  const pixelScale = Math.sqrt(pixels / (1920 * 1080));
  const fpsScale = Math.sqrt(Math.max(24, Number(fps) || 30) / 30);
  const bitrate = Math.round(base * pixelScale * fpsScale);
  return Math.max(12000, Math.min(300000, bitrate));
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function waitForObsSocket(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: '127.0.0.1', port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error('OBS_WEBSOCKET_UNAVAILABLE'));
        else setTimeout(attempt, 450);
      });
    };
    attempt();
  });
}
function createObsClient(port) {
  return new Promise((resolve, reject) => {
    const WebSocketCtor = global.WebSocket;
    if (!WebSocketCtor) {
      reject(new Error('WEBSOCKET_UNAVAILABLE'));
      return;
    }
    const ws = new WebSocketCtor(`ws://127.0.0.1:${port}`);
    let ready = false;
    const pending = new Map();
    const fail = (error) => {
      pending.forEach(entry => entry.reject(error));
      pending.clear();
    };
    const timeout = setTimeout(() => {
      if (!ready) {
        try { ws.close(); } catch (e) {}
        reject(new Error('OBS_WEBSOCKET_TIMEOUT'));
      }
    }, 15000);
    ws.addEventListener('message', event => {
      let payload = null;
      try { payload = JSON.parse(String(event.data || '{}')); } catch (e) {}
      if (!payload) return;
      if (payload.op === 0) {
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, eventSubscriptions: 0 } }));
        return;
      }
      if (payload.op === 2) {
        clearTimeout(timeout);
        ready = true;
        resolve({
          request(requestType, requestData) {
            const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            return new Promise((reqResolve, reqReject) => {
              pending.set(requestId, { resolve: reqResolve, reject: reqReject, requestType });
              ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData: requestData || {} } }));
              setTimeout(() => {
                if (pending.has(requestId)) {
                  pending.delete(requestId);
                  reqReject(new Error(`${requestType}_TIMEOUT`));
                }
              }, 12000);
            });
          },
          close() {
            try { ws.close(); } catch (e) {}
          },
        });
        return;
      }
      if (payload.op === 7 && payload.d && payload.d.requestId) {
        const entry = pending.get(payload.d.requestId);
        if (!entry) return;
        pending.delete(payload.d.requestId);
        const status = payload.d.requestStatus || {};
        if (status.result) entry.resolve(payload.d.responseData || {});
        else entry.reject(new Error(status.comment || status.code || `${entry.requestType}_FAILED`));
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      fail(new Error('OBS_WEBSOCKET_ERROR'));
      if (!ready) reject(new Error('OBS_WEBSOCKET_ERROR'));
    });
    ws.addEventListener('close', () => {
      fail(new Error('OBS_WEBSOCKET_CLOSED'));
    });
  });
}
async function ignoreObsRequest(client, type, data) {
  try { return await client.request(type, data); } catch (e) { return null; }
}
async function obsProfileParameter(client, category, name) {
  const response = await ignoreObsRequest(client, 'GetProfileParameter', {
    parameterCategory: category,
    parameterName: name,
  });
  return response && response.parameterValue !== undefined ? String(response.parameterValue) : '';
}
async function setObsProfileParameter(client, category, name, value) {
  return ignoreObsRequest(client, 'SetProfileParameter', {
    parameterCategory: category,
    parameterName: name,
    parameterValue: String(value),
  });
}
async function switchObsCaptureProfile(client, softwareFallback) {
  const profileList = await client.request('GetProfileList', {});
  const currentProfileName = String(profileList && profileList.currentProfileName || '');
  const profiles = profileList && Array.isArray(profileList.profiles) ? profileList.profiles.map(String) : [];
  const targetProfileName = nextObsCaptureProfile(currentProfileName);
  const inheritedRecEncoder = await obsProfileParameter(client, 'SimpleOutput', 'RecEncoder');
  const inheritedStreamEncoder = await obsProfileParameter(client, 'SimpleOutput', 'StreamEncoder');
  const created = !profiles.includes(targetProfileName);
  if (created) {
    await client.request('CreateProfile', { profileName: targetProfileName });
  }
  const refreshed = await client.request('GetProfileList', {});
  if (String(refreshed && refreshed.currentProfileName || '') !== targetProfileName) {
    await client.request('SetCurrentProfile', { profileName: targetProfileName });
  }
  if (softwareFallback) {
    await setObsProfileParameter(client, 'SimpleOutput', 'RecEncoder', 'x264');
    await setObsProfileParameter(client, 'SimpleOutput', 'StreamEncoder', 'x264');
  } else if (created) {
    if (inheritedRecEncoder) await setObsProfileParameter(client, 'SimpleOutput', 'RecEncoder', inheritedRecEncoder);
    if (inheritedStreamEncoder) await setObsProfileParameter(client, 'SimpleOutput', 'StreamEncoder', inheritedStreamEncoder);
  }
  const encoder = await obsProfileParameter(client, 'SimpleOutput', 'RecEncoder');
  appendWallpaperObsLog(`OBS_PROFILE name=${targetProfileName} encoder=${encoder || 'default'} fallback=${softwareFallback ? 'software' : 'preferred'}`);
  return { profileName: targetProfileName, encoder: encoder || 'default' };
}
async function applyObsCaptureVideoSettings(client, requestedCanvas, fps) {
  await client.request('SetVideoSettings', {
    fpsNumerator: fps,
    fpsDenominator: 1,
    baseWidth: requestedCanvas.width,
    baseHeight: requestedCanvas.height,
    outputWidth: requestedCanvas.width,
    outputHeight: requestedCanvas.height,
  });
  const appliedVideo = await ignoreObsRequest(client, 'GetVideoSettings', {}) || {};
  return {
    canvas: {
      width: Number(appliedVideo.baseWidth) || requestedCanvas.width,
      height: Number(appliedVideo.baseHeight) || requestedCanvas.height,
    },
    outputCanvas: {
      width: Number(appliedVideo.outputWidth) || requestedCanvas.width,
      height: Number(appliedVideo.outputHeight) || requestedCanvas.height,
    },
  };
}
async function configureObsRecordingOutput(client, cacheDir, output, vBitrate, fps) {
  await setObsProfileParameter(client, 'SimpleOutput', 'FilePath', cacheDir);
  await setObsProfileParameter(client, 'SimpleOutput', 'RecFormat', 'mp4');
  await setObsProfileParameter(client, 'SimpleOutput', 'RecFormat2', 'mp4');
  await setObsProfileParameter(client, 'SimpleOutput', 'RecQuality', 'Stream');
  await setObsProfileParameter(client, 'SimpleOutput', 'VBitrate', vBitrate);
  await setObsProfileParameter(client, 'SimpleOutput', 'FFVBitrate', vBitrate);
  await setObsProfileParameter(client, 'SimpleOutput', 'RecAudioEncoder', 'aac');
  await setObsProfileParameter(client, 'SimpleOutput', 'StreamAudioEncoder', 'aac');
  await setObsProfileParameter(client, 'SimpleOutput', 'RecTracks', 1);
  await setObsProfileParameter(client, 'Video', 'FPSCommon', fps);
  await setObsProfileParameter(client, 'Output', 'Mode', 'Simple');
  await setObsProfileParameter(client, 'Output', 'FilenameFormatting', path.basename(output, path.extname(output)));
}
async function startObsRecordConfirmed(client) {
  try {
    await client.request('StartRecord');
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : 'START_RECORD_FAILED' };
  }
  return waitForObsRecordStart(client, wait, { attempts: 24, intervalMs: 200 });
}
async function applyObsSceneItemLayout(client, sceneName, sceneItemId, crop, canvas) {
  await client.request('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    sceneItemTransform: {
      positionX: 0,
      positionY: 0,
      rotation: 0,
      cropLeft: crop.left,
      cropTop: crop.top,
      cropRight: crop.right,
      cropBottom: crop.bottom,
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 5,
      boundsWidth: canvas.width,
      boundsHeight: canvas.height,
      alignment: 5,
    },
  });
}
async function waitForObsSceneItemTransform(client, sceneName, sceneItemId) {
  let lastTransform = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await ignoreObsRequest(client, 'GetSceneItemTransform', { sceneName, sceneItemId });
    lastTransform = response && response.sceneItemTransform ? response.sceneItemTransform : lastTransform;
    if (lastTransform && Number(lastTransform.sourceWidth) > 0 && Number(lastTransform.sourceHeight) > 0) return lastTransform;
    await wait(120);
  }
  return lastTransform || {};
}
function obsInputListHas(inputList, inputName) {
  const inputs = inputList && Array.isArray(inputList.inputs) ? inputList.inputs : [];
  return inputs.some(input => input && input.inputName === inputName);
}
function obsLaunchArgs(port) {
  return [
    '--portable',
    '--multi',
    '--disable-shutdown-check',
    '--minimize-to-tray',
    '--websocket_port', String(port || 4455),
    '--websocket_password', '',
  ];
}
function ensureObsPortableConfig(obsPath, port) {
  try {
    const root = obsRootDir(obsPath);
    const configDir = path.join(root, 'config', 'obs-studio', 'plugin_config', 'obs-websocket');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
      server_enabled: true,
      server_port: Number(port || 4455),
      server_password: '',
      auth_required: false,
      alert_on_load: false,
    }, null, 2), 'utf8');
  } catch (e) {
    appendWallpaperObsLog(`OBS_CONFIG_FAILED ${e.message || e}`);
  }
}
function launchObsNormal(obsPath, port) {
  try {
    ensureObsPortableConfig(obsPath, port);
    const child = spawn(obsPath, obsLaunchArgs(port || 4455), {
      cwd: obsWorkingDir(obsPath),
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
    });
    child.unref();
    appendWallpaperObsLog(`OBS_NORMAL_LAUNCHED pid=${child.pid || ''} path=${obsPath}`);
    return true;
  } catch (e) {
    appendWallpaperObsLog(`OBS_NORMAL_FAILED ${e.message || e}`);
    return false;
  }
}
function launchObsElevated(obsPath, port) {
  return new Promise((resolve, reject) => {
    const args = obsLaunchArgs(port || 4455);
    ensureObsPortableConfig(obsPath, port);
    const scriptPath = path.join(app.getPath('temp'), `mineradio-obs-runas-${process.pid}-${Date.now()}.ps1`);
    const script = [
      '$ErrorActionPreference = "Stop"',
      '$obsPath = ' + psSingleQuote(obsPath),
      '$workDir = ' + psSingleQuote(obsWorkingDir(obsPath)),
      '$obsArgs = @(' + args.map(psSingleQuote).join(', ') + ')',
      'Start-Process -FilePath $obsPath -WorkingDirectory $workDir -ArgumentList $obsArgs -Verb RunAs',
    ].join('\r\n');
    try {
      fs.writeFileSync(scriptPath, script, 'utf8');
    } catch (e) {
      reject(e);
      return;
    }
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    });
    ps.on('error', reject);
    ps.on('close', code => {
      try { fs.unlinkSync(scriptPath); } catch (e) {}
      if (code === 0) resolve(true);
      else reject(new Error(code === 1223 ? 'OBS_ADMIN_CANCELLED' : 'OBS_ADMIN_LAUNCH_FAILED'));
    });
  });
}
async function connectObsWithReuse(obsPath, port) {
  try {
    await waitForObsSocket(port, 1500);
    appendWallpaperObsLog('OBS_REUSE_SOCKET');
    return await createObsClient(port);
  } catch (reuseError) {
    appendWallpaperObsLog(`OBS_REUSE_UNAVAILABLE ${reuseError.message || reuseError}`);
  }
  launchObsNormal(obsPath, port);
  try {
    await waitForObsSocket(port, 18000);
    appendWallpaperObsLog('OBS_NORMAL_SOCKET_READY');
    return await createObsClient(port);
  } catch (normalError) {
    appendWallpaperObsLog(`OBS_NORMAL_SOCKET_FAILED ${normalError.message || normalError}; fallback elevated`);
  }
  await launchObsElevated(obsPath, port);
  await waitForObsSocket(port, 35000);
  appendWallpaperObsLog('OBS_ELEVATED_SOCKET_READY');
  return createObsClient(port);
}
async function runObsSceneCapture(payload, output, cacheDir) {
  const obsPath = findObsExe();
  if (!obsPath) return { ok: false, error: 'OBS_MISSING' };
  const duration = Math.max(8, Math.min(180, Number(payload && payload.duration) || 30));
  const fps = [24, 30, 60].includes(Number(payload && payload.fps)) ? Number(payload.fps) : 30;
  const port = 4455;
  let client = null;
  try {
    client = await connectObsWithReuse(obsPath, port);
    let captureProfile = await switchObsCaptureProfile(client, false);
    const sceneName = 'Mineradio Wallpaper Capture';
    const inputName = 'Mineradio Wallpaper Pop-out';
    const popoutWindow = await findWallpaperPopoutWindow();
    if (!popoutWindow) {
      appendWallpaperObsLog('POP_OUT_WINDOW_MISSING before CreateInput');
      try { client.close(); } catch (e) {}
      return { ok: false, error: 'POP_OUT_WINDOW_MISSING' };
    }
    const windowSelector = obsWindowSelector(popoutWindow);
    const requestedCanvas = obsCanvasSize(payload, popoutWindow);
    await ignoreObsRequest(client, 'CreateScene', { sceneName });
    await ignoreObsRequest(client, 'SetCurrentProgramScene', { sceneName });
    let appliedSettings = await applyObsCaptureVideoSettings(client, requestedCanvas, fps);
    let canvas = appliedSettings.canvas;
    let outputCanvas = appliedSettings.outputCanvas;
    let vBitrate = obsRecordingBitrate(payload, outputCanvas, fps);
    appendWallpaperObsLog(`POP_OUT_WINDOW title=${popoutWindow.title} class=${popoutWindow.class} exe=${popoutWindow.exe} client=${popoutWindow.clientWidth}x${popoutWindow.clientHeight} requested=${requestedCanvas.width}x${requestedCanvas.height} canvas=${canvas.width}x${canvas.height} output=${outputCanvas.width}x${outputCanvas.height} bitrate=${vBitrate} selector=${windowSelector}`);
    const inputSettings = {
      window: windowSelector,
      priority: 0,
      method: 2,
      cursor: false,
      capture_cursor: false,
      client_area: true,
      compatibility: false,
    };
    const inputList = await ignoreObsRequest(client, 'GetInputList', {});
    const inputExists = obsInputListHas(inputList, inputName);
    if (!inputExists) {
      try {
        await client.request('CreateInput', {
          sceneName,
          inputName,
          inputKind: 'window_capture',
          inputSettings,
          sceneItemEnabled: true,
        });
      } catch (createError) {
        if (!/already exists/i.test(String(createError && createError.message || createError))) throw createError;
        appendWallpaperObsLog(`OBS_INPUT_ALREADY_EXISTS_RECOVERED name=${inputName}`);
      }
    }
    let sceneItem = await ignoreObsRequest(client, 'GetSceneItemId', { sceneName, sourceName: inputName });
    if (!sceneItem || sceneItem.sceneItemId === undefined) {
      await ignoreObsRequest(client, 'CreateSceneItem', { sceneName, sourceName: inputName, sceneItemEnabled: true });
      sceneItem = await ignoreObsRequest(client, 'GetSceneItemId', { sceneName, sourceName: inputName });
    }
    if (inputExists && sceneItem && sceneItem.sceneItemId !== undefined) {
      await ignoreObsRequest(client, 'SetSceneItemEnabled', {
        sceneName,
        sceneItemId: sceneItem.sceneItemId,
        sceneItemEnabled: false,
      });
      await ignoreObsRequest(client, 'SetInputSettings', {
        inputName,
        inputSettings: Object.assign({}, inputSettings, { window: '' }),
        overlay: true,
      });
      await wait(180);
    }
    await ignoreObsRequest(client, 'SetInputSettings', {
      inputName,
      inputSettings,
      overlay: true,
    });
    let crop = { left: 0, top: 0, right: 0, bottom: 0, mode: 'unknown' };
    if (sceneItem && sceneItem.sceneItemId !== undefined) {
      await ignoreObsRequest(client, 'SetSceneItemEnabled', {
        sceneName,
        sceneItemId: sceneItem.sceneItemId,
        sceneItemEnabled: true,
      });
      await wait(650);
      const sourceTransform = await waitForObsSceneItemTransform(client, sceneName, sceneItem.sceneItemId);
      crop = obsClientCrop(popoutWindow, sourceTransform);
      appendWallpaperObsLog(`OBS_SOURCE source=${sourceTransform.sourceWidth || 0}x${sourceTransform.sourceHeight || 0} window=${popoutWindow.windowWidth || 0}x${popoutWindow.windowHeight || 0} crop=${crop.left},${crop.top},${crop.right},${crop.bottom} mode=${crop.mode}`);
      await applyObsSceneItemLayout(client, sceneName, sceneItem.sceneItemId, crop, canvas);
      await ignoreObsRequest(client, 'SetSceneItemScaleFilter', {
        sceneName,
        sceneItemId: sceneItem.sceneItemId,
        scaleFilter: 'OBS_SCALE_LANCZOS',
      });
    }
    await configureObsRecordingOutput(client, cacheDir, output, vBitrate, fps);
    const before = new Set(fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).map(name => path.join(cacheDir, name)) : []);
    let recordStart = await startObsRecordConfirmed(client);
    if (!recordStart.ok) {
      appendWallpaperObsLog(`OBS_RECORD_START_FAILED profile=${captureProfile.profileName} encoder=${captureProfile.encoder} detail=${recordStart.error || JSON.stringify(recordStart.status || {})}; retry=x264`);
      await ignoreObsRequest(client, 'StopRecord', {});
      captureProfile = await switchObsCaptureProfile(client, true);
      await ignoreObsRequest(client, 'SetCurrentProgramScene', { sceneName });
      appliedSettings = await applyObsCaptureVideoSettings(client, requestedCanvas, fps);
      canvas = appliedSettings.canvas;
      outputCanvas = appliedSettings.outputCanvas;
      vBitrate = obsRecordingBitrate(payload, outputCanvas, fps);
      if (sceneItem && sceneItem.sceneItemId !== undefined) {
        await applyObsSceneItemLayout(client, sceneName, sceneItem.sceneItemId, crop, canvas);
      }
      await configureObsRecordingOutput(client, cacheDir, output, vBitrate, fps);
      recordStart = await startObsRecordConfirmed(client);
      if (!recordStart.ok) {
        appendWallpaperObsLog(`OBS_RECORD_SOFTWARE_FALLBACK_FAILED profile=${captureProfile.profileName} detail=${recordStart.error || JSON.stringify(recordStart.status || {})}`);
        try { client.close(); } catch (closeError) {}
        return { ok: false, error: 'OBS_RECORD_START_FAILED' };
      }
      appendWallpaperObsLog(`OBS_RECORD_SOFTWARE_FALLBACK_ACTIVE profile=${captureProfile.profileName} encoder=${captureProfile.encoder}`);
    } else {
      appendWallpaperObsLog(`OBS_RECORD_ACTIVE profile=${captureProfile.profileName} encoder=${captureProfile.encoder}`);
    }
    await wait(duration * 1000);
    let stopData = {};
    try { stopData = await client.request('StopRecord'); } catch (e) {}
    await wait(1200);
    client.close();
    const outputPath = stopData.outputPath && fs.existsSync(stopData.outputPath)
      ? stopData.outputPath
      : newestVideoFile(cacheDir, before);
    if (!outputPath) return { ok: false, error: 'OBS_OUTPUT_MISSING' };
    if (path.resolve(outputPath) !== path.resolve(output)) {
      try {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        try {
          fs.renameSync(outputPath, output);
        } catch (renameError) {
          fs.copyFileSync(outputPath, output);
          try { fs.unlinkSync(outputPath); } catch (unlinkError) {}
        }
      } catch (e) {
        return { ok: false, error: e.message || 'OBS_OUTPUT_MOVE_FAILED', filePath: outputPath };
      }
    }
    return { ok: true, filePath: output, backend: 'obs' };
  } catch (e) {
    try { if (client) client.close(); } catch (closeError) {}
    return { ok: false, error: e.message || 'OBS_CAPTURE_FAILED' };
  }
}
function newestVideoFile(dir, before) {
  let best = null;
  let bestTime = 0;
  try {
    fs.readdirSync(dir).forEach(name => {
      if (!/\.(mp4|mkv|mov|flv)$/i.test(name)) return;
      const file = path.join(dir, name);
      if (before && before.has(file)) return;
      const stat = fs.statSync(file);
      if (stat.mtimeMs > bestTime) {
        bestTime = stat.mtimeMs;
        best = file;
      }
    });
  } catch (e) {}
  return best;
}
ipcMain.handle('mineradio-wallpaper-scene-tools', async () => {
  const wallpaperEnginePath = findWallpaperEngineExe();
  const obsPath = findObsExe();
  const cacheDir = wallpaperConversionCacheDir();
  return {
    ok: true,
    wallpaperEnginePath,
    obsPath,
    cacheDir,
    canPreview: !!wallpaperEnginePath,
    canConvert: !!wallpaperEnginePath && !!obsPath,
  };
});
ipcMain.handle('mineradio-wallpaper-scene-convert', async (_event, payload) => {
  try {
    const id = safeWallpaperFileName(payload && payload.id);
    const fps = [24, 30, 60].includes(Number(payload && payload.fps)) ? Number(payload.fps) : 30;
    const duration = Math.max(8, Math.min(180, Number(payload && payload.duration) || 30));
    const resolution = String(payload && payload.resolution || 'screen');
    const bitrateMode = String(payload && payload.bitrate || 'high');
    const cacheDir = wallpaperConversionCacheDir();
    const output = path.join(cacheDir, `${id}-${Date.now()}.mp4`);
    const obsResult = await runObsSceneCapture(Object.assign({}, payload, { backend: 'obs' }), output, cacheDir);
    if (!obsResult.ok) {
      try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch (e) {}
      return obsResult;
    }
    const stat = fs.statSync(output);
    if ((stat.size || 0) < 256 * 1024) {
      return {
        ok: false,
        error: 'CAPTURE_TOO_SMALL',
        detail: 'OBS 输出文件过小，可能录制未启动或捕获失败。',
        filePath: output,
        size: stat.size || 0,
      };
    }
    return {
      ok: true,
      filePath: output,
      mediaUrl: wallpaperConvertedFileUrl(output),
      size: stat.size || 0,
      fps,
      duration,
      resolution,
      bitrate: bitrateMode,
      backend: 'obs',
    };
  } catch (e) {
    return { ok: false, error: e.message || 'SCENE_CONVERT_FAILED' };
  }
});
ipcMain.handle('mineradio-wallpaper-cache-open-folder', async (_event, filePath) => {
  try {
    const cacheDir = wallpaperConversionCacheDir();
    const target = String(filePath || '').trim();
    if (target && isPathInsideDir(cacheDir, target) && fs.existsSync(target)) {
      shell.showItemInFolder(target);
      return { ok: true, filePath: target };
    }
    shell.openPath(cacheDir);
    return { ok: true, folderPath: cacheDir };
  } catch (e) {
    return { ok: false, error: e.message || 'OPEN_CACHE_FOLDER_FAILED' };
  }
});
ipcMain.handle('mineradio-wallpaper-cache-delete-file', async (_event, filePath) => {
  try {
    const cacheDir = wallpaperConversionCacheDir();
    const legacyDir = path.join(app.getPath('userData'), 'wallpaper-cache');
    const target = path.resolve(String(filePath || '').trim());
    if (!target || (!isPathInsideDir(cacheDir, target) && !isPathInsideDir(legacyDir, target))) {
      return { ok: false, error: 'DELETE_OUTSIDE_CACHE' };
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.unlinkSync(target);
    return { ok: true, filePath: target };
  } catch (e) {
    return { ok: false, error: e.message || 'DELETE_CACHE_FILE_FAILED' };
  }
});
ipcMain.handle('mineradio-select-wallpaper-cache-folder', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const current = wallpaperConversionCacheDir();
    const result = await dialog.showOpenDialog(owner, {
      title: '选择 Scene 转换保存目录',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const folderPath = path.resolve(result.filePaths[0]);
    fs.mkdirSync(folderPath, { recursive: true });
    const config = readWallpaperToolsConfig();
    config.cacheDir = folderPath;
    saveWallpaperToolsConfig(config);
    process.env.MINERADIO_WALLPAPER_CACHE_DIR = folderPath;
    return { ok: true, folderPath };
  } catch (e) {
    return { ok: false, error: e.message || 'SELECT_CACHE_FOLDER_FAILED' };
  }
});
ipcMain.handle('mineradio-select-obs-file', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '选择 obs64.exe',
      defaultPath: findObsExe() || 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
      filters: [{ name: 'OBS Studio', extensions: ['exe'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const obsPath = result.filePaths[0];
    const config = readWallpaperToolsConfig();
    config.obsPath = obsPath;
    saveWallpaperToolsConfig(config);
    return { ok: true, obsPath };
  } catch (e) {
    return { ok: false, error: e.message || 'SELECT_OBS_FAILED' };
  }
});
ipcMain.handle('mineradio-wallpaper-obs-launch-admin', async () => {
  try {
    const obsPath = findObsExe();
    if (!obsPath) return { ok: false, error: 'OBS_MISSING' };
    await launchObsElevated(obsPath, 4455);
    return { ok: true, obsPath };
  } catch (e) {
    return { ok: false, error: e.message || 'OBS_ADMIN_LAUNCH_FAILED' };
  }
});
ipcMain.handle('mineradio-select-ffmpeg-file', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: '选择 ffmpeg.exe',
      properties: ['openFile'],
      filters: [{ name: 'ffmpeg', extensions: ['exe'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const ffmpegPath = result.filePaths[0];
    const config = readWallpaperToolsConfig();
    config.ffmpegPath = ffmpegPath;
    saveWallpaperToolsConfig(config);
    return { ok: true, ffmpegPath };
  } catch (e) {
    return { ok: false, error: e.message || 'SELECT_FFMPEG_FAILED' };
  }
});

ipcMain.handle('netease-music-open-login', async (event) => {
  return openNeteaseMusicLoginWindow(getSenderWindow(event));
});

ipcMain.handle('netease-music-clear-login', async () => {
  return clearNeteaseMusicLoginSession();
});

ipcMain.handle('qq-music-open-login', async (event) => {
  return openQQMusicLoginWindow(getSenderWindow(event));
});

ipcMain.handle('qq-music-clear-login', async () => {
  return clearQQMusicLoginSession();
});

ipcMain.handle('qq-music-playlist-write', async (_event, payload) => {
  try {
    return await writeQQPlaylistThroughOfficialWeb(payload || {});
  } catch (error) {
    console.error('QQ official playlist write failed:', error);
    return { ok: false, success: false, provider: 'qq', error: error.message || 'QQ_PLAYLIST_WRITE_FAILED' };
  }
});

ipcMain.handle('kuwo-music-open-login', async (event) => {
  return openKuwoMusicLoginWindow(getSenderWindow(event));
});

ipcMain.handle('kuwo-music-clear-login', async () => {
  return clearKuwoMusicLoginSession();
});

ipcMain.handle('mineradio-open-update-installer', async (_event, filePath) => {
  try {
    const target = path.resolve(String(filePath || ''));
    const updateDir = path.resolve(getUpdateDownloadDir());
    if (!target || !target.startsWith(updateDir + path.sep)) {
      return { ok: false, error: 'INVALID_UPDATE_PATH' };
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'UPDATE_FILE_MISSING' };
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'OPEN_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-restart-app', async () => {
  try {
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'RESTART_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-enabled', async (_event, enabled, payload) => {
  try {
    if (enabled) {
      createDesktopLyricsWindow(payload || {});
      broadcastDesktopLyricsEnabledState(true);
    } else {
      closeDesktopLyricsWindow();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-update', async (_event, payload) => {
  try {
    const nextState = { ...desktopLyricsState, ...(payload || {}) };
    if (nextState.enabled) {
      createDesktopLyricsWindow(payload || {});
    } else if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsState = nextState;
      sendDesktopLyricsState();
    } else {
      desktopLyricsState = nextState;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-dragging', async () => {
  return { ok: true };
});

ipcMain.handle('mineradio-desktop-lyrics-set-pointer-capture', async (_event, active) => {
  try {
    desktopLyricsPointerCapture = !!active;
    applyDesktopLyricsMouseBehavior();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_POINTER_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-hot-bounds', async (_event, bounds) => {
  try {
    const left = clampNumber(bounds && bounds.left, -2000, 4000, 0);
    const top = clampNumber(bounds && bounds.top, -2000, 4000, 0);
    const right = clampNumber(bounds && bounds.right, left + 1, 6000, left + 1);
    const bottom = clampNumber(bounds && bounds.bottom, top + 1, 6000, top + 1);
    desktopLyricsHotBounds = { left, top, right, bottom };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_HOT_BOUNDS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-lock-state', async (_event, locked) => {
  try {
    desktopLyricsState = { ...desktopLyricsState, clickThrough: !!locked };
    if (desktopLyricsState.clickThrough !== false) desktopLyricsPointerCapture = false;
    applyDesktopLyricsMouseBehavior();
    broadcastDesktopLyricsLockState();
    return { ok: true, locked: desktopLyricsState.clickThrough !== false };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_LOCK_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-move-by', async (_event, dx, dy) => {
  try {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return { ok: false, error: 'NO_DESKTOP_LYRICS_WINDOW' };
    if (desktopLyricsState.clickThrough !== false) return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' };
    const bounds = desktopLyricsWindow.getBounds();
    const next = {
      ...bounds,
      x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
      y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
    };
    desktopLyricsWindow.setBounds(next, false);
    desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_MOVE_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-set-enabled', async (_event, enabled, payload) => {
  try {
    if (enabled) createWallpaperWindow(payload || {});
    else closeWallpaperWindow();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-update', async (_event, payload) => {
  try {
    wallpaperState = { ...wallpaperState, ...(payload || {}) };
    if (wallpaperState.enabled) {
      createWallpaperWindow(wallpaperState);
      if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
        positionWallpaperWindow();
        sendWallpaperState();
      }
    } else if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      sendWallpaperState();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'WALLPAPER_UPDATE_FAILED' };
  }
});

async function createWindowInternal() {
  htmlFullscreenActive = false;
  windowFullscreenActive = false;
  mainPageReady = false;
  appendStartupLog('startup:begin', SAFE_GPU_MODE ? 'safe-gpu' : 'default-gpu');
  const port = await findOpenPort(3000);
  mainServerPort = port;

  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.COOKIE_FILE = path.join(app.getPath('userData'), '.cookie');
  process.env.QQ_COOKIE_FILE = path.join(app.getPath('userData'), '.qq-cookie');
  process.env.KUGOU_COOKIE_FILE = path.join(app.getPath('userData'), '.kugou-cookie');
  process.env.KUWO_COOKIE_FILE = path.join(app.getPath('userData'), '.kuwo-cookie');
  process.env.MINERADIO_UPDATE_DIR = getUpdateDownloadDir();

  const initialBounds = getWindowedBounds();

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 960,
    minHeight: 540,
    show: false,
    frame: false,
    fullscreen: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: APP_ICON_ICO,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl.startsWith(`http://127.0.0.1:${port}`)) {
      mainPageReady = true;
      appendStartupLog('main-page:ready');
    }
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
    sendWindowState(mainWindow);
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    appendStartupLog('main-page:load-failed', `${code} ${description} ${url}`);
  });

  mainWindow.webContents.on('unresponsive', () => {
    appendStartupLog('renderer:unresponsive', mainWindow.webContents.getURL());
    if (!mainPageReady) relaunchInSafeGpuMode('renderer-unresponsive-during-startup');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appendStartupLog('renderer:gone', JSON.stringify(details || {}));
    if (!mainPageReady) relaunchInSafeGpuMode(`renderer-gone-${details && details.reason || 'unknown'}`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape') && mainWindow.isFullScreen()) {
      event.preventDefault();
      exitFullscreenToWindow(mainWindow);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    sendWindowState(mainWindow);
  });

  mainWindow.on('maximize', () => sendWindowState(mainWindow));
  mainWindow.on('unmaximize', () => sendWindowState(mainWindow));
  mainWindow.on('minimize', () => sendWindowState(mainWindow));
  mainWindow.on('restore', () => sendWindowState(mainWindow));
  mainWindow.on('show', () => sendWindowState(mainWindow));
  mainWindow.on('hide', () => sendWindowState(mainWindow));
  mainWindow.on('focus', () => sendWindowState(mainWindow));
  mainWindow.on('blur', () => sendWindowState(mainWindow));
  mainWindow.on('move', () => scheduleWindowStateSend(mainWindow));
  mainWindow.on('resize', () => scheduleWindowStateSend(mainWindow));
  mainWindow.on('close', (event) => {
    if (appIsQuitting) return;
    event.preventDefault();
    hideMainWindowToTray(mainWindow);
  });
  mainWindow.on('closed', () => {
    if (mainWindowStateTimer) {
      clearTimeout(mainWindowStateTimer);
      mainWindowStateTimer = null;
    }
    closeOverlayWindows();
    mainWindow = null;
  });
  mainWindow.on('enter-full-screen', () => {
    windowFullscreenActive = true;
    sendWindowState(mainWindow);
  });
  mainWindow.on('leave-full-screen', () => {
    windowFullscreenActive = false;
    setTimeout(() => applyWindowedBounds(mainWindow), 50);
  });
  mainWindow.on('enter-html-full-screen', () => {
    htmlFullscreenActive = true;
    sendWindowState(mainWindow);
  });
  mainWindow.on('leave-html-full-screen', () => {
    htmlFullscreenActive = false;
    setTimeout(() => applyWindowedBounds(mainWindow), 50);
  });

  process.env.MINERADIO_WALLPAPER_CACHE_DIR = wallpaperConversionCacheDir();
  try {
    const legacyQQCookie = path.join(__dirname, '..', '.qq-cookie');
    if (fs.existsSync(legacyQQCookie)) {
      if (!fs.existsSync(process.env.QQ_COOKIE_FILE)) {
        fs.copyFileSync(legacyQQCookie, process.env.QQ_COOKIE_FILE);
      }
      fs.unlinkSync(legacyQQCookie);
    }
  } catch (e) {
    appendStartupLog('qq-cookie-migration:skipped', e.message);
  }

  appendStartupLog('local-server:loading');
  localServer = require(path.join(__dirname, '..', 'server.js'));
  await waitForServer(localServer);
  appendStartupLog('local-server:listening', String(port));

  const appSession = session.defaultSession;
  const isMineradioOrigin = (webContents, requestingOrigin) => {
    try {
      const target = new URL(requestingOrigin || webContents.getURL());
      return target.hostname === '127.0.0.1' && Number(target.port) === mainServerPort;
    } catch (e) {
      return false;
    }
  };
  appSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return isMineradioOrigin(webContents, requestingOrigin)
      && isAllowedPermissionCheck(permission, details);
  });
  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingOrigin = details && (details.securityOrigin || details.requestingUrl);
    callback(isMineradioOrigin(webContents, requestingOrigin)
      && isAllowedPermissionRequest(permission, details));
  });

  appendStartupLog('main-page:loading');
  await loadMainPageWithTimeout(mainWindow, `http://127.0.0.1:${port}`);
  appendStartupLog('startup:complete');
  return mainWindow;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return Promise.resolve(mainWindow);
  }
  if (mainWindowCreation) return mainWindowCreation;
  mainWindowCreation = createWindowInternal().finally(() => {
    mainWindowCreation = null;
  });
  return mainWindowCreation;
}

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!focusMainWindow()) {
      app.whenReady().then(() => createWindow()).catch((error) => handleStartupFailure(error));
    }
  });

  app.whenReady().then(async () => {
    screen.on('display-metrics-changed', () => {
      positionDesktopLyricsWindow();
      positionWallpaperWindow();
      scheduleWindowStateSend(mainWindow);
    });
    screen.on('display-added', () => scheduleWindowStateSend(mainWindow));
    screen.on('display-removed', () => scheduleWindowStateSend(mainWindow));
    await createWindow();
    createTray();
  }).catch((error) => handleStartupFailure(error));

  app.on('child-process-gone', (_event, details) => {
    appendStartupLog('child-process:gone', JSON.stringify(details || {}));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => handleStartupFailure(error));
    }
    else focusMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    appIsQuitting = true;
    unregisterMineradioGlobalHotkeys();
    closeOverlayWindows();
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
    if (localServer && localServer.close) localServer.close();
  });
}
