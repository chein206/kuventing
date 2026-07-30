-- ============================================================
-- 017. 광고 자막 위치
--
-- 자막(메뉴명·설명·가격)을 사진 아래쪽에 못 박아 두었다.
-- 그런데 사진은 매장마다 다르다. 접시가 아래에 있는 사진이면 글자가 접시를 덮고,
-- 위에 있으면 아래가 텅 빈다. 사진 규격으로 전부 통제하려 하면
-- 매장마다 사진을 다시 뽑아야 한다 — 그건 우리 일이 늘어나는 방향이다.
--
-- 슬라이드마다 위치를 고르게 한다. 사장님이 사진을 보고 셋 중 하나를 누른다.
--   top    사진 아래쪽이 주인공일 때 (접시가 아래)
--   mid    가운데
--   bottom 사진 위쪽이 주인공일 때 (접시가 위) — 기본값
--
-- ads jsonb 배열의 각 항목에 pos 를 하나 더 담는다.
-- set_ads 는 아는 필드만 옮겨 담으므로 함수를 같이 고쳐야 한다.
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
  v_pos    text;
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
    v_pos   := lower(btrim(coalesce(it->>'pos', 'bottom')));

    if v_pos not in ('top', 'mid', 'bottom') then
      return json_build_object('ok', false, 'reason', 'BAD_POS', 'at', v_n);
    end if;

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
      'image', v_image,
      'pos',   v_pos
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

revoke all on function kuji.set_ads(uuid, json) from public, anon, authenticated;
grant execute on function kuji.set_ads(uuid, json) to service_role;

-- 이미 있는 슬라이드에 기본값을 채운다 (없으면 화면이 bottom 으로 읽지만 명시해 둔다)
update kuji.campaigns
   set ads = (
     select coalesce(jsonb_agg(
              case when e ? 'pos' then e else e || '{"pos":"bottom"}'::jsonb end
            ), '[]'::jsonb)
       from jsonb_array_elements(ads) e
   )
 where jsonb_array_length(ads) > 0;

-- 확인
select c.id, jsonb_array_length(c.ads) as slides, c.ads
  from kuji.campaigns c
 order by c.created_at desc
 limit 3;
