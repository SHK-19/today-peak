// 토스 인가 코드를 우리 세션 토큰으로 바꾼다.
//
// 클라이언트 → login(여기) → 토스 generate-token → 토스 login-me → userKey → 세션 토큰.
// 토스 access/refresh token은 이 함수 밖으로 나가지 않는다.
//
// 토스 서버 API는 mTLS 클라이언트 인증서를 요구한다(문서: 서버 API 이용하기).
// Deno.createHttpClient는 unstable API라 호스팅 런타임에 없을 수 있어,
// 없으면 mtls_unsupported로 분명히 실패시킨다. GET으로 그 여부만 미리 확인할 수 있다.

import { SESSION_TTL_MS, signSessionToken } from '../../../src/lib/session-token.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/session.ts';

import { TOSS_API, createHttpClient, grantWithCode, tossClient, type TossResult } from '../_shared/toss.ts';

async function exchangeCode(
  client: unknown,
  authorizationCode: string,
  referrer: string,
): Promise<string> {
  const response = await fetch(`${TOSS_API}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
    client,
  } as RequestInit);

  const body = (await response.json()) as TossResult<{ accessToken: string }>;
  if (!response.ok || body.resultType !== 'SUCCESS') {
    throw new Error('token_exchange_failed');
  }
  return body.success.accessToken;
}

async function fetchUserKey(client: unknown, accessToken: string): Promise<number> {
  const response = await fetch(`${TOSS_API}/api-partner/v1/apps-in-toss/user/oauth2/login-me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    client,
  } as RequestInit);

  const body = (await response.json()) as TossResult<{ userKey: number }>;
  if (!response.ok || body.resultType !== 'SUCCESS') {
    throw new Error('login_me_failed');
  }
  return body.success.userKey;
}

// 설정된 인증서로 토스 서버에 실제로 붙어본다. 만료·재사용된 인가 코드를 보내므로
// 응답이 오면(400/401 포함) TLS 핸드셰이크는 성공한 것이다.
async function probeMtls(): Promise<Record<string, unknown>> {
  try {
    const client = tossClient();
    const response = await fetch(
      `${TOSS_API}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ authorizationCode: 'probe', referrer: 'DEFAULT' }),
        client,
      } as RequestInit,
    );
    return { handshake: 'ok', status: response.status, body: (await response.text()).slice(0, 200) };
  } catch (error) {
    return {
      handshake: 'failed',
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');

  const early = preflight(request);
  if (early !== null) {
    return early;
  }

  // 인증서가 오기 전에 이 런타임에서 mTLS가 되는지만 확인하는 용도.
  // createHttpClient는 unstable API라 "있는지"만으로는 부족하다. 실제로 만들어서
  // 토스 서버까지 붙여보고 무엇으로 실패하는지를 본다.
  if (request.method === 'GET') {
    // ?handshake=1일 때만 토스 서버까지 실제로 붙어본다. 그냥 GET에 외부 호출이 딸려가지 않게.
    const params = new URL(request.url).searchParams;
    const handshake = params.get('handshake') === '1';
    // ?promotion=<userKey>: 프로모션 지급 프로브. PROMO_PROBE_CODE 시크릿(쉼표로 여러 개)의
    // TEST_ 코드마다 1P를 시험 지급한다. 실제 코드는 건너뛴다. 테스트가 끝나면 시크릿을 지운다.
    const probeUser = params.get('promotion');
    const probe: Record<string, number> = {};
    if (probeUser !== null) {
      for (const code of (Deno.env.get('PROMO_PROBE_CODE') ?? '').split(',')) {
        if (code.startsWith('TEST_')) probe[code] = await grantWithCode(Number(probeUser), code, 1, code);
      }
    }
    const promotion = probeUser !== null ? { probe } : {};
    return json(
      {
        deno: Deno.version.deno,
        exists: createHttpClient !== undefined,
        certConfigured: Deno.env.get('TOSS_MTLS_CERT') !== undefined,
        ...(handshake ? await probeMtls() : {}),
        ...promotion,
      },
      200,
      origin,
    );
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const secret = Deno.env.get('SESSION_SIGNING_SECRET');
  if (secret === undefined) {
    console.error('SESSION_SIGNING_SECRET이 없다');
    return json({ error: 'server_error' }, 500, origin);
  }

  let authorizationCode: unknown;
  let referrer: unknown;
  try {
    ({ authorizationCode, referrer } = (await request.json()) as Record<string, unknown>);
  } catch {
    return json({ error: 'invalid_request' }, 400, origin);
  }
  if (
    typeof authorizationCode !== 'string' ||
    authorizationCode === '' ||
    (referrer !== 'DEFAULT' && referrer !== 'SANDBOX')
  ) {
    return json({ error: 'invalid_request' }, 400, origin);
  }

  try {
    const client = tossClient();
    const accessToken = await exchangeCode(client, authorizationCode, referrer);
    const userKey = await fetchUserKey(client, accessToken);

    // 연결을 끊었다가 다시 로그인한 경우 무효화 표시를 걷는다.
    const { error: clearError } = await serviceClient()
      .from('unlinked_users')
      .delete()
      .eq('user_id', userKey);
    if (clearError !== null) {
      console.error(`unlinked_users 정리 실패 · userKey=${userKey} · ${clearError.message}`);
    }

    console.log(`login ok · userKey=${userKey} · referrer=${referrer}`);
    const now = Date.now();
    return json(
      {
        token: await signSessionToken(userKey, secret, now),
        expiresAt: now + SESSION_TTL_MS,
      },
      200,
      origin,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error(`login 실패 · ${reason}`);
    // 인가 코드 문제(만료·재사용)와 서버 설정 문제를 나눠서 알려준다.
    const status = reason === 'token_exchange_failed' || reason === 'login_me_failed' ? 401 : 500;
    return json({ error: reason }, status, origin);
  }
});
