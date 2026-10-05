-- ============================================================
-- 026. 끝물 방식 4가지 — 가장 낮은 등급만 남았을 때 (025 를 고친다)
--
-- 025 의 "피날레 숨기고 계속"은 뺀다. 숨긴 피날레가 일찍 나오면 남은 장은 다시 결과가 뻔한
-- 뽑기가 된다 — 손님 입장에서 불합리하다(사장님, 2026-10-05). 대신 판이 끝나는 방식을 고른다.
--
--   off    끝까지 — 마지막 장이 피날레 보너스 (기본, 예전 그대로)
--   end    피날레 넣고 새 판 — 가장 낮은 등급만 남으면 피날레가 그중 1장에 숨는다.
--          뽑히는 순간 이 판은 끝나고 새 판이 열린다. 남은 장은 정리한다
--   carry  피날레 넣고 새 판 + 남은 장 — 위와 같고 남은 장을 새 판에 섞어 넣는다(새 판이 그만큼 커진다)
--   skip   피날레 없이 새 판 — 가장 낮은 등급만 남으면 바로 이 판을 끝내고 새 판을 연다.
--          이 판 피날레는 나가지 않는다. 카운터 화면에 미리 안내한다(표시광고법 — 공개한 것과 같아야 한다)
--
-- end · carry · skip 은 판이 끝나면(피날레가 나오거나 다 뽑히면) 새 판을 저절로 연다.
-- "가장 낮은 등급"은 그 판에 든 등급 중 가장 뒤 글자(E, F …).
-- 판에 등급이 하나뿐이면 끝물로 치지 않는다 — 전부 E 인 판에서 skip 이 판을 계속 갈아치우지 않게.
-- ============================================================

alter table kuji.campaigns drop constraint if exists campaigns_endgame_chk;
update kuji.campaigns set endgame = 'end' where endgame = 'hide';
alter table kuji.campaigns
  add constraint campaigns_endgame_chk check (endgame in ('off', 'end', 'carry', 'skip'));

-- ------------------------------------------------------------
-- 판의 끝물 — 가장 낮은 등급(low), 그것만 남았나(tail), 남은 장(left_n)
-- ------------------------------------------------------------
create or replace function kuji.box_tail(p_campaign uuid, p_box int,
                                         out low text, out tail boolean, out left_n int)
language plpgsql stable security definer set search_path = kuji, public as $$
declare v_grades int; v_left_low int;
begin
  select max(p.grade), count(distinct p.grade) into low, v_grades
  from kuji.tickets t join kuji.prizes p on p.id = t.prize_id
  where t.campaign_id = p_campaign and t.box = p_box;

  select count(*), count(*) filter (where p.grade = low) into left_n, v_left_low
  from kuji.tickets t join kuji.prizes p on p.id = t.prize_id
  where t.campaign_id = p_campaign and t.box = p_box and t.drawn_at is null;

  tail := coalesce(v_grades, 0) >= 2 and left_n > 0 and left_n = v_left_low;
end $$;

-- ------------------------------------------------------------
-- 지금 판의 피날레 상태 — low(가장 낮은 등급)를 같이 보내 화면 문구에 쓴다
-- ------------------------------------------------------------
create or replace function kuji.finale_state(p_campaign uuid)
returns json language plpgsql stable security definer set search_path = kuji, public as $$
declare
  v_box   int;
  v_mode  text;
  v_name  text;
  v_low   text;
  v_tail  boolean;
  v_left  int;
  v_given boolean;
begin
  select current_box, endgame, nullif(trim(last_one_name), '')
    into v_box, v_mode, v_name
  from kuji.campaigns where id = p_campaign;

  select low, tail, left_n into v_low, v_tail, v_left from kuji.box_tail(p_campaign, v_box);
  v_given := kuji.finale_given(p_campaign, v_box);

  return json_build_object(
    'mode',   v_mode,
    'low',    v_low,
    'given',  v_given,
    'hidden', v_mode in ('end', 'carry') and v_name is not null and not v_given and v_tail,
    'carried', (
      select coalesce(json_agg(json_build_object('grade', x.grade, 'n', x.n) order by x.grade), '[]'::json)
      from (
        select p.grade, count(*) as n
        from kuji.tickets t join kuji.prizes p on p.id = t.prize_id
        where t.campaign_id = p_campaign and t.box = v_box and t.from_box is not null
        group by p.grade
      ) x
    )
  );
end $$;

-- ------------------------------------------------------------
-- 뽑기 — 끝물 방식을 따른다. 같은 판의 뽑기는 캠페인 줄을 잠가 한 번에 하나씩
-- ------------------------------------------------------------
create or replace function kuji.draw(p_pass text, p_position int)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_pass    kuji.draw_passes%rowtype;
  v_camp    kuji.campaigns%rowtype;
  v_ticket  kuji.tickets%rowtype;
  v_prize   kuji.prizes%rowtype;
  v_box     int;
  v_code    text;
  v_low     text;
  v_tail    boolean;            -- 뽑기 전 — 가장 낮은 등급만 남았다
  v_before  int;                -- 뽑기 전 남은 장
  v_given   boolean;            -- 이 판 피날레가 이미 나갔다
  v_hidden  boolean;            -- 피날레가 남은 장 중 1장에 숨어 있는 구간
  v_left    int;
  v_is_last boolean;
  v_next    boolean := false;   -- 이 뽑기로 판이 끝나 새 판을 연다
  v_carry   boolean := false;
  v_new_box boolean := false;
  v_carried int := 0;
  v_dropped int := 0;
  v_r       json;
  v_exp     timestamptz;
begin
  select * into v_pass from kuji.draw_passes where code = p_pass for update;
  if not found                  then raise exception 'PASS_NOT_FOUND'; end if;
  if v_pass.used_at is not null then raise exception 'PASS_USED';      end if;
  if v_pass.expires_at < now()  then raise exception 'PASS_EXPIRED';   end if;

  select * into v_camp from kuji.campaigns where id = v_pass.campaign_id for update;
  v_box := v_camp.current_box;

  select low, tail, left_n into v_low, v_tail, v_before from kuji.box_tail(v_camp.id, v_box);
  v_given  := kuji.finale_given(v_camp.id, v_box);
  v_hidden := v_camp.endgame in ('end', 'carry')
              and nullif(trim(v_camp.last_one_name), '') is not null
              and not v_given and v_tail;

  update kuji.tickets set drawn_at = now()
  where campaign_id = v_camp.id and box = v_box
    and position = p_position and drawn_at is null
  returning * into v_ticket;
  if not found then raise exception 'TICKET_TAKEN'; end if;

  update kuji.draw_passes set used_at = now() where id = v_pass.id;
  select * into v_prize from kuji.prizes where id = v_ticket.prize_id;

  v_left := v_before - 1;

  -- 피날레 — 숨긴 구간이면 1 / 남은 장 수(마지막 한 장이면 반드시), 아니면 마지막 장. 한 판에 한 번만
  v_is_last := not v_given and case when v_hidden then random() * v_before < 1 else v_left = 0 end;

  v_exp := case when v_prize.use_when = 'later'
                then now() + (v_prize.valid_days || ' days')::interval
                else now() + interval '2 hours' end;

  loop
    begin
      v_code := kuji.gen_code(6);
      insert into kuji.coupons (campaign_id, ticket_id, prize_id, code, is_last_one, expires_at)
      values (v_camp.id, v_ticket.id, v_prize.id, v_code, v_is_last, v_exp);
      exit;
    exception when unique_violation then
    end;
  end loop;

  -- 판 넘기기 — 끝까지(off) 가 아니면 판이 끝나는 순간 새 판을 연다
  if v_camp.endgame <> 'off' then
    if v_is_last or v_left = 0 then
      -- 피날레가 나왔거나(숨긴 것 · 마지막 장) 다 뽑혔다
      v_next  := true;
      v_carry := v_camp.endgame = 'carry';
    elsif v_camp.endgame = 'skip' then
      -- 이 뽑기로 가장 낮은 등급만 남았다 — 피날레 없이 바로 새 판
      select tail into v_next from kuji.box_tail(v_camp.id, v_box);
    end if;

    if v_next then
      begin
        v_r := kuji.open_new_box(v_camp.id, v_carry);
        v_new_box := true;
        v_carried := (v_r ->> 'carried')::int;
        v_dropped := v_left - v_carried;
      exception when others then
        -- 새 판을 못 열면(상품 구성 합이 안 맞는 등) 남은 장은 이 판에 그대로 두고 뽑기는 그대로 끝낸다
        v_new_box := false; v_carried := 0; v_dropped := 0;
      end;
    end if;
  end if;

  return json_build_object(
    'grade',   v_prize.grade,
    'name',    v_prize.name,
    'useWhen', v_prize.use_when,
    'image',   v_prize.image_url,
    'code',    substr(v_code,1,3) || '-' || substr(v_code,4,3),
    'isLastOne',    v_is_last,
    'lastOneName',  case when v_is_last then v_camp.last_one_name  else null end,
    'lastOneLabel', case when v_is_last then v_camp.last_one_label else null end,
    'hidden',    v_hidden,
    'newBox',    v_new_box,
    'carried',   v_carried,
    'dropped',   v_dropped,
    'expiresAt', v_exp,
    'left',      v_left,
    'position',  p_position
  );
end $$;

-- ------------------------------------------------------------
-- 사장님이 끝물 방식을 바꾼 직후 — 지금 판에 바로 적용할 게 있으면 한다
--   skip 인데 이미 가장 낮은 등급만 남아 있다 → 바로 새 판(남은 장 정리)
--   off 가 아닌데 판이 이미 다 뽑혔다     → 새 판
-- ------------------------------------------------------------
create or replace function kuji.endgame_apply(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_mode text; v_box int; v_tail boolean; v_left int; v_r json;
begin
  select endgame, current_box into v_mode, v_box
  from kuji.campaigns where id = p_campaign for update;
  if v_mode is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  select tail, left_n into v_tail, v_left from kuji.box_tail(p_campaign, v_box);

  if (v_mode = 'skip' and v_tail) or (v_mode <> 'off' and v_left = 0) then
    begin
      v_r := kuji.open_new_box(p_campaign, false);
    exception when others then
      return json_build_object('ok', false, 'reason', split_part(sqlerrm, ':', 1));
    end;
    return json_build_object('ok', true, 'newBox', true, 'box', (v_r ->> 'box')::int, 'dropped', v_left);
  end if;

  return json_build_object('ok', true, 'newBox', false);
end $$;

-- ------------------------------------------------------------
-- 권한
-- ------------------------------------------------------------
revoke all on function kuji.box_tail(uuid,int), kuji.endgame_apply(uuid)
  from public, anon, authenticated;
grant execute on function kuji.box_tail(uuid,int)     to service_role;
grant execute on function kuji.endgame_apply(uuid)    to service_role;
grant execute on function kuji.draw(text,int)         to anon, authenticated;

select s.name as store, c.endgame, c.current_box,
       (select low  from kuji.box_tail(c.id, c.current_box)) as low,
       (select tail from kuji.box_tail(c.id, c.current_box)) as low_only,
       (select left_n from kuji.box_tail(c.id, c.current_box)) as left_now
from kuji.campaigns c join kuji.stores s on s.id = c.store_id
order by c.created_at;
