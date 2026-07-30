-- ============================================================
-- 카페(별 헤는 밤) 상품 사진 · 광고 연결
-- npm run img 로 /img/prize-cafe-*.jpg 를 만든 뒤에 실행한다.
-- ============================================================

do $$
declare v_campaign uuid;
begin
  select c.id into v_campaign
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where s.name = '별 헤는 밤'
  order by c.created_at desc limit 1;

  if v_campaign is null then raise exception '카페 캠페인을 찾지 못했습니다'; end if;

  update kuji.prizes set image_url = '/img/prize-cafe-a.jpg' where campaign_id = v_campaign and grade = 'A';
  update kuji.prizes set image_url = '/img/prize-cafe-b.jpg' where campaign_id = v_campaign and grade = 'B';
  update kuji.prizes set image_url = '/img/prize-cafe-c.jpg' where campaign_id = v_campaign and grade = 'C';
  update kuji.prizes set image_url = '/img/prize-cafe-d.jpg' where campaign_id = v_campaign and grade = 'D';
  update kuji.prizes set image_url = '/img/prize-e.svg'      where campaign_id = v_campaign and grade = 'E';

  update kuji.campaigns
     set last_one_image = '/img/prize-cafe-last.jpg',
         ads = '[
           {"title":"딸기 생크림 케익","sub":"매일 아침 만든 시트에 제철 딸기","price":"8,500원","image":"/img/menu-딸기생크림케익.jpg"},
           {"title":"아인슈페너","sub":"진한 에스프레소 위에 수제 크림","price":"6,500원","image":"/img/menu-아인슈페너.jpg"},
           {"title":"콜드브루","sub":"12시간 저온 추출, 부드러운 목넘김","price":"5,500원","image":"/img/menu-콜드브루.jpg"},
           {"title":"케익 + 음료 세트","sub":"둘이 나눠 먹기 딱 좋은 구성","price":"13,000원","image":"/img/menu-딸기케익세트.jpg"}
         ]'::jsonb
   where id = v_campaign;
end $$;

select p.grade, p.name, p.qty, p.image_url
from kuji.prizes p
join kuji.campaigns c on c.id = p.campaign_id
join kuji.stores s on s.id = c.store_id
where s.name = '별 헤는 밤'
order by p.sort;
