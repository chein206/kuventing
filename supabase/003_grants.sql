-- ============================================================
-- 003 — service_role 에 kuji 스키마 테이블 권한 부여
--
-- schema.sql 은 함수 실행 권한만 줬다. 사장님 화면이 테이블을 직접 읽고
-- 쓰려면(보드 주소 조회, 모드 전환, 앞으로의 캠페인 편집) 테이블 권한이 필요하다.
--
-- anon 은 여전히 아무 권한도 없다. RLS + 무정책 조합으로 계속 차단된다.
-- service_role 은 Next.js 서버 라우트에서만 쓰이며 브라우저에 노출되지 않는다.
-- ============================================================

grant all on all tables    in schema kuji to service_role;
grant all on all sequences in schema kuji to service_role;

alter default privileges in schema kuji grant all on tables    to service_role;
alter default privileges in schema kuji grant all on sequences to service_role;

-- 확인
select id, title, board_mode, idle_seconds, board_token
from kuji.campaigns
order by created_at desc
limit 1;
