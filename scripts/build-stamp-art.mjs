// design/stamps/ (디자이너 납품)에서 src/data/stamp-art.json을 만든다.
//
//   seasons/{season}/{id}.svg  →  산별·계절별 그림 층 (defs + 본문)
//   motifs/*.svg               →  <use href="x.svg#sym">를 같은 문서의 <symbol>로 인라인
//   assignments.json           →  해 위치
//   season-tokens.json         →  계절 하늘색, 겨울 팔레트
//
// 렌더 시점의 처리(id 접두사, 40px·미모음 변환)는 src/lib/stamp-art.ts가 한다.
//
//   node scripts/build-stamp-art.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../design/stamps/', import.meta.url);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const symbols = new Map(); // "meadow.svg#motif-meadow-season" → "<symbol …>…</symbol>"
for (const file of readdirSync(new URL('motifs/', ROOT))) {
  const text = readFileSync(new URL(`motifs/${file}`, ROOT), 'utf8');
  for (const match of text.matchAll(/<symbol id="([^"]+)"[\s\S]*?<\/symbol>/g)) {
    symbols.set(`${file}#${match[1]}`, match[0]);
  }
}

function extract(svgText, id, season) {
  const defsMatch = /<defs>([\s\S]*?)<\/defs>/.exec(svgText);
  const bodyMatch = /<\/defs>([\s\S]*)<\/svg>\s*$/.exec(svgText);
  if (defsMatch === null || bodyMatch === null) {
    throw new Error(`${season}/${id}: defs 또는 본문을 못 찾았다`);
  }
  let defs = defsMatch[1];
  let body = bodyMatch[1];

  // 외부 심볼 참조를 문서 안 심볼로 바꾼다.
  body = body.replace(/href="(?:\.\.\/)+motifs\/([^"#]+#[^"]+)"/g, (_, key) => {
    const symbol = symbols.get(key);
    if (symbol === undefined) {
      throw new Error(`${season}/${id}: 모티프 ${key} 없음`);
    }
    if (!defs.includes(symbol)) {
      defs += symbol;
    }
    return `href="#${key.split('#')[1]}"`;
  });
  if (/href="[^#"]/.test(body)) {
    throw new Error(`${season}/${id}: 외부 참조가 남아 있다`);
  }
  return `<defs>${defs}</defs>${body}`;
}

const assignments = JSON.parse(readFileSync(new URL('assignments.json', ROOT), 'utf8'));
const tokens = JSON.parse(readFileSync(new URL('season-tokens.json', ROOT), 'utf8'));

const art = {};
for (const { id, name, sun } of assignments) {
  const seasons = {};
  for (const season of SEASONS) {
    const text = readFileSync(new URL(`seasons/${season}/${id}.svg`, ROOT), 'utf8');
    seasons[season] = extract(text, id, season);
  }
  art[id] = { name, sun, seasons };
}

const output = {
  _note:
    '자동 생성. 직접 고치지 말고 scripts/build-stamp-art.mjs를 다시 돌리세요. 출처: design/stamps/ (2026-09-06 2차 납품).',
  sky: Object.fromEntries(SEASONS.map((s) => [s, tokens.seasons[s].sky])),
  winter: tokens.winterPalette,
  // 디자이너 그림이 없는 산도 같은 계절 팔레트로 물든다(붉은 단풍형 기준).
  palette: tokens.paletteTypes.red,
  art,
};
const path = new URL('../src/data/stamp-art.json', import.meta.url);
writeFileSync(path, `${JSON.stringify(output)}\n`);
const bytes = JSON.stringify(output).length;
console.log(`stamp-art.json: 산 ${Object.keys(art).length}곳 × ${SEASONS.length}계절, ${Math.round(bytes / 1024)}KB`);
