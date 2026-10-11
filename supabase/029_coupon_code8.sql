-- ============================================================
-- 029. 쿠폰 번호 6자리 → 8자리 (보안 점검 10-11 · 사장님 A안)
--
-- 쿠폰 조회(get_coupon)는 손님 화면이라 손님 키로 열려 있고 횟수 제한이 없다. 6자리(32^6 ≈ 10억)는
-- 판 번호(쿠폰 QR 에 들어 있다)만 알면 계속 넣어 보며 남의 미사용 쿠폰(다음 방문 경품)을 찾을 수 있었다.
-- 8자리(32^8 ≈ 1조)면 사실상 못 맞춘다.
--
-- - 새로 나가는 쿠폰부터 8자리. 이미 나간 6자리 쿠폰은 그대로 조회 · 사용된다(redeem · get_coupon 은 길이를 안 본다)
-- - 보여 주는 모양: 6자리 = XXX-XXX(옛), 8자리 = XXXX-XXXX — fmt_code 하나로
-- - draw(026) · owner_stats(025) · get_coupon(025)은 최신 정의를 그대로 옮기고 번호 줄만 바꿨다
-- - 사장님 화면 번호 입력칸은 앱이 두 모양을 다 받는다(같이 배포)
-- ============================================================

create or replace function kuji.fmt_code(p_code text)
returns text language sql immutable as $$
  select case length(p_code)
           when 6 then substr(p_code, 1, 3) || '-' || substr(p_code, 4, 3)
           when 8 then substr(p_code, 1, 4) || '-' || substr(p_code, 5, 4)
           else p_code
         end
$$;

-- ------------------------------------------------------------
-- draw — 026 그대로, 쿠폰 번호 8자리 · 모양 fmt_code
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
      v_code := kuji.gen_code(8);   -- 029: 6 → 8자리(맞춰 보기 막기)
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
    'code',    kuji.fmt_code(v_code),
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
-- owner_stats — 025 그대로, 미사용 쿠폰 번호 모양만 fmt_code
-- ------------------------------------------------------------
create or replace function kuji.owner_stats(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_box int; v_store uuid;
begin
  select current_box, store_id into v_box, v_store from kuji.campaigns where id = p_campaign;

  return json_build_object(
    'box',      v_box,
    'total',    coalesce(nullif((select count(*) from kuji.tickets
                                  where campaign_id = p_campaign and box = v_box), 0)::int,
                         (select total_tickets from kuji.campaigns where id = p_campaign)),
    'left',     (select count(*) from kuji.tickets where campaign_id = p_campaign and box = v_box and drawn_at is null),
    'drawn',    (select count(*) from kuji.tickets where campaign_id = p_campaign and box = v_box and drawn_at is not null),
    'today',    (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at::date = current_date),
    'coupons',  (select count(*) from kuji.coupons where campaign_id = p_campaign),
    'redeemed', (select count(*) from kuji.coupons where campaign_id = p_campaign and used_at is not null),
    'ratePerMin', (select rate_per_min from kuji.campaigns where id = p_campaign),
    'recent10',   kuji.rate_count('session',   p_campaign::text, interval '10 minutes'),
    'pinFails',   kuji.rate_count('board_pin', v_store::text,    interval '10 minutes', true)
                  + kuji.rate_count('owner_pin', v_store::text,  interval '10 minutes', true),
    'byGrade',  (select coalesce(json_agg(json_build_object(
                    'grade', p.grade, 'name', p.name, 'qty', p.qty,
                    'useWhen', p.use_when, 'validDays', p.valid_days, 'image', p.image_url,
                    'left', (select count(*) from kuji.tickets t
                              where t.prize_id = p.id and t.box = v_box and t.drawn_at is null)
                 ) order by p.sort, p.grade), '[]'::json)
                 from kuji.prizes p where p.campaign_id = p_campaign),
    'pending',  (select coalesce(json_agg(json_build_object(
                    'code', kuji.fmt_code(c.code),
                    'grade', p.grade, 'name', p.name, 'at', c.created_at
                 ) order by c.created_at desc), '[]'::json)
                 from kuji.coupons c join kuji.prizes p on p.id = c.prize_id
                 where c.campaign_id = p_campaign and c.used_at is null),
    'finale',   kuji.finale_state(p_campaign)
  );
end $$;

-- ------------------------------------------------------------
-- get_coupon — 025 그대로, 번호 모양만 fmt_code
-- ------------------------------------------------------------
create or replace function kuji.get_coupon(p_campaign uuid, p_code text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json;
begin
  select json_build_object(
    'grade', p.grade, 'name', p.name, 'image', p.image_url,
    'code', kuji.fmt_code(c.code),
    'isLastOne', c.is_last_one, 'expiresAt', c.expires_at, 'usedAt', c.used_at,
    'lastOneLabel', case when c.is_last_one then k.last_one_label else null end,
    'lastOneName',  case when c.is_last_one then k.last_one_name  else null end
  ) into v
  from kuji.coupons c
  join kuji.prizes p on p.id = c.prize_id
  join kuji.campaigns k on k.id = c.campaign_id
  where c.campaign_id = p_campaign and c.code = replace(upper(p_code),'-','');
  return coalesce(v, json_build_object('error','NOT_FOUND'));
end $$;

-- ------------------------------------------------------------
-- 함수 권한 다시 잠그기(028 과 같다) — 새 함수 fmt_code 도 서버 전용이 된다
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
       and p.proname in ('get_board_config', 'open_session', 'get_board', 'check_pass', 'draw', 'get_coupon')
  loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;

-- 확인 — 손님용 6개만 나와야 한다
select p.oid::regprocedure as anon_callable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'kuji'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;
