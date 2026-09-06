# 오늘 정상 — 수도권 확장 / BATCH 01

100대명산12곳 + 동네명산30곳, 총42곳입니다. 기존 확정본10곳은 유지하고 신규 그림만 추가했습니다. 이번 납품은 의뢰서의1묶음이며,2·3묶음은 검수 피드백 이후 진행합니다.

## 먼저 볼 시트

- `sheets/05-all-42.png`: 전체42곳 갤러리.
- `sheets/01-neutral-sky-76.png`: 42×4계절168칸, 같은 회색하늘, 실제76px.
- `sheets/02-neutral-sky-40.png`: 동일168칸, 실제40px, 장식·질감 제외.
- `sheets/03-mixed-collection.png`: 3열76px 혼합 계절42곳.
- `sheets/04-four-keepsakes.png`: 관악산·남산·인왕산 사계절.
- `sheets/06-empty-40.png`: 미모음42곳.
- `sheets/07-system-comparison.png`: 기존 시제품과 신규100대·동네산 비교.

모든 시트에 편집 가능한 SVG가 있습니다. PNG를100% 배율로 열면 표기 크기와 같습니다.

## 납품 파일

- `stamps/{id}.svg`: 기본 그림 층42개(편집 원본).
- `seasons/{season}/{id}.svg`: 사계절 그림 층168개(앱에서 사용).
- `motifs/`: 기존9파일과 새4파일, 총13종. none용 파일은 없습니다.
- `standalone/{season}/{id}.svg/png`: 완성168종. PNG600×600, 도장 밖 투명. SVG는 외부 심볼 없이 독립적으로 열림.
- `preview/{season}/`: 42×4×3크기×2상태 =1,008쌍.
- `assignments.csv/json`: ID·컬렉션·인증지점·배치·눈·해·팔레트.
- `season-tokens.json`: 기존10+신규42의52개 매핑. 기존 매핑을 덮어 지우지 말고 병합합니다.
- `art-data.json`: 산별 편집용 경로.
- `source-brief-data.json`: 의뢰서에서 추출한42개 정본 행.
- `docs/`: 확장 규칙·적용 방법·변경 요약·참고 근거.
- `validation.json`: 형식·용량·참조·수량 검사.

동네산30곳 중20곳은 모티프 없이 산체만 사용했습니다. 새 모티프는 tower/pavilion/fortress/altar 네 종류입니다. 모든 산은 2차 계절 규칙과 주황 링·해를 사용합니다.

파일 검증과 실제 등산자의 식별 검증은 구분됩니다. 정확한 지평선·DEM·무기명 식별21곳 이상은 미검증이며, 앱 적용·출시 작업은 하지 않았습니다. 실루엣의 사실성·인상은1묶음 검수에서 확인할 항목입니다.
