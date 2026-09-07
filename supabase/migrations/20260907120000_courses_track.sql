-- 코스 트랙을 지도 위에 선으로 그리려고 간략화한 좌표([[lat, lng], …], 오차 15m)를 둔다.
alter table public.courses add column track jsonb not null default '[]';
