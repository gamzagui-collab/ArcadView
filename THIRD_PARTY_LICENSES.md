# izCAD — Üçüncü Taraf Açık Kaynak Bildirimleri

izCAD Universal is a renamed, derived SIL OFL 1.1 font combining the bundled Nanum Gothic and CAD symbol subset. See `fonts/IzCadUniversal-NOTICE.txt`, `LICENSE-NANUM-GOTHIC.txt`, and `LICENSE-CAD-SYMBOLS-OFL.txt`.

Son güncelleme: 10 Ekim 2026 — uygulama sürümü 2.0

Bu belge, izCAD Android uygulamasının çalışma zamanında kullanılan başlıca
üçüncü taraf bileşenleri listeler. Kullanılmayan libdxfrw çalışma zamanı
projeden ve dağıtım varlıklarından kaldırılmıştır.

## Çalışma zamanı bileşenleri

| Bileşen | Sürüm | Lisans | Tam lisans metni |
|---|---:|---|---|
| React ve React DOM | 19.1.1 | MIT | `LICENSE-REACT-MIT.txt` |
| Three.js | 0.161.0 | MIT | `LICENSE-THREE-MIT.txt` |
| dxf-viewer | 1.0.48 | MPL-2.0 | `LICENSE-MPL-2.0.txt` |
| dxf-viewer içindeki dxf-parser türevi | 1.0.48 ile birlikte | MIT | `LICENSE-DXF-PARSER-MIT.txt` |
| @capacitor/core ve @capacitor/android | 8.4.3 | MIT | `LICENSE-CAPACITOR-MIT.txt` |
| @capacitor/browser | 8.0.4 | MIT | `LICENSE-CAPACITOR-MIT.txt` |
| @mlightcad/libredwg-web | 0.9.0 | GPL-3.0-only | `LICENSE` |
| LibreDWG native Android core (same libredwg-web v0.9.0 source) | 7d90153180229faff5d1bbdfb9fb4378d5f141d5 | GPL-3.0-or-later, distributed with this GPL-3.0-only app | `LICENSE`, `vendor/libredwg-0.9.0-source.tar.gz` (COPYING), `vendor/README.md` |
| PDF.js (`pdfjs-dist`) | 6.4.299 | Apache License 2.0; ek varlık lisansları aşağıda | `LICENSE-APACHE-2.0.txt`, `LICENSE-PDFJS-THIRD-PARTY.txt` |
| fflate | 0.8.3 | MIT | `LICENSE-FFLATE-MIT.txt` |
| libarchive-wasm JavaScript bağları | 1.2.0 | MIT | `LICENSE-LIBARCHIVE-WASM-MIT.txt` |
| libarchive (arşiv WASM içinde) | 3.7.7 | BSD-2-Clause, bazı kaynaklarda BSD-3-Clause; BLAKE2 için Apache-2.0 seçeneği | `LICENSE-LIBARCHIVE.txt`, `LICENSE-LIBARCHIVE-SOURCE-NOTICES.txt`, `LICENSE-APACHE-2.0.txt` |
| OpenSSL (arşiv WASM içinde) | 3.4.1 | Apache License 2.0 | `LICENSE-OPENSSL-3.txt` |
| zlib (arşiv WASM içinde) | 1.3.1 | zlib | `LICENSE-ZLIB.txt` |
| libbzip2 (arşiv WASM içinde) | 1.0.8 | bzip2 lisansı | `LICENSE-BZIP2.txt` |
| XZ Utils liblzma (arşiv WASM içinde) | 5.6.4 | BSD Zero Clause (0BSD) | `LICENSE-XZ-0BSD.txt` |
| Emscripten JavaScript/WASM çalışma zamanı ve musl/LLVM yardımcıları | libarchive-wasm derlemesindeki Emscripten 4.0.5 | MIT/NCSA; musl bileşen bildirimleri; Apache-2.0 WITH LLVM-exception ve ilgili eski LLVM lisansları | `LICENSE-EMSCRIPTEN.txt`, `LICENSE-MUSL.txt`, `LICENSE-LLVM.txt` |
| Liberation Sans tabanlı IzCadSans-Regular.ttf | 2.1.5 | SIL Open Font License 1.1 | `LICENSE-FONT-OFL-1.1.txt` |
| Nanum Gothic Regular (çevrimdışı Korece CAD yazı tipi) | 3.020 | SIL Open Font License 1.1 | `LICENSE-NANUM-GOTHIC.txt` |
| izCAD Symbols (Noto Sans KR tabanlı, U+2205/U+33A1 alt kümesi) | 1.0; Noto 2.004 | SIL Open Font License 1.1 | `LICENSE-CAD-SYMBOLS-OFL.txt` |
| AndroidX, Android Core SplashScreen ve Apache Cordova Android çalışma zamanı | Gradle dosyalarında sabitlenen sürümler | Apache License 2.0 | `LICENSE-APACHE-2.0.txt` |

Bağımlılıkların kaynak depoları:

- React: https://github.com/facebook/react
- Three.js: https://github.com/mrdoob/three.js
- dxf-viewer: https://github.com/vagran/dxf-viewer
- Capacitor: https://github.com/ionic-team/capacitor
- LibreDWG WebAssembly: https://github.com/mlightcad/libredwg-web/tree/v0.9.0
- GNU LibreDWG: https://github.com/LibreDWG/libredwg
- Nanum Gothic: https://github.com/google/fonts/tree/5bd87dfc525c8a0d1d8529d3684716e00c3fc59a/ofl/nanumgothic
- izCAD Symbols kaynak yazı tipi: https://github.com/notofonts/noto-cjk/blob/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/Variable/TTF/Subset/NotoSansKR-VF.ttf
- PDF.js: https://github.com/mozilla/pdf.js/tree/v6.4.299
- fflate: https://github.com/101arrowz/fflate
- libarchive-wasm: https://github.com/ofk/libarchive-wasm/tree/v1.2.0
- libarchive: https://github.com/libarchive/libarchive/tree/v3.7.7
- OpenSSL: https://github.com/openssl/openssl/tree/openssl-3.4.1
- zlib: https://github.com/madler/zlib/tree/v1.3.1
- bzip2: https://sourceware.org/pub/bzip2/bzip2-1.0.8.tar.gz
- XZ Utils: https://github.com/tukaani-project/xz/tree/v5.6.4
- Emscripten: https://github.com/emscripten-core/emscripten/tree/4.0.5
- AndroidX: https://github.com/androidx/androidx
- Apache Cordova Android: https://github.com/apache/cordova-android

## Telif bildirimleri

- Nanum Gothic: NHN Corporation; Sandoll Communications Inc. SIL OFL 1.1; özgün bildirim `LICENSE-NANUM-GOTHIC.txt` dosyasındadır.
- izCAD Symbols: Noto Sans KR kaynak telif bildirimi font metadata içinde korunur; SIL OFL 1.1. Yeniden üretim: `scripts/build-cad-symbol-font.py`.

- React: Copyright (c) Meta Platforms, Inc. and affiliates.
- Three.js: Copyright © 2010-2024 three.js authors.
- dxf-viewer: Copyright (c) 2024 SIA SPH Engineering ve katkıda bulunanlar.
- dxf-parser türevi: Copyright (c) 2015 GDS Storefront Estimating.
- Capacitor: Copyright (c) 2017-present Drifty Co.
- PDF.js: Copyright 2024 Mozilla Foundation; ek görüntü/font bileşenlerinin
  bildirimleri `LICENSE-PDFJS-THIRD-PARTY.txt` içinde korunur.
- fflate: Copyright (c) 2026 Arjun Barrett.
- libarchive-wasm: Copyright (c) 2021 ofk.
- libarchive: Tim Kientzle, Martin Matuska, Michihiro NAKAJIMA ve ilgili
  kaynak dosyalarının diğer yazarları; özgün bildirimler
  `LICENSE-LIBARCHIVE-SOURCE-NOTICES.txt` içindedir.
- OpenSSL: Copyright (c) 1998-2025 The OpenSSL Project Authors;
  Copyright (c) 1995-1998 Eric A. Young, Tim J. Hudson.
- zlib: (C) 1995-2022 Jean-loup Gailly and Mark Adler.
- bzip2/libbzip2: Copyright (C) 1996-2019 Julian R Seward.
- XZ Utils: Copyright (C) The XZ Utils authors and contributors.
- LibreDWG ve WebAssembly bağları: Free Software Foundation, LibreDWG
  katkıcıları ve MLightCAD/libredwg-web katkıcılarının ilgili kaynak dosyası
  bildirimleri geçerlidir.
- Liberation font verileri: Copyright (c) 2010 Google Corporation ve
  Copyright (c) 2012 Red Hat, Inc. Reserved Font Name bilgileri font lisans
  metninde yer alır.

LibreDWG için ayrıntılı telif bildirimleri, karşılık gelen kaynak kod
dağıtımındaki dosya başlıklarında korunmalıdır.

## PDF.js ek varlıkları

PDF.js dağıtımındaki lisans metinleri değiştirilmeden hem
`LICENSE-PDFJS-THIRD-PARTY.txt` içinde hem ilgili çalışma zamanı varlıklarının
yanında paketlenir:

| Varlık | Lisans/bildirim |
|---|---|
| Adobe CMap verileri | Adobe telif bildirimi ve BSD-3-Clause koşulları (`cmaps/LICENSE`) |
| Foxit standart fontları | PDFium BSD-3-Clause (`standard_fonts/LICENSE_FOXIT`) |
| PDF.js standart Liberation fontları | GPL-2.0 ve gömülü font istisnası (`standard_fonts/LICENSE_LIBERATION`) |
| OpenJPEG JPEG2000 kod çözücüsü | BSD-2-Clause (`wasm/LICENSE_OPENJPEG`) |
| JBIG2 kod çözücüsü | PDFium BSD-3-Clause (`wasm/LICENSE_JBIG2`) |
| qcms renk yönetimi | MIT (`wasm/LICENSE_QCMS`) |
| PDF.js ICC renk profili | CC0 1.0 Universal (`iccs/LICENSE`) |
| PDF.js görüntü kod çözücü bağları | Apache-2.0 (`wasm/LICENSE_PDFJS_*`) |

PDF.js'in standart Liberation fontları kendi GPL-2.0 ve font istisnası
koşulları altında ayrı font dosyalarıdır; CAD çizim fontunun OFL lisansı bu
dosyalara uygulanmaz. Font kullanılan veya gömülen belgeler, lisansın font
istisnası kapsamında yalnızca bu nedenle GPL kapsamına girmez. Tam font
lisansı PDF.js sürümünün
`external/standard_fonts/LICENSE_LIBERATION` metninde yer alır.

## Arşiv WebAssembly derlemesi

`libarchive-wasm` npm paketinin MIT beyanı yalnızca JavaScript bağlarının
lisansını tek başına açıklamak için yeterlidir. Paketlenen `libarchive.wasm`
için temel C kütüphanesi ve statik bağlı bağımlılıkların lisansları ayrıca
korunur. Sürüm kaynakları, derleme dosyaları ve eşleşen WASM SHA-256 bilgisi
`NOTICE-ARCHIVE-RUNTIME.md` içindedir.

Bağlanan XZ bileşeni yalnızca 0BSD lisanslı `liblzma` kütüphanesidir; XZ'nin
GPL/LGPL lisanslı komut satırı/betik ve derleme araçları izCAD içinde
paketlenmez. libarchive'in BLAKE2 dosyalarında sunulan üç seçenekten Apache
License 2.0 seçeneği kullanılır. Arşiv motorunun burada listelenen kütüphane
lisansları GPL-3.0 ile birlikte dağıtıma uygundur; özgün telif ve lisans
koşulları korunur.

## GPL-3.0-only dağıtım notu

izCAD'in DWG motoru `@mlightcad/libredwg-web@0.9.0` ve uygulamanın ana lisansı
GPL-3.0-only'dir. Bir APK başka kişilere verildiğinde, APK ile birebir eşleşen
tam ve karşılık gelen kaynak kodun erişilebilir olması gerekir. GitHub yayını
en az şunları içermelidir:

- izCAD kaynak kodunun APK ile eşleşen sürüm etiketi,
- `package-lock.json` ve kullanılan tüm derleme betikleri,
- `libredwg-web` 0.9.0 ve temel aldığı LibreDWG kaynak sürümü/commit'i,
- Varsa izCAD veya LibreDWG için yapılan değişiklikler ve yamalar,
- Dağıtılan WebAssembly dosyasını yeniden üretmek için gereken talimatlar.

APK için bir GitHub Release oluşturulmalı ve kaynak etiketi ile APK sürümü aynı
olmalıdır. Dağıtılan LibreDWG WebAssembly dosyasının karşılık gelen kaynak
arşivi aynı release altında sunulmalı veya aynı kolaylıkta erişilebilir kesin
bir kaynak adresi verilmelidir.

Bu dosya açık kaynak bildirimidir; hukuki görüş değildir.

## Optional Google Play development configuration (not in employee GitHub APKs)

- AndroidX Credentials / Credentials Play Services Auth 1.6.0 — Apache-2.0, Android Open Source Project.
- Google Play Billing 9.1.0 — the published Maven POM declares **Android Software Development Kit License**: https://developer.android.com/studio/terms.html
- Google Identity googleid 1.2.1 — the published Maven POM declares **Android Software Development Kit License**: https://developer.android.com/studio/terms.html
- Additional transitive Google Play services libraries are subject to their published terms. They are not described as Apache-licensed or included in the existing GPL license by this notice.

The Play configuration is local development work. Compatibility of distributing these SDK binaries together with this GPL-3.0-only application and LibreDWG needs a licensing determination before public distribution. No linking exception is asserted or added to upstream copyrights. Existing GitHub builds omit these dependencies and preserve their existing updater and offline tools. Corresponding application source remains under GPL-3.0-only; service credentials and signing keys are never included.
