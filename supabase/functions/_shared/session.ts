import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { verifySessionToken } from '../../../src/lib/session-token.ts';

// Authorization 헤더의 세션 토큰에서 userKey를 꺼낸다.
// 클라이언트가 보낸 user_id 같은 값은 어디서도 믿지 않는다.
export async function readUserKey(request: Request): Promise<number | null> {
  const header = request.headers.get('authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    return null;
  }
  const secret = Deno.env.get('SESSION_SIGNING_SECRET');
  if (secret === undefined) {
    console.error('SESSION_SIGNING_SECRET이 없다');
    return null;
  }
  const outcome = await verifySessionToken(header.slice('Bearer '.length), secret, Date.now());
  if (!outcome.ok) {
    return null;
  }

  // 토스 앱에서 연결을 끊었으면 서명이 살아 있어도 무효다. 클라이언트는 401을 받고
  // 로그인 화면으로 돌아간다. 다시 로그인하면 login 함수가 이 행을 지운다.
  const { data, error } = await serviceClient()
    .from('unlinked_users')
    .select('user_id')
    .eq('user_id', outcome.userKey)
    .maybeSingle();
  if (error !== null) {
    console.error(`unlinked_users 조회 실패 · ${error.message}`);
    return null;
  }
  return data === null ? outcome.userKey : null;
}

// service role로만 테이블에 닿는다. RLS는 켜져 있고 정책이 없어서 다른 키로는 아무것도 못 읽는다.
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}
