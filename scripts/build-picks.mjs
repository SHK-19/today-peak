// 오늘 Pick(등산 준비물 큐레이션)을 토스쇼핑 쉐어링크 API로 채운다 → src/data/picks.json
//
//   입력: src/data/picks-curation.txt — 사람이 고른 상품. 한 줄에 하나.
//     카테고리 | 상품 URL 또는 tacaId 또는 item:tacaItemId | 계절(봄,여름,가을,겨울 · 선택) | 최소 고도 m(선택)
//     예)  장비 | https://toss.shopping/t/9876 | 겨울 | 1000
//          음식 | item:1221294259 | |          ← 목록 API에서 고른 옵션 ID
//
//   node scripts/build-picks.mjs            리포트만 (API는 부른다)
//   node scripts/build-picks.mjs --write    src/data/picks.json(번들 폴백) + docs/picks.json(GitHub Pages, 앱이 시작할 때 받음) 갱신
//
// 매일 갱신: scripts/daily-picks.sh (launchd). 가격·품절이 하루 단위로 따라가고, 하루특가는 endAt이 지나면 화면에서 빠진다.
//
// 규칙(문서: sharelink-docs.toss.im/guide/open-api):
//   - 토큰은 client_credentials로 받고 .sharelink-token.json에 저장해 재사용한다(매번 발급 금지).
//   - 상품 상세는 30건씩 tacaIds로 조회 → 응답의 tacaItemId로 링크를 발급한다(안정적인 동일성).
//   - 같은 상품은 같은 링크가 돌아오므로 재실행해도 중복이 안 생긴다. 발급 실패 상품은 뺀다.
//   - 이 Mac의 IP만 등록돼 있다. 서버(Edge Function)에서는 부르지 않는다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const env = Object.fromEntries(
  readFileSync(new URL('.env', ROOT), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);
const ACCESS_KEY = env.SHARELINK_ACCESS_KEY;
const SECRET_KEY = env.SHARELINK_SECRET_KEY;
const PUBLISHER_ID = env.SHARELINK_PUBLISHER_ID;
if (!ACCESS_KEY || !SECRET_KEY || !PUBLISHER_ID) {
  console.error('.env에 SHARELINK_ACCESS_KEY, SHARELINK_SECRET_KEY, SHARELINK_PUBLISHER_ID가 있어야 한다');
  process.exit(1);
}

const SEASON = { 봄: 'spring', 여름: 'summer', 가을: 'autumn', 겨울: 'winter' };
const CATEGORIES = new Set(['장비', '의류', '음식', '안전']);

// ---- 입력 파싱
const lines = readFileSync(new URL('src/data/picks-curation.txt', ROOT), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));
const wanted = [];
for (const line of lines) {
  const [category, ref, seasons = '', minEle = ''] = line.replace(/\s+#.*$/, '').split('|').map((s) => s.trim());
  if (!CATEGORIES.has(category)) throw new Error(`카테고리가 이상하다: ${line}`);
  const tacaItemId = /^item:(\d+)$/.exec(ref)?.[1];
  const tacaId = tacaItemId ? null : Number(/^\d+$/.test(ref) ? ref : /toss\.shopping\/t\/(\d+)/.exec(ref)?.[1]);
  if (!tacaItemId && !Number.isFinite(tacaId)) throw new Error(`상품을 못 읽었다(https://toss.shopping/t/숫자 · tacaId · item:tacaItemId): ${line}`);
  wanted.push({
    category,
    tacaId,
    tacaItemId: tacaItemId ? Number(tacaItemId) : null,
    seasons: seasons.split(',').map((s) => SEASON[s.trim()]).filter(Boolean),
    minElevationM: minEle === '' ? undefined : Number(minEle),
  });
}

// ---- 토큰 (파일에 저장, 만료 하루 전까지 재사용)
const tokenPath = new URL('.sharelink-token.json', ROOT);
async function token(force = false) {
  if (!force && existsSync(tokenPath)) {
    const saved = JSON.parse(readFileSync(tokenPath, 'utf8'));
    if (saved.expiresAt - Date.now() > 24 * 60 * 60 * 1000) return saved.accessToken;
  }
  const response = await fetch('https://oauth2.cert.toss.im/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ACCESS_KEY,
      client_secret: SECRET_KEY,
      scope: 'sharelink:read sharelink:write',
    }),
  });
  if (!response.ok) throw new Error(`토큰 발급 실패 ${response.status} ${await response.text()}`);
  const body = await response.json();
  writeFileSync(tokenPath, JSON.stringify({ accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }));
  return body.access_token;
}

let TOKEN = await token();
async function call(path, init) {
  const response = await fetch(`https://sharelink.toss.im${path}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { response, body: await response.json().catch(() => ({})) };
}
async function api(path, init = {}) {
  let { response, body } = await call(path, init);
  // 401이면 토큰을 새로 받아 한 번 더. 네트워크가 끊겼다 붙으면 그 뒤 호출이 전부 401이 된다
  // (2026-09-08 자동 실행이 이걸로 8번째부터 끝까지 실패했다).
  if (response.status === 401) {
    TOKEN = await token(true);
    ({ response, body } = await call(path, init));
  }
  if (!response.ok || body.resultType !== 'SUCCESS') {
    throw new Error(`${path} ${response.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.success;
}

// ---- 상품 상세 (30건씩). 옵션 ID(tacaItemId)와 상품 ID(tacaId)를 따로 조회한다.
const details = new Map(); // key: `item:${tacaItemId}` 또는 `taca:${tacaId}`
const byItem = wanted.filter((w) => w.tacaItemId !== null).map((w) => w.tacaItemId);
const byTaca = wanted.filter((w) => w.tacaItemId === null).map((w) => w.tacaId);
for (const [param, ids, keyOf] of [['tacaItemIds', byItem, (d) => `item:${d.tacaItemId}`], ['tacaIds', byTaca, (d) => `taca:${d.tacaId}`]]) {
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const { items, notFoundIds } = await api(`/openapi/products/detail?${param}=${chunk.join(',')}`);
    for (const item of items) details.set(keyOf(item), item);
    if (notFoundIds?.length) console.log(`못 찾은 상품: ${notFoundIds.join(', ')}`);
  }
}

// ---- 하루특가. 오늘 편성 중 등산 키워드에 맞는 것만. endAt이 지나면 앱이 숨긴다.
const DEAL_KEYWORDS = /등산|트레킹|아웃도어|캠핑|배낭|스틱|헤드랜턴|보호대|양말|장갑|모자|우비|생수|이온|음료|커피|견과|너트|육포|오징어|단백질|프로틴|에너지바|영양바|초콜릿|젤리|양갱|과자|스낵|감자칩|사과|귤|감귤|바나나|토마토|고구마|옥수수|계란|주먹밥|김밥|홍삼|유산균|비타민|오메가|올리브|선크림|핫팩|물티슈|손소독|구급|밴드/;
// 이름에 등산 키워드가 있어도 산에 들고 갈 수 없는 것("초코바나나 아이스크림")은 뺀다.
const DEAL_EXCLUDE = /아이스크림|냉동|냉장|세제|섬유|샴푸|화장품|마스크팩|선물세트/;
const deals = [];
try {
  const { items } = await api('/openapi/products/today-deals?size=30');
  for (const d of items ?? []) {
    const name = d.displayName ?? '';
    if (!DEAL_KEYWORDS.test(name) || DEAL_EXCLUDE.test(name) || d.isSoldOut) continue;
    deals.push(d);
  }
  console.log(`하루특가 ${items?.length ?? 0}개 중 등산 관련 ${deals.length}개`);
} catch (error) {
  console.log(`하루특가 조회 실패 → 건너뜀: ${error.message.slice(0, 100)}`);
}

// ---- 링크 발급. 초당 제한(429)에 걸리지 않게 호출 사이를 띄운다.
const picks = [];
const gone = []; // 품절·삭제로 없어진 상품. 정상이고, 큐레이션을 사람이 보충해야 한다.
let failedCount = 0; // 401·네트워크 같은 일시적 오류. 이게 많으면 결과를 믿을 수 없다.
for (const w of wanted) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const d = details.get(w.tacaItemId !== null ? `item:${w.tacaItemId}` : `taca:${w.tacaId}`);
  if (d === undefined) {
    gone.push(`item:${w.tacaItemId ?? w.tacaId} (상품 없음)`);
    continue;
  }
  let link;
  try {
    link = await api('/openapi/links', {
      method: 'POST',
      body: JSON.stringify({ tacaItemId: d.tacaItemId, publisherId: PUBLISHER_ID }),
    });
  } catch (error) {
    console.log(`링크 발급 실패 → 제외: ${d.displayName} (${error.message.slice(0, 120)})`);
    failedCount += 1;
    continue;
  }
  if (d.isSoldOut) {
    gone.push(`${d.displayName} (품절)`);
    console.log(`품절 → 제외: ${d.displayName}`);
    continue;
  }
  picks.push({
    id: `sl-${d.tacaItemId}`,
    name: d.displayName,
    category: w.category,
    link: link.shortUrl,
    imageUrl: d.thumbnailUrl,
    priceText: `${Number(d.displayPrice).toLocaleString('ko-KR')}원`,
    // 정가보다 싸면 할인율. 하루특가 표시는 안 한다 — 번들은 정적이고 특가는 그날 끝난다.
    ...(Number(d.discountRate) >= 10 ? { discountRate: Number(d.discountRate) } : {}),
    ...(w.seasons.length > 0 ? { seasons: w.seasons } : {}),
    ...(w.minElevationM === undefined ? {} : { minElevationM: w.minElevationM }),
  });
}

// 하루특가도 링크를 발급해 앞에 둔다. 카테고리는 이름으로 대충 나눈다 — 하루 지나면 사라지는 항목이다.
for (const d of deals) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  let link;
  try {
    link = await api('/openapi/links', { method: 'POST', body: JSON.stringify({ tacaItemId: d.tacaItemId, publisherId: PUBLISHER_ID }) });
  } catch {
    continue;
  }
  const name = d.displayName ?? '';
  const category = /등산|트레킹|배낭|스틱|랜턴|보호대|캠핑/.test(name) ? '장비' : /양말|장갑|모자|우비|의류|자켓|티셔츠/.test(name) ? '의류' : /선크림|핫팩|물티슈|손소독|구급|밴드/.test(name) ? '안전' : '음식';
  picks.unshift({
    id: `deal-${d.tacaItemId}`,
    name,
    category,
    link: link.shortUrl,
    imageUrl: d.thumbnailUrl,
    priceText: `${Number(d.displayPrice).toLocaleString('ko-KR')}원`,
    ...(Number(d.discountRate) >= 10 ? { discountRate: Number(d.discountRate) } : {}),
    dealEndsAt: d.endAt,
  });
}

console.log(`큐레이션 ${wanted.length}개 → 상품 ${details.size}개 → 링크 ${picks.length}개 (하루특가 ${deals.length})`);
for (const p of picks) console.log(`  [${p.category}] ${p.name} · ${p.priceText} · ${p.link}`);

if (gone.length > 0) {
  console.log(`\n없어진 상품 ${gone.length}개 — picks-curation.txt에서 빼고 새로 채울 것:`);
  for (const g of gone) console.log(`  ${g}`);
}

if (process.argv[2] === '--write') {
  // 중간에 API가 끊기면 살아남은 앞부분만 파일을 덮어써 오늘 Pick이 통째로 비어 버린다
  // (2026-09-08 자동 실행이 8번째부터 401로 실패해 126개 → 7개). 일시적 오류가 여럿이면 쓰지 않는다.
  // 품절·삭제로 사라진 건 정상이라 세지 않는다 — 그것까지 막으면 갱신이 영영 멈춘다.
  if (failedCount > wanted.length * 0.05) {
    console.error(`일시적 오류로 ${failedCount}개 실패 → 쓰지 않는다. 기존 파일 유지.`);
    process.exit(1);
  }
  const body = { _note: '자동 생성: scripts/build-picks.mjs. 고칠 건 picks-curation.txt.', updatedAt: new Date().toISOString(), items: picks };
  writeFileSync(new URL('src/data/picks.json', ROOT), `${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(new URL('docs/picks.json', ROOT), `${JSON.stringify(body)}\n`);
  console.log('src/data/picks.json · docs/picks.json 갱신');
}
