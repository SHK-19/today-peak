// 산 사진을 src/data/photos.json으로 만든다.
//
//   한국관광공사 관광사진 (B551011/PhotoGalleryService1/gallerySearchList1)
//
//   node scripts/build-photos.mjs --probe   첫 응답 한 건을 그대로 찍는다(필드 확인용)
//   node scripts/build-photos.mjs           리포트만
//   node scripts/build-photos.mjs --write   src/data/photos.json을 덮어쓴다
//
// 공공누리 제1·3유형(출처표시 계열)만 받는다. 제2·4유형은 비상업적 이용만 허용이라
// 나중에 광고가 붙으면 위반이 된다. 유형을 알 수 없는 항목도 버린다.
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
const load = (file) =>
  JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8')).mountains;
const MOUNTAINS = [...load('mountains.json'), ...load('mountains-local.json')];

// 허용 유형. 값이 코드인지 문자열인지는 첫 응답을 보고 맞춘다(--probe).
const OPEN_LICENSE = /제?\s*[13]\s*유형|Type\s*[13]/i;

async function search(keyword) {
  const url =
    `${URL_}?serviceKey=${KEY}&MobileOS=ETC&MobileApp=todaypeak&_type=json` +
    `&arrange=A&numOfRows=10&pageNo=1&keyword=${encodeURIComponent(keyword)}`;
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
  let items = [];
  try {
    items = await search(mountain.name);
  } catch (error) {
    console.error(`${mountain.name}: ${error.message}`);
  }
  // 이름이 제목에 들어가고 이용 조건이 맞는 첫 장. 산 이름이 흔해서 제목 확인은 필수다.
  const hit = items.find(
    (item) =>
      String(item.galTitle ?? '').includes(mountain.name) &&
      OPEN_LICENSE.test(String(item.galPhotographyLocation ?? '') + String(item.galSearchKeyword ?? '') + String(item.galCopyrightDivCd ?? '')),
  );
  if (hit === undefined) {
    missing.push(mountain.name);
    continue;
  }
  photos[mountain.id] = {
    url: hit.galWebImageUrl,
    title: hit.galTitle,
    credit: hit.galPhotographyLocation ?? '한국관광공사',
  };
}

console.log(`사진 있음 ${Object.keys(photos).length}곳 / ${MOUNTAINS.length}곳`);
console.log(`없는 산 ${missing.length}곳: ${missing.join(', ')}`);

if (mode === '--write') {
  const path = new URL('../src/data/photos.json', import.meta.url);
  writeFileSync(
    path,
    `${JSON.stringify({ _note: '자동 생성. scripts/build-photos.mjs. 출처: 한국관광공사 관광사진(공공누리 출처표시).', photos }, null, 2)}\n`,
  );
  console.log('src/data/photos.json 갱신');
}
