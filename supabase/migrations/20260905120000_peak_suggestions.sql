-- 이용자가 "여기도 정상"이라고 직접 알려준 지점.
--
-- 평소 인증에서는 좌표를 저장하지 않는다(판정 후 폐기). 이 표는 이용자가 제안 버튼을
-- 누른 경우에만 그 순간의 좌표 1건을 담는다 — 개인정보처리방침 제3조·제4조 참고.
-- 다른 이용자에게 노출하지 않는다. 우리가 정상 좌표를 고칠지 판단하는 근거로만 쓴다.
-- 보관 1년.

create table public.peak_suggestions (
  id bigint generated always as identity primary key,
  user_id bigint not null,
  mountain_id text not null,
  peak_name text not null,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision not null,
  distance_m double precision not null,
  suggested_at timestamptz not null default now()
);

alter table public.peak_suggestions enable row level security;
revoke all on public.peak_suggestions from anon, authenticated;

-- 같은 지점에 제안이 몇 번 쌓였는지 보려면 산 단위로 훑는다.
create index peak_suggestions_mountain_idx on public.peak_suggestions (mountain_id, suggested_at desc);
