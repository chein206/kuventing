-- ============================================================
-- 두 번째 데모 매장 — 카페 "별 헤는 밤 · 수유 본점"
--
-- 007 까지 실행한 뒤에 돌린다.
-- 보드는 토큰으로 캠페인을 찾으므로 이 캠페인은 바로 쓸 수 있다.
-- (사장님 화면은 아직 .env 의 캠페인 하나만 보므로 카페 관리까지 하려면
--  NEXT_PUBLIC_CAMPAIGN_ID 를 바꾸거나 다점포 지원을 붙여야 한다)
-- ============================================================

do $$
declare
  v_store    uuid;
  v_campaign uuid;
begin
  insert into kuji.stores (name, branch, owner_pin, board_pin)
  values ('별 헤는 밤', '수유 본점', '2580', '1357')
  returning id into v_store;

  insert into kuji.campaigns (
    store_id, title, status, total_tickets, theme,
    starts_at, ends_at,
    last_one_label, last_one_name,
    board_mode, idle_seconds, slide_seconds, result_seconds, auto_open_seconds
  )
  values (
    v_store, '오픈 기념 뽑기', 'live', 50, 'warm',
    now(), now() + interval '7 days',
    '막차 보너스', '딸기케익 + 음료 2잔 세트',
    'pin', 20, 6, 40, 45
  )
  returning id into v_campaign;

  insert into kuji.prizes (campaign_id, grade, name, qty, use_when, valid_days, sort) values
    (v_campaign, 'A', '딸기케익 + 음료 1잔 세트',   1,  'now',   0, 1),
    (v_campaign, 'B', '딸기케익',                  3,  'now',   0, 2),
    (v_campaign, 'C', '아인슈페너 1잔',             6,  'now',   0, 3),
    (v_campaign, 'D', '아메리카노 1잔',            12,  'now',   0, 4),
    (v_campaign, 'E', '1,000원 할인',              28,  'later', 7, 5);

  -- E상은 매장이 달라도 그대로 쓸 수 있는 벡터 이미지
  update kuji.prizes set image_url = '/img/prize-e.svg'
   where campaign_id = v_campaign and grade = 'E';

  -- 초기화면 광고 (사진은 나중에 assets/ 에 ad-*.jpg 로 넣고 npm run img)
  update kuji.campaigns set ads = '[
    {"title":"딸기 생크림 케익","sub":"매일 아침 만든 시트에 제철 딸기","price":"8,500원","image":null},
    {"title":"아인슈페너","sub":"진한 에스프레소 위에 수제 크림","price":"6,500원","image":null},
    {"title":"오늘의 원두","sub":"에티오피아 예가체프 · 산미와 꽃향","price":"5,000원","image":null}
  ]'::jsonb
  where id = v_campaign;

  perform kuji.build_tickets(v_campaign);
end $$;

-- 보드 주소에 쓸 토큰
select s.name || ' · ' || s.branch as store,
       c.title,
       c.board_token,
       s.board_pin  as "카운터 PIN",
       s.owner_pin  as "사장님 PIN",
       c.total_tickets,
       (select count(*) from kuji.tickets t where t.campaign_id = c.id) as tickets
from kuji.campaigns c join kuji.stores s on s.id = c.store_id
where s.name = '별 헤는 밤';
