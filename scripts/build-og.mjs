// 공유 미리보기 이미지(산 × 계절)를 굽는다. docs/og/{산id}-{계절}.png → GitHub Pages로 공개된다.
// share.ts가 같은 규칙으로 URL을 만들기 때문에 매핑 파일은 없다.
//
//   node scripts/build-og.mjs                    전부
//   node scripts/build-og.mjs 남산,인왕산         이름으로 고른 산만
//   node scripts/build-og.mjs 0000000002,osm-123  id로 고른 산만
//
// 디자이너 스탬프가 배치로 들어오면 그 산들만 다시 구우면 된다. 전부 다시 구울 이유는
// 카드 레이아웃·문구를 바꿀 때뿐이다.
//
// 스탬프 그림이나 산 목록이 바뀌면 다시 돌리고 커밋한다.
// 한 번 돌리면 504장이 전부 새 파일이 된다(약 20MB). 디자이너 납품처럼 그림이 실제로
// 바뀔 때만 돌린다 — 문구 하나 고칠 때마다 돌리면 저장소 이력만 불어난다.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/og');
const BUILD = path.join(ROOT, 'node_modules/.scratch/og');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CONCURRENCY = 6;

const only = process.argv[2]?.split(',').map((text) => text.trim()).filter((text) => text !== '');

// vite로 SSR 번들을 만든다 — TSX·JSON·import.meta.glob을 앱과 같은 방식으로 처리하려고.
await run('npx', ['vite', 'build', '--ssr', 'scripts/og-card.tsx', '--outDir', BUILD, '--logLevel', 'warn'], { cwd: ROOT });
const { cards, WIDTH, HEIGHT } = await import(path.join(BUILD, 'og-card.js'));

const all = cards().filter(
  (card) => only === undefined || only.some((text) => card.name.includes(text) || card.id === text),
);
const pages = await mkdtemp(path.join(tmpdir(), 'og-'));
await mkdir(OUT, { recursive: true });

let done = 0;
const queue = [...all];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let card = queue.shift(); card !== undefined; card = queue.shift()) {
      const page = path.join(pages, `${card.file}.html`);
      await writeFile(page, card.html);
      // 헤드리스 크롬이 이유 없이 매달리는 경우가 있다. 끊고 한 번 더 시도한다.
      await shoot(page, card.file).catch(() => shoot(page, card.file));
      done += 1;
      if (done % 25 === 0) process.stdout.write(`${done}/${all.length}\n`);
    }
  }),
);

async function shoot(page, file) {
  return await run(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--virtual-time-budget=2000',
      `--screenshot=${path.join(OUT, file)}`,
      `file://${page}`,
    ],
    { timeout: 30_000 },
  );
}
await rm(pages, { recursive: true, force: true });
console.log(`${done}장 → docs/og/`);
