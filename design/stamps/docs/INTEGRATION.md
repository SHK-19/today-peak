# 최종 묶음 병합

기존90곳에 신규36곳의 assignments를 id 기준으로 추가합니다. seasons144개와 stamps36개를 추가하며 기존 파일은 그대로 둡니다. motifs의 기존15파일은 같고 cairn.svg만 신규입니다. season-tokens.json은126개 mountainPaletteTypes를 포함합니다.

첫 defs와 본문 구조, ../../motifs/{file}.svg#symbol use, lg-only/collected-only는 기존 파이프라인과 같습니다. 내부 ID f/g/c/d는 인스턴스 접두사가 필요합니다. 기존 prefixIds를 유지하세요. d는 네 고산의 깊은 겨울눈 클립입니다.

봄/여름/가을 자체색과 겨울 슬롯을 유지합니다. 봄1500m 이상 잔설, 겨울600m 이상 눈, 겨울1500m 이상 확장 설면이 그림에 포함되므로 자동 눈을 중복하지 않습니다. 600m 미만 네 곳에는 겨울 눈이 없습니다. 이 변경은 이번36곳에만 적용합니다.

40px는 lg-only 제거·필터 제거, 미모음은 collected-only 제거·모든색 단색화·후경opacity1. 40px의 잔설/확장 설면은 세부 표현으로 생략하고 산색으로 계절을 구분합니다. 앱의40px 미모음 #B8C0B2와 디자인 시트의 #D4DACE 차이는 기존대로 유지합니다.

해·링과 하늘은 기존 호스트가 그립니다. assignments.sun과 season-tokens.seasons의sky를 사용합니다. 낮은 네 산의 밝은 바위 면은 눈이 아니므로 일반 paper 슬롯을 지우지 않습니다.

원본 앱 저장소를 변경하지 않고, 기존 build-stamp-art.mjs 복사본으로126곳을 합친 데이터 빌드와 실제 prepareArt 함수의 크기·상태 변환을 검사합니다. 이는 실기기·배포 검사가 아닙니다.
