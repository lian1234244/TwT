# Third Party Notices

This file accompanies both source and binary distributions. Component copyrights
remain with their respective owners. The repository license does not replace the
licenses listed below.

## FFmpeg

Mineradio uses the FFmpeg executable supplied by `@ffmpeg-installer/ffmpeg` for
local media conversion. The bundled build reports `--enable-gpl` and
`--enable-version3`; it is therefore distributed under GNU GPL version 3 or
later rather than the default LGPL configuration.

- Component: FFmpeg
- Package: `@ffmpeg-installer/ffmpeg` 1.1.x
- Bundled build revision: `N-92722-gf22fcd4483`
- License: GPL-3.0-or-later for this configured binary
- Project source: https://ffmpeg.org/download.html
- Git source: https://git.ffmpeg.org/ffmpeg.git
- Legal and compliance information: https://ffmpeg.org/legal.html
- Package source: https://github.com/kribblo/node-ffmpeg-installer

The exact executable configuration can be inspected with `ffmpeg -version`.
Release notes link to this repository and this notice so recipients can obtain
the corresponding application source and the FFmpeg source/build information.

## KuGouMusicApi

Mineradio vendors KuGouMusicApi as the local adapter for user-authorized KuGou login, playlists, metadata, and playback URL requests.

- Component: KuGouMusicApi
- Version: 1.5.1
- License: MIT
- Source: https://github.com/MakcRe/KuGouMusicApi
- Release: https://github.com/MakcRe/KuGouMusicApi/releases/tag/v1.5.1
- License text: `resources/vendor/kugoumusicapi/LICENSE`

KuGou trademarks, accounts, catalog data, and media rights remain owned by KuGou and their respective rights holders. Mineradio does not bundle account cookies or media files.

## OBS Studio

Mineradio bundles OBS Studio components as an external local recording backend for Wallpaper Engine Scene capture.

- Component: OBS Studio
- Version: 32.1.2
- License: GPL-2.0-or-later
- Source: https://github.com/obsproject/obs-studio
- Release: https://github.com/obsproject/obs-studio/releases/tag/32.1.2
- License text: `licenses/OBS-COPYING.txt`

Mineradio launches OBS Studio as a separate process for local capture. OBS Studio copyrights, trademarks, and license terms remain owned by their respective authors.

## all-the-cities / GeoNames

Mineradio builds a compact offline administrative-city index from `all-the-cities` so Home weather can identify the nearest city without using the public IP address.

- Package: all-the-cities 3.1.0
- Package license: MIT
- Source: https://github.com/zeke/all-the-cities
- Underlying data: GeoNames Gazetteer
- GeoNames data license: CC BY 4.0
- GeoNames: https://www.geonames.org/
