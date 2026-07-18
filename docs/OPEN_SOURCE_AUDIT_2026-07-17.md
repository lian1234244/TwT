# Open-source publication audit - 2026-07-17

This document records the checks performed before the first public publication
of Mineradio Mikalinsa Edition. It is an engineering compliance record, not
legal advice or a guarantee that every jurisdiction or third-party contract has
the same requirements.

## Identity and provenance

- Upstream: `XxHuberrr/Mineradio`
- Upstream baseline: `v1.1.1`
- Derivative maintainer: `Mikalinsa`
- Derivative versions reviewed: `v1.1.2` through `v1.1.5`
- Main license: GNU GPL v3.0
- Upstream attribution retained in `NOTICE.md` and `README.md`

## Privacy and secret review

- Local KuGou session files were found and excluded by `.gitignore`.
- Debug and launch logs were found and excluded.
- QQ/NetEase/KuGou cookies, environment files, user cache, Wallpaper output,
  user media, build output and agent checkpoints are excluded.
- A long hexadecimal constant in vendored KuGouMusicApi login code was reviewed
  as part of that MIT-licensed upstream adapter, not a local user credential.
- No private-key header, JWT-shaped credential or hard-coded bearer credential
  was found in the intended publication set.

Secret scanning must be repeated against `git ls-files` immediately before the
first push and before changing repository visibility to public.

## Binary/source correspondence

- The v1.1.2-v1.1.5 installers contain unpacked Electron application sources.
- Runtime source was extracted without executing the installers or touching the
  Windows registry.
- A matching source tag must exist before each historical binary is published.
- v1.1.1 is an upstream baseline. Its installer must not be rebranded as a
  Mikalinsa-authored release; users are directed to the upstream Release.

## Third-party components

- OBS Studio 32.1.2: GPL-2.0-or-later; portable binary is kept out of normal Git
  because of file-size limits. License and source location are documented.
- FFmpeg `N-92722-gf22fcd4483`: the shipped configuration enables GPL and
  version 3 components. It is documented as GPL-3.0-or-later, not default LGPL.
- KuGouMusicApi 1.5.1: MIT license and source retained.
- npm dependency licenses are inventoried in `docs/DEPENDENCY_LICENSES.md`.

## Product and service boundaries

- The project is explicitly described as an unofficial derivative work.
- No music files, Wallpaper Workshop content, shared accounts or membership
  credentials are part of the publication.
- Third-party platform endpoints and user-authorized sessions can still be
  subject to platform terms, rate limits, copyright restrictions and changes.
- The Mineradio name, logo and upstream visual assets can involve rights beyond
  source-code copyright; this publication makes no claim of upstream endorsement.

## Verification completed

- `node --check server.js`
- `node --check desktop/main.js`
- 38 Node contract tests passed
- Version and release manifests reviewed for v1.1.2-v1.1.5
- SHA-256 values recorded in Release notes and checksum files

## Remaining publication gates

- Repeat tracked-file secret scan after Git initialization.
- Create exact source commits/tags for historical binaries.
- Push while repository is private, inspect the remote tree, then make it public.
- Enable private vulnerability reporting and repository security features.
- Verify every Release asset and source tag from an unauthenticated browser.
