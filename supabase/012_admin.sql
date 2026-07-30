-- ============================================================
-- 012 — 운영자용 매장 생성
--
-- 지금까지 매장 하나 늘리려면 SQL 을 직접 짰다(20분).
-- 캠페인 패키지 모델에서는 우리가 기획·세팅해서 넘기므로
-- 매장 생성은 사장님 셀프가 아니라 운영자 화면에서 한다.
--
-- 한 번에 원자적으로 처리한다: 매장 → 캠페인 → 상품 → 티켓 셔플.
-- 중간에 실패하면 전부 되돌아간다.
-- ============================================================

create or replace function kuji.admin_create_store(p json)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_store    uuid;
  v_campaign uuid;
  v_total    int;
  v_sum      int := 0;
  v_count    int := 0;
  it         json;
  v_name     text := trim(p->'store'->>'name');
  v_owner    text := p->'store'->>'owner_pin';
  v_board    text := p->'store'->>'board_pin';
begin
  -- 입력 검증
  if v_name is null or v_name = '' then
    return json_build_object('ok', false, 'reason', 'NO_NAME');
  end if;
  if v_owner !~ '^\d{4}$' or v_board !~ '^\d{4}$' then
    return json_build_object('ok', false, 'reason', 'BAD_PIN');
  end if;
  -- 카운터 PIN 은 손님 앞에서 매일 눌린다. 사장님 PIN 과 같으면 안 된다.
  if v_owner = v_board then
    return json_build_object('ok', false, 'reason', 'SAME_PIN');
  end if;

  v_total := coalesce((p->'campaign'->>'total_tickets')::int, 50);
  if v_total < 10 or v_total > 500 then
    return json_build_object('ok', false, 'reason', 'BAD_TOTAL');
  end if;

  for it in select * from json_array_elements(p->'prizes') loop
    v_sum := v_sum + (it->>'qty')::int;
    v_count := v_count + 1;
  end loop;

  if v_count < 1 or v_count > 8 then
    return json_build_object('ok', false, 'reason', 'GRADE_COUNT', 'count', v_count);
  end if;
  if v_sum <> v_total then
    return json_build_object('ok', false, 'reason', 'QTY_MISMATCH', 'sum', v_sum, 'total', v_total);
  end if;

  -- 매장
  insert into kuji.stores (name, branch, owner_pin, board_pin)
  values (v_name, nullif(trim(coalesce(p->'store'->>'branch','')), ''), v_owner, v_board)
  returning id into v_store;

  -- 캠페인 (토큰은 컬럼 기본값으로 자동 발급된다 — 009 참고)
  insert into kuji.campaigns (
    store_id, title, status, total_tickets, theme,
    starts_at, ends_at,
    board_mode, rate_per_min,
    last_one_label, last_one_name,
    ads
  ) values (
    v_store,
    coalesce(nullif(trim(coalesce(p->'campaign'->>'title','')), ''), '오픈 기념 뽑기'),
    'live',
    v_total,
    coalesce(p->'campaign'->>'theme', 'warm'),
    now(),
    now() + (coalesce((p->'campaign'->>'days')::int, 7) || ' days')::interval,
    coalesce(p->'campaign'->>'board_mode', 'pin'),
    coalesce((p->'campaign'->>'rate_per_min')::int, 6),
    coalesce(nullif(trim(coalesce(p->'campaign'->>'last_one_label','')), ''), '막차 보너스'),
    nullif(trim(coalesce(p->'campaign'->>'last_one_name','')), ''),
    coalesce(p->'ads', '[]'::json)::jsonb
  )
  returning id into v_campaign;

  -- 상품
  for it in select * from json_array_elements(p->'prizes') loop
    insert into kuji.prizes (campaign_id, grade, name, qty, use_when, valid_days, sort, image_url)
    values (
      v_campaign,
      it->>'grade',
      coalesce(nullif(trim(coalesce(it->>'name','')), ''), (it->>'grade') || '상 상품'),
      (it->>'qty')::int,
      coalesce(it->>'use_when', 'later'),
      coalesce((it->>'valid_days')::int, 7),
      ascii(it->>'grade') - 64,
      nullif(it->>'image_url', '')
    );
  end loop;

  -- 1회차 박스 채우기
  perform kuji.build_tickets(v_campaign);

  return json_build_object(
    'ok', true,
    'storeId', v_store,
    'campaignId', v_campaign,
    'ownerToken', (select owner_token from kuji.stores    where id = v_store),
    'boardToken', (select board_token from kuji.campaigns where id = v_campaign)
  );
end $$;

-- ------------------------------------------------------------
-- 운영자용 매장 목록 — 주소·PIN·박스 상태를 한 번에
-- ------------------------------------------------------------
create or replace function kuji.admin_list_stores()
returns json language plpgsql security definer set search_path = kuji, public as $$
begin
  return coalesce((
    select json_agg(x order by x.created_at)
    from (
      select
        s.id, s.name, s.branch, s.created_at,
        s.owner_token, s.owner_pin, s.board_pin,
        c.id           as campaign_id,
        c.title, c.status, c.theme, c.board_mode,
        c.board_token, c.current_box, c.total_tickets, c.ends_at,
        (select count(*) from kuji.tickets t
          where t.campaign_id = c.id and t.box = c.current_box and t.drawn_at is null) as left,
        (select count(*) from kuji.coupons k where k.campaign_id = c.id)                as coupons,
        (select count(*) from kuji.coupons k
          where k.campaign_id = c.id and k.used_at is not null)                          as redeemed,
        (select count(*) from kuji.prizes p where p.campaign_id = c.id)                  as grades
      from kuji.stores s
      left join kuji.campaigns c on c.store_id = s.id
    ) x
  ), '[]'::json);
end $$;

-- ------------------------------------------------------------
-- 매장 삭제 — 데모·오입력 정리용.
-- 뽑힌 기록이 있으면 거부한다 (실제 운영 데이터 보호).
-- ------------------------------------------------------------
create or replace function kuji.admin_delete_store(p_store uuid, p_force boolean default false)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_drawn int;
begin
  select count(*) into v_drawn
  from kuji.tickets t join kuji.campaigns c on c.id = t.campaign_id
  where c.store_id = p_store and t.drawn_at is not null;

  if v_drawn > 0 and not p_force then
    return json_build_object('ok', false, 'reason', 'HAS_HISTORY', 'drawn', v_drawn);
  end if;

  delete from kuji.stores where id = p_store;   -- 캠페인·티켓·쿠폰은 cascade
  return json_build_object('ok', true, 'drawn', v_drawn);
end $$;

revoke all on function kuji.admin_create_store(json),
                       kuji.admin_list_stores(),
                       kuji.admin_delete_store(uuid, boolean)
  from anon, authenticated;

grant execute on function kuji.admin_create_store(json)              to service_role;
grant execute on function kuji.admin_list_stores()                   to service_role;
grant execute on function kuji.admin_delete_store(uuid, boolean)     to service_role;
