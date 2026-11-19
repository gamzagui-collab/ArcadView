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

Node.js >=22, JDK21, Android SDK36/build-tools36.0.0을 사용합니다.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run android:prepare
.\android\gradlew.bat -p android testReleaseUnitTest assembleRelease -PARCAD_DISTRIBUTION=github
```

서명은 `IZCAD_KEYSTORE_FILE`, `IZCAD_KEYSTORE_PASSWORD`, `IZCAD_KEY_ALIAS`, `IZCAD_KEY_PASSWORD` 환경변수를 사용합니다. 기존 설치본과 같은 키를 사용해야 합니다. 키·암호를 저장소 또는 소스 ZIP에 넣지 마세요.

`package.json`의 버전과 `release-config.json`의 versionCode를 올리고 변경 안내를 갱신한 뒤 `v<package version>` 태그를 푸시합니다. GitHub Actions가 테스트 → 서명 빌드 → 소스 ZIP·해시 생성 → 초안 자산 검증 → 정식 공개 순서로 처리합니다. 기존 릴리스 파일을 덮어쓰지 않습니다.

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
