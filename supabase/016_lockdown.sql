-- ============================================================
-- 016. 함수 권한 잠금  ★ 보안 수정 — 반드시 돌릴 것
--
-- 지금까지 서버 전용 함수를 이렇게 막았다고 생각했다.
--
--   revoke all on function kuji.foo(...) from anon, authenticated;
--   grant execute on function kuji.foo(...) to service_role;
--
-- 이게 안 막는다. Postgres 는 함수를 만들면 EXECUTE 를 **PUBLIC 에 기본으로 준다.**
-- anon 은 PUBLIC 을 물려받으므로, anon 이름으로 revoke 해도 PUBLIC 경로가 남는다.
-- 결과: 브라우저에 노출되는 anon 키로 서버 전용 함수가 전부 호출됐다.
--
--   admin_list_stores()  → 모든 매장의 owner_token · owner_pin · board_pin
--   admin_delete_store() → 아무 매장이나 삭제
--   set_ads / set_prizes / rotate_* → 임의 변경
--
-- 함수를 하나씩 나열하지 않고 스키마 전체를 훑는다.
-- 앞으로 함수를 새로 만들 때 이 파일을 다시 돌리면 기본이 "닫힘"이 된다.
-- ============================================================

-- ------------------------------------------------------------
-- 1) kuji 스키마의 모든 함수: PUBLIC · anon · authenticated 회수
--    service_role 만 남긴다
-- ------------------------------------------------------------
do $$
declare r record; v_n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
    v_n := v_n + 1;
  end loop;
  raise notice '함수 % 개를 service_role 전용으로 바꿨습니다', v_n;
end $$;

-- ------------------------------------------------------------
-- 2) 손님·태블릿 화면이 직접 부르는 함수만 다시 열어준다
--    (브라우저에서 anon 키로 호출된다)
--
--    get_board_config  카운터 화면 설정·광고 읽기
--    open_session      PIN 확인 후 뽑기권 발급
--    get_board         티켓 판 상태
--    check_pass        뽑기권 확인
--    draw              한 장 뽑기
--    get_coupon        손님 쿠폰 조회 (/c/...)
--
--    이 여섯 개는 토큰·코드를 아는 사람만 쓸 수 있고,
--    안 뽑힌 티켓의 내용은 돌려주지 않는다.
-- ------------------------------------------------------------
do $$
declare r record; v_n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
       and p.proname in (
         'get_board_config', 'open_session', 'get_board',
         'check_pass', 'draw', 'get_coupon'
       )
  loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
    v_n := v_n + 1;
  end loop;
  raise notice '화면용 함수 % 개를 anon 에 열었습니다', v_n;
end $$;

-- ------------------------------------------------------------
-- 3) 앞으로 만드는 함수도 기본이 닫힘이 되도록
--    (이 스키마에 함수를 만드는 역할에 대해 PUBLIC 기본권한을 없앤다)
-- ------------------------------------------------------------
alter default privileges in schema kuji revoke execute on functions from public;

-- ------------------------------------------------------------
-- 4) 확인 — anon 이 실행할 수 있는 함수가 위 여섯 개뿐이어야 한다
-- ------------------------------------------------------------
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth,
       has_function_privilege('service_role',  p.oid, 'execute') as svc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'kuji'
 order by anon desc, p.proname;

-- 테이블 쪽도 같이 본다. RLS 가 정책 없이 걸려 있어 읽기가 막히지만
-- 권한 자체가 남아 있으면 정리해 두는 편이 낫다.
select c.relname,
       c.relrowsecurity                                        as rls,
       (select count(*) from pg_policies where schemaname = 'kuji' and tablename = c.relname) as policies,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('anon', c.oid, 'insert') as anon_insert,
       has_table_privilege('anon', c.oid, 'update') as anon_update
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'kuji' and c.relkind = 'r'
 order by c.relname;
