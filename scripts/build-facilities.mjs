// 산별 시설(주차장·화장실·대피소·약수터)을 숲길POI에서 받아 Supabase facilities 테이블용 SQL을 만든다.
//
//   한국등산트레킹지원센터 숲길POI (B553662/fmmtnFrtrlPoiInfoService) — PARK / TOILET / SHELTER / SPRING
//
//   node scripts/build-facilities.mjs            리포트만
//   node scripts/build-facilities.mjs --write    supabase/seed/facilities.sql을 덮어쓴다
//
// 적용: supabase db query --linked --project-ref <ref> "$(cat supabase/seed/facilities.sql)"
// 번들에 넣지 않는 이유는 CLAUDE.md "데이터 구조 3층" — 상세에서만 쓰고 자주 바뀐다.
// 100대 명산만 해당한다(id = 숲길POI frtrlId). 동네 명산(OSM)은 이 API에 없다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const URL_ = 'https://apis.data.go.kr/B553662/fmmtnFrtrlPoiInfoService/getFmmtnFrtrlPoiInfoList';
const KINDS = { PARK: 'parking', TOILET: 'toilet', SHELTER: 'shelter', SPRING: 'spring' };

const KEY = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('DATA_GO_KR_KEY='))
  ?.slice('DATA_GO_KR_KEY='.length)
  .replace(/\s/g, '');
if (!KEY) {
  console.error('.env에 DATA_GO_KR_KEY가 없다');
  process.exit(1);
}

const mountains = JSON.parse(
  readFileSync(new URL('../src/data/mountains.json', import.meta.url), 'utf8'),
).mountains;
const ids = new Set(mountains.map((m) => m.id));

async function load(code) {
  const response = await fetch(
    `${URL_}?serviceKey=${KEY}&pageNo=1&numOfRows=3000&type=json&srchPlaceTpeCd=${code}`,
  );
  if (!response.ok) throw new Error(`${response.status} ${code}`);
  const { totalCount, items } = (await response.json()).response.body;
  const list = items?.item ?? [];
  if (list.length < totalCount) throw new Error(`${code} ${totalCount}건 중 ${list.length}건만 받았다`);
  return list;
}

const rows = [];
const seen = new Set();
for (const [code, kind] of Object.entries(KINDS)) {
  const items = await load(code);
  let kept = 0;
  for (const item of items) {
    if (!ids.has(item.frtrlId)) continue;
    const lat = Number(Number(item.lat).toFixed(6));
    const lng = Number(Number(item.lot).toFixed(6));
    const key = `${item.frtrlId}|${kind}|${lat}|${lng}`;
    if (seen.has(key)) continue; // 좌표까지 같은 중복
    seen.add(key);
    rows.push({ mountainId: item.frtrlId, kind, name: item.placeNm.trim(), lat, lng });
    kept += 1;
  }
  console.log(`${code}: 전국 ${items.length}건 → 우리 산 ${kept}건`);
}

const withAny = new Set(rows.map((r) => r.mountainId));
console.log(`합계 ${rows.length}건 · 시설 있는 산 ${withAny.size}/${mountains.length}곳`);
const none = mountains.filter((m) => !withAny.has(m.id)).map((m) => m.name);
console.log(`시설 없는 산 ${none.length}곳: ${none.join(', ')}`);

if (process.argv[2] === '--write') {
  const q = (text) => `'${String(text).replace(/'/g, "''")}'`;
  const values = rows
    .map((r) => `(${q(r.mountainId)}, ${q(r.kind)}, ${q(r.name)}, ${r.lat}, ${r.lng})`)
    .join(',\n');
  const sql = `-- 자동 생성: scripts/build-facilities.mjs (${new Date().toISOString().slice(0, 10)}). 출처: 숲길POI.
delete from public.facilities;
insert into public.facilities (mountain_id, kind, name, lat, lng) values
${values};
`;
  mkdirSync(new URL('../supabase/seed/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../supabase/seed/facilities.sql', import.meta.url), sql);
  console.log(`supabase/seed/facilities.sql 갱신 (${Math.round(sql.length / 1024)}KB)`);
}
