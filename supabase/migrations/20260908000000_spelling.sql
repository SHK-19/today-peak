-- 맞춤법 데일리 퀴즈 기록. Today Peak 프로젝트를 같이 쓰므로 표 이름에 spelling_ 접두사.
-- user_id는 토스 로그인 userKey. Edge Function이 세션 토큰에서 꺼낸 값만 들어간다.
-- RLS를 켜고 정책을 만들지 않는다 = anon/authenticated는 아무것도 못 한다. service role만 닿는다.

create table public.spelling_records (
  user_id bigint not null,
  played_date date not null,          -- KST 날짜. 서버가 정한다.
  score smallint not null,
  picks smallint[] not null,          -- 문제 순서대로 고른 보기(0/1). 재진입 시 결과 복원용.
  question_ids text[] not null,       -- 그날 낸 문제 id. 은행이 바뀌어도 복원 가능하게.
  created_at timestamptz not null default now(),
  primary key (user_id, played_date)
);

alter table public.spelling_records enable row level security;
revoke all on public.spelling_records from anon, authenticated;

-- 토스 로그인 연결을 끊은 사용자. 콜백이 기록하고 세션 검증이 본다. 다시 로그인하면 지운다.
create table public.spelling_unlinked_users (
  user_id bigint primary key,
  referrer text not null,
  unlinked_at timestamptz not null default now()
);

alter table public.spelling_unlinked_users enable row level security;
revoke all on public.spelling_unlinked_users from anon, authenticated;
