'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const releases = [];

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

for (const version of ['1.1.2', '1.1.3', '1.1.4', '1.1.5']) {
  const base = `Mineradio-Mikalinsa-${version}`;
  const names = [
    `${base}-Setup.exe`,
    `${base}-Setup.exe.blockmap`,
    `${base}-更新说明.txt`,
    `${base}-release-manifest.json`,
    `${base}-SHA256SUMS.txt`,
    `${base}-Corresponding-Source.zip`,
    `${base}-Corresponding-Source.zip.sha256.txt`
  ];
  const assets = names.map((name) => {
    const file = path.join(dist, name);
    if (!fs.existsSync(file)) throw new Error(`Missing release asset: ${name}`);
    const stat = fs.statSync(file);
    return { name, bytes: stat.size, sha256: sha256(file) };
  });
  const releaseManifest = JSON.parse(fs.readFileSync(path.join(dist, `${base}-release-manifest.json`), 'utf8'));
  const installerAsset = assets.find((asset) => asset.name === `${base}-Setup.exe`);
  if (releaseManifest.version !== version || releaseManifest.sha256 !== installerAsset.sha256) {
    throw new Error(`Installer manifest mismatch for v${version}.`);
  }
  const installerChecksums = fs.readFileSync(path.join(dist, `${base}-SHA256SUMS.txt`), 'utf8').toLowerCase();
  if (!installerChecksums.includes(installerAsset.sha256)) {
    throw new Error(`Installer checksum file mismatch for v${version}.`);
  }
  const sourceAsset = assets.find((asset) => asset.name === `${base}-Corresponding-Source.zip`);
  const sourceChecksums = fs.readFileSync(path.join(dist, `${base}-Corresponding-Source.zip.sha256.txt`), 'utf8').toLowerCase();
  if (!sourceChecksums.includes(sourceAsset.sha256)) {
    throw new Error(`Source checksum file mismatch for v${version}.`);
  }
  releases.push({
    tag: `v${version}`,
    title: `Mineradio v${version} - Mikalinsa Edition`,
    notes: `release-notes/v${version}.md`,
    prerelease: false,
    latest: version === '1.1.5',
    assets
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  repository: 'Mikalinsa/Mineradio-derivative-work',
  upstream: 'XxHuberrr/Mineradio',
  upstreamBaseline: 'v1.1.1',
  upstreamBaselineReuploaded: false,
  releases
};

fs.writeFileSync(path.join(root, 'release-publication-manifest.json'), `${JSON.stringify(payload, null, 2)}\n`);
