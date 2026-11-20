# GitHub 릴리스와 승인 업데이트

공식 저장소: <https://github.com/gamzagui-collab/ArcadView>

## 사용 방법

처음에는 [최신 릴리스](https://github.com/gamzagui-collab/ArcadView/releases/latest)의 APK를 설치합니다. 기존 v26까지의 APK에는 업데이트 기능이 없으므로 이 버전은 한 번 직접 설치해야 합니다. 앱을 제거하거나 데이터를 초기화하지 마세요.

이후 앱 실행 시 최신 정식 릴리스를 확인합니다. 앱 복귀 시에는 6시간 간격으로 확인합니다. 인터넷 연결이 없어도 도면 열람·측정·주석 기능은 계속 사용할 수 있습니다. 수동 확인은 앱 정보의 **업데이트 확인** 버튼입니다.

새 버전 알림을 열어 **다운로드 및 업데이트**를 누르면 APK를 내려받고 검증합니다. 설치 출처 권한이 없으면 안내에 따라 Android 설정에서 Arcad View의 **이 출처 허용**을 켭니다. 돌아오면 검증된 APK의 Android 설치 화면이 열립니다. Android에서 최종 설치를 승인합니다.

## 검증과 데이터 보존

- 지정된 공개 저장소의 정식 최신 릴리스만 사용합니다. 초안·시험 릴리스·같거나 낮은 versionCode는 제외합니다.
- `Arcad-View-v<versionName>-<versionCode>.apk` 이름, 릴리스 태그, 정확한 저장소 다운로드 URL, GitHub 자산 SHA-256과 파일 크기를 검증합니다.
- HTTPS GitHub 다운로드 호스트의 제한된 리디렉션만 허용하고 APK 크기를 128MiB로 제한합니다.
- APK를 받은 후 SHA-256, 앱 패키지 ID, 버전 이름·코드, 현재 설치본과 같은 서명인지 다시 검사합니다.
- 승인 전에는 다운로드하지 않습니다. APK는 앱 전용 임시 폴더에 저장하고 Android 설치기로만 전달합니다.
- 도면 파일과 주석은 업데이트 요청에 포함하지 않습니다. 앱 제거·데이터 초기화·자동 다운그레이드는 하지 않습니다.

## 개발 및 배포

Node.js >=22, JDK21, Android SDK36/build-tools36.0.0, NDK28.2.13676358, CMake3.22.1을 사용합니다. GitHub Actions가 동일 버전을 설치하고 네 가지 ABI의 네이티브 DWG 엔진 및 16KB ELF/APK 정렬을 검사합니다. 엔진 대응 소스는 `vendor/`에 포함되어 소스 ZIP과 함께 배포됩니다.

`npm ci`와 `android:prepare`는 고정된 Capacitor Android 8.4.3의 safe area 주입 시점만 보정합니다. HTML 루트가 없으면 문서 준비를 기다려 최신 CSS 여백을 적용하며, 네이티브 여백 계산과 실제 오류 보고는 유지합니다. `scripts/patch-capacitor-safe-area.mjs`에 보정 소스가 포함되고 다른 의존성 버전에서는 검토 없이 적용하지 않습니다.

`scripts/patch-cad-controls.mjs`는 고정된 dxf-viewer 1.0.48의 touchstart/touchmove에서 취소 가능한 이벤트에만 `preventDefault`를 호출하도록 보정합니다. 확대·이동 처리는 유지하며 다른 버전이나 소스 형태에는 검토 없이 적용하지 않습니다.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run android:prepare
.\android\gradlew.bat -p android testReleaseUnitTest assembleRelease -PARCAD_DISTRIBUTION=github
```

서명은 `IZCAD_KEYSTORE_FILE`, `IZCAD_KEYSTORE_PASSWORD`, `IZCAD_KEY_ALIAS`, `IZCAD_KEY_PASSWORD` 환경변수를 사용합니다. 기존 설치본과 같은 키를 사용해야 합니다. 키·암호를 저장소 또는 소스 ZIP에 넣지 마세요.

`package.json`의 버전과 `release-config.json`의 versionCode를 올리고 변경 안내를 갱신한 뒤 `v<package version>` 태그를 푸시합니다. GitHub Actions가 테스트 → 서명 빌드 → 소스 ZIP·해시 생성 → 초안 자산 검증 → 정식 공개 순서로 처리합니다. 기존 릴리스 파일을 덮어쓰지 않습니다.

`scripts/github-release.mjs`는 초안 생성 응답의 숫자 ID를 사용합니다. 생성 직후 목록에서 초안을 다시 검색하지 않으며 일시적인 API 오류와 자산 해시 반영 지연에는 제한된 재시도를 적용합니다. 정식 공개 후에는 APK·소스·메타데이터·해시 파일을 다시 내려받아 검증하고 앱이 사용하는 `/releases/latest`도 확인합니다.

같은 태그의 Actions를 재실행할 수 있습니다. 이미 공개된 릴리스는 원래 파일을 검증한 뒤 빌드와 게시를 건너뜁니다. 완료된 초안은 그대로 공개하며, 부분 업로드나 초안 생성 전 중단은 동일 커밋·태그의 보관된 `arcad-view-<tag>` Actions 산출물을 복원해 누락 파일만 업로드합니다. 재빌드로 APK 해시가 바뀌어도 기존 자산을 교체하지 않습니다. 원래 산출물이 만료됐거나 기존 파일 해시가 다르면 삭제·덮어쓰기 없이 명확한 오류로 중단합니다.

수동 재실행은 GitHub의 **Actions → Build and publish Android release → 해당 태그 실행 → Re-run all jobs**입니다. 배포 권한은 `contents: write`, 원래 빌드 복원 권한은 `actions: read`를 사용합니다. 복구용 Actions 산출물에는 APK와 공개 소스·해시만 포함되고 서명 키는 포함되지 않습니다.

Actions에 필요한 암호화된 저장소 Secrets:

- `ARCAD_KEYSTORE_BASE64`
- `ARCAD_KEYSTORE_PASSWORD`
- `ARCAD_KEY_ALIAS`
- `ARCAD_KEY_PASSWORD`

릴리스 APK는 `debuggable=false`이며 WebView 원격 디버깅이 꺼져 있습니다. 현재는 기존 테스트 APK와의 업데이트 호환 서명을 유지합니다. Google Play 배포를 수행하거나 인증한 것은 아닙니다.

## Play 배포용 빌드

```powershell
.\android\gradlew.bat -p android assembleRelease -PARCAD_DISTRIBUTION=play
```

이 모드에는 GitHub 인터넷/설치 권한 오버레이가 포함되지 않고 자체 업데이트가 비활성화됩니다. Play 배포 시의 서명·스토어 검토·실제 기기 검증은 별도 절차입니다.
