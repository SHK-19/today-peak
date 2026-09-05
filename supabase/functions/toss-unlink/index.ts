// 토스가 부르는 연결 끊기 콜백. 사용자가 토스 앱에서 연결을 끊거나, 약관 동의를 철회하거나,
// 토스 회원을 탈퇴하면 여기로 온다 (referrer: UNLINK / WITHDRAWAL_TERMS / WITHDRAWAL_TOSS).
//
// 세션 토큰이 없는 열린 엔드포인트라 **Basic Auth가 유일한 보호막**이다.
// 이 값을 아는 사람은 임의의 userKey 기록을 지울 수 있다.
//
// 우리가 직접 remove-by-user-key API를 호출한 경우에는 콜백이 오지 않는다(문서 명시).

import { serviceClient } from '../_shared/session.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// 콘솔에 등록한 값을 토스가 어떤 형태로 보내는지 문서에 없다. 있을 법한 형태를 모두 받아준다.
function authCandidates(expected: string): string[] {
  return [expected, `Basic ${expected}`, btoa(expected), `Basic ${btoa(expected)}`];
}

// 값 자체는 절대 로그에 남기지 않는다. 비교용 지문만 남긴다.
async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 4))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function isAuthorized(request: Request): Promise<boolean> {
  const expected = Deno.env.get('TOSS_UNLINK_BASIC_AUTH');
  if (expected === undefined) {
    console.error('TOSS_UNLINK_BASIC_AUTH가 없다');
    return false;
  }
  const header = request.headers.get('authorization');
  if (header !== null) {
    if (authCandidates(expected).includes(header)) {
      return true;
    }
    // `Basic xxx` 형태로 왔다면 디코드한 값도 비교한다.
    if (header.startsWith('Basic ')) {
      try {
        if (atob(header.slice(6)) === expected) {
          return true;
        }
      } catch {
        // base64가 아니면 아래 진단으로 넘어간다.
      }
    }
  }

  // 무엇이 어긋났는지 남긴다 — 토스가 보내는 형태를 알아내는 유일한 방법이다.
  console.error(
    `unlink 인증 실패 · scheme=${header === null ? '없음' : header.split(' ')[0]}` +
      ` · len=${header?.length ?? 0} · 받은지문=${header === null ? '-' : await fingerprint(header)}` +
      ` · 기대지문=${await fingerprint(expected)}/${await fingerprint(`Basic ${expected}`)}`,
  );
  return false;
}

async function readUserKey(request: Request): Promise<number | null> {
  const fromQuery = new URL(request.url).searchParams.get('userKey');
  if (fromQuery !== null) {
    const parsed = Number(fromQuery);
    return Number.isInteger(parsed) ? parsed : null;
  }
  try {
    const { userKey } = (await request.json()) as { userKey?: unknown };
    return typeof userKey === 'number' && Number.isInteger(userKey) ? userKey : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  // 무엇이든 들어오면 먼저 남긴다 — 토스가 콜백을 보내기는 하는지부터 확인해야 한다.
  console.log(`unlink 요청 도착 · ${request.method} · ${new URL(request.url).search || '(쿼리 없음)'}`);

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  if (!(await isAuthorized(request))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const userKey = await readUserKey(request);
  if (userKey === null) {
    return json({ error: 'invalid_request' }, 400);
  }
  const referrer = new URL(request.url).searchParams.get('referrer') ?? 'UNKNOWN';

  const supabase = serviceClient();
  const [stamps, hikeStarts, unlinked] = await Promise.all([
    supabase.from('stamps').delete().eq('user_id', userKey),
    supabase.from('hike_starts').delete().eq('user_id', userKey),
    // 세션 토큰을 무효화한다. 다시 로그인하면 login 함수가 이 행을 지운다.
    supabase.from('unlinked_users').upsert({ user_id: userKey, referrer }),
  ]);

  const failed = [stamps, hikeStarts, unlinked].find((result) => result.error !== null);
  if (failed !== undefined) {
    console.error(`unlink 처리 실패 · userKey=${userKey} · ${failed.error?.message}`);
    return json({ error: 'server_error' }, 500);
  }

  console.log(`unlink · userKey=${userKey} · referrer=${referrer}`);
  return json({ ok: true }, 200);
});
