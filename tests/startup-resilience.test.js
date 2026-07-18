const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const previewWorkflow = fs.readFileSync(path.join(root, 'scripts', 'pack-preview.js'), 'utf8');
const policy = require(path.join(root, 'desktop', 'startup-policy'));

const defaultSwitches = policy.chromiumPerformanceSwitches({});
const defaultNames = new Set(defaultSwitches.map(([name]) => name));
['ignore-gpu-blocklist', 'force_high_performance_gpu', 'use-angle']
  .forEach(name => assert(!defaultNames.has(name), `default startup must not force risky GPU switch: ${name}`));

const forcedSwitches = policy.chromiumPerformanceSwitches({ MINERADIO_FORCE_GPU: '1' });
const forcedNames = new Set(forcedSwitches.map(([name]) => name));
['ignore-gpu-blocklist', 'force_high_performance_gpu', 'use-angle']
  .forEach(name => assert(forcedNames.has(name), `explicit GPU override must retain advanced switch: ${name}`));

const startupWindowAt = main.indexOf('mainWindow = new BrowserWindow({');
const serverRequireAt = main.indexOf("require(path.join(__dirname, '..', 'server.js'))");
assert(startupWindowAt >= 0, 'main window must be prepared before heavy initialization');
assert(serverRequireAt > startupWindowAt, 'main window and recovery handlers must be prepared before the local server is required');
assert(!main.includes('showStartupWindow('), 'startup must not insert an extra page before the original animation');
assert(!fs.existsSync(path.join(root, 'desktop', 'startup.html')), 'extra lightweight startup page must stay removed');

[
  "mainWindow.webContents.on('unresponsive'",
  "mainWindow.webContents.on('render-process-gone'",
  'handleStartupFailure(error)',
  "path.join(app.getPath('userData'), 'startup.log')",
  "arg.startsWith('--mineradio-user-data-dir=')",
  "app.setPath('userData', customUserDataDir)",
  'app.disableHardwareAcceleration()',
  "appendSwitch('disable-gpu-sandbox')",
].forEach(contract => assert(main.includes(contract), `missing startup recovery contract: ${contract}`));

assert(/Function MineradioFinishStartApp[\s\S]*?Sleep\s+\d+[\s\S]*?ExecShellAsUser/.test(installer),
  'installer must briefly delay first launch until setup has settled');
assert(previewWorkflow.includes('function previewLaunchArgs()'), 'preview workflow must probe user-data write access');
assert(previewWorkflow.includes('--user-data-dir=${fallback}'), 'preview workflow must isolate Chromium user data');
assert(previewWorkflow.includes('--mineradio-user-data-dir=${fallback}'), 'preview workflow must isolate Electron user data');
assert(previewWorkflow.includes("'--mineradio-safe-gpu'"), 'sandboxed preview must use the safe GPU recovery path');

console.log('startup resilience contract tests passed');
