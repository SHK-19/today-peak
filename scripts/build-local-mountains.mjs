// OpenStreetMap에서 "동네 명산" 정상 좌표를 뽑아 src/data/mountains-local.json을 만든다.
//
// 100대 명산 밖의 산은 공공데이터에 정상 좌표가 없다(봉우리POI·전국 주요 봉우리 POI 모두 확인, 2026-09-06).
// OSM natural=peak 노드에서 가져오되, 좌표를 지어내지 않는다 — 아래 목록의 near는 동명이산 중
// 어느 노드를 고를지 정하는 힌트일 뿐이고, 실제 좌표·고도는 항상 OSM 노드 값이다.
//
// 라이선스: ODbL. 출력 파일 _note와 앱 개인정보처리방침/설명에 출처를 남긴다.
//
//   node scripts/build-local-mountains.mjs                     Overpass에서 받아 리포트만
//   node scripts/build-local-mountains.mjs --write             파일을 쓴다
//   node scripts/build-local-mountains.mjs --cache dump.json   Overpass 대신 받아둔 덤프 사용

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// 서울·경기·인천을 다섯 상자로 나눠 받는다. 한 번에 받으면 Overpass가 504를 낸다.
const BOXES = [
  '37.0,126.4,37.4,127.15',
  '37.0,127.15,37.4,127.9',
  '37.4,126.4,37.75,127.15',
  '37.4,127.15,37.75,127.9',
  '37.75,126.4,38.3,127.9',
];
const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// 동네 명산 후보. osmName은 OSM 노드 이름(산 이름과 다를 때만), near는 동명이산 선택 힌트, province는 홈 필터용 시·도.
const WANTED = [
  // 서울
  { name: '인왕산', province: '서울', near: [37.585, 126.958] },
  { name: '북악산', province: '서울', near: [37.593, 126.974] },
  { name: '남산', province: '서울', near: [37.552, 126.988] },
  { name: '안산', displayName: '안산(서대문)', province: '서울', near: [37.577, 126.946] },
  { name: '아차산', province: '서울', near: [37.567, 127.103] },
  { name: '용마산', province: '서울', near: [37.571, 127.096] },
  { name: '불암산', province: '서울', near: [37.664, 127.095] },
  { name: '수락산', province: '서울', near: [37.699, 127.081] },
  { name: '우면산', province: '서울', near: [37.47, 127.009] },
  { name: '대모산', province: '서울', near: [37.475, 127.079] },
  { name: '구룡산', province: '서울', near: [37.469, 127.061] },
  { name: '청계산', province: '서울', near: [37.422, 127.043] },
  { name: '삼성산', province: '서울', near: [37.436, 126.939] },
  { name: '개화산', province: '서울', near: [37.583, 126.805] },
  { name: '봉산', displayName: '봉산(은평)', province: '서울', near: [37.612, 126.901] },
  // 경기·인천
  { name: '검단산', displayName: '검단산(하남)', province: '경기', near: [37.518, 127.249] },
  { name: '예봉산', province: '경기', near: [37.559, 127.261] },
  { name: '운길산', province: '경기', near: [37.573, 127.295] },
  { name: '남한산', province: '경기', near: [37.481, 127.204] },
  { name: '계양산', province: '인천', near: [37.553, 126.715] },
  { name: '소래산', province: '인천', near: [37.452, 126.779] },
  { name: '문수산', displayName: '문수산(김포)', province: '경기', near: [37.739, 126.549] },
  { name: '고려산', province: '인천', near: [37.744, 126.437] },
  { name: '모락산', province: '경기', near: [37.371, 126.979] },
  { name: '백운산', displayName: '백운산(의왕)', province: '경기', near: [37.354, 127.017] },
  { name: '광교산', osmName: '광교산 시루봉', peakName: '시루봉', province: '경기', near: [37.345, 127.034] },
  { name: '노고산', displayName: '노고산(고양)', province: '경기', near: [37.685, 126.944] },
  { name: '앵자봉', province: '경기', near: [37.416, 127.398] },
  { name: '불곡산', displayName: '불곡산(성남)', province: '경기', near: [37.352, 127.134] },
  { name: '석성산', province: '경기', near: [37.273, 127.173] },
];

async function fetchPeaks() {
  const elements = [];
  for (const box of BOXES) {
    const query = `[out:json][timeout:180];node["natural"="peak"]["name"](${box});out body;`;
    let got = null;
    for (const mirror of MIRRORS) {
      try {
        const response = await fetch(`${mirror}?data=${encodeURIComponent(query)}`);
        if (response.ok) {
          got = await response.json();
          break;
        }
      } catch {
        // 다음 미러
      }
    }
    if (got === null) {
      throw new Error(`Overpass 실패: ${box}`);
    }
    elements.push(...got.elements);
  }
  const seen = new Set();
  return elements.filter((node) => !seen.has(node.id) && seen.add(node.id));
}

const cacheIndex = process.argv.indexOf('--cache');
const peaks =
  cacheIndex !== -1 && existsSync(process.argv[cacheIndex + 1])
    ? JSON.parse(readFileSync(process.argv[cacheIndex + 1], 'utf8')).elements
    : await fetchPeaks();

const rows = [];
const problems = [];
for (const want of WANTED) {
  const targetName = want.osmName ?? want.name;
  const candidates = peaks.filter((node) => node.tags.name === targetName);
  if (candidates.length === 0) {
    problems.push(`${want.name}: OSM에 "${targetName}" 봉우리 없음`);
    continue;
  }
  const dist = (node) => Math.hypot(node.lat - want.near[0], node.lon - want.near[1]);
  const node = candidates.reduce((best, cur) => (dist(cur) < dist(best) ? cur : best));
  if (dist(node) > 0.03) {
    problems.push(`${want.name}: 가장 가까운 노드가 힌트에서 ${(dist(node) * 111).toFixed(1)}km 떨어짐`);
    continue;
  }
  const elevation = Number.parseFloat(node.tags.ele);
  if (!Number.isFinite(elevation) || elevation <= 0) {
    problems.push(`${want.name}: 고도 없음 (OSM 노드 ${node.id})`);
    continue;
  }
  rows.push({
    id: `osm-${node.id}`,
    name: want.displayName ?? want.name,
    summitLat: Number(node.lat.toFixed(6)),
    summitLng: Number(node.lon.toFixed(6)),
    elevationM: Math.round(elevation),
    region: '수도권',
    province: want.province,
    difficulty: null,
    ...(want.peakName ? { peakName: want.peakName } : {}),
    trailheads: [],
    collection: 'local',
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
console.log(`동네 명산 ${rows.length}곳 (후보 ${WANTED.length})`);
for (const row of rows) {
  console.log(`  ${row.name.padEnd(8)} ${row.elevationM}m  ${row.summitLat},${row.summitLng}  ${row.id}`);
}
if (problems.length > 0) {
  console.log(`\n문제 ${problems.length}건:`);
  for (const line of problems) console.log(`  ${line}`);
}

if (process.argv.includes('--write')) {
  const output = {
    _note:
      '자동 생성 파일입니다. 직접 고치지 말고 scripts/build-local-mountains.mjs를 다시 돌리세요. ' +
      '출처: © OpenStreetMap contributors (natural=peak 노드의 좌표·고도), ODbL 1.0. ' +
      '100대 명산 밖의 "동네 명산" 컬렉션입니다. 산 선택은 사람이 했고 좌표는 OSM 값 그대로입니다. ' +
      `생성 ${new Date().toISOString().slice(0, 10)}.`,
    mountains: rows,
  };
  writeFileSync(new URL('../src/data/mountains-local.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nsrc/data/mountains-local.json 갱신 (${rows.length}곳)`);
}
