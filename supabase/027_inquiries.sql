-- ============================================================
-- 027 홈페이지 도입 문의
--
-- 홈페이지(/site) 문의 폼이 /api/inquiry 를 거쳐 여기에 쌓는다.
-- 쓰고 읽는 것은 서버(service_role)뿐이다 — 손님 · 사장님 화면(anon)은 이 표를 못 본다.
-- 길이 제한은 app/lib/inquiry.ts 와 같다. 개인정보 보관 기간은 문의일로부터 1년(폼 동의문).
-- ============================================================

create table if not exists kuji.inquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 60),
  kind        text not null default '기타',
  contact     text not null check (char_length(contact) between 1 and 80),
  message     text check (message is null or char_length(message) <= 1000),
  source      text not null default 'site',
  referer     text,
  -- 연락했으면 적는다(관리자)
  handled_at  timestamptz,
  memo        text
);

create index if not exists inquiries_created_idx on kuji.inquiries (created_at desc);

alter table kuji.inquiries enable row level security;
-- 정책을 만들지 않는다 → anon · authenticated 는 읽기도 쓰기도 못 한다
revoke all on kuji.inquiries from anon, authenticated;
grant all on kuji.inquiries to service_role;

-- 1년 지난 문의 지우기(보관 기간) — 필요할 때 SQL 편집기에서:
-- delete from kuji.inquiries where created_at < now() - interval '1 year';
