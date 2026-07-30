-- ============================================================
-- 009 — 토큰 자동 발급
--
-- 002/008 은 그 시점에 있던 행만 채웠다. 이후에 새로 만든 매장·캠페인은
-- 토큰이 비어 있어 주소를 만들 수 없었다. 컬럼 기본값으로 바꿔 항상 붙게 한다.
-- ============================================================

alter table kuji.stores    alter column owner_token set default kuji.gen_code(12);
alter table kuji.campaigns alter column board_token set default kuji.gen_code(12);

-- 지금 비어 있는 것들 채우기
update kuji.stores    set owner_token = kuji.gen_code(12) where owner_token is null;
update kuji.campaigns set board_token = kuji.gen_code(12) where board_token is null;

alter table kuji.stores    alter column owner_token set not null;
alter table kuji.campaigns alter column board_token set not null;

select s.name || coalesce(' · ' || s.branch, '') as store,
       s.owner_token, c.board_token
from kuji.stores s
left join kuji.campaigns c on c.store_id = s.id
order by s.created_at;
