-- 토스 로그인 연결을 끊은 사용자. 콜백이 여기에 기록하고, 세션 토큰 검증이 이 표를 본다.
--
-- 세션 토큰은 우리가 서명한 것이라 데이터를 지워도 14일간 유효하다. 이 표가 없으면
-- 연결을 끊은 사용자가 로그인된 채로 남아 "다시 로그인을 요청하는 약관 화면"이 뜨지 않는다.
-- 다시 로그인하면 login 함수가 해당 행을 지운다.

create table public.unlinked_users (
  user_id bigint primary key,
  referrer text not null,
  unlinked_at timestamptz not null default now()
);

alter table public.unlinked_users enable row level security;
revoke all on public.unlinked_users from anon, authenticated;
