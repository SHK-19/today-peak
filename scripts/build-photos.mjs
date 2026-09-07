// 산 사진을 src/data/photos.json으로 만든다.
//
//   한국관광공사 관광사진 (B551011/PhotoGalleryService1/gallerySearchList1)
//
//   node scripts/build-photos.mjs --probe   첫 응답 한 건을 그대로 찍는다(필드 확인용)
//   node scripts/build-photos.mjs           리포트만
//   node scripts/build-photos.mjs --write   src/data/photos.json을 덮어쓴다
//
// 응답에 사진별 공공누리 유형 필드는 없다(2026-09-07 확인: galTitle·galWebImageUrl·galPhotographer·
// galPhotographyLocation·galSearchKeyword). 이용 조건은 데이터셋(15101914) 단위로 본다 — 출처 표기 필수라
// 화면에 "사진 한국관광공사 · 촬영자"를 붙인다.
import { readFileSync, writeFileSync } from 'node:fs';

const URL_ = 'https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1';
const KEY = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('DATA_GO_KR_KEY='))
  ?.slice('DATA_GO_KR_KEY='.length)
  .replace(/\s/g, '');

if (!KEY) {
  console.error('.env에 DATA_GO_KR_KEY가 없다');
  process.exit(1);
}

const mode = process.argv[2];

// 규칙으로 못 거른 것들(2026-09-07 시트 육안 검수). 이름만 같은 다른 곳, 표지판, 접사.
// 이 산들은 API 대신 사람이 준 사진(photos-manual.json)으로 채운다.
const SKIP = new Set([
  '0000000035', // 무등산 — 원본 URL이 깨져 있음(148바이트 에러)
  '0000000067', // 월출산 — 같은 문제
  '0000000028', // 두륜산
  '0000000046', // 변산
  '0000000055', // 소요산
  '0000000081', // 천성산
  '0000000078', // 지리산(통영)
  '0000000080', // 천마산
  'osm-2668320332', // 안산(서대문)
  'osm-4908796773', // 봉산(은평)
  '0000000012', // 금산
  '0000000087', // 칠갑산
  '0000000093', // 한라산
  '0000000047', // 북한산
  '0000000032', // 명성산
  '0000000031', // 마이산
  'osm-7481782673', // 문수산(김포)
]);

// 사람이 직접 고른 사진. { photos: { [산id]: { title, credit } } }. 파일은 docs/photos/{id}.jpg에 직접 둔다.
const manualPath = new URL('../src/data/photos-manual.json', import.meta.url);
const MANUAL = (() => {
  try {
    return JSON.parse(readFileSync(manualPath, 'utf8')).photos ?? {};
  } catch {
    return {};
  }
})();
const load = (file) =>
  JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8')).mountains;
const MOUNTAINS = [...load('mountains.json'), ...load('mountains-local.json')];

const NOT_MOUNTAIN =
  /전시관|박물관|주차장|야영장|테마파크|정원|행궁|숲길|올레길|둘레길|레포츠|안내|표지|자락|휴양림|시설|입구|매표|케이블카|모노레일|스타파크|생태|관광지|공원묘|리조트|스키|온천|축제|시장|역$|(^|\s)\S+[사암]$/;
const SCENERY = /전경|풍경|자연|정상|능선|일출|일몰|운해|설경|단풍|봉우리|바위|계곡|산행|등산/;

function pickPhoto(items, name) {
  const title = (item) => String(item.galTitle ?? '');
  const keywords = (item) => String(item.galSearchKeyword ?? '');
  const candidates = items.filter(
    (item) =>
      (title(item).includes(name) || (keywords(item).includes(name) && /산|봉|국립공원|능선|정상/.test(title(item)))) &&
      !NOT_MOUNTAIN.test(title(item)),
  );
  const score = (item) =>
    (title(item) === name ? 4 : 0) +
    (title(item).includes(name) ? 2 : 0) +
    (SCENERY.test(keywords(item) + title(item)) ? 2 : 0) -
    Math.min(title(item).length, 20) / 20;
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

// "안산(서대문)" → "안산". 괄호는 우리가 붙인 구분자라 검색어에서 뺀다.
const baseName = (name) => name.replace(/\(.*\)$/, '').trim();

async function search(keyword) {
  const url =
    `${URL_}?serviceKey=${KEY}&MobileOS=ETC&MobileApp=todaypeak&_type=json` +
    `&arrange=A&numOfRows=100&pageNo=1&keyword=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${keyword}`);
  }
  const body = await response.json();
  const items = body.response?.body?.items?.item;
  return items === undefined ? [] : Array.isArray(items) ? items : [items];
}

if (mode === '--probe') {
  const items = await search('북한산');
  console.log(JSON.stringify(items[0], null, 2));
  process.exit(0);
}

const photos = {};
const missing = [];
for (const mountain of MOUNTAINS) {
  if (mountain.id in MANUAL) {
    photos[mountain.id] = { ...MANUAL[mountain.id], source: 'manual' };
    continue;
  }
  if (SKIP.has(mountain.id)) {
    missing.push(mountain.name);
    continue;
  }
  const name = baseName(mountain.name);
  let items = [];
  try {
    items = await search(name);
  } catch (error) {
    console.error(`${mountain.name}: ${error.message}`);
  }
  // 산 사진이어야 한다. 관광사진 갤러리에는 산 이름이 붙은 전시관·야영장·표지판·사찰 사진이
  // 많아서(속리산테마파크, 지리산정원, 청량산박물관…) 그런 제목은 거르고, 풍경 키워드가 있는
  // 것을 앞에 둔다. 첫 결과를 그대로 쓰면 63장 중 20장이 산이 아니었다(2026-09-07).
  const hit = pickPhoto(items, name);
  if (hit === undefined) {
    missing.push(mountain.name);
    continue;
  }
  photos[mountain.id] = {
    url: hit.galWebImageUrl,
    title: hit.galTitle,
    credit: `한국관광공사 · ${hit.galPhotographer ?? ''}`.replace(/ · $/, ''),
  };
}

console.log(`사진 있음 ${Object.keys(photos).length}곳 / ${MOUNTAINS.length}곳 (직접 고른 것 ${Object.values(photos).filter((p) => p.source === 'manual').length}곳)`);
console.log(`없는 산 ${missing.length}곳: ${missing.join(', ')}`);

if (mode === '--write') {
  const path = new URL('../src/data/photos.json', import.meta.url);
  writeFileSync(
    path,
    `${JSON.stringify({ _note: '자동 생성. scripts/build-photos.mjs. 출처: 한국관광공사 관광사진(공공누리 출처표시).', photos }, null, 2)}\n`,
  );
  console.log('src/data/photos.json 갱신');
}
