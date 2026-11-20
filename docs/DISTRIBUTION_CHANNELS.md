# 소스 공개와 앱 배포

## 공개 소스 저장소

<https://github.com/gamzagui-collab/ArcadView-Source>

GPL-3.0-only에 따라 배포 버전의 전체 수정 소스, 의존성 고지, 네이티브 엔진 소스와 빌드 절차를 제공합니다. `v2.1.19`처럼 앱 버전과 같은 태그를 사용합니다. 이전 배포판의 태그도 유지합니다.

이 저장소의 GitHub Actions는 비활성화합니다. APK/AAB 자산이나 실행 파일 릴리스를 게시하지 않습니다. 빌드 절차와 스크립트는 대응 소스에 포함되며, 소스를 받은 사람의 GPL상 빌드·수정·재배포 권리는 유지됩니다.

## 전환 기간 직원용 APK

현재는 <https://github.com/gamzagui-collab/ArcadView>에서 APK와 기존 업데이트를 유지합니다. 사용자가 2026-11-20에 선택한 방침에 따라 Play 전환 전에는 이 저장소나 기존 릴리스를 비공개로 바꾸지 않습니다.

검증·커밋 후 `powershell.exe -NoProfile -File scripts/publish-version.ps1`을 실행하면 기존 개발자 Git 인증으로 공개 소스와 태그를 먼저 올리고, 빌드 저장소의 태그를 올려 APK 자동화를 시작합니다. 새 쓰기 키·토큰·Actions 비밀값을 생성하지 않습니다. APK 자동화는 동일 커밋의 소스 태그가 공개되어 있는지 확인하고 게시합니다. 소스 저장소에서는 빌드가 실행되지 않습니다.

## Google Play 전환

Play 배포판은 `-PARCAD_DISTRIBUTION=play`로 빌드합니다. 이 구성은 기존 코드에서 GitHub 자체 업데이트를 비활성화하고 APK 설치 권한을 포함하지 않습니다. Play 설치본의 업데이트는 Google Play를 사용합니다.

Play 출시와 기존 직원의 이전 경로를 확인한 뒤 빌드 저장소를 비공개로 전환합니다. GitHub 릴리스의 접근 권한은 저장소를 따르므로 그 저장소의 이전 릴리스도 함께 비공개가 됩니다. 릴리스와 자산을 삭제할 필요는 없습니다. 공개 소스 저장소와 버전 태그는 계속 유지합니다.

비공개 GitHub 릴리스는 인증 없이 기존 앱에 제공되지 않습니다. 직원용 별도 자체 업데이트를 계속하려면 별도 배포 서버가 필요하며, GitHub 자격증명을 앱에 넣어서는 안 됩니다. 현재 사용할 서버가 없으므로 이를 구축했다고 주장하지 않습니다.

## 라이선스 안내

상용·유료 배포는 가능하지만 GPL로 배포한 수정 프로그램의 대응 소스 제공 의무와 이용자의 수정·재배포 권리는 유지됩니다. GitHub 전체 개발 과정을 공개할 필요와 대응 소스 제공은 별개의 사항입니다. 비밀키·계정·사용자 도면·운영 데이터는 소스 제공 대상에 넣지 않습니다.

앱의 오픈소스 안내와 스토어 설명에 위 소스 주소 및 해당 버전 태그를 안내합니다. 원저작자와 의존성의 저작권·라이선스 고지는 유지합니다. 이미 공개된 사본이나 부여한 GPL 권리는 저장소 비공개 전환으로 회수되지 않습니다.

근거: [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html#section6), [GNU의 상용 배포 안내](https://www.gnu.org/licenses/gpl-faq.en.html#DoesTheGPLAllowMoney), [Google Play의 자체 업데이트 정책](https://support.google.com/googleplay/android-developer/answer/16559646).
