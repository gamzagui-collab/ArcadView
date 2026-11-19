# Arcad View changes

## 2.1.3 — 2026-11-20

- Android 9의 APK 서명 정보 조회 호환성 수정. 누락된 서명은 계속 거부하며 실제 인증서 SHA-256 집합을 비교합니다.

## 2.1.2 — 2026-11-20

- 초안 릴리스의 자산 검증·공개를 릴리스 ID 기준으로 처리

## 2.1.1 — 2026-11-20

- GitHub Actions에서 폐기된 Android SDK tools 패키지를 요청하지 않도록 수정

## 2.1.0 — 2026-11-20

- Arcad View / GUI's Arc Industry 브랜드와 남색·파랑 UX
- 오버레이 레이어·그리기·텍스트·치수·선택·이동·삭제·트림
- 대형 DWG 반복 열기, 변환/화면 캐시, 단위 기억과 블록·해치 스냅
- GitHub 승인 업데이트, APK 해시·패키지·버전·서명 검증
- 서명 APK·전체 소스·해시를 게시하는 GitHub Actions

## Upstream history

# izCAD 2.0 — 10 Ekim 2026

Mevcut koyu tema, renkler, ikonlar ve ana ekran tasarımı korunmuştur.

- Android durum çubuğu şeffaf arka plan ve açık renk saat/pil simgeleriyle uygulamanın koyu temasına uyarlandı.
- Aşırı uzak kayıtlı DWG görünümü reddedilerek içeriğe uygun ilk görünüm eklendi; tam çizimi gösteren ekrana sığdırma aracı korunuyor.
- Geçici 2B CAD ölçümü eklendi: mesafe, toplam uzunluk, çokgen alanı/çevresi, açı ve desteklenen nesne uzunlukları; birim seçimi ve noktalara tutunma.
- PDF için çevrimdışı görüntüleme, sayfa değiştirme ve yakınlaştırma eklendi.
- ZIP ve tek parçalı, şifresiz RAR içerik önizlemesi; seçilen CAD/PDF dosyalarını klasör yapısıyla atomik içe aktarma eklendi.
- Yeni dosya türleri kitaplığa ve Android dosya yöneticisinden açma akışına eklendi. Not ekleme, düzenlenmiş DWG kaydetme ve PDF ölçümü kapsam dışı.
- Çizim kitaplığına klasör içinde arama, ad/tarih/boyut sıralaması ve birden fazla çizimi birlikte ekleme eklendi.
- Aynı adlı dosyalar mevcut çizimin üzerine yazılmadan ayrı kopyalar olarak saklanıyor.
- Klasör ve dosya işlemleri atomik hâle getirildi; eşzamanlı işlemler ve yetersiz depolama durumunda yarım kayıtların önüne geçildi.
- 1.x kitaplık veritabanı ve paket kimliği korunuyor; güncellemede veri sıfırlanmıyor.
- Kitaplığı açıp kapatırken mevcut çizim ve kamera görünümü korunuyor.
- Android geri tuşu iletişim kutularını, klasörleri ve çizim ekranını takip ediyor.
- DXF worker hataları, yükleme zaman aşımı, iptal ve WebGL kaynak temizliği iyileştirildi.
- Eski DXF dosyalarında Türkçe dâhil desteklenen kod sayfaları algılanıyor.
- Kayıtlı görünüm, katman görünürlüğü ve iç içe XCLIP desteği sağlamlaştırıldı.
- Boş dosyalara ve 128 MiB üzeri kaynak/dönüşüm çıktısına kontrollü hata eklendi. Bu sınır, her küçük dosyanın her cihazda açılabileceği garantisi değildir.
- Hata ekranına tekrar deneme ve geri dönüş eklendi; depolama hataları görünür bildiriliyor.
- Erişilebilir dosya düğmeleri, iletişim kutusu odağı, klavye ile geri dönüş ve ilerleme göstergesi iyileştirildi.
- Capacitor 8.4.3 güvenlik düzeltmesine güncellendi; test araçları ve ilgili alt bağımlılıklar güncellendi.
- Android API 36, release imzalama seçenekleri, kaynak/paket bütünlüğü kontrolleri ve yayın rehberi hazırlandı.

## Play Store değişiklik metni — Türkçe

izCAD 2.0: CAD ölçümü, birim seçimi ve noktalara tutunma eklendi. PDF dosyalarını açın; ZIP/RAR içindeki çizim ve PDF dosyalarını kitaplığa çıkarın. Durum çubuğu daha okunur, ilk çizim görünümü daha kullanışlı. Kitaplık, dosya açma ve kararlılık iyileştirildi. Dosyalarınız cihazınızda kalır.

## Play Store release notes — English

izCAD 2.0 adds CAD measurements, unit selection and geometry snapping. Open PDFs and extract CAD/PDF documents from ZIP/RAR archives into your library. Improved status bar readability, initial drawing view, library and file handling. Your files stay on your device.
