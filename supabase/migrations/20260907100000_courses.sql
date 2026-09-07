-- 등산 코스. 한국등산트레킹지원센터 GPX(트랭글 기록)를 scripts/build-courses.mjs로 요약한 것.
-- supabase/seed/courses.sql로 통째로 갈아 끼운다. 트랙 좌표는 없다 — 지도를 그리지 않는다.
-- pois: [{ kind, name, lat, lng }] 코스 위 지점(입구·주차장·정류장·화장실·약수터·대피소·매점·
-- 문화재·전망·주의·정상). 종류 문자열은 GPX category 그대로(ENTRY, PARK, TRANS, TOILET, …).

create table public.courses (
  id text primary key,                    -- "{mountain_id}-{순번}"
  mountain_id text not null,
  name text not null,
  start_name text,
  peak_name text,
  peak_ele_m integer,
  distance_m integer not null,
  ascent_m integer not null,
  descent_m integer not null,
  max_ele_m integer not null,
  minutes integer not null,
  kcal integer not null,
  difficulty text not null check (difficulty in ('초급', '중급', '상급')),
  is_loop boolean not null,
  pois jsonb not null default '[]'
);

alter table public.courses enable row level security;
revoke all on public.courses from anon, authenticated;

create index courses_mountain_idx on public.courses (mountain_id, distance_m);
