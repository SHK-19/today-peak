// 토스 서버 API 공통. mTLS 클라이언트와 프로모션(토스 포인트) 지급.
//
// 지급은 login처럼 서버에서만 한다. 클라이언트가 보낸 금액·유저를 믿지 않는다 —
// 금액은 여기 상수, 유저는 세션 토큰의 userKey.

export const TOSS_API = 'https://apps-in-toss-api.toss.im';

export type TossResult<T> =
  | { resultType: 'SUCCESS'; success: T }
  | { resultType: string; error?: { errorCode?: string; reason?: string } };

// Deno.createHttpClient는 unstable이라 타입에 없을 수 있다. 런타임에서 직접 확인한다.
export const createHttpClient = (
  Deno as unknown as {
    createHttpClient?: (options: { cert: string; key: string }) => unknown;
  }
).createHttpClient;

export function tossClient(): unknown {
  const cert = Deno.env.get('TOSS_MTLS_CERT');
  const key = Deno.env.get('TOSS_MTLS_KEY');
  if (cert === undefined || key === undefined) {
    throw new Error('mtls_not_configured');
  }
  if (createHttpClient === undefined) {
    throw new Error('mtls_unsupported');
  }
  return createHttpClient({ cert, key });
}

// 프로모션 코드는 시크릿. 비어 있으면 그 지급은 조용히 건너뛴다(프로모션 전이거나 종료 후).
export type Promotion = 'start' | 'summit' | 'first';
const PROMOTION_ENV: Record<Promotion, string> = {
  start: 'PROMO_START_CODE',
  summit: 'PROMO_SUMMIT_CODE',
  first: 'PROMO_FIRST_CODE',
};
export const PROMOTION_AMOUNT: Record<Promotion, number> = { start: 3, summit: 10, first: 30 };

// 코드가 설정된 프로모션과 금액. 화면 고지 문구용.
export function activeRewards(): Partial<Record<Promotion, number>> {
  const out: Partial<Record<Promotion, number>> = {};
  for (const promotion of ['start', 'summit', 'first'] as const) {
    const code = Deno.env.get(PROMOTION_ENV[promotion]);
    if (code !== undefined && code !== '') out[promotion] = PROMOTION_AMOUNT[promotion];
  }
  return out;
}

async function post<T>(client: unknown, path: string, userKey: number, body: unknown): Promise<TossResult<T>> {
  const response = await fetch(`${TOSS_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-toss-user-key': String(userKey) },
    body: JSON.stringify(body),
    client,
    signal: AbortSignal.timeout(5000),
  } as RequestInit);
  return (await response.json()) as TossResult<T>;
}

// 코드 하나로 지급. 성공이면 금액, 아니면 0. 어떤 이유로든 던지지 않는다.
export async function grantWithCode(userKey: number, code: string, amount: number, label: string): Promise<number> {
  try {
    const client = tossClient();
    const keyResult = await post<{ key: string }>(
      client,
      '/api-partner/v1/apps-in-toss/promotion/execute-promotion/get-key',
      userKey,
      {},
    );
    if (keyResult.resultType !== 'SUCCESS') {
      console.error(`promotion get-key 실패 · ${label} · ${JSON.stringify(keyResult)}`);
      return 0;
    }
    const result = await post<{ key: string }>(
      client,
      '/api-partner/v1/apps-in-toss/promotion/execute-promotion',
      userKey,
      { promotionCode: code, key: keyResult.success.key, amount },
    );
    if (result.resultType !== 'SUCCESS') {
      console.error(`promotion 지급 실패 · ${label} · ${JSON.stringify(result)}`);
      return 0;
    }
    console.log(`promotion 지급 · ${label} · ${amount}P · userKey=${userKey}`);
    return amount;
  } catch (error) {
    console.error(`promotion 오류 · ${label} · ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

// 포인트는 부가 기능이라 스탬프·산행 시작 응답을 막으면 안 된다. 실패는 로그로만 남긴다.
export async function grantReward(userKey: number, promotion: Promotion): Promise<number> {
  const code = Deno.env.get(PROMOTION_ENV[promotion]);
  if (code === undefined || code === '') return 0;
  return await grantWithCode(userKey, code, PROMOTION_AMOUNT[promotion], promotion);
}
