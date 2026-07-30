-- ============================================================
-- 007 — 등급 A~H (최대 8개) + 마지막 보상 명칭 설정
--
-- 등급 개수를 사장님이 정한다. 등급을 지울 때는 그 등급을 쓴 티켓이
-- 남아 있으면 거부한다(과거 쿠폰이 어떤 상품이었는지 알 수 없게 되므로).
-- ============================================================

-- "라스트원상"은 특정 브랜드 용어이므로 쓰지 않는다. 문구를 설정값으로 뺀다.
alter table kuji.campaigns
  add column if not exists last_one_label text not null default '막차 보너스';

-- 이미 만들어진 캠페인도 새 문구로 맞춘다
update kuji.campaigns set last_one_label = '막차 보너스'
 where last_one_label in ('마지막 보상', 'LAST ONE');

-- ------------------------------------------------------------
-- 상품 구성 저장 — 추가 / 수정 / 삭제까지
-- ------------------------------------------------------------
create or replace function kuji.set_prizes(p_campaign uuid, p_prizes json)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_total  int;
  v_sum    int := 0;
  v_count  int := 0;
  it       json;
  v_grades text[] := '{}';
  v_stuck  text[];
begin
  select total_tickets into v_total from kuji.campaigns where id = p_campaign;
  if v_total is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  for it in select * from json_array_elements(p_prizes) loop
    v_sum   := v_sum + (it->>'qty')::int;
    v_count := v_count + 1;
    v_grades := v_grades || (it->>'grade');
  end loop;

  if v_count < 1 or v_count > 8 then
    return json_build_object('ok', false, 'reason', 'GRADE_COUNT', 'count', v_count);
  end if;

  if v_sum <> v_total then
    return json_build_object('ok', false, 'reason', 'QTY_MISMATCH', 'sum', v_sum, 'total', v_total);
  end if;

  -- 빠진 등급 중 이미 발행된 티켓이 있는 것은 지울 수 없다
  select array_agg(p.grade) into v_stuck
  from kuji.prizes p
  where p.campaign_id = p_campaign
    and not (p.grade = any(v_grades))
    and exists (select 1 from kuji.tickets t where t.prize_id = p.id);

  if v_stuck is not null then
    return json_build_object('ok', false, 'reason', 'GRADE_IN_USE', 'grades', v_stuck);
  end if;

  delete from kuji.prizes
   where campaign_id = p_campaign and not (grade = any(v_grades));

  for it in select * from json_array_elements(p_prizes) loop
    insert into kuji.prizes (campaign_id, grade, name, qty, use_when, valid_days, sort)
    values (
      p_campaign,
      it->>'grade',
      coalesce(it->>'name', it->>'grade' || '상'),
      (it->>'qty')::int,
      coalesce(it->>'use_when', 'later'),
      coalesce((it->>'valid_days')::int, 7),
      coalesce((it->>'sort')::int, ascii(it->>'grade') - 64)
    )
    on conflict (campaign_id, grade) do update
      set name       = excluded.name,
          qty        = excluded.qty,
          use_when   = excluded.use_when,
          valid_days = excluded.valid_days,
          sort       = excluded.sort;
  end loop;

  return json_build_object('ok', true, 'sum', v_sum, 'count', v_count);
end $$;

-- ------------------------------------------------------------
-- 보드 설정에 마지막 보상 문구 추가
-- ------------------------------------------------------------
create or replace function kuji.get_board_config(p_token text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json;
begin
  select json_build_object(
    'campaignId',  c.id,
    'title',       c.title,
    'status',      c.status,
    'theme',       c.theme,
    'mode',        c.board_mode,
    'idleSeconds', c.idle_seconds,
    'slideSeconds',    c.slide_seconds,
    'resultSeconds',   c.result_seconds,
    'autoOpenSeconds', c.auto_open_seconds,
    'ads',         c.ads,
    'lastOneName', c.last_one_name,
    'lastOneImage',c.last_one_image,
    'lastOneLabel',c.last_one_label,
    'store', json_build_object('name', s.name, 'branch', s.branch, 'logo', s.logo_url)
  ) into v
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  return coalesce(v, json_build_object('error', 'NOT_FOUND'));
end $$;

-- draw 응답에도 문구를 실어 보낸다
create or replace function kuji.draw(p_pass text, p_position int)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_pass    kuji.draw_passes%rowtype;
  v_ticket  kuji.tickets%rowtype;
  v_prize   kuji.prizes%rowtype;
  v_box     int;
  v_code    text;
  v_left    int;
  v_is_last boolean;
  v_exp     timestamptz;
begin
  select * into v_pass from kuji.draw_passes where code = p_pass for update;
  if not found                  then raise exception 'PASS_NOT_FOUND'; end if;
  if v_pass.used_at is not null then raise exception 'PASS_USED';      end if;
  if v_pass.expires_at < now()  then raise exception 'PASS_EXPIRED';   end if;

  select current_box into v_box from kuji.campaigns where id = v_pass.campaign_id;

  update kuji.tickets set drawn_at = now()
  where campaign_id = v_pass.campaign_id and box = v_box
    and position = p_position and drawn_at is null
  returning * into v_ticket;
  if not found then raise exception 'TICKET_TAKEN'; end if;

  update kuji.draw_passes set used_at = now() where id = v_pass.id;
  select * into v_prize from kuji.prizes where id = v_ticket.prize_id;

  select count(*) into v_left
  from kuji.tickets where campaign_id = v_pass.campaign_id and box = v_box and drawn_at is null;
  v_is_last := (v_left = 0);

  v_exp := case when v_prize.use_when = 'later'
                then now() + (v_prize.valid_days || ' days')::interval
                else now() + interval '2 hours' end;

  loop
    begin
      v_code := kuji.gen_code(6);
      insert into kuji.coupons (campaign_id, ticket_id, prize_id, code, is_last_one, expires_at)
      values (v_pass.campaign_id, v_ticket.id, v_prize.id, v_code, v_is_last, v_exp);
      exit;
    exception when unique_violation then
    end;
  end loop;

  return json_build_object(
    'grade',   v_prize.grade,
    'name',    v_prize.name,
    'useWhen', v_prize.use_when,
    'image',   v_prize.image_url,
    'code',    substr(v_code,1,3) || '-' || substr(v_code,4,3),
    'isLastOne', v_is_last,
    'lastOneName',  case when v_is_last
      then (select last_one_name  from kuji.campaigns where id = v_pass.campaign_id) else null end,
    'lastOneLabel', case when v_is_last
      then (select last_one_label from kuji.campaigns where id = v_pass.campaign_id) else null end,
    'expiresAt', v_exp,
    'left',      v_left,
    'position',  p_position
  );
end $$;

grant execute on function kuji.get_board_config(text) to anon, authenticated;
grant execute on function kuji.draw(text,int)         to anon, authenticated;
grant execute on function kuji.set_prizes(uuid,json)  to service_role;

select title, last_one_label,
       (select count(*) from kuji.prizes p where p.campaign_id = c.id) as grades
from kuji.campaigns c order by created_at desc limit 1;
