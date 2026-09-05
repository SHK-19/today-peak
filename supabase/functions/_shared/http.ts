// 미니앱이 서비스되는 origin. 그 외에서 온 요청에는 CORS 헤더를 주지 않는다.
// (SDK 3.x의 web/private-web, 2026-08-25 이후 번들의 apps/private-apps)
const ALLOWED_ORIGINS = new Set([
  'https://today-peak.web.tossmini.com',
  'https://today-peak.private-web.tossmini.com',
  'https://today-peak.apps.tossmini.com',
  'https://today-peak.private-apps.tossmini.com',
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || !ALLOWED_ORIGINS.has(origin)) {
    return {};
  }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}
