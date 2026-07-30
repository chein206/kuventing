-- ============================================================
-- 006 — 박스 회차 + 상품 구성 편집
--
-- 박스를 새로 열 때 기존 티켓·쿠폰을 지우면 손님이 들고 있는 쿠폰이 사라진다.
-- 대신 회차 번호(box)를 올리고 새 티켓을 추가한다. 지난 회차 기록은 그대로 남는다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists current_box int not null default 1;

alter table kuji.tickets
  add column if not exists box int not null default 1;

-- 자리 번호는 회차마다 1번부터 다시 시작한다
alter table kuji.tickets drop constraint if exists tickets_campaign_id_position_key;
do $$
begin
  alter table kuji.tickets add constraint tickets_campaign_box_position_key
    unique (campaign_id, box, position);
exception when duplicate_table or duplicate_object then null;
end $$;

create index if not exists tickets_campaign_box_idx on kuji.tickets (campaign_id, box, drawn_at);

-- ------------------------------------------------------------
-- 티켓 생성 — 현재 회차에 채운다
-- ------------------------------------------------------------
create or replace function kuji.build_tickets(p_campaign uuid)
returns int language plpgsql security definer set search_path = kuji, public as $$
declare v_total int; v_sum int; v_box int;
begin
  select total_tickets, current_box into v_total, v_box
  from kuji.campaigns where id = p_campaign;

  if exists (select 1 from kuji.tickets
             where campaign_id = p_campaign and box = v_box and drawn_at is not null) then
    raise exception 'ALREADY_STARTED';
  end if;

  select coalesce(sum(qty),0) into v_sum from kuji.prizes where campaign_id = p_campaign;
  if v_sum <> v_total then
    raise exception 'QTY_MISMATCH:%:%', v_sum, v_total;
  end if;

  delete from kuji.tickets where campaign_id = p_campaign and box = v_box;

  insert into kuji.tickets (campaign_id, box, position, prize_id)
  select p_campaign, v_box, row_number() over (order by random()), x.prize_id
  from (
    select p.id as prize_id
    from kuji.prizes p, generate_series(1, p.qty)
    where p.campaign_id = p_campaign
  ) x;

  return v_total;
end $$;

-- ------------------------------------------------------------
-- 새 박스 열기 — 회차를 올리고 새로 섞는다. 지난 회차는 보존.
-- ------------------------------------------------------------
create or replace function kuji.open_new_box(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_box int; v_total int;
begin
  update kuji.campaigns
     set current_box = current_box + 1
   where id = p_campaign
  returning current_box, total_tickets into v_box, v_total;

  if v_box is null then raise exception 'NOT_FOUND'; end if;

  perform kuji.build_tickets(p_campaign);

  return json_build_object('ok', true, 'box', v_box, 'total', v_total);
end $$;

-- ------------------------------------------------------------
-- 상품 구성 저장
-- 등급별 수량 합이 총 티켓 수와 같아야 한다.
-- 이미 뽑기가 시작된 회차에는 반영되지 않는다 — 새 박스를 열어야 적용된다.
-- ------------------------------------------------------------
create or replace function kuji.set_prizes(p_campaign uuid, p_prizes json)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_total int;
  v_sum   int := 0;
  it      json;
begin
  select total_tickets into v_total from kuji.campaigns where id = p_campaign;
  if v_total is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  for it in select * from json_array_elements(p_prizes) loop
    v_sum := v_sum + (it->>'qty')::int;
  end loop;

  if v_sum <> v_total then
    return json_build_object('ok', false, 'reason', 'QTY_MISMATCH', 'sum', v_sum, 'total', v_total);
  end if;

  for it in select * from json_array_elements(p_prizes) loop
    update kuji.prizes
       set name       = coalesce(it->>'name', name),
           qty        = (it->>'qty')::int,
           use_when   = coalesce(it->>'use_when', use_when),
           valid_days = coalesce((it->>'valid_days')::int, valid_days)
     where campaign_id = p_campaign and grade = (it->>'grade');
  end loop;

  return json_build_object('ok', true, 'sum', v_sum);
end $$;

-- ------------------------------------------------------------
-- 이하 함수들: 현재 회차만 보도록 수정
-- ------------------------------------------------------------
create or replace function kuji.get_board(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json; v_box int;
begin
  select current_box into v_box from kuji.campaigns where id = p_campaign;

  select json_build_object(
    'campaign', (
      select json_build_object(
        'id', c.id, 'title', c.title, 'status', c.status, 'theme', c.theme,
        'total', c.total_tickets, 'endsAt', c.ends_at, 'box', c.current_box,
        'lastOneName', c.last_one_name, 'lastOneImage', c.last_one_image,
        'store', json_build_object('name', s.name, 'branch', s.branch, 'logo', s.logo_url)
      )
      from kuji.campaigns c join kuji.stores s on s.id = c.store_id
      where c.id = p_campaign
    ),
    'prizes', (
      select coalesce(json_agg(json_build_object(
        'grade', p.grade, 'name', p.name, 'qty', p.qty,
        'useWhen', p.use_when, 'image', p.image_url,
        'left', (select count(*) from kuji.tickets t
                  where t.prize_id = p.id and t.box = v_box and t.drawn_at is null)
      ) order by p.sort, p.grade), '[]'::json)
      from kuji.prizes p where p.campaign_id = p_campaign
    ),
    'board', (
      select coalesce(json_agg(json_build_object(
        'pos', t.position,
        'grade', case when t.drawn_at is null then null else p.grade end
      ) order by t.position), '[]'::json)
      from kuji.tickets t join kuji.prizes p on p.id = t.prize_id
      where t.campaign_id = p_campaign and t.box = v_box
    ),
    'left', (select count(*) from kuji.tickets
              where campaign_id = p_campaign and box = v_box and drawn_at is null)
  ) into v;
  return v;
end $$;

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
  where campaign_id = v_pass.campaign_id
    and box = v_box
    and position = p_position
    and drawn_at is null
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
    'lastOneName', case when v_is_last
      then (select last_one_name from kuji.campaigns where id = v_pass.campaign_id) else null end,
    'expiresAt', v_exp,
    'left',      v_left,
    'position',  p_position
  );
end $$;

create or replace function kuji.issue_pass(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_code text; v_left int; v_box int;
begin
  select current_box into v_box from kuji.campaigns where id = p_campaign;
  select count(*) into v_left from kuji.tickets
   where campaign_id = p_campaign and box = v_box and drawn_at is null;
  if v_left = 0 then raise exception 'BOX_EMPTY'; end if;

  loop
    begin
      v_code := kuji.gen_code(10);
      insert into kuji.draw_passes (campaign_id, code, expires_at)
      values (p_campaign, v_code, now() + interval '3 minutes');
      exit;
    exception when unique_violation then
    end;
  end loop;

  return json_build_object('code', v_code, 'expiresAt', now() + interval '3 minutes', 'left', v_left);
end $$;

create or replace function kuji.open_session(p_token text, p_pin text default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_campaign uuid; v_mode text; v_pin text; v_left int; v_code text; v_box int;
begin
  select c.id, c.board_mode, s.board_pin, c.current_box
    into v_campaign, v_mode, v_pin, v_box
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  if v_campaign is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  if v_mode = 'pin' and (p_pin is null or p_pin <> v_pin) then
    return json_build_object('ok', false, 'reason', 'BAD_PIN');
  end if;

  select count(*) into v_left from kuji.tickets
   where campaign_id = v_campaign and box = v_box and drawn_at is null;
  if v_left = 0 then return json_build_object('ok', false, 'reason', 'BOX_EMPTY'); end if;

  loop
    begin
      v_code := kuji.gen_code(10);
      insert into kuji.draw_passes (campaign_id, code, expires_at)
      values (v_campaign, v_code, now() + interval '3 minutes');
      exit;
    exception when unique_violation then
    end;
  end loop;

  return json_build_object('ok', true, 'pass', v_code, 'campaignId', v_campaign, 'left', v_left);
end $$;

-- 대시보드: 티켓 수치는 현재 회차, 미사용 쿠폰은 전 회차(손님이 아직 들고 있으므로)
create or replace function kuji.owner_stats(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_box int;
begin
  select current_box into v_box from kuji.campaigns where id = p_campaign;

  return json_build_object(
    'box',      v_box,
    'total',    (select total_tickets from kuji.campaigns where id = p_campaign),
    'left',     (select count(*) from kuji.tickets where campaign_id = p_campaign and box = v_box and drawn_at is null),
    'drawn',    (select count(*) from kuji.tickets where campaign_id = p_campaign and box = v_box and drawn_at is not null),
    'today',    (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at::date = current_date),
    'coupons',  (select count(*) from kuji.coupons where campaign_id = p_campaign),
    'redeemed', (select count(*) from kuji.coupons where campaign_id = p_campaign and used_at is not null),
    'byGrade',  (select coalesce(json_agg(json_build_object(
                    'grade', p.grade, 'name', p.name, 'qty', p.qty,
                    'useWhen', p.use_when, 'validDays', p.valid_days, 'image', p.image_url,
                    'left', (select count(*) from kuji.tickets t
                              where t.prize_id = p.id and t.box = v_box and t.drawn_at is null)
                 ) order by p.sort, p.grade), '[]'::json)
                 from kuji.prizes p where p.campaign_id = p_campaign),
    'pending',  (select coalesce(json_agg(json_build_object(
                    'code', substr(c.code,1,3)||'-'||substr(c.code,4,3),
                    'grade', p.grade, 'name', p.name, 'at', c.created_at
                 ) order by c.created_at desc), '[]'::json)
                 from kuji.coupons c join kuji.prizes p on p.id = c.prize_id
                 where c.campaign_id = p_campaign and c.used_at is null)
  );
end $$;

grant execute on function kuji.get_board(uuid)   to anon, authenticated;
grant execute on function kuji.draw(text,int)    to anon, authenticated;
grant execute on function kuji.open_session(text,text) to anon, authenticated;
revoke all on function kuji.open_new_box(uuid), kuji.set_prizes(uuid,json) from anon, authenticated;
grant execute on function kuji.open_new_box(uuid)      to service_role;
grant execute on function kuji.set_prizes(uuid,json)   to service_role;
grant execute on function kuji.build_tickets(uuid)     to service_role;

-- 지금 박스가 소진된 상태면 바로 새 박스를 하나 열어 둔다
do $$
declare v uuid; v_left int; v_box int;
begin
  select id, current_box into v, v_box from kuji.campaigns order by created_at desc limit 1;
  select count(*) into v_left from kuji.tickets where campaign_id = v and box = v_box and drawn_at is null;
  if v_left = 0 then
    perform kuji.open_new_box(v);
    raise notice '새 박스를 열었습니다';
  end if;
end $$;

select title, current_box, total_tickets from kuji.campaigns order by created_at desc limit 1;
