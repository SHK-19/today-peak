-- 스탬프와 산행 시작 기록.
-- user_id는 토스 로그인의 userKey(숫자)다. 클라이언트가 보낸 값은 절대 쓰지 않고
-- Edge Function이 세션 토큰에서 꺼낸 값만 들어간다.
--
-- RLS를 켜고 정책을 하나도 만들지 않는다 = anon/authenticated는 아무것도 못 한다.
-- service role은 RLS를 우회하므로 Edge Function만 이 테이블에 닿는다.

create table public.stamps (
  id bigint generated always as identity primary key,
  user_id bigint not null,
  mountain_id text not null,
  verified_at timestamptz not null default now(),
  distance_m double precision not null,
  accuracy_m double precision not null
);

alter table public.stamps enable row level security;
revoke all on public.stamps from anon, authenticated;

create index stamps_user_idx on public.stamps (user_id, verified_at desc);
create index stamps_mountain_idx on public.stamps (mountain_id, verified_at desc);

create table public.hike_starts (
  id bigint generated always as identity primary key,
  user_id bigint not null,
  mountain_id text not null,
  trailhead_name text not null,
  started_at timestamptz not null default now(),
  distance_m double precision not null
);

alter table public.hike_starts enable row level security;
revoke all on public.hike_starts from anon, authenticated;

create index hike_starts_mountain_idx on public.hike_starts (mountain_id, started_at desc);
create index hike_starts_user_idx on public.hike_starts (user_id, started_at desc);
