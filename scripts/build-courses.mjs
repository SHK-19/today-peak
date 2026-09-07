// 등산 코스를 GPX에서 뽑아 Supabase courses 테이블용 SQL을 만든다.
//
//   한국등산트레킹지원센터_산림청 100대명산 (data.go.kr 15098177, GPX)   — 산 폴더 / 코스 파일
//   한국등산트레킹지원센터_전국 주요 봉우리 코스 (15108086, GPX)        — 동네 명산용, 봉우리 폴더 / 코스 파일
//
//   node scripts/build-courses.mjs <100대명산 폴더> <봉우리코스 폴더>            리포트만
//   node scripts/build-courses.mjs <100대명산 폴더> <봉우리코스 폴더> --write    supabase/seed/courses.sql
//
// 이 파일들은 트랭글 GPS 기록이지 편집된 코스가 아니다. 그래서:
//   - 코스 이름: 시작점 300m 안의 입구·주차장·정류장 지점 이름. 없거나 "갈림길"처럼 일반명이면 "N.Nkm 코스".
//   - 정상: 파일 안 PEAK 지점 중 가장 높은 것. 없으면 null (정상까지 안 가는 기록도 많다).
//   - 시간: 네이스미스 — 4.5km/h + 오르막 10m당 1분. 칼로리: 70kg 기준. 난이도: 오르막 300/600m.
//   - 시설·교통·주의는 지점(wpt)의 category 그대로. 우리가 문구를 만들지 않는다.
// 트랙 좌표는 저장하지 않는다 — 지도를 그리지 않는다(CLAUDE.md 범위 밖).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [topDir, peakDir, flag] = process.argv.slice(2);
if (!topDir || !peakDir) {
  console.error('사용법: node scripts/build-courses.mjs <100대명산 폴더> <봉우리코스 폴더> [--write]');
  process.exit(1);
}
const nfc = (text) => text.normalize('NFC');
const load = (file) =>
  JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8')).mountains;
const TOP100 = load('mountains.json');
const LOCAL = load('mountains-local.json');

// 저장할 지점 종류. SIGN(이정표)·NONE·PHOTO·WILD는 뺀다 — 화면에 줄 게 없다.
const KEEP = new Set([
  'ENTRY', 'PARK', 'TRANS', 'TOILET', 'SPRING', 'SHELTER', 'STORE', 'FOOD', 'CAMP',
  'CULTURAL', 'VIEW', 'SCENERY', 'REST', 'INFO', 'DANGER', 'PEAK',
]);
const GENERIC_NAME = /^(갈림길|화장실|주차장|버스\s?정류장|버스|정상|안내소|쉼터|이정표|입구|들머리)$/;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 트랭글 GPX는 형식이 고정이라 정규식으로 충분하다. 이름·종류는 CDATA로 감싸여 있어 먼저 벗긴다.
function parseGpx(raw) {
  const text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const points = [];
  for (const m of text.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)">\s*<ele>([\d.-]+)<\/ele>/g)) {
    points.push({ lat: Number(m[1]), lng: Number(m[2]), ele: Number(m[3]) });
  }
  const wpts = [];
  for (const m of text.matchAll(/<wpt lat="([\d.-]+)" lon="([\d.-]+)">([\s\S]*?)<\/wpt>/g)) {
    const body = m[3];
    const name = /<name>([^<]*)<\/name>/.exec(body)?.[1].trim() ?? '';
    const category = /<category>([^<]*)<\/category>/.exec(body)?.[1].trim() ?? '';
    const ele = Number(/<ele>([\d.-]+)<\/ele>/.exec(body)?.[1] ?? 0);
    wpts.push({ lat: Number(m[1]), lng: Number(m[2]), ele, name, category });
  }
  return { points, wpts };
}

// GPS 고도 잡음 문턱. 벤치마크 앱(북한산성 코스 981m)과 맞춰 정했다.
const ELE_THRESHOLD_M = Number(process.env.ELE_THRESHOLD_M ?? 8);

function stats(points) {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let base = points[0].ele;
  for (let i = 1; i < points.length; i += 1) {
    distance += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    // 5m 문턱: GPS 고도 잡음을 오르막으로 세지 않는다.
    const delta = points[i].ele - base;
    if (delta >= ELE_THRESHOLD_M) { ascent += delta; base = points[i].ele; }
    else if (delta <= -ELE_THRESHOLD_M) { descent -= delta; base = points[i].ele; }
  }
  const top = points.reduce((best, p) => (p.ele > best.ele ? p : best), points[0]);
  return { distance, ascent, descent, maxEle: top.ele, top };
}

function course(file, mountainId, seq, mountainName) {
  const { points, wpts } = parseGpx(readFileSync(file, 'utf8'));
  if (points.length < 10) return null;
  const s = stats(points);
  const start = points[0];
  const end = points.at(-1);
  const near = (w) => haversine(start.lat, start.lng, w.lat, w.lng);
  const entrance = wpts
    .filter((w) => ['ENTRY', 'PARK', 'TRANS'].includes(w.category) && near(w) <= 300 && !GENERIC_NAME.test(w.name) && w.name !== '')
    .sort((a, b) => near(a) - near(b))[0];
  const first = wpts.filter((w) => near(w) <= 300 && w.name !== '' && !GENERIC_NAME.test(w.name)).sort((a, b) => near(a) - near(b))[0];
  const km = Math.round((s.distance / 100)) / 10;
  const name = entrance?.name ?? first?.name ?? `${km}km 코스`;
  const peak = wpts.filter((w) => w.category === 'PEAK').sort((a, b) => b.ele - a.ele)[0] ?? null;
  // "원효봉 정상" → "원효봉", "정상"·"산정상" → 산 이름. 화면에서 "정상 원효봉 정상"이 되지 않게.
  const peakName =
    peak === null ? null : (peak.name.replace(/\s*(산)?정상(석)?\d*$/, '').trim() || mountainName);
  const minutes = Math.round((s.distance / 4500) * 60 + s.ascent / 10);
  const kcal = Math.round(70 * (1.05 * (s.distance / 1000) + 0.0125 * s.ascent));
  const difficulty = s.ascent < 300 ? '초급' : s.ascent < 600 ? '중급' : '상급';
  const pois = wpts
    .filter((w) => KEEP.has(w.category) && w.name !== '')
    .map((w) => ({ kind: w.category, name: w.name, lat: w.lat, lng: w.lng }));
  return {
    id: `${mountainId}-${String(seq).padStart(2, '0')}`,
    mountainId,
    name,
    startName: entrance?.name ?? first?.name ?? null,
    peakName,
    peakEleM: peak === null ? null : Math.round(peak.ele),
    distanceM: Math.round(s.distance),
    ascentM: Math.round(s.ascent),
    descentM: Math.round(s.descent),
    maxEleM: Math.round(s.maxEle),
    minutes,
    kcal,
    difficulty,
    isLoop: haversine(start.lat, start.lng, end.lat, end.lng) <= 200,
    pois,
    _peak: peak,
    _top: s.top,
  };
}

function coursesIn(dir, mountainId, mountainName) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.gpx')).sort();
  return files.map((f, i) => course(path.join(dir, f), mountainId, i + 1, mountainName)).filter((c) => c !== null);
}

// 같은 산에 같은 이름("6.4km 코스")이 여럿이면 (2), (3)을 붙인다.
function dedupeNames(courses) {
  const seen = new Map();
  for (const c of courses) {
    const n = (seen.get(c.name) ?? 0) + 1;
    seen.set(c.name, n);
    if (n > 1) c.name = `${c.name} (${n})`;
  }
  return courses;
}

const rows = [];
const report = [];
const topFolders = new Map(readdirSync(topDir).map((f) => [nfc(f), path.join(topDir, f)]));
for (const m of TOP100) {
  const dir = topFolders.get(m.name);
  if (dir === undefined) { report.push(`${m.name}: 폴더 없음`); continue; }
  rows.push(...dedupeNames(coursesIn(dir, m.id, m.name)));
}
// 100대 명산인데 우리 목록에 없는 산(정상 좌표가 없어 빠진 4곳). 정상 좌표 후보를 보고한다.
const extras = [...topFolders.keys()].filter((name) => !TOP100.some((m) => m.name === name));
for (const name of extras) {
  const cs = coursesIn(topFolders.get(name), `x-${name}`, name);
  const peaks = cs.map((c) => c._peak).filter((p) => p !== null).sort((a, b) => b.ele - a.ele);
  report.push(`목록 밖 ${name}: 코스 ${cs.length} · PEAK 후보 ${peaks[0] ? `${peaks[0].name} ${Math.round(peaks[0].ele)}m ${peaks[0].lat},${peaks[0].lng}` : '없음'}`);
}

// 동네 명산: 이름이 같은 봉우리 폴더 중 정상 1.5km 안에 코스 최고점이 있는 것만.
const peakFolders = readdirSync(peakDir).map((f) => [nfc(f), path.join(peakDir, f)]);
for (const m of LOCAL) {
  const base = m.name.replace(/\(.*\)$/, '');
  const candidates = peakFolders.filter(([n]) => new RegExp(`_${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\(|$)`).test(n));
  let picked = [];
  for (const [, dir] of candidates) {
    // 이름이 같은 다른 산(청계산이 5곳)을 거르려고 트랙 최고점이 우리 정상 1.5km 안인 것만 받는다.
    const cs = coursesIn(dir, m.id, m.name.replace(/\(.*\)$/, '')).filter(
      (c) => haversine(c._top.lat, c._top.lng, m.summitLat, m.summitLng) <= 1500,
    );
    picked.push(...cs);
  }
  picked = dedupeNames(picked.map((c, i) => ({ ...c, id: `${m.id}-${String(i + 1).padStart(2, '0')}` })));
  if (picked.length === 0) report.push(`${m.name}: 봉우리 코스 없음 (후보 폴더 ${candidates.length})`);
  rows.push(...picked);
}

const byMountain = new Map();
for (const r of rows) byMountain.set(r.mountainId, (byMountain.get(r.mountainId) ?? 0) + 1);
console.log(`코스 ${rows.length}개 · 산 ${byMountain.size}곳 · PEAK 있는 코스 ${rows.filter((r) => r.peakName !== null).length} · 왕복 ${rows.filter((r) => r.isLoop).length}`);
console.log(`지점 ${rows.reduce((s, r) => s + r.pois.length, 0)}개 · "N.Nkm 코스" 이름 ${rows.filter((r) => /km 코스$/.test(r.name)).length}개`);
for (const line of report) console.log('  ' + line);
const bhs = rows.filter((r) => r.mountainId === '0000000047').slice(0, 6);
console.log('북한산 처음 6개:');
for (const c of bhs) console.log(`  ${c.id} ${c.name} · ${(c.distanceM / 1000).toFixed(2)}km · ↑${c.ascentM}m · ${Math.floor(c.minutes / 60)}시간 ${c.minutes % 60}분 · ${c.kcal}kcal · ${c.difficulty} · 정상 ${c.peakName ?? '-'} ${c.peakEleM ?? ''} · 지점 ${c.pois.length}${c.isLoop ? ' · 왕복' : ''}`);

if (flag === '--write') {
  const q = (v) => (v === null ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const values = rows
    .map((r) => `(${[r.id, r.mountainId, r.name, r.startName, r.peakName, r.peakEleM, r.distanceM, r.ascentM, r.descentM, r.maxEleM, r.minutes, r.kcal, r.difficulty, r.isLoop, JSON.stringify(r.pois)].map(q).join(', ')})`)
    .join(',\n');
  const sql = `-- 자동 생성: scripts/build-courses.mjs (${new Date().toISOString().slice(0, 10)}). 출처: 한국등산트레킹지원센터 GPX.
delete from public.courses;
insert into public.courses (id, mountain_id, name, start_name, peak_name, peak_ele_m, distance_m, ascent_m, descent_m, max_ele_m, minutes, kcal, difficulty, is_loop, pois) values
${values};
`;
  mkdirSync(new URL('../supabase/seed/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../supabase/seed/courses.sql', import.meta.url), sql);
  console.log(`supabase/seed/courses.sql 갱신 (${Math.round(sql.length / 1024)}KB)`);
}
