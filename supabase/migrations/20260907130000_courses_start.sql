-- 들머리 주소·좌표. 주소는 네이버 역지오코딩(빌드 때 한 번), 좌표는 트랙 첫 점. "복사"해서 지도 앱에 붙이는 용도.
alter table public.courses
  add column start_address text,
  add column start_lat double precision,
  add column start_lng double precision;
