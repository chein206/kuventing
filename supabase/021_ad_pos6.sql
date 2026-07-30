-- ============================================================
-- 021. 광고 자막 위치 3칸 → 6칸
--
-- 위/가운데/아래만으로는 부족했다. 접시가 왼쪽에 있으면 글자를 오른쪽으로
-- 밀어야 하는데 방법이 없었다. 가로도 고를 수 있게 여섯 칸으로 나눈다.
--
--   tl 상좌   tr 상우
--   ml 중좌   mr 중우
--   bl 하좌   br 하우
--
-- 옛 값(top/mid/bottom)은 왼쪽 정렬로 읽어 그대로 옮긴다.
-- ============================================================

-- 이미 들어 있는 값을 먼저 옮긴다
update kuji.campaigns
   set ads = (
     select coalesce(jsonb_agg(
              e || jsonb_build_object('pos',
                case e->>'pos'
                  when 'top'    then 'tl'
                  when 'mid'    then 'ml'
                  when 'bottom' then 'bl'
                  when 'tl' then 'tl' when 'tr' then 'tr'
                  when 'ml' then 'ml' when 'mr' then 'mr'
                  when 'bl' then 'bl' when 'br' then 'br'
                  else 'bl'
                end)
            ), '[]'::jsonb)
       from jsonb_array_elements(ads) e
   )
 where jsonb_array_length(ads) > 0;

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
  v_kept   jsonb := '[]'::jsonb;
  v_gone   jsonb := '[]'::jsonb;
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

    -- 옛 값도 받아 준다. 화면이 갱신되기 전 요청이 섞일 수 있다
    v_pos := lower(btrim(coalesce(it->>'pos', 'bl')));
    v_pos := case v_pos
               when 'top' then 'tl' when 'mid' then 'ml' when 'bottom' then 'bl'
               else v_pos end;
    if v_pos not in ('tl', 'tr', 'ml', 'mr', 'bl', 'br') then
      return json_build_object('ok', false, 'reason', 'BAD_POS', 'at', v_n);
    end if;

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

-- 확인
select title, ads from kuji.campaigns order by created_at desc limit 3;
