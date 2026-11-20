# Arcad View — modification notice

Arcad View 2.1.19, modified on 2026-11-20 by GUI's Arc Industry.
Based on orgofjs/izCAD. Original copyright and third-party notices below are retained.
Source: https://github.com/gamzagui-collab/ArcadView-Source
License: GPL-3.0-only.

Modifications include Android DWG memory isolation and caches, Korean fonts,
measurement and snap improvements, overlay markup layers, Arcad View UX,
and consent-based GitHub APK updates. Version 2.1.9 adds a disposable native
Android converter built from the same LibreDWG 0.9.0 sources, disk-backed DXF
export, reachable-block retention and a larger packed measurement index.
Version 2.1.19 separates the public corresponding-source repository (Actions
disabled) from APK distribution and verifies the matching public source tag
before publishing binaries. It scans native DXF block reachability using buffered byte ranges
and adds a first-conversion explanation. Drawing data and existing caches
retain their original formats.
Version 2.1.18 adds precision object selection, draggable grips and a free-move
handle, boundary-first line/circular-arc extension, and whole-degree rotation
with a live preview. Original drawing edits remain reversible overlays.
Version 2.1.17 replaces the prior A-shaped brand with a blue metallic folded
document and silver CAD crosshair, based on the user-supplied reference. The
selected color master was produced with the built-in image-generation tool;
its prompt and export procedure are included in branding/MARK_SOURCE.md.
Version 2.1.16 adds an automatic update dialog and a persistent pending-update
indicator on the information button, with visible mobile approval actions.
Version 2.1.15 adds shared display precision settings, screen-width point
markups and text leaders, a protected fourth overlay layer and a layer badge.
Version 2.1.14 computes line/circle intersections in circle-local coordinates
to avoid discriminant cancellation on very long survey axes.
Version 2.1.13 adds signed XY move confirmation, intersection snapping and
parallel offsets with direction arrows and a remembered distance. Original CAD
files remain unchanged; editing uses the existing reversible overlay layers.
Version 2.1.12 preserves large-coordinate rendering precision for lines, points and
block instances so measurement overlays remain aligned while panning and zooming.
Version 2.1.11 replaces remaining Android legacy icon assets with the Arcad View mark.
Version 2.1.10 adds grouped view/history controls, tool cancellation and inline
IME-aware text editing with per-object size/color and undo/redo. Existing drawing
sources and native conversion/cache formats are unchanged.
The pinned dxf-viewer 1.0.48 touch controls also check event.cancelable before
canceling touch start/move events; pan/zoom behavior and original notices remain.
Native engine provenance and corresponding sources are in `vendor/README.md`
and the source distribution. Drawing processing stays local;
only the GitHub distribution's update check/download uses the network.

## Original izCAD notice

# izCAD — NOTICE

Drawing text uses the single offline izCAD Universal family, derived from Nanum Gothic and the bundled CAD symbol subset under SIL OFL 1.1. Original font licenses are retained; see `fonts/IzCadUniversal-NOTICE.txt`.

Copyright (C) 2026 İZ

izCAD, cihazdaki DXF, DWG ve PDF belgelerini tamamen çevrimdışı görüntüleyen;
CAD ölçümü ve ZIP/RAR içe aktarma araçları sunan açık kaynak bir Android
uygulamasıdır.

- Kaynak kodu: https://github.com/orgofjs/izCAD
- Gizlilik politikası ve yasal bilgiler:
  https://sites.google.com/view/izcad-gp-pp/ana-sayfa
- İletişim: tepukmenajeri@gmail.com
- Uygulama sürümü: 2.0

## Ana lisans

izCAD kaynak kodu ve dağıtılan uygulama, GNU General Public License version 3
koşulları altında, yalnızca GPL-3.0-only olarak yayımlanır. Tam metin `LICENSE`
dosyasındadır.

## Üçüncü taraf bileşenleri

Tam bileşen listesi ve lisans eşlemesi `THIRD_PARTY_LICENSES.md` dosyasındadır.
Projeyle birlikte dağıtılan ilgili lisans metinleri:

- `LICENSE`
- `LICENSE-APACHE-2.0.txt`
- `LICENSE-CAPACITOR-MIT.txt`
- `LICENSE-DXF-PARSER-MIT.txt`
- `LICENSE-FONT-OFL-1.1.txt`
- `LICENSE-NANUM-GOTHIC.txt`
- `LICENSE-CAD-SYMBOLS-OFL.txt`
- `LICENSE-MPL-2.0.txt`
- `LICENSE-REACT-MIT.txt`
- `LICENSE-THREE-MIT.txt`
- `LICENSE-FFLATE-MIT.txt`
- `LICENSE-PDFJS-THIRD-PARTY.txt`
- `LICENSE-LIBARCHIVE-WASM-MIT.txt`
- `LICENSE-LIBARCHIVE.txt`
- `LICENSE-LIBARCHIVE-SOURCE-NOTICES.txt`
- `LICENSE-OPENSSL-3.txt`
- `LICENSE-ZLIB.txt`
- `LICENSE-BZIP2.txt`
- `LICENSE-XZ-0BSD.txt`
- `LICENSE-EMSCRIPTEN.txt`
- `LICENSE-MUSL.txt`
- `LICENSE-LLVM.txt`
- `NOTICE-ARCHIVE-RUNTIME.md`

PDF.js varlıklarının özgün lisans dosyaları ayrıca kendi `pdfjs/cmaps`,
`pdfjs/standard_fonts`, `pdfjs/wasm` ve `pdfjs/iccs` klasörlerinde korunur. PDF.js ile
birlikte gelen Liberation fontlarının GPL-2.0 ve font istisnası, CAD için
kullanılan IzCadSans fontunun SIL OFL 1.1 lisansından farklıdır. Bu font
dosyaları kendi lisansları altında ayrı bileşenler olarak dağıtılır.

Bu bildirim, herhangi bir üçüncü taraf markasının izCAD'i desteklediği veya
onayladığı anlamına gelmez.
