// 공유 미리보기 카드(OG 이미지) 한 장의 HTML. scripts/build-og.mjs가 이걸 크롬으로 굽는다.
// 앱 안 스탬프와 같은 <Stamp>를 쓴다 — 카드만 따로 그리면 언젠가 앱과 어긋난다.
import { renderToStaticMarkup } from 'react-dom/server';

import { Stamp } from '../src/components/Stamp.tsx';
import local from '../src/data/mountains-local.json';
import data from '../src/data/mountains.json';
import { SEASON_LABEL, SEASON_ORDER } from '../src/lib/seasons.ts';
import type { Season } from '../src/lib/stamp-art.ts';
import type { Mountain } from '../src/lib/verify.ts';

export const WIDTH = 800;
export const HEIGHT = 420;

// 계절을 정하는 건 인증 시각이라, 계절마다 대표 날짜를 하나씩 넣어 그린다.
const SEASON_DATE: Record<Season, string> = {
  spring: '2026-04-15T03:00:00.000Z',
  summer: '2026-07-15T03:00:00.000Z',
  autumn: '2026-10-15T03:00:00.000Z',
  winter: '2026-01-15T03:00:00.000Z',
};

// mountains.ts의 MOUNTAINS를 쓰지 않는다 — 거기엔 실측용 test-places(집 좌표)가 섞여 있고,
// 그 이름으로 카드를 구우면 공개 폴더로 나간다.
const ALL = [...data.mountains, ...local.mountains] as Mountain[];

export function cards(): { file: string; id: string; name: string; html: string }[] {
  return ALL.flatMap((mountain) =>
    SEASON_ORDER.map((season) => ({
      file: `${mountain.id}-${season}.png`,
      id: mountain.id,
      name: mountain.name,
      html: cardHtml(mountain, season),
    })),
  );
}

function cardHtml(mountain: Mountain, season: Season): string {
  const stamp = renderToStaticMarkup(
    <Stamp mountain={mountain} collected size={280} verifiedAt={SEASON_DATE[season]} />,
  );
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    display: flex; align-items: center; gap: 48px;
    padding: 0 64px;
    background: #f3f1e8;
    font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;
    color: #20372d;
    word-break: keep-all;
  }
  .art { flex: none; width: 280px; height: 280px; }
  .copy { display: flex; flex-direction: column; gap: 12px; }
  h1 { font-size: 62px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.1; }
  .season { font-size: 30px; font-weight: 600; color: #1f6b4a; }
  .brand { margin-top: 14px; font-size: 20px; font-weight: 600; color: #657168; }
</style></head>
<body>
  <div class="art">${stamp}</div>
  <div class="copy">
    <h1>${mountain.name}</h1>
    <p class="season">${SEASON_LABEL[season]} 스탬프</p>
    <p class="brand">오늘 정상 · 정상에서 받은 스탬프</p>
  </div>
</body></html>`;
}
