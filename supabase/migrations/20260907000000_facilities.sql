-- 산별 시설(주차장·화장실·대피소·약수터). 숲길POI에서 scripts/build-facilities.mjs로 받아
-- supabase/seed/facilities.sql로 통째로 갈아 끼운다. 이용자 데이터가 아니라 참고 데이터다.
--
-- 번들에 넣지 않는 이유: CLAUDE.md "데이터 구조 3층" — 산 상세에서만 필요하고 이미 mountain-stats를
-- 부르므로 왕복이 늘지 않는다. 100대 명산만 있다(mountain_id = 숲길POI frtrlId).

create table public.facilities (
  id bigint generated always as identity primary key,
  mountain_id text not null,
  kind text not null check (kind in ('parking', 'toilet', 'shelter', 'spring')),
  name text not null,
  lat double precision not null,
  lng double precision not null
);

alter table public.facilities enable row level security;
revoke all on public.facilities from anon, authenticated;

create index facilities_mountain_idx on public.facilities (mountain_id, kind);
