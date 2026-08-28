const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const workflow = fs.readFileSync(path.join(root, 'scripts', 'build-installer.js'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'build', 'installerSidebar.bmp'));

function assertSidebarFooterIsBlank(bitmap) {
  assert.strictEqual(bitmap.toString('ascii', 0, 2), 'BM', 'installer sidebar must remain a BMP');
  const pixelOffset = bitmap.readUInt32LE(10);
  const width = bitmap.readInt32LE(18);
  const signedHeight = bitmap.readInt32LE(22);
  const height = Math.abs(signedHeight);
  const bitsPerPixel = bitmap.readUInt16LE(28);
  assert([24, 32].includes(bitsPerPixel), 'installer sidebar contract expects a 24-bit or 32-bit BMP');
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const footerStartY = Math.floor(height * 0.68);
  for (let y = footerStartY; y < height; y += 1) {
    const sourceY = signedHeight > 0 ? height - 1 - y : y;
    const rowOffset = pixelOffset + sourceY * rowSize;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + x * bytesPerPixel;
      assert(
        bitmap[offset] >= 248 && bitmap[offset + 1] >= 248 && bitmap[offset + 2] >= 248,
        `installer sidebar footer must stay blank at ${x},${y}`,
      );
    }
  }
}

assert.strictEqual(pkg.scripts['package:installer'], 'node scripts/build-installer.js');
assert.strictEqual(lock.version, pkg.version);
assert.strictEqual(lock.packages[''].version, pkg.version);
assert.match(changelog, new RegExp(`^## v${pkg.version.replace(/\./g, '\\.')}$`, 'm'));
assert.strictEqual(pkg.author, 'Mikalinsa');
assert.strictEqual(pkg.mineradio.edition, 'TwT Edition');
assert.strictEqual(pkg.mineradio.creator, 'Mikalinsa');
assert.strictEqual(pkg.build.nsis.artifactName, 'TwT-${version}-Setup.${ext}');
assert.strictEqual(pkg.build.compression, 'maximum');
assert.strictEqual(pkg.build.nsis.oneClick, false);
assert.strictEqual(pkg.build.nsis.perMachine, false);
assert.strictEqual(pkg.build.nsis.allowToChangeInstallationDirectory, false);
assert.strictEqual(pkg.build.nsis.deleteAppDataOnUninstall, false);
assert(pkg.build.nsis.installerLanguages.includes('zh_CN'));
assert(pkg.build.files.includes('resources/location/**/*'));
assert(pkg.build.files.includes('resources/vendor/kugoumusicapi/**/*'));
assert(pkg.build.files.includes('providers/**/*'));
assert(!pkg.build.files.includes('build/**/*'));
['!**/.cookie', '!**/.qq-cookie', '!**/.env*', '!**/*.log', '!**/updates/**/*', '!**/wallpaper-cache/**/*']
  .forEach(pattern => assert(pkg.build.files.includes(pattern), `missing private file exclusion: ${pattern}`));

[
  'Page custom MineradioDirectoryShow MineradioDirectoryLeave',
  'Page custom MineradioReleaseNotesShow',
  'Function MineradioReleaseNotesShow',
  '${MIKALINSA_RELEASE_NOTES}',
  '${WS_VSCROLL}|${ES_MULTILINE}|${ES_AUTOVSCROLL}|${ES_READONLY}',
  '!macro customInstall',
  '!macro customRemoveFiles',
  'Uninstall ${PRODUCT_FILENAME}.exe',
  'MUI_INSTFILESPAGE_COLORS',
  'TWT  /  v${VERSION}',
  'Sleep 900',
].forEach(contract => assert(installer.includes(contract), `missing installer contract: ${contract}`));
assert(
  /!macro customRemoveFiles\s+Call un\.MineradioValidateUninstallDir\s+Call un\.MineradioRemoveInstalledFiles\s+!macroend/.test(installer),
  'uninstall safety validation must run after electron-builder restores the real install directory',
);
assert(!installer.includes('!macro customUnInit'), 'uninstall validation must not run from the temporary NSIS directory');
assert(!installer.includes('为这台电脑安装 Mineradio。默认安装到'), 'welcome page must not advertise a fixed install path');
assert(!installer.includes('默认位置：$INSTDIR'), 'welcome page must not repeat a default install path');
assertSidebarFooterIsBlank(sidebar);
[
  'RMDir /r "$INSTDIR\\locales"',
  'RMDir /r "$INSTDIR\\resources"',
  'RMDir /r "$INSTDIR\\swiftshader"',
  'Delete "$INSTDIR\\${MINERADIO_INSTALL_MARKER}"',
].forEach(contract => assert(installer.includes(contract), `missing recursive uninstall cleanup: ${contract}`));
assert(!installer.includes('Mineradio 不安装到 C 盘'), 'installer must allow users to choose any safe drive');

[
  'assertPrivacyBoundary(root, runtimeEntries)',
  'assertPortablePackagePrivacy()',
  "'--win'",
  "'nsis'",
  'SHA256SUMS.txt',
  'readReleaseNotes(pkg.version)',
  '更新说明.txt',
  'releaseNotes: pkg.releaseNotes',
  'writeInstallerReleaseNotes(pkg)',
  "uninstallProgram: `Uninstall ${productName}.exe`",
].forEach(contract => assert(workflow.includes(contract), `missing release workflow contract: ${contract}`));

console.log('installer workflow contract tests passed');
