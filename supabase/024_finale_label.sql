-- ============================================================
-- 024 — 막차 보너스 → 피날레 보너스
--
-- 마지막 표를 뽑은 손님에게 얹어 주는 보너스의 이름을 바꾼다(사장님 결정, 2026-10-05).
--
--   1. 새 캠페인의 기본 이름표
--   2. 기본 이름표를 그대로 쓰던 캠페인은 새 이름으로 — 사장님이 직접 바꾼 문구는 건드리지 않는다
--   3. 운영자 매장 생성(012)의 빈 칸 기본값
-- ============================================================

alter table kuji.campaigns alter column last_one_label set default '피날레 보너스';

update kuji.campaigns set last_one_label = '피날레 보너스'
 where last_one_label = '막차 보너스';

-- 012 의 함수를 그대로 옮기고 기본 이름표 한 줄만 바꿨다
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
    coalesce(nullif(trim(coalesce(p->'campaign'->>'last_one_label','')), ''), '피날레 보너스'),
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
