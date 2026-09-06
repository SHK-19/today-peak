// 공공데이터 두 곳을 합쳐 src/data/mountains.json을 만든다.
//
//   숲나들e 100대명산 정보 (odcloud 15112801) — 이름·소재지·공식 높이·난이도·개요
//   한국등산트레킹지원센터 봉우리POI (B553662/peakPoiInfoService) — 정상 좌표
//   한국등산트레킹지원센터 숲길POI (B553662/fmmtnFrtrlPoiInfoService, ENTRY) — 등산로 입구 좌표
//
// 좌표는 지어내지 않는다. 정상은 "그 산에 귀속된 봉우리 중 공식 높이에 가장 가까운 것"으로
// 고르고, 어떤 봉우리를 골랐는지(peakName) 파일과 리포트에 남긴다.
//
//   node scripts/build-mountains.mjs            리포트만 보고 파일은 안 쓴다
//   node scripts/build-mountains.mjs --write    src/data/mountains.json을 덮어쓴다

import { readFileSync, writeFileSync } from 'node:fs';

const SUP_URL =
  'https://api.odcloud.kr/api/15112801/v1/uddi:72bf80fc-1a93-4193-a6db-8a547d7c3333';
const PEAK_URL = 'https://apis.data.go.kr/B553662/peakPoiInfoService/getPeakPoiInfoList';
const ENTRY_URL =
  'https://apis.data.go.kr/B553662/fmmtnFrtrlPoiInfoService/getFmmtnFrtrlPoiInfoList';

const KEY = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('DATA_GO_KR_KEY='))
  ?.slice('DATA_GO_KR_KEY='.length)
  .replace(/\s/g, '');

if (!KEY) {
  console.error('.env에 DATA_GO_KR_KEY가 없다');
  process.exit(1);
}

// 소재지 앞머리를 권역으로 접는다. 100곳을 한 화면에 나열하지 않으려면 필요하다.
const REGION_OF = {
  서울: '수도권',
  경기: '수도권',
  인천: '수도권',
  강원: '강원',
  충청: '충청',
  대전: '충청',
  세종: '충청',
  전라: '전라',
  광주: '전라',
  경상: '경상',
  대구: '경상',
  울산: '경상',
  부산: '경상',
  제주: '제주',
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url.split('?')[0]}`);
  }
  return await response.json();
}

async function loadMountains() {
  const { data } = await fetchJson(
    `${SUP_URL}?page=1&perPage=200&returnType=JSON&serviceKey=${KEY}`,
  );
  return data;
}

async function loadPeaks() {
  const peaks = [];
  for (let page = 1; page <= 2; page += 1) {
    const body = await fetchJson(
      `${PEAK_URL}?serviceKey=${KEY}&pageNo=${page}&numOfRows=500&type=json`,
    );
    peaks.push(...body.response.body.items.item);
  }
  return peaks;
}

// 등산로 입구는 전국 688건이라 한 페이지에 다 온다. 좌표가 완전히 같은 중복만 걷어낸다.
async function loadEntries() {
  const body = await fetchJson(
    `${ENTRY_URL}?serviceKey=${KEY}&pageNo=1&numOfRows=1000&type=json&srchPlaceTpeCd=ENTRY`,
  );
  const { totalCount, items } = body.response.body;
  if (items.item.length < totalCount) {
    throw new Error(`등산로 입구 ${totalCount}건 중 ${items.item.length}건만 받았다. numOfRows를 늘려라`);
  }
  return items.item;
}

function trailheadsOf(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const lat = Number(Number(entry.lat).toFixed(6));
    const lng = Number(Number(entry.lot).toFixed(6));
    const key = `${lat},${lng}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ name: entry.placeNm.trim(), lat, lng });
  }
  return result;
}

// 난이도 필드는 "산행시간 : … 산높이 : … 난이도 : 초급" 같은 한 덩어리 문자열이다.
function parseDifficulty(raw) {
  const matched = /난이도\s*:\s*([^\s]+)/.exec(raw ?? '');
  const value = matched?.[1];
  return value === undefined || value === '-' ? null : value;
}

// 수도권만 시·도로 더 쪼갠다. 홈에서 "서울만" 보고 싶은 사람이 많다. 소재지 첫 토큰 기준.
const PROVINCE_OF = { 서울: '서울', 경기: '경기', 인천: '인천' };
function provinceOf(place) {
  return PROVINCE_OF[(place ?? '').slice(0, 2)] ?? null;
}

function regionOf(place) {
  return REGION_OF[(place ?? '').slice(0, 2)] ?? null;
}

const mountains = await loadMountains();
const peaks = await loadPeaks();
const entries = await loadEntries();

const peaksByName = new Map();
for (const peak of peaks) {
  const list = peaksByName.get(peak.frtrlNm) ?? [];
  list.push(peak);
  peaksByName.set(peak.frtrlNm, list);
}

const entriesById = new Map();
for (const entry of entries) {
  const list = entriesById.get(entry.frtrlId) ?? [];
  list.push(entry);
  entriesById.set(entry.frtrlId, list);
}

const rows = [];
const skipped = [];
const warnings = [];

for (const mountain of mountains) {
  const name = mountain['명산_이름'];
  const candidates = peaksByName.get(name);
  if (candidates === undefined) {
    skipped.push(name);
    continue;
  }

  const official = Math.round(Number(mountain['명산_높이']));

  // "가장 높은 봉우리"로 고르면 인접한 다른 산의 봉우리를 집는다
  // (백운산에 광덕산, 황석산에 기백산이 붙었다). 공식 높이에 가장 가까운 봉우리를 쓴다.
  // 이름에 산 이름이나 '정상'이 들어간 후보를 먼저 보고, 없으면 전체에서 고른다.
  // 이름 필터를 먼저 걸면 진짜 정상이 빠진다(덕유산 향적봉이 그랬다).
  // 고도가 있는 봉우리 전체에서 공식 높이에 가장 가까운 것을 고른다.
  const measurable = candidates.filter((peak) => Number(peak.aslAltide) > 0);
  const pool = measurable.length > 0 ? measurable : candidates;
  const summit = pool.reduce((best, peak) =>
    Math.abs(Number(peak.aslAltide) - official) < Math.abs(Number(best.aslAltide) - official)
      ? peak
      : best,
  );
  const measured = Math.round(Number(summit.aslAltide));

  // 그래도 크게 다르면 사람이 봐야 한다.
  if (Math.abs(official - measured) > 60 || measured === 0) {
    warnings.push(`${name}: 공식 ${official}m vs 채택 봉우리 ${measured}m (${summit.placeNm})`);
  }

  rows.push({
    id: summit.frtrlId,
    name,
    summitLat: Number(Number(summit.lat).toFixed(6)),
    summitLng: Number(Number(summit.lot).toFixed(6)),
    elevationM: official,
    region: regionOf(mountain['명산_소재지']),
    province: provinceOf(mountain['명산_소재지']),
    difficulty: parseDifficulty(mountain['난이도']),
    peakName: summit.placeNm,
    trailheads: trailheadsOf(entriesById.get(summit.frtrlId) ?? []),
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

console.log(`산 ${rows.length}곳 생성 · 좌표 없어 제외 ${skipped.length}곳: ${skipped.join(', ')}`);
console.log(`권역 분포: ${JSON.stringify(
  rows.reduce((acc, row) => ({ ...acc, [row.region ?? '미분류']: (acc[row.region ?? '미분류'] ?? 0) + 1 }), {}),
)}`);
console.log(`난이도 있음: ${rows.filter((row) => row.difficulty !== null).length}곳`);
const noEntry = rows.filter((row) => row.trailheads.length === 0);
console.log(
  `등산로 입구 ${rows.reduce((sum, row) => sum + row.trailheads.length, 0)}곳 · 입구 없는 산 ${noEntry.length}곳: ${noEntry.map((row) => row.name).join(', ')}`,
);
if (warnings.length > 0) {
  console.log(`\n확인 필요 ${warnings.length}건 (공식 높이와 채택 봉우리 고도 차 60m 초과):`);
  for (const line of warnings) {
    console.log(`  ${line}`);
  }
}

if (process.argv.includes('--write')) {
  const output = {
    _note:
      '자동 생성 파일입니다. 직접 고치지 말고 scripts/build-mountains.mjs를 다시 돌리세요. ' +
      '출처: 숲나들e 100대명산 정보(공공데이터포털 15112801, 이름·소재지·공식 높이·난이도) + ' +
      '한국등산트레킹지원센터 봉우리POI(15097953, 정상 좌표) + 숲길POI(15097947, 등산로 입구 좌표). 이용허락범위 제한 없음. ' +
      '정상은 산에 귀속된 봉우리 중 공식 높이에 가장 가까운 것을 채택했고, 채택한 봉우리 이름은 peakName에 남겼습니다. ' +
      `생성 ${new Date().toISOString().slice(0, 10)}.`,
    mountains: rows,
  };
  const path = new URL('../src/data/mountains.json', import.meta.url);
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nsrc/data/mountains.json 갱신 (${rows.length}곳)`);
} else {
  console.log('\n(리포트만 출력했습니다. 파일을 쓰려면 --write)');
}
