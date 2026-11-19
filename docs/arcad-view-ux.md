# Arcad View UX

Arcad View / GUI's Arc Industry의 현장용 CAD 열람·측정·마크업 화면입니다. 기존 원본 도면, 오프라인 동작, 주석과 단위 저장 형식을 유지합니다.

- 홈: 남색 브랜드 헤더, 건축 선화, 실제 최근 도면, 보관함 바로가기. 작은 파일도 B/KB/MB 단위로 표시합니다.
- 보관함: 밝은 목록, 검색·정렬·폴더 관리·압축 가져오기 등 기존 기능을 유지합니다.
- 뷰어: 남색 헤더와 아래 도구바, 파란 선택 상태, 접을 수 있는 측정창과 도구 상태 표시.
- 작업창: 레이어 / 그리기 / 치수 탭. 탭 변경과 창 접기는 선택 도구·스냅·배율을 초기화하지 않습니다. 사용법은 펼쳐 볼 수 있습니다.
- 브랜딩: 앱 표시 이름과 Android 아이콘은 Arcad View입니다. 업데이트 호환성을 위해 applicationId와 기존 저장소 키는 유지합니다. 원본 오픈소스 고지는 앱 정보에서 오프라인으로 열람할 수 있습니다.

Android 빌드: `npm ci`, `npm test`, `npm run android:prepare`, `android/gradlew.bat -p android assembleDebug -PIZCAD_VERSION_CODE=26`.

UI 로고와 건축 선화는 SVG/Android VectorDrawable로 구현하여 인터넷 없이 사용할 수 있습니다. 도면 엔진과 DWG 변환/화면 캐시 버전은 이 UX 변경에서 수정하지 않습니다.
