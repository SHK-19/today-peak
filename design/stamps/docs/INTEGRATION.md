# 기존 파이프라인에 추가하기

seasons152개와 stamps38개를 기존 폴더에 추가합니다. motifs13개는 기존과 같고 bridge.svg, sheer-face.svg 두 파일만 신규입니다. assignments는 이번38개만 있으므로 기존52개에 id 기준으로 병합하세요. season-tokens.json은90개 매핑을 포함합니다. 운영에 다른 매핑이 추가되어 있다면 이 역시 기존을 지우지 말고 병합합니다.

SVG는 기존처럼 첫 defs와 본문 구조를 유지합니다. 외부 참조는 ../motifs 또는 ../../motifs의 use href뿐입니다. compact한 내부 ID f/g/c는 각 파일의 filter/gradient/clipPath입니다. 기존 prefixIds가 인스턴스별로 접두사를 붙여야 합니다. 모티프 내부 ID와 파일명은 변경하지 않았습니다.

봄·여름·가을 자체색, 겨울 기존 슬롯, lg-only/collected-only, 미모음 변환은 동일합니다. 겨울 값은 토큰의 winterPalette에 있습니다. 새 파일을 고도 색으로 일괄 덮지 마세요. 40px에서 세부 장식과 필터를 끄되 능선 그라데이션은 남깁니다. 미모음은 모든 paint를 단색으로 치환합니다.

앱의 현재 stamp-art.ts는40px 미모음에 #B8C0B2를 사용하고76px에는 #D4DACE를 사용합니다. 이번 디자인 검수 시트는 의뢰서의 미모음 색 #D4DACE를 그대로 사용했습니다. 앱 로직은 변경하지 않았습니다.

해·링은 기존 주황, r20/r85/r77입니다. 해 위치는 assignments.sun. 봄 잔설 대상은 없고 겨울에는 자체 눈이 있으므로 호스트 자동 눈은 중복하지 않습니다.

기존 build-stamp-art.mjs를 수정 없이 복사한 격리 폴더에서 시제품10+1묶음42+이번38을 합쳐 빌드를 확인합니다. 이는 산출물 호환성 검사이며 실제 앱 반영·배포는 아닙니다. 그림 PNG가 필요하면 standalone, 앱 에셋만 필요하면 seasons를 사용하세요.
