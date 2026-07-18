# Building Mineradio Mikalinsa Edition

## Requirements

- Windows 10/11 x64
- Node.js 20 LTS or newer
- npm
- Git
- OBS Studio 32.1.2 portable files when Scene capture is required

## Build

```powershell
git clone https://github.com/Mikalinsa/Mineradio-derivative-work.git
cd Mineradio-derivative-work
npm ci
npm start
```

Directory build:

```powershell
npm run build:win:dir
```

Installer build:

```powershell
npm run package:installer
```

## Third-party binary inputs

`resources/obs/` is intentionally excluded from Git because the portable OBS
distribution contains files larger than GitHub's normal source-file limit. Use
OBS Studio 32.1.2 from its official release and place the portable tree under
`resources/obs/`. Keep the original file layout and license files.

FFmpeg is resolved by `@ffmpeg-installer/ffmpeg` during `npm ci`. The configured
binary in current releases enables GPLv3 components. See
`THIRD_PARTY_NOTICES.md` before redistributing a build.

## Reproducibility

Each GitHub Release is attached to a version tag. GitHub's generated source
archive for that tag is the corresponding Mineradio application source. Build
timestamps, dependency mirrors and unsigned Windows metadata can make the
rebuilt installer hash differ even when the source is equivalent.
