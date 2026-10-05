-- ============================================================
-- 025. 끝물 방식 — 남은 티켓이 모두 같은 등급일 때
--
-- 남은 게 전부 E 면 손님은 뽑기 전에 결과를 안다. 매장에서는 테이블당 한 장씩 뽑으니
-- 이치방쿠지처럼 "남은 걸 다 사서 피날레"도 안 된다(뽑기권 유료 판매는 금지 — 법률조사.md).
-- 그래서 사장님이 고른다.
--
--   off    그대로 — 마지막 장이 피날레 보너스 (기본)
--   hide   피날레 숨기기 — 남은 장이 모두 같은 등급이 되면 피날레가 남은 장 중 1장에 숨는다.
--          뽑을 때마다 "1 / 남은 장 수"로 나온다. 끝까지 안 나오면 마지막 장이 받는다(지금과 같다)
--   carry  숨기기 + 다음 판 — 위와 같고, 피날레가 나오면 남은 장을 다음 판에 섞어 넣고 바로 새 판을 연다.
--          사장님이 새 박스를 손으로 열 때도 남은 장을 버리지 않고 섞어 넣는다
--
-- 피날레는 한 판에 한 번만 나간다. 다음 판은 섞어 넣은 만큼 커진다(설정 장 수 + 넘어온 장).
-- 화면에는 "남은 7장 중 1장에 피날레", 나간 뒤엔 "피날레 나감", 새 판엔 "지난 판에서 넘어온 E 4장 포함"
-- 이 뜬다. 공개한 잔여 · 확률은 사실과 같아야 한다(표시광고법) — 화면 문구가 곧 규칙이다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists endgame text not null default 'off';
alter table kuji.campaigns
  drop constraint if exists campaigns_endgame_chk;
alter table kuji.campaigns
  add constraint campaigns_endgame_chk check (endgame in ('off', 'hide', 'carry'));

-- 지난 판에서 넘어온 티켓이면 그 판 번호
alter table kuji.tickets
  add column if not exists from_box int;

-- ------------------------------------------------------------
-- 이 판 피날레가 이미 나갔나
-- ------------------------------------------------------------
create or replace function kuji.finale_given(p_campaign uuid, p_box int)
returns boolean language sql stable security definer set search_path = kuji, public as $$
  select exists (
    select 1 from kuji.coupons c join kuji.tickets t on t.id = c.ticket_id
    where t.campaign_id = p_campaign and t.box = p_box and c.is_last_one
  );
$$;

-- ------------------------------------------------------------
-- 지금 판의 피날레 상태 — 보드와 사장님 화면이 같이 쓴다
--   hidden   피날레가 남은 장 중 1장에 숨어 있다
--   given    이 판 피날레가 이미 나갔다
--   carried  지난 판에서 넘어온 장(등급별)
-- ------------------------------------------------------------
create or replace function kuji.finale_state(p_campaign uuid)
returns json language plpgsql stable security definer set search_path = kuji, public as $$
declare
  v_box    int;
  v_mode   text;
  v_name   text;
  v_left   int;
  v_grades int;
  v_given  boolean;
begin
  select current_box, endgame, nullif(trim(last_one_name), '')
    into v_box, v_mode, v_name
  from kuji.campaigns where id = p_campaign;

  select count(*), count(distinct prize_id) into v_left, v_grades
  from kuji.tickets where campaign_id = p_campaign and box = v_box and drawn_at is null;

  v_given := kuji.finale_given(p_campaign, v_box);

  return json_build_object(
    'mode',   v_mode,
    'given',  v_given,
    'hidden', v_mode <> 'off' and v_name is not null and not v_given and v_left > 0 and v_grades = 1,
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
-- 새 박스 열기 — 남은 장을 섞어 넣을 수 있다
--   p_carry  true 섞어 넣는다 · false 버린다 · null 매장 설정(carry 면 섞어 넣는다)
-- 새 판을 먼저 채우고, 남은 장을 옮긴 뒤, 판 전체 자리를 다시 섞는다.
-- 자리 번호는 판 안에서 겹칠 수 없으므로 옮기는 동안 잠시 큰 번호에 둔다.
-- ------------------------------------------------------------
drop function if exists kuji.open_new_box(uuid);

create or replace function kuji.open_new_box(p_campaign uuid, p_carry boolean default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_box     int;
  v_total   int;
  v_mode    text;
  v_carried int := 0;
begin
  update kuji.campaigns
     set current_box = current_box + 1
   where id = p_campaign
  returning current_box, total_tickets, endgame into v_box, v_total, v_mode;

  if v_box is null then raise exception 'NOT_FOUND'; end if;

  perform kuji.build_tickets(p_campaign);

  if coalesce(p_carry, v_mode = 'carry') then
    update kuji.tickets t
       set box = v_box, from_box = v_box - 1, position = 100000 + s.rn
      from (select id, row_number() over () as rn
              from kuji.tickets
             where campaign_id = p_campaign and box = v_box - 1 and drawn_at is null) s
     where t.id = s.id;
    get diagnostics v_carried = row_count;

    if v_carried > 0 then
      update kuji.tickets t
         set position = 200000 + s.rn
        from (select id, row_number() over (order by random()) as rn
                from kuji.tickets
               where campaign_id = p_campaign and box = v_box) s
       where t.id = s.id;
      update kuji.tickets
         set position = position - 200000
       where campaign_id = p_campaign and box = v_box;
    end if;
  end if;

  return json_build_object('ok', true, 'box', v_box, 'total', v_total + v_carried, 'carried', v_carried);
end $$;

-- ------------------------------------------------------------
-- 뽑기 — 끝물 방식을 따른다
-- 같은 판의 뽑기는 캠페인 줄을 잠가 한 번에 하나씩 처리한다.
-- 동시에 뽑히면 피날레가 두 번 나가거나, 서로 남은 장이 있다고 보고 아무도 못 받을 수 있다.
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
  v_before  int;       -- 뽑기 전 남은 장
  v_grades  int;       -- 뽑기 전 남은 등급 수
  v_given   boolean;   -- 이 판 피날레가 이미 나갔다
  v_hidden  boolean;   -- 피날레가 남은 장 중 1장에 숨어 있는 구간
  v_left    int;
  v_is_last boolean;
  v_carried int := 0;
  v_exp     timestamptz;
begin
  select * into v_pass from kuji.draw_passes where code = p_pass for update;
  if not found                  then raise exception 'PASS_NOT_FOUND'; end if;
  if v_pass.used_at is not null then raise exception 'PASS_USED';      end if;
  if v_pass.expires_at < now()  then raise exception 'PASS_EXPIRED';   end if;

  select * into v_camp from kuji.campaigns where id = v_pass.campaign_id for update;
  v_box := v_camp.current_box;

  select count(*), count(distinct prize_id) into v_before, v_grades
  from kuji.tickets where campaign_id = v_camp.id and box = v_box and drawn_at is null;
  v_given  := kuji.finale_given(v_camp.id, v_box);
  v_hidden := v_camp.endgame <> 'off' and nullif(trim(v_camp.last_one_name), '') is not null
              and not v_given and v_grades = 1;

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

  -- 숨긴 피날레가 나왔는데 장이 남았다 — 다음 판에 섞어 넣고 바로 연다.
  -- 새 판을 못 열면(상품 구성 합이 안 맞는 등) 남은 장은 이 판에 그대로 두고 뽑기는 그대로 끝낸다
  if v_is_last and v_left > 0 and v_camp.endgame = 'carry' then
    begin
      v_carried := (kuji.open_new_box(v_camp.id, true) ->> 'carried')::int;
    exception when others then
      v_carried := 0;
    end;
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
    'carried',   v_carried,
    'expiresAt', v_exp,
    'left',      v_left,
    'position',  p_position
  );
end $$;

-- ------------------------------------------------------------
-- 보드 — 판 크기는 실제 장 수(넘어온 장 포함), 피날레 상태를 같이 싣는다
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
        'total', coalesce(nullif((select count(*) from kuji.tickets t
                                   where t.campaign_id = c.id and t.box = v_box), 0)::int,
                          c.total_tickets),
        'endsAt', c.ends_at, 'box', c.current_box,
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
              where campaign_id = p_campaign and box = v_box and drawn_at is null),
    'finale', kuji.finale_state(p_campaign)
  ) into v;
  return v;
end $$;

-- ------------------------------------------------------------
-- 사장님 대시보드 — 판 크기는 실제 장 수, 피날레 상태 추가 (나머지는 010 그대로)
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
                    'code', substr(c.code,1,3)||'-'||substr(c.code,4,3),
                    'grade', p.grade, 'name', p.name, 'at', c.created_at
                 ) order by c.created_at desc), '[]'::json)
                 from kuji.coupons c join kuji.prizes p on p.id = c.prize_id
                 where c.campaign_id = p_campaign and c.used_at is null),
    'finale',   kuji.finale_state(p_campaign)
  );
end $$;

-- ------------------------------------------------------------
-- 손님 쿠폰 — 피날레 문구를 같이 보낸다(쿠폰 화면이 "LAST ONE" 대신 매장 문구를 쓰게)
-- ------------------------------------------------------------
create or replace function kuji.get_coupon(p_campaign uuid, p_code text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json;
begin
  select json_build_object(
    'grade', p.grade, 'name', p.name, 'image', p.image_url,
    'code', substr(c.code,1,3) || '-' || substr(c.code,4,3),
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
-- 권한 — 보드 · 뽑기 · 쿠폰은 손님(anon), 나머지는 서버(service_role)만
-- ------------------------------------------------------------
revoke all on function kuji.finale_given(uuid,int),
                       kuji.finale_state(uuid),
                       kuji.open_new_box(uuid,boolean)
  from public, anon, authenticated;
grant execute on function kuji.finale_given(uuid,int)      to service_role;
grant execute on function kuji.finale_state(uuid)          to service_role;
grant execute on function kuji.open_new_box(uuid,boolean)  to service_role;

grant execute on function kuji.get_board(uuid)        to anon, authenticated;
grant execute on function kuji.draw(text,int)         to anon, authenticated;
grant execute on function kuji.get_coupon(uuid,text)  to anon, authenticated;
grant execute on function kuji.owner_stats(uuid)      to service_role;

select s.name as store, c.endgame, c.current_box,
       (select count(*) from kuji.tickets t
         where t.campaign_id = c.id and t.box = c.current_box and t.drawn_at is null) as left_now
from kuji.campaigns c join kuji.stores s on s.id = c.store_id
order by c.created_at;
