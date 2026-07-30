-- ============================================================
-- 008 — 매장별 사장님 주소
--
-- 지금까지 사장님 화면은 .env 의 캠페인 하나만 봤다. 매장이 둘 이상이면
-- 관리가 안 되므로 보드와 같은 방식(주소에 토큰)으로 매장을 가른다.
--   /owner/<사장님토큰>  + 매장 PIN
-- PIN만으로 가르면 4자리가 겹치고 남의 매장에 들어갈 수 있어 쓰지 않는다.
-- ============================================================

alter table kuji.stores
  add column if not exists owner_token text;

update kuji.stores set owner_token = kuji.gen_code(12) where owner_token is null;

do $$
begin
  alter table kuji.stores add constraint stores_owner_token_key unique (owner_token);
exception when duplicate_table or duplicate_object then null;
end $$;

-- 사장님 주소 목록 (service_role 이 서버에서만 읽는다)
select s.name || coalesce(' · ' || s.branch, '') as store,
       s.owner_token,
       s.owner_pin  as "사장님 PIN",
       s.board_pin  as "카운터 PIN",
       c.board_token,
       c.title
from kuji.stores s
left join kuji.campaigns c on c.store_id = s.id
order by s.created_at;
