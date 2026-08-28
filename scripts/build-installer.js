'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const packagePath = path.join(root, 'package.json');
const packageLockPath = path.join(root, 'package-lock.json');
const changelogPath = path.join(root, 'CHANGELOG.md');
const generatedInstallerNotesPath = path.join(root, 'build', 'generated-release-notes.nsh');
const localElectronDist = path.join(root, '.cache', 'electron-dist-42.4.1');
const electronBuilderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const runtimeEntries = [
  'desktop',
  'public',
  path.join('resources', 'obs'),
  path.join('resources', 'location'),
  'providers',
  'licenses',
  'server.js',
  'dj-analyzer.js',
  'package.json',
  'THIRD_PARTY_NOTICES.md',
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      stdio: options.stdio || 'inherit',
      windowsHide: options.windowsHide === true,
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function ensureInsideRoot(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to access path outside project: ${target}`);
  }
}

function sensitiveReason(filePath) {
  const relative = path.relative(root, filePath).replace(/\\/g, '/').toLowerCase();
  const name = path.basename(relative);
  if (name === '.cookie' || name === '.qq-cookie' || name === '.kugou-cookie' || name === '.kuwo-cookie') return 'account cookie';
  if (name === '.env' || name.startsWith('.env.')) return 'environment secret';
  if (name.endsWith('.log') || name.endsWith('.tmp')) return 'local runtime log';
  if (/(^|\/)(updates|wallpaper-cache|backups)(\/|$)/.test(relative)) return 'user cache/data directory';
  return '';
}

function scanSensitiveFiles(entryPath, findings) {
  if (!fs.existsSync(entryPath)) return;
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entryPath)) {
      scanSensitiveFiles(path.join(entryPath, name), findings);
    }
    return;
  }
  const reason = sensitiveReason(entryPath);
  if (reason) findings.push({ filePath: entryPath, reason });
}

function assertPrivacyBoundary(baseDir, entries) {
  const findings = [];
  for (const entry of entries) scanSensitiveFiles(path.join(baseDir, entry), findings);
  if (findings.length) {
    const detail = findings.map(item => `${item.reason}: ${item.filePath}`).join('\n');
    throw new Error(`Private or runtime files would enter the installer:\n${detail}`);
  }
}

function assertInstallerConfig(pkg) {
  const build = pkg.build || {};
  const nsis = build.nsis || {};
  if (nsis.oneClick !== false) throw new Error('NSIS must use the assisted installer.');
  if (nsis.allowToChangeInstallationDirectory !== false) {
    throw new Error('The built-in directory page must stay disabled; Mineradio supplies its own directory selector.');
  }
  if (nsis.createDesktopShortcut !== true || nsis.createStartMenuShortcut !== true) {
    throw new Error('Desktop and Start Menu shortcuts must remain enabled.');
  }
  if (!Array.isArray(nsis.installerLanguages) || !nsis.installerLanguages.includes('zh_CN')) {
    throw new Error('Simplified Chinese installer language is required.');
  }
  if (build.compression !== 'maximum') throw new Error('Release installer must use maximum compression.');
  const files = Array.isArray(build.files) ? build.files : [];
  if (!files.includes('resources/location/**/*')) throw new Error('Offline location data is missing from the installer file list.');
  if (files.includes('build/**/*')) throw new Error('Build-time installer assets must not be copied into the installed app.');
  if (pkg.author !== 'Mikalinsa') throw new Error('Release author must be Mikalinsa.');
  if (pkg.mineradio?.edition !== 'TwT Edition' || pkg.mineradio?.creator !== 'Mikalinsa') {
    throw new Error('TwT Edition identity is missing from package.json.');
  }
  if (nsis.artifactName !== 'TwT-${version}-Setup.${ext}') {
    throw new Error('Installer artifact naming must identify the TwT edition.');
  }
}

function readReleaseNotes(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid SemVer release version: ${version}`);
  const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error(`package-lock.json version must match package.json ${version}.`);
  }
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const escaped = version.replace(/\./g, '\\.');
  const match = changelog.match(new RegExp(`^## v${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  if (!match) throw new Error(`CHANGELOG.md is missing a ## v${version} section.`);
  const notes = match[1].split(/\r?\n/)
    .map(line => line.match(/^[-*]\s+(.+)/)?.[1]?.trim())
    .filter(Boolean);
  if (!notes.length) throw new Error(`CHANGELOG.md v${version} must contain at least one release note.`);
  return notes;
}

function writeInstallerReleaseNotes(pkg) {
  const escapeNsis = value => String(value)
    .replace(/\$/g, '$$')
    .replace(/"/g, '$\\"');
  const summary = pkg.releaseNotes.slice(0, 6)
    .map(note => `- ${escapeNsis(note)}`)
    .join('$\\r$\\n');
  fs.writeFileSync(generatedInstallerNotesPath, [
    '; Generated by scripts/build-installer.js. Do not edit manually.',
    `!define MIKALINSA_RELEASE_NOTES "${summary}"`,
    '',
  ].join('\r\n'), 'utf8');
}

async function validate() {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assertInstallerConfig(pkg);
  pkg.releaseNotes = readReleaseNotes(pkg.version);
  assertPrivacyBoundary(root, runtimeEntries);

  const checks = [
    ['node', ['--check', 'server.js']],
    ['node', ['--check', path.join('desktop', 'main.js')]],
    ['node', ['--check', path.join('desktop', 'preload.js')]],
    ['node', ['--check', path.join('desktop', 'overlay-preload.js')]],
    ['node', ['--check', path.join('scripts', 'build-installer.js')]],
    ['node', [path.join('scripts', 'check-inline-scripts.js')]],
  ];
  for (const [command, args] of checks) {
    console.log(`[installer] check: ${command} ${args.join(' ')}`);
    await run(command, args);
  }

  const testsDir = path.join(root, 'tests');
  const tests = fs.readdirSync(testsDir).filter(name => name.endsWith('.test.js')).sort();
  for (const test of tests) {
    console.log(`[installer] test: ${test}`);
    await run('node', [path.join(testsDir, test)]);
  }
  return pkg;
}

async function stopMineradioProcesses() {
  if (process.platform !== 'win32') return;
  const script = [
    "Get-Process Mineradio -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
    'Start-Sleep -Milliseconds 900',
  ].join('; ');
  console.log('[installer] stop running Mineradio instances');
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function clearStaleArtifacts(productName, version) {
  fs.mkdirSync(distDir, { recursive: true });
  const releaseBase = `${productName}-${version}`;
  const names = [
    `${releaseBase}-Setup.exe`,
    `${releaseBase}-Setup.exe.blockmap`,
    `${releaseBase}-更新说明.txt`,
    `${releaseBase}-SHA256SUMS.txt`,
    `${releaseBase}-release-manifest.json`,
  ];
  for (const name of names) {
    const target = path.join(distDir, name);
    ensureInsideRoot(target);
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
}

async function buildInstaller(pkg) {
  if (!fs.existsSync(electronBuilderCli)) throw new Error('electron-builder is not installed.');
  if (!fs.existsSync(path.join(localElectronDist, 'electron.exe'))) {
    throw new Error('Local Electron runtime is missing. Run the preview packaging workflow once before building a release installer.');
  }
  const productName = pkg.productName || 'Mineradio';
  writeInstallerReleaseNotes(pkg);
  clearStaleArtifacts(productName, pkg.version);
  const args = [
    electronBuilderCli,
    '--win',
    'nsis',
    `--config.electronDist=${localElectronDist}`,
  ];
  console.log('[installer] build NSIS assisted installer');
  await run(process.execPath, args);
}

function assertPortablePackagePrivacy() {
  const packagedApp = path.join(distDir, 'win-unpacked', 'resources', 'app');
  if (!fs.existsSync(packagedApp)) throw new Error('Packaged app directory was not generated.');
  const findings = [];
  scanSensitiveFiles(packagedApp, findings);
  if (findings.length) {
    throw new Error(`Packaged app contains private/runtime files:\n${findings.map(item => item.filePath).join('\n')}`);
  }
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function writeReleaseMetadata(pkg) {
  const productName = pkg.productName || 'TwT';
  const releaseBase = `${productName}-${pkg.version}`;
  const installerName = `${releaseBase}-Setup.exe`;
  const installerPath = path.join(distDir, installerName);
  if (!fs.existsSync(installerPath)) throw new Error(`Installer was not generated: ${installerPath}`);
  const stat = fs.statSync(installerPath);
  if (stat.size < 10 * 1024 * 1024) throw new Error('Generated installer is unexpectedly small.');
  const header = Buffer.alloc(2);
  const fd = fs.openSync(installerPath, 'r');
  fs.readSync(fd, header, 0, 2, 0);
  fs.closeSync(fd);
  if (header.toString('ascii') !== 'MZ') throw new Error('Generated installer is not a valid Windows executable.');

  const digest = await sha256(installerPath);
  const checksumName = `${releaseBase}-SHA256SUMS.txt`;
  const notesName = `${releaseBase}-更新说明.txt`;
  const manifestName = `${releaseBase}-release-manifest.json`;
  fs.writeFileSync(path.join(distDir, checksumName), `${digest}  ${installerName}\r\n`, 'utf8');
  fs.writeFileSync(path.join(distDir, notesName), [
    `TwT ${pkg.version} - ${pkg.mineradio.edition}`,
    '',
    ...pkg.releaseNotes.map(note => `- ${note}`),
    '',
  ].join('\r\n'), 'utf8');
  fs.writeFileSync(path.join(distDir, manifestName), JSON.stringify({
    product: productName,
    version: pkg.version,
    edition: pkg.mineradio.edition,
    creator: pkg.mineradio.creator,
    generatedAt: new Date().toISOString(),
    installer: installerName,
    bytes: stat.size,
    sha256: digest,
    installMode: 'assisted-per-user',
    selectableInstallDirectory: true,
    uninstallProgram: `Uninstall ${productName}.exe`,
    packagedUserData: false,
    userDataLocation: '%APPDATA%/Mineradio',
    releaseNotes: pkg.releaseNotes,
  }, null, 2) + '\n', 'utf8');

  console.log(`[installer] ready: ${installerPath}`);
  console.log(`[installer] size: ${(stat.size / 1048576).toFixed(1)} MB`);
  console.log(`[installer] sha256: ${digest}`);
}

async function main() {
  const pkg = await validate();
  await stopMineradioProcesses();
  await buildInstaller(pkg);
  assertPortablePackagePrivacy();
  await writeReleaseMetadata(pkg);
}

main().catch(error => {
  console.error(`[installer] ${error.stack || error.message}`);
  process.exitCode = 1;
});
