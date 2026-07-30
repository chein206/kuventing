-- ============================================================
-- 데모 캠페인 시드 (라멘집 50장)
-- schema.sql 실행 후에 돌린다. 마지막에 campaign_id 가 나온다 — 그걸 .env.local 에 넣는다.
-- ============================================================

do $$
declare
  v_store    uuid;
  v_campaign uuid;
begin
  insert into kuji.stores (name, branch, owner_pin)
  values ('멘야 코바야시', '합정점', '1234')
  returning id into v_store;

  insert into kuji.campaigns (store_id, title, status, total_tickets, theme, starts_at, ends_at, last_one_name)
  values (v_store, '오픈 기념 뽑기', 'live', 50, 'warm',
          now(), now() + interval '7 days',
          '차슈덮밥 세트 무료 + 굿즈')
  returning id into v_campaign;

  insert into kuji.prizes (campaign_id, grade, name, qty, use_when, valid_days, sort) values
    (v_campaign, 'A', '차슈덮밥 세트 무료', 1,  'now',   0, 1),
    (v_campaign, 'B', '라멘 1그릇 무료',    2,  'now',   0, 2),
    (v_campaign, 'C', '교자 무료',          4,  'now',   0, 3),
    (v_campaign, 'D', '음료 무료',          8,  'later', 7, 4),
    (v_campaign, 'E', '1,000원 할인',       35, 'later', 7, 5);

  perform kuji.build_tickets(v_campaign);

  raise notice '--------------------------------------------';
  raise notice 'CAMPAIGN_ID = %', v_campaign;
  raise notice 'OWNER_PIN   = 1234';
  raise notice '--------------------------------------------';
end $$;

-- 확인용 — 여기 나오는 id 를 .env.local 의 NEXT_PUBLIC_CAMPAIGN_ID 에 넣는다
select c.id as campaign_id, s.name as store, c.title, c.total_tickets,
       (select count(*) from kuji.tickets t where t.campaign_id = c.id) as tickets_built
from kuji.campaigns c join kuji.stores s on s.id = c.store_id
order by c.created_at desc
limit 1;
