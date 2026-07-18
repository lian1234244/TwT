const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appOutDir = path.join(root, 'dist', 'win-unpacked');
const packagedAppDir = path.join(appOutDir, 'resources', 'app');
const exePath = path.join(appOutDir, 'Mineradio.exe');
const localElectronDist = path.join(root, '.cache', 'electron-dist-42.4.1');

const validationCommands = [
  ['node', ['--check', 'server.js']],
  ['node', ['--check', path.join('desktop', 'main.js')]],
  ['node', ['--check', path.join('desktop', 'preload.js')]],
  ['node', ['--check', path.join('desktop', 'overlay-preload.js')]],
  ['node', [path.join('scripts', 'check-inline-scripts.js')]],
];

const appEntries = [
  'desktop',
  'public',
  'obs',
  'resources',
  'providers',
  'build',
  'licenses',
  'server.js',
  'dj-analyzer.js',
  'package.json',
  'THIRD_PARTY_NOTICES.md',
];

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let child = null;

    try {
      child = spawn(command, args, {
        cwd: root,
        shell: false,
        stdio: options.stdio || 'inherit',
        env: process.env,
        windowsHide: options.windowsHide === true,
      });
    } catch (error) {
      console.error(`[pack-preview] ${command} failed to start: ${error.message}`);
      resolve({ code: 1, error });
      return;
    }

    let timer = null;
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        if (settled) {
          return;
        }
        console.error(`[pack-preview] timeout: ${command} ${args.join(' ')}`);
        timedOut = true;
        child.kill();
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      console.error(`[pack-preview] ${command} failed to start: ${error.message}`);
      resolve({ code: 1, error });
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ code: timedOut ? 1 : code || 0 });
    });
  });
}

async function stopPackagedProcesses() {
  if (process.platform !== 'win32' || !fs.existsSync(appOutDir)) {
    return;
  }

  const escapedRoot = appOutDir.replace(/'/g, "''");
  const script = [
    `$root = [IO.Path]::GetFullPath('${escapedRoot}').TrimEnd('\\') + '\\'`,
    '$processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {',
    "  ($_.Name -ieq 'Mineradio.exe') -or ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase))",
    '}',
    'foreach ($process in $processes) {',
    '  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue',
    '}',
  ].join('\r\n');
  console.log('[pack-preview] stop: packaged Mineradio and bundled OBS processes');
  const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'ignore',
    windowsHide: true,
    timeoutMs: 15000,
  });
  if (result.code !== 0) {
    console.warn('[pack-preview] some packaged processes may still be running.');
  }
  await new Promise(resolve => setTimeout(resolve, 700));
}

async function validate() {
  for (const [command, args] of validationCommands) {
    console.log(`[pack-preview] check: ${command} ${args.join(' ')}`);
    const result = await run(command, args);
    if (result.code !== 0) {
      throw new Error(`Validation failed: ${command} ${args.join(' ')}`);
    }
  }

  const previewTests = [
    ['wallpaper capture geometry', path.join(root, 'tests', 'wallpaper-capture-geometry.test.js')],
    ['wallpaper OBS state', path.join(root, 'tests', 'wallpaper-obs-state.test.js')],
    ['playlist panel performance contract', path.join(root, 'tests', 'playlist-panel-performance.test.js')],
    ['desktop transparency contract', path.join(root, 'tests', 'desktop-transparency.test.js')],
    ['home DIY module contract', path.join(root, 'tests', 'home-diy-module.test.js')],
    ['multi-provider Home discovery', path.join(root, 'tests', 'home-discover-multi-provider.test.js')],
    ['home weather location', path.join(root, 'tests', 'home-weather-location.test.js')],
    ['weather reverse location', path.join(root, 'tests', 'weather-reverse-location.test.js')],
    ['professional equalizer contract', path.join(root, 'tests', 'professional-equalizer.test.js')],
    ['user archive equalizer contract', path.join(root, 'tests', 'user-archive-equalizer.test.js')],
    ['camera permission policy', path.join(root, 'tests', 'camera-permission-policy.test.js')],
    ['home entry performance contract', path.join(root, 'tests', 'home-entry-performance.test.js')],
    ['home cassette deck contract', path.join(root, 'tests', 'home-cassette-deck.test.js')],
    ['control cover void shortcut contract', path.join(root, 'tests', 'control-cover-void-shortcut.test.js')],
    ['stage shelf controls reveal contract', path.join(root, 'tests', 'shelf-stage-controls.test.js')],
    ['interaction QoS contract', path.join(root, 'tests', 'interaction-qos.test.js')],
    ['composite frame scheduler', path.join(root, 'tests', 'composite-frame-scheduler.test.js')],
    ['adaptive performance observer', path.join(root, 'tests', 'adaptive-performance-observer.test.js')],
    ['visual frame task scheduler', path.join(root, 'tests', 'visual-frame-task-scheduler.test.js')],
    ['app visual FPS control contract', path.join(root, 'tests', 'app-visual-fps-control.test.js')],
    ['lyric field motion contract', path.join(root, 'tests', 'lyric-field-motion.test.js')],
    ['magnetic lyric field contract', path.join(root, 'tests', 'magnetic-lyric-field.test.js')],
    ['editorial and star-track preset contract', path.join(root, 'tests', 'editorial-startrack-presets.test.js')],
    ['kugou rhythm analysis', path.join(root, 'tests', 'kugou-rhythm-analysis.test.js')],
    ['Kuwo login UI disabled', path.join(root, 'tests', 'kuwo-login-hidden.test.js')],
    ['music provider expansion', path.join(root, 'tests', 'music-provider-expansion.test.js')],
    ['platform collection and queue', path.join(root, 'tests', 'platform-collection-queue.test.js')],
      ['login window compatibility', path.join(root, 'tests', 'login-window-compatibility.test.js')],
      ['tray mode', path.join(root, 'tests', 'tray-mode.test.js')],
      ['splash accent controls', path.join(root, 'tests', 'splash-accent-controls.test.js')],
      ['user FX archive completeness', path.join(root, 'tests', 'user-fx-archive-completeness.test.js')],
      ['playlist cover fallback', path.join(root, 'tests', 'playlist-cover-fallback.test.js')],
  ];
  for (const [label, testFile] of previewTests) {
    if (!fs.existsSync(testFile)) continue;
    console.log(`[pack-preview] test: ${label}`);
    const result = await run('node', [testFile]);
    if (result.code !== 0) {
      throw new Error(`${label} test failed`);
    }
  }
}

async function tryFullBuild() {
  const electronBuilderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
  const args = [electronBuilderCli, '--win', 'dir'];
  if (fs.existsSync(path.join(localElectronDist, 'electron.exe'))) {
    args.push(`--config.electronDist=${localElectronDist}`);
    console.log(`[pack-preview] build: use local Electron ${localElectronDist}`);
  }
  console.log('[pack-preview] build: electron-builder --win dir');
  const result = await run(process.execPath, args, {
    timeoutMs: 120000,
  });
  return result.code === 0;
}

function ensureInsideRoot(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside project: ${target}`);
  }
}

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function syncAppIntoExistingPackage() {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Missing existing preview exe: ${exePath}`);
  }

  ensureInsideRoot(packagedAppDir);
  fs.mkdirSync(packagedAppDir, { recursive: true });

  for (const entry of appEntries) {
    const source = path.join(root, entry);
    const target = path.join(packagedAppDir, entry);
    ensureInsideRoot(target);
    copyRecursive(source, target);
  }

  console.log('[pack-preview] synced app files into existing dist/win-unpacked.');
}

function verifyPackagedUiMatchesSource() {
  const sourceUi = path.join(root, 'public', 'index.html');
  const packagedUi = path.join(packagedAppDir, 'public', 'index.html');
  if (!fs.existsSync(packagedUi)) {
    throw new Error(`Missing packaged UI: ${packagedUi}`);
  }
  const source = fs.readFileSync(sourceUi);
  const packaged = fs.readFileSync(packagedUi);
  if (!source.equals(packaged)) {
    throw new Error('Packaged public/index.html is stale and does not match the current source.');
  }
  console.log('[pack-preview] verified: packaged UI matches current source.');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function previewLaunchArgs() {
  const normalUserData = process.env.APPDATA && path.join(process.env.APPDATA, 'Mineradio');
  const probe = normalUserData && path.join(normalUserData, '.mineradio-preview-write-probe');
  try {
    if (!normalUserData) throw new Error('APPDATA is unavailable');
    fs.mkdirSync(normalUserData, { recursive: true });
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return [];
  } catch (error) {
    const fallback = path.join(os.tmpdir(), 'Mineradio-Codex-Preview');
    fs.mkdirSync(fallback, { recursive: true });
    console.warn(`[pack-preview] APPDATA is not writable; use isolated preview profile: ${fallback}`);
    return [
      `--user-data-dir=${fallback}`,
      `--mineradio-user-data-dir=${fallback}`,
      '--mineradio-safe-gpu',
    ];
  }
}

async function launchPreview() {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Cannot launch missing exe: ${exePath}`);
  }

  const launchArgs = previewLaunchArgs();
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    console.log(`[pack-preview] launch (${attempt}/2): ${exePath}`);
    if (process.platform === 'win32') {
      const escapedExe = exePath.replace(/'/g, "''");
      const escapedCwd = appOutDir.replace(/'/g, "''");
      const escapedArgs = launchArgs.map(arg => `'${arg.replace(/'/g, "''")}'`).join(', ');
      const argumentList = launchArgs.length ? ' -ArgumentList $arguments' : '';
      const launchScript = [
        `$stdout = Join-Path '${escapedCwd}' 'mineradio-preview.stdout.log'`,
        `$stderr = Join-Path '${escapedCwd}' 'mineradio-preview.stderr.log'`,
        `Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue`,
        `$arguments = @(${escapedArgs})`,
        `$p = Start-Process -FilePath '${escapedExe}'${argumentList} -WorkingDirectory '${escapedCwd}' -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Normal`,
        'Start-Sleep -Seconds 6',
        '$p.Refresh()',
        'if ($p.HasExited) { exit 1 }',
        'Write-Output ("[pack-preview] preview process stable: pid " + $p.Id)',
      ].join('\r\n');
      const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launchScript], {
        timeoutMs: 12000,
      });
      if (result.code === 0) return;
    } else {
      const child = spawn(exePath, launchArgs, {
        cwd: appOutDir,
        detached: true,
        stdio: 'ignore',
      });
      await delay(6000);
      if (child.exitCode == null && !child.killed) {
        child.unref();
        console.log(`[pack-preview] preview process stable: pid ${child.pid}`);
        return;
      }
    }
    if (attempt < 2) {
      console.warn('[pack-preview] preview exited during single-instance handoff; retrying.');
      await delay(1400);
    }
  }
  throw new Error('Preview process exited immediately after two launch attempts.');
}

async function main() {
  await validate();
  await stopPackagedProcesses();

  const fullBuildOk = await tryFullBuild();
  if (fullBuildOk) {
    console.log('[pack-preview] full win-unpacked build complete.');
  } else {
    console.warn('[pack-preview] full build failed; falling back to syncing app files.');
  }

  // A timed-out builder can leave a valid executable beside stale app files.
  // Sync and verify after either path so the launched preview is always current.
  syncAppIntoExistingPackage();
  verifyPackagedUiMatchesSource();

  await launchPreview();
}

main().catch((error) => {
  console.error(`[pack-preview] ${error.message}`);
  process.exitCode = 1;
});
