# Release Policy / 发布政策

## Version identity

- Tags use `vX.Y.Z`.
- Public binaries are identified as `Mikalinsa Edition`.
- The upstream baseline is Mineradio v1.1.1 by XxHuberrr.
- A published version number is immutable; a rebuilt installer requires a new version.

## Required correspondence

Every installer Release must point to the tag containing the application source
used for that installer. Do not use a newer or older source tree as a substitute.
GitHub's source archive for the tag is the application corresponding source.

Bundled third-party GPL components must also have their license, version, source
location and build/configuration information documented in
`THIRD_PARTY_NOTICES.md` and the Release notes.

## Pre-release checks

1. Confirm `package.json`, `package-lock.json`, installer name and Changelog version.
2. Confirm update owner/repository is `Mikalinsa/Mineradio-derivative-work`.
3. Run secret and privacy scans; reject Cookie, Token, user media and local logs.
4. Run syntax checks, automated tests and an Electron smoke test.
5. Build with `npm run package:installer`.
6. Verify installer, blockmap, manifest, notes and SHA-256 files.
7. Create the version tag from the exact build source.
8. Publish Release notes with upstream attribution, third-party notices, known
   limitations, unsigned-installer warning and source links.
9. Upload assets only after the source tag is visible.

## Historical releases

Historical binaries may be published only after their exact Electron
`resources/app` source has been recovered and committed to the matching tag.
The upstream v1.1.1 binary must be labeled as an upstream baseline and must not
be represented as a Mikalinsa-authored build.

## Release assets

- `Mineradio-Mikalinsa-X.Y.Z-Setup.exe`
- `Mineradio-Mikalinsa-X.Y.Z-Setup.exe.blockmap`
- `Mineradio-Mikalinsa-X.Y.Z-更新说明.txt`
- `Mineradio-Mikalinsa-X.Y.Z-release-manifest.json`
- `Mineradio-Mikalinsa-X.Y.Z-SHA256SUMS.txt`
- `latest.yml` for the latest supported update channel only

GitHub automatically provides source `.zip` and `.tar.gz` archives for each tag.
