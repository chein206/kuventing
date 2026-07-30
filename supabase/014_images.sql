-- ============================================================
-- 014. 사진 업로드
--
-- 지금까지 상품·광고 사진은 assets/ 에 파일을 넣고 npm run img 를 돌린 뒤
-- SQL 로 경로를 박아 넣었다. 매장이 늘면 그때마다 우리가 붙어야 한다.
-- 사장님이 폰으로 찍어 바로 올릴 수 있게 경로를 DB 함수로 연다.
--
-- 파일 자체는 Supabase Storage 의 kuventing 버킷에 들어간다.
-- 여기 함수는 "어느 상품이 어느 URL을 쓰는가" 만 관리한다.
--
-- 옛 URL 을 돌려주는 이유: 라우트가 그 파일을 스토리지에서 지운다.
-- 안 지우면 사장님이 사진을 바꿀 때마다 쓰레기가 쌓인다.
-- ============================================================

-- ------------------------------------------------------------
-- 상품 사진
-- p_url 이 비면 사진을 뗀다 (등급 글자로 되돌아간다)
-- ------------------------------------------------------------
create or replace function kuji.set_prize_image(p_campaign uuid, p_grade text, p_url text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_old text;
begin
  select image_url into v_old
    from kuji.prizes
   where campaign_id = p_campaign and grade = upper(p_grade);

  if not found then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  update kuji.prizes
     set image_url = nullif(btrim(p_url), '')
   where campaign_id = p_campaign and grade = upper(p_grade);

  return json_build_object('ok', true, 'old', v_old);
end $$;

-- ------------------------------------------------------------
-- 막차 보너스 사진
-- 등급 상품이 아니라 캠페인에 붙는다
-- ------------------------------------------------------------
create or replace function kuji.set_last_one_image(p_campaign uuid, p_url text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_old text;
begin
  select last_one_image into v_old from kuji.campaigns where id = p_campaign;
  if not found then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  update kuji.campaigns
     set last_one_image = nullif(btrim(p_url), '')
   where id = p_campaign;

  return json_build_object('ok', true, 'old', v_old);
end $$;

-- ------------------------------------------------------------
-- 광고 슬라이드 사진
-- ads 는 jsonb 배열이라 자리(index)로 찾는다. 배열 밖이면 거부.
-- ------------------------------------------------------------
create or replace function kuji.set_ad_image(p_campaign uuid, p_index int, p_url text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_ads jsonb;
  v_old text;
begin
  select ads into v_ads from kuji.campaigns where id = p_campaign;
  if v_ads is null then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if p_index < 0 or p_index >= jsonb_array_length(v_ads) then
    return json_build_object('ok', false, 'reason', 'BAD_INDEX');
  end if;

  v_old := v_ads -> p_index ->> 'image';

  update kuji.campaigns
     set ads = jsonb_set(
           v_ads,
           array[p_index::text, 'image'],
           case when nullif(btrim(p_url), '') is null
                then 'null'::jsonb
                else to_jsonb(btrim(p_url)) end
         )
   where id = p_campaign;

  return json_build_object('ok', true, 'old', v_old);
end $$;

-- ------------------------------------------------------------
-- 권한 — 서버 라우트(service_role)만
-- ------------------------------------------------------------
revoke all on function
  kuji.set_prize_image(uuid, text, text),
  kuji.set_last_one_image(uuid, text),
  kuji.set_ad_image(uuid, int, text)
from anon, authenticated;

grant execute on function kuji.set_prize_image(uuid, text, text)  to service_role;
grant execute on function kuji.set_last_one_image(uuid, text)     to service_role;
grant execute on function kuji.set_ad_image(uuid, int, text)      to service_role;

-- 확인
select grade, name, coalesce(image_url, '(없음)') as image
  from kuji.prizes
 where campaign_id = (select id from kuji.campaigns order by created_at desc limit 1)
 order by sort;
