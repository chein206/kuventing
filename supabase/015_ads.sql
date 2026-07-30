-- ============================================================
-- 015. 광고 슬라이드 편집
--
-- 대기화면 슬라이드는 campaigns.ads (jsonb 배열) 하나에 들어 있다.
-- 지금까지 이 배열은 SQL 로만 고쳤다. 사장님이 메뉴를 바꿀 때마다
-- 우리에게 연락해야 하는 마지막 항목이었다.
--
-- 배열을 통째로 갈아끼운다. 자리(index)로 부분 수정하지 않는다 —
-- 순서 바꾸기·중간 삭제가 전부 배열 재작성이라 그게 더 단순하다.
--
-- 사라진 사진 URL 을 돌려주는 이유: 라우트가 그 파일을 스토리지에서 지운다.
-- 슬라이드를 지웠는데 사진만 버킷에 남으면 아무도 안 보는 용량이 된다.
-- ============================================================

create or replace function kuji.set_ads(p_campaign uuid, p_ads json)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_old    jsonb;
  v_new    jsonb := '[]'::jsonb;
  it       json;
  v_title  text;
  v_sub    text;
  v_price  text;
  v_image  text;
  v_n      int := 0;
  v_kept   jsonb := '[]'::jsonb;   -- 새 배열이 쓰는 사진들
  v_gone   jsonb := '[]'::jsonb;   -- 더 이상 안 쓰는 사진들
begin
  select ads into v_old from kuji.campaigns where id = p_campaign;
  if v_old is null then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  for it in select * from json_array_elements(p_ads) loop
    v_n := v_n + 1;
    if v_n > 10 then
      return json_build_object('ok', false, 'reason', 'TOO_MANY');
    end if;

    v_title := btrim(coalesce(it->>'title', ''));
    v_sub   := btrim(coalesce(it->>'sub', ''));
    v_price := btrim(coalesce(it->>'price', ''));
    v_image := nullif(btrim(coalesce(it->>'image', '')), '');

    -- 글자도 사진도 없는 빈 슬라이드는 화면에서 빈 칸으로 지나간다
    if v_title = '' and v_image is null then
      return json_build_object('ok', false, 'reason', 'EMPTY_SLIDE', 'at', v_n);
    end if;
    if length(v_title) > 30 or length(v_sub) > 60 or length(v_price) > 20 then
      return json_build_object('ok', false, 'reason', 'TOO_LONG', 'at', v_n);
    end if;

    v_new := v_new || jsonb_build_object(
      'title', v_title,
      'sub',   nullif(v_sub, ''),
      'price', nullif(v_price, ''),
      'image', v_image
    );
    if v_image is not null then
      v_kept := v_kept || to_jsonb(v_image);
    end if;
  end loop;

  -- 옛 배열에 있었지만 새 배열이 안 쓰는 사진
  select coalesce(jsonb_agg(s.url), '[]'::jsonb) into v_gone
    from (select e->>'image' as url
            from jsonb_array_elements(v_old) e
           where e->>'image' is not null) s
   where not (v_kept ? s.url);

  update kuji.campaigns set ads = v_new where id = p_campaign;

  return json_build_object('ok', true, 'count', v_n, 'gone', v_gone);
end $$;

revoke all on function kuji.set_ads(uuid, json) from anon, authenticated;
grant execute on function kuji.set_ads(uuid, json) to service_role;

-- 확인
select id, jsonb_array_length(ads) as slides, ads
  from kuji.campaigns
 order by created_at desc
 limit 3;
