import mountainsData from '../../../src/data/mountains.json' with { type: 'json' };
import type { Mountain } from '../../../src/lib/verify.ts';

// 클라이언트는 test-places.json을 번들에 넣지만 그 파일은 커밋하지 않는다(거주지 좌표).
// 서버도 같은 목록을 알아야 인증이 성립하므로, 실측 기간에만 TEST_PLACES 환경변수로 넣는다.
// 출시 전에 `supabase secrets unset TEST_PLACES`로 지운다.
function testPlaces(): Mountain[] {
  const raw = Deno.env.get('TEST_PLACES');
  if (raw === undefined) {
    return [];
  }
  try {
    return JSON.parse(raw) as Mountain[];
  } catch {
    console.error('TEST_PLACES 파싱 실패');
    return [];
  }
}

export const MOUNTAINS: Mountain[] = [...(mountainsData.mountains as Mountain[]), ...testPlaces()];
