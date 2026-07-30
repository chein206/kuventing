-- ============================================================
-- 개발용 — 박스 되감기
--
-- ⚠️ 이 캠페인의 티켓·쿠폰·뽑기권을 전부 지우고 새로 섞는다.
--    발급된 쿠폰도 사라지므로 손님이 실제로 들고 있는 이벤트에는 쓰지 말 것.
--    운영에서 박스를 새로 여는 기능은 별도로 만들어야 한다(이력 보존).
-- ============================================================

do $$
declare v_campaign uuid;
begin
  select id into v_campaign from kuji.campaigns order by created_at desc limit 1;

  delete from kuji.coupons     where campaign_id = v_campaign;
  delete from kuji.draw_passes where campaign_id = v_campaign;
  delete from kuji.tickets     where campaign_id = v_campaign;

  perform kuji.build_tickets(v_campaign);

  raise notice 'campaign % 박스를 새로 채웠습니다', v_campaign;
end $$;

select c.title,
       (select count(*) from kuji.tickets t where t.campaign_id = c.id) as tickets,
       (select count(*) from kuji.tickets t where t.campaign_id = c.id and t.drawn_at is null) as left
from kuji.campaigns c
order by c.created_at desc
limit 1;
