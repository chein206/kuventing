-- ============================================================
-- 개발용 — 시드를 두 번 돌려 생긴 중복 매장 정리
--
-- 규칙: 같은 이름·지점의 매장이 여럿이면
--       뽑힌 티켓이 가장 많은 것을 남기고, 뽑힌 기록이 0인 나머지를 지운다.
--       기록이 있는 매장은 절대 지우지 않는다.
--
-- ⚠️ 실행 전에 아래 "확인" 쿼리부터 돌려서 무엇이 지워질지 보고 판단할 것.
-- ============================================================

-- ── 1) 확인: 무엇이 남고 무엇이 지워지는가 ──────────────────
with agg as (
  select s.id, s.name, s.branch, s.created_at,
         coalesce(sum(case when t.drawn_at is not null then 1 else 0 end), 0) as drawn
  from kuji.stores s
  left join kuji.campaigns c on c.store_id = s.id
  left join kuji.tickets   t on t.campaign_id = c.id
  group by s.id
),
ranked as (
  select *, row_number() over (
           partition by name, coalesce(branch,'')
           order by drawn desc, created_at asc
         ) as rn
  from agg
)
select id, name, branch, drawn,
       case when rn = 1 then '남김'
            when drawn > 0 then '남김 (기록 있음)'
            else '삭제 대상' end as 판정
from ranked
order by name, rn;

-- ── 2) 실제 삭제: 위 결과를 보고 납득했을 때만 아래 블록을 실행 ──
-- do $$
-- declare v_del uuid[];
-- begin
--   with agg as (
--     select s.id, s.name, s.branch, s.created_at,
--            coalesce(sum(case when t.drawn_at is not null then 1 else 0 end), 0) as drawn
--     from kuji.stores s
--     left join kuji.campaigns c on c.store_id = s.id
--     left join kuji.tickets   t on t.campaign_id = c.id
--     group by s.id
--   ),
--   ranked as (
--     select *, row_number() over (
--              partition by name, coalesce(branch,'')
--              order by drawn desc, created_at asc
--            ) as rn
--     from agg
--   )
--   select array_agg(id) into v_del from ranked where rn > 1 and drawn = 0;
--
--   if v_del is null then
--     raise notice '지울 중복 매장이 없습니다';
--   else
--     delete from kuji.stores where id = any(v_del);   -- 캠페인·티켓·쿠폰은 cascade
--     raise notice '중복 매장 %개를 지웠습니다', array_length(v_del, 1);
--   end if;
-- end $$;
