# Arcad View changes

## 2.1.26 — 2026-11-21

- 기존 각도·반지름 치수의 표시 위치 조절은 잔액 0에서도 사용 가능하도록 계량 편집 접근 조건을 분리
- 기준점·값이 고정된 위치 조절은 추가 차감하지 않으며 일반 객체 형상 편집의 기존 접근 정책 유지
- 반지름 측정·중심/원호 스냅·각도/반지름 치수 기능 포함, 원본과 기존 기능 유지
- 접근 검사 호출 여부를 검사하는 회귀 테스트 추가 및 LDPlayer 기능 재검증
- 공개 소스 검사 시 발생한 무인증 GitHub API HTTP 403을 단기 Actions 토큰 조회로 보완, 공개 여부·태그·커밋 일치 검사는 유지

## 2.1.25 — 2026-11-21

- 측정의 면적·각도 사이에 반지름 도구 추가: 중심점 → 원호 위 점으로 측정
- 반지름 도구는 원/원호 중심점을 우선 스냅하고 임의 각도의 원호 위 점을 해석적으로 투영해 스냅
- 기존 원본 및 앱에서 그린 원 지원, 큰 DWG의 압축 인덱스를 유지한 채 원/원호 대상만 캐시하여 탐색
- 5번 치수 레이어에 각도(3점)·반지름(2점) 치수 추가, 기존 치수 배율·소수점·색상/두께 설정 사용
- 완성 즉시 드래그 손잡이 표시: 각도는 꼭짓점 중심으로 호 위치, 반지름은 중심/원호 기준점을 유지하며 지시선·문자 위치 조절
- 표시 위치만 옮길 때 측정값·기준점을 유지하고 추가 토큰 차감 없이 저장, 실행 취소·다시 실행 지원
- LDPlayer에서 DXF·그린 원·실제 COVER/BASE DWG의 중심/원호 스냅, 치수 생성·드래그·재열기 및 원본 보존 검증

## 2.1.24 — 2026-11-21

- UNDO·REDO를 왼쪽 세로 독으로 이동하고 도구 해제를 하단 툴바에 고정, 하단 상태 표시와 도구를 총 2행으로 정리
- 객체 선택 시 왼쪽 독 위에 색상 팔레트 버튼과 선 두께·글자 크기 슬라이더 표시
- 선·도형·치수·포인트의 개별 색상/선 두께 및 텍스트·지시문자 크기 조절
- 슬라이더는 실시간 미리보기 후 손을 뗄 때 한 번 저장, UNDO·REDO 한 번으로 되돌리기/복원
- 원본 선의 스타일 변경은 가림과 주석 복사로 저장하여 원본 파일을 수정하지 않고 기존 레이어 방식 유지
- LDPlayer에서 320/360/412/1098px 배치, 실제 드래그, 색상/크기, 저장/재열기, 기존 도면·주석·설정 보존 검증

## 2.1.23 — 2026-11-21

- 측정·그리기 점 마커 안쪽의 검은 외곽과 굵은 연결선/면 채움을 제거해 배경 도면을 표시
- 하늘색 원 테두리의 크기·색·굵기는 유지하고 가운데 작은 흰 점과 가는 연결선 유지
- 그리기 임시 도형도 마커 내부에서만 잘라내고 기존 도면·저장된 주석은 그대로 표시
- 원본 파일·스냅·측정 계산·확대/이동·저장 동작 유지
- LDPlayer의 실제 화면과 SVG 픽셀 검사로 측정·그리기 투명도 및 1,000mm 스냅 결과 확인

## 2.1.22 — 2026-11-21

- 실행 취소·다시 실행·툴 해제를 위쪽 고정 행으로 분리하고, 아래 보기 버튼은 원형 초기화만 유지
- 가운데 측정·그리기·객체 선택·삭제만 가로 스크롤, 도구 목록에 짧은 감속 관성 추가
- 확대 버튼 제거 후에도 PDF를 확대할 수 있도록 두 손가락 확대 조작 연결
- 그리기 창에서 레이어 탭을 빼고 왼쪽 위 레이어 번호로 별도 레이어 창 열기
- 치수 전용 5번 레이어 자동 선택·다른 레이어 선택 잠금·직전 일반 레이어 복귀
- 4번 포인트 레이어와 일반 1~3번 레이어 유지, 기존 치수·주석은 이동하지 않고 그대로 보존
- 5번에는 새 치수만 저장, 전용 레이어 표시·색상·저장/재열기와 일반 레이어 삭제 시 보존
- 전용 레이어 자동 생성·표시 변경을 일반 레이어 생성 토큰으로 분류하지 않도록 보정
- LDPlayer에서 관성·고정 버튼·두 손가락 확대·치수/포인트 레이어·기존 도면 보존 검증

## 2.1.21 — 2026-11-21

- 메인 툴바를 높이 56px의 한 줄로 정리하고 보기 버튼은 고정, 작업 도구는 좌우 스크롤
- 사각형 화면 맞춤 버튼을 빼고 확대·축소·원형 보기 초기화 유지
- 객체 선택·객체 삭제를 메인 툴바로 이동하고 선택 상태·삭제 가능 여부 연동
- 상태 카드를 오른쪽 아래로 축소하고 남색 툴바와 모양·간격 통일
- 상세 도구는 탭·생성 도구·편집 도구의 최대 3개 버튼 행, 각 도구 행은 가로 스크롤
- 스냅·치수 배율·포인트 스타일·폴리라인 완료와 실행 취소/다시 실행 유지
- LDPlayer에서 실제 가로 스와이프·객체 선택/삭제·실행 취소/다시 실행·폴리라인 완료 검증, 보관함 33개 원본과 기존 주석 보존

## 2.1.20 — 2026-11-21

- 폴리라인·총길이·면적의 완료 버튼을 도구창 밖에도 표시하고 열린 경로 중간 완료 지원
- 총길이·면적 진행 중에는 직전 구간 거리만 표시하고, 완료·저장 후 합산 길이·면적·둘레 표시
- 일시 중지와 실행 취소 상태에서도 미완료 합계가 드러나지 않도록 표시 상태 복원
- COVER·BASE 실제 DWG에서 열린 경로 완료와 기존 작성 데이터·원본 보존 검증
- 직원용 기존 오프라인 사용·동일 서명·업데이트 기능 유지, 자동 업데이트용 버전 코드 증가

## 2.1.19 — 2026-11-20

- 첫 DWG 변환의 DXF 검사에서 바이트별 스트림 호출·불필요한 줄 객체 생성을 줄임
- 변환 결과와 메타데이터를 변경하지 않고 기존 변환·화면 캐시 유지
- 최초 변환 중에는 시간이 걸릴 수 있고 이후 저장된 결과로 더 빠르게 열린다는 안내
- 네이티브 변환과 블록 검사의 소요 시간 로그 분리
- APK를 빌드하지 않는 공개 소스 저장소 분리, 버전별 전체 소스 링크와 APK 게시 전 소스 태그 일치 확인

## 2.1.18 — 2026-11-20

- 길게 눌러 위쪽 조준점·객체 미리보기로 정밀 선택
- 선택 꼭짓점 드래그 크기/형상 편집과 하단 중앙 십자 자유 이동, 스냅과 취소/실행 취소
- 경계 먼저 선택 후 열린 선·원호·원형호 폴리라인 끝쪽을 눌러 곡률 유지 연장
- 선택 객체의 중심점·방향점으로 회전 미리보기, 전체 선택된 정수 각도 입력과 적용
- 회전한 사각형·구름마크의 4개 꼭짓점, 문자 방향과 선형 치수 값 보존
- 원본 객체의 변경은 가림+별도 도형으로 저장하며 원본 파일은 유지

## 2.1.17 — 2026-11-20

- A 형태 대신 사용자 제공 문서·십자선 심벌, 파랑/하늘색 메탈과 은색 십자선 적용
- 런처·원형/적응형 아이콘·단색 리소스·시작 화면·앱 내부/업데이트 로고·favicon 교체
- Android 비트맵 6개 밀도와 Play 아이콘 재생성, 선택 원본·프롬프트·내보내기 스크립트 포함
- 기존 패키지·서명·업데이트·CAD 기능·원본 도면과 저장 데이터 유지

## 2.1.16 — 2026-11-20

- 새 업데이트 확인 시 작은 배너 대신 안내창 자동 표시, 같은 실행 중 같은 버전의 반복 팝업 방지
- 미설치 업데이트가 있으면 오른쪽 위 i 아이콘에 빨간 점, 나중에/닫기 후에도 유지
- 버전 번호만 기억해 재시작·통신 오류에도 표시 유지, 설치 또는 최신 상태 확인 후 해제
- 모바일 업데이트 창의 내용은 스크롤하고 승인·나중에 버튼은 계속 표시
- 기존 서명·해시 검증 및 다운로드/Android 설치 승인, 원본 도면·저장 데이터 유지

## 2.1.15 — 2026-11-20

- 측정·화면 측정값·그린 치수선의 최대 소수 자릿수 0~6 선택 및 기억
- 포인트 탭: 화살표·구름마크·원형·사각형·한글 텍스트 지시선
- 화면 고정 굵기/글자 크기, 굵기·색상 설정 및 표시 객체 선택·이동·삭제·실행 취소
- 일반 레이어 3개 유지 + 자동 전용 4번 포인트그리기 레이어, 다른 도구에서 이전 일반 레이어 복귀
- 현재 레이어 색상과 대비되는 숫자 배지, 원본 도면·기존 편집 데이터 유지

## 2.1.14 — 2026-11-20

- 매우 긴 선과 작은 원의 교차 스냅에서 큰 수의 차로 생기는 오차를 중심 기준 투영 계산으로 수정
- X/Y 이동 확인과 방향 지정 옵셋, 거리 기억 기능 유지

## 2.1.13 — 2026-11-20

- 이동 기준점/목적점의 선·원·원호 교차 스냅과 X/Y 거리 입력, 이동 버튼으로 적용
- 선·폴리라인·사각형·원·원호 옵셋, 양쪽 방향 화살표와 거리 미리보기, 적용 버튼
- 마지막 적용 옵셋 거리를 단위와 함께 기억하고 입력값을 전체 선택해 바로 덮어쓰기
- 기존 원본 파일·가림 레이어·실행 취소/다시 실행·자동 업데이트 유지

## 2.1.12 — 2026-11-20

- 큰 좌표에서 선·점·블록 표시가 스냅점에서 어긋나고 화면 이동에 따라 달라지는 정밀도 오류 수정
- 기본 도형은 가까운 배정밀도 원점으로 저장하고 블록은 기존 인스턴싱을 유지하며 카메라 근처 좌표로 갱신
- 기존 DWG 변환 결과와 단위·주석을 유지하고 화면 캐시만 새 정밀도 형식으로 준비
- 닫은 도면의 GPU·측정 버퍼 회수 지연을 보완해 큰 도면 연속 재열기 메모리 유지
- 원본 CAD 파일과 기존 UI·측정·그리기·업데이트 기능 유지

## 2.1.11 — 2026-11-20

- Android 일반/원형/전경/배경 PNG 24개와 남아 있던 기본 drawable을 Arcad View 로고로 통일
- Android 13 이상 단색 테마 아이콘도 같은 Arcad 마크 사용
- 기존 기능·원본 도면·저장 데이터·패키지 ID·업데이트 서명 유지

## 2.1.10 — 2026-11-20

- 확대·축소·화면 맞춤·보기 초기화를 아이콘 그룹으로 정리하고, 그리기 옆에 실행 취소·다시 실행·도구 해제 그룹 추가
- 측정 지점, 그리기 중인 지점과 완료한 주석 편집에 undo/redo 지원
- 텍스트 위치를 길게 눌러 조정 후 손을 떼면 도면 위에서 입력. 한글 IME 조합을 직접 표시하고 바깥 터치로 완료, 기존 문자는 길게 눌러 재편집
- 왼쪽 글자 크기 슬라이더와 적용 버튼이 있는 색상 팔레트, 기존 주석 형식과 호환되는 객체별 색상 저장
- 원본 도면과 기존 단위·주석, DWG 변환/측정 인덱스/캐시 및 승인 업데이트 유지
- 스크롤 중 취소할 수 없는 touchstart/touchmove 이벤트에 preventDefault를 호출하지 않도록 고정 버전 뷰어 보정

## 2.1.9 — 2026-11-20

- 동일 LibreDWG 0.9.0 소스의 격리된 Android 네이티브 변환, DXF 디스크 출력과 사용하지 않는 블록 정의 제외
- 파싱 객체 사용 후 회수, 배정밀도 경계 버퍼, 측정 인덱스 한도 확대와 새 캐시 형식
- 기본 LDPlayer에서 43,331,838바이트 DWG 최초 열기와 전체 인덱스·제한 범위 이후 1,290mm 측정, BASE·COVER 회귀 검증
- 네 가지 ABI, 16KB ELF/APK 정렬 검사와 대응 엔진 소스를 포함한 자동 릴리스

## 2.1.8 — 2026-11-20

- 플랫폼 줄바꿈이 포함된 worker URL 대신 버전·내용 지문으로 화면 캐시 식별
- 동일 형식의 기존 Windows/Linux 캐시를 재파싱·복사 없이 재사용. v2.1.7의 대용량 허용 한도와 메모리 복구 유지

## 2.1.7 — 2026-11-20

- CAD 원본 512MiB / 변환 DXF 1GiB, 변환·화면 캐시 각각 2GiB로 확장
- DXF 줄 배열 대신 지연 읽기, WASM 메모리 확장 실패·변환 프로세스 종료·렌더러 종료 복구
- 단위/주석 v1 식별 및 기존 기능 유지. 실제 100MB+ DWG 미검증, 32비트 WebView의 메모리 한계와 제공 시험 도면의 측정 제한은 RELEASE_NOTES.md에 명시

## 2.1.6 — 2026-11-20

- 생성 API가 반환한 릴리스 ID로 자산 업로드·해시 검증·정식 공개를 연결하여 초안 목록 조회 지연 제거
- 동일 태그 재실행 시 공개 파일 검증 후 재사용, 중단된 초안은 같은 커밋의 원래 Actions 산출물로 복구
- 기존 릴리스·자산은 덮어쓰거나 삭제하지 않으며 앱의 최신 릴리스 조회 API도 공개 후 확인

## 2.1.5 — 2026-11-20

- HTML 루트가 만들어지기 전 Capacitor의 safe area CSS 주입을 문서 준비 시점까지 보류하고 최신 여백값을 적용
- 기존 상태 표시줄·내비게이션·키보드 여백 계산과 오류 보고 유지, 설치/빌드 시 동일 보정 자동 적용

## 2.1.4 — 2026-11-20

- 홈 화면의 빈 도면 캔버스가 최근 도면 카드 터치를 가리는 문제 수정

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
