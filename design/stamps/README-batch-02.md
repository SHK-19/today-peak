# 오늘 정상 — 경상·충청38 / BATCH 02

경상28곳과 충청10곳의 기본판38개, 계절판152개입니다. 기존52곳의 그림과 모티프는 변경하지 않았습니다.

## 그림 결과물 보기

- `sheets/05-all-38.png`: 38곳 전체 미리보기.
- `standalone/spring/` 등 네 계절 폴더: 개별 완성 PNG·SVG152쌍. 실제 폴더명은 spring, summer, autumn, winter입니다. PNG는600×600이며 원 밖은 투명합니다.
- `sheets/04-four-keepsakes.png`: 가야산·대둔산·월악산 사계절 비교.
- `sheets/01-neutral-sky-76.png`, `02-neutral-sky-40.png`: 같은 회색하늘에서38×4계절 비교.
- `sheets/03-mixed-collection.png`: 3열76px 혼합 계절38곳.
- `sheets/06-empty-40.png`: 미모음 윤곽38곳.
- `sheets/07-system-comparison.png`: 기존 시제품과 비교.

## 앱 적용용 파일

- `stamps/{id}.svg`38개: 편집 원본인 기본 그림층.
- `seasons/{season}/{id}.svg`152개: 앱에서 쓰는 계절 그림층. 링·해·하늘은 앱에서 합성.
- `motifs/`: 기존13개 그대로 + bridge, sheer-face 2개 =15종.
- `assignments.json/csv`: 이번38곳만. 기존52곳의 배정표와 ID로 병합.
- `season-tokens.json`: 기존52+신규38=90개 mountainPaletteTypes를 포함한 상위집합.
- `art-data.json`: 편집 가능한 산별 경로와 구도 데이터.
- `source-brief-data.json`: 의뢰서 표에서 추출한38행.
- `validation.json`: 파일·수량·용량·참조·파이프라인 검사 결과.
- `docs/`: 변경 요약, 적용 안내, 기준 해석.

전체 납품 ZIP은 그림 결과물까지 포함합니다. 별도 assets ZIP은 앱 적용용 SVG·배정표·문서만 포함하며 PNG 미리보기는 없습니다.

무기명 산 식별률과 실제 정상 조망 일치는 사람 검수 대상입니다. 이를 검증 완료로 표시하지 않았으며 기존 출시 앱은 수정하지 않았습니다. 이번 묶음에 마이산과3묶음36곳은 포함하지 않습니다.
