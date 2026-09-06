# 오늘 정상 — 계절 강조 2차

요청서 designbriefstampsseasons.md에 따라 봄·여름·가을의 색면만 강화했습니다. 기본판과 겨울판, 산 형태·모티프·질감은 유지합니다.

## 판정 시트 4장

1. `sheets/01-neutral-sky-76.png`: 10곳×4계절, 실제76px, 전부 같은 회색 하늘.
2. `sheets/02-neutral-sky-40.png`: 동일40칸, 실제40px, 장식·질감 제외. 하늘도 회색으로 통일해 색만 비교.
3. `sheets/03-mixed-collection.png`: 3열76px 혼합 계절10곳.
4. `sheets/04-four-keepsakes.png`: 설악산·소백산·한라산 사계절160px 비교.

각 시트에 편집 가능한 SVG가 있습니다. PNG를 실제 배율100%로 보면 표기한 스탬프 크기가 맞습니다.

## 파일

- `seasons/{spring,summer,autumn,winter}/{id}.svg`: 그림 층40개.
- `stamps/`: 변경하지 않은 편집 원본10개.
- `motifs/`: 변경하지 않은 공유 심볼9파일.
- `standalone/`: 독립 완성SVG·600×600 PNG40쌍.
- `preview/`: 40/76/160px × 모음/미모음 ×40종 =240쌍.
- `season-tokens.json`: 계절 하늘, 해 유지값, 산 유형별 팔레트와 산ID배정.
- `assignments.csv/json`: 위치·배치는 유지하고 JSON의 seasonSnow에 봄 잔설 정책을 갱신했습니다. CSV는 기존 배치 참조용이며 계절 눈 정책은 JSON과 적용 안내를 사용합니다.
- `docs/CHANGE-SUMMARY.md`: 변경 요약1쪽.
- `docs/EXPANSION.md`: 계절 절을 갱신한 확장 규칙.
- `docs/INTEGRATION.md`: 자체색·그라데이션·미모음·봄 잔설 적용 방법.
- `validation.json`: 크기·용량·참조·원본 보존 검사.

기본판과 겨울판은 원본과 동일하게 보존했습니다. 현재 앱에 적용하거나 실제 사용자에게 식별률을 시험한 결과는 아닙니다. 기존 랜드마크 콘셉트의 DEM 미검증 상태는 같습니다.
