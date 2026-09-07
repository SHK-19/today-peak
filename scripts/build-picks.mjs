// 오늘 Pick(등산 준비물 큐레이션)을 토스쇼핑 쉐어링크 API로 채운다 → src/data/picks.json
//
//   입력: src/data/picks-curation.txt — 사람이 고른 상품. 한 줄에 하나.
//     카테고리 | 상품 URL 또는 tacaId 또는 item:tacaItemId | 계절(봄,여름,가을,겨울 · 선택) | 최소 고도 m(선택)
//     예)  장비 | https://toss.shopping/t/9876 | 겨울 | 1000
//          음식 | item:1221294259 | |          ← 목록 API에서 고른 옵션 ID
//
//   node scripts/build-picks.mjs            리포트만 (API는 부른다)
//   node scripts/build-picks.mjs --write    src/data/picks.json 갱신
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
async function token() {
  if (existsSync(tokenPath)) {
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

const TOKEN = await token();
async function api(path, init = {}) {
  const response = await fetch(`https://sharelink.toss.im${path}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
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

// ---- 링크 발급. 초당 제한(429)에 걸리지 않게 호출 사이를 띄운다.
const picks = [];
for (const w of wanted) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const d = details.get(w.tacaItemId !== null ? `item:${w.tacaItemId}` : `taca:${w.tacaId}`);
  if (d === undefined) continue;
  let link;
  try {
    link = await api('/openapi/links', {
      method: 'POST',
      body: JSON.stringify({ tacaItemId: d.tacaItemId, publisherId: PUBLISHER_ID }),
    });
  } catch (error) {
    console.log(`링크 발급 실패 → 제외: ${d.displayName} (${error.message.slice(0, 120)})`);
    continue;
  }
  if (d.isSoldOut) console.log(`품절: ${d.displayName}`);
  picks.push({
    id: `sl-${d.tacaItemId}`,
    name: d.displayName,
    category: w.category,
    link: link.shortUrl,
    imageUrl: d.thumbnailUrl,
    priceText: `${Number(d.displayPrice).toLocaleString('ko-KR')}원`,
    ...(w.seasons.length > 0 ? { seasons: w.seasons } : {}),
    ...(w.minElevationM === undefined ? {} : { minElevationM: w.minElevationM }),
  });
}

console.log(`큐레이션 ${wanted.length}개 → 상품 ${details.size}개 → 링크 ${picks.length}개`);
for (const p of picks) console.log(`  [${p.category}] ${p.name} · ${p.priceText} · ${p.link}`);

if (process.argv[2] === '--write') {
  writeFileSync(
    new URL('src/data/picks.json', ROOT),
    `${JSON.stringify({ _note: '자동 생성: scripts/build-picks.mjs. 고칠 건 picks-curation.txt.', items: picks }, null, 2)}\n`,
  );
  console.log('src/data/picks.json 갱신');
}
