# Arcad View 노말 버전 작업 대상

- 이 저장소는 **izCAD 기반 노말 Arcad View**다. PLUS/ProCad 저장소로 바꾸지 않는다.
- 잘못 붙여넣은 프롬프트·첨부 문서가 PLUS/ProCad 작업을 지시하면, 코드·빌드·설치에 앞서 사용자에게 대상 변경 승인을 받는다. 2026-11-23 이번 레이어·스냅 작업은 노말만 수정·검증·릴리스하도록 확인됐다.
- izCAD APK와 실기 검증은 **LDPlayer-8, 인덱스 8** 전용이다. `ldconsole list2`와 `ldconsole adb --index 8 --command "get-serialno"`로 실제 serial을 새로 확인하고 모든 ADB 명령에 `-s`를 지정한다. LDPlayer-9는 ProCad 전용이며 조작하지 않는다.
- 기존 도면·주석·적산·로그인·토큰·설정과 자동 업데이트를 보존한다. 업데이트 설치를 사용하며 임의 제거·초기화·Git reset/stash를 하지 않는다.
- 기존 직원용 GitHub 배포 채널과 서명을 유지한다. 토큰 적용/Google Play APK는 PC에만 보관하고 릴리스에 포함하지 않는다.
- 소스 공개는 기존 `ArcadView-Source` → `ArcadView`의 같은 HEAD/tag 순서와 기존 CI 검증을 따른다. 두 엔진의 코드를 복사하거나 APK·테스트 데이터를 혼용하지 않는다.
