## Arcad View 2.1.4

GUI's Arc Industry의 Android CAD 뷰어입니다. izCAD를 기반으로 개선한 전체 소스를 GPL-3.0으로 함께 공개합니다.

- 남색·파랑·하늘색 UX, 홈·최근 도면·보관함, 레이어/그리기/치수 작업창
- DWG/DXF 측정, 블록·해치 스냅, 도면별 단위 기억과 변환/화면 캐시
- 최대 3개 오버레이 레이어, 폴리라인·원·사각형·텍스트·치수선, 선택·이동·삭제·트림
- GitHub 새 릴리스 자동 확인과 사용자 승인 후 APK 다운로드·검증·업데이트
- 홈 최근 도면 카드의 실제 터치를 가리던 빈 캔버스 수정

### 설치와 업데이트

`Arcad-View-v2.1.4-31.apk`를 설치하세요. 기존 테스트 설치본과 같은 서명을 사용하므로 앱을 제거하지 않고 업데이트할 수 있습니다. 기존 앱을 삭제하면 기기 안의 도면 보관함과 주석이 사라질 수 있습니다.

앱은 시작 시, 이후 복귀 시에는 6시간 간격으로 새 버전을 확인합니다. **앱 정보 → 업데이트 확인**으로 즉시 확인할 수도 있습니다. 승인 전에는 APK를 다운로드하지 않습니다. 다운로드 후 SHA-256·패키지 ID·버전·서명을 검사하고 Android 설치 화면을 엽니다. 기기 설정에 따라 ‘이 출처 허용’과 Android의 최종 설치 승인이 필요합니다.

도면 원본은 수정하지 않으며, 도면과 주석은 기기에 보관합니다. 인터넷 연결은 GitHub 업데이트 확인과 다운로드에만 사용합니다.

[사용 및 빌드 안내](https://github.com/gamzagui-collab/ArcadView#readme) · [업데이트/배포 안내](https://github.com/gamzagui-collab/ArcadView/blob/main/docs/GITHUB_RELEASES.md) · [개인정보 안내](https://github.com/gamzagui-collab/ArcadView/blob/main/PRIVACY.md)

### 포함 파일

- 서명된 GitHub 배포용 APK
- 해당 태그의 전체 소스 ZIP
- `SHA256SUMS.txt`와 버전·커밋·서명 지문을 기록한 `release-info.json`

이 릴리스는 GitHub 직접 설치용입니다. Google Play 배포본은 별도로 빌드하며 APK 자체 업데이트 권한과 기능을 포함하지 않습니다.
