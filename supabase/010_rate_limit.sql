-- ============================================================
-- 010 — 남용 방어 (rate limit + PIN 대입 차단)
--
-- 배포하면서 생긴 실제 위험 세 가지를 막는다.
--
-- 1. 상시 개방(board_mode='open') 모드에서 보드 주소가 새면
--    누가 원격에서 티켓을 전부 소진시킬 수 있다.
-- 2. 카운터 PIN이 4자리다. 보드 주소를 아는 사람이 1만 번 대입하면 뚫린다.
-- 3. 사장님 PIN도 4자리다. 사장님 주소를 아는 사람이 같은 방법으로 뚫는다.
--
-- 매장 실사용에는 걸리지 않는 값으로 잡는다. 태블릿 한 대에서 한 명씩
-- 뽑으므로 분당 6회면 충분하다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists rate_per_min int not null default 6;

-- ------------------------------------------------------------
-- 시도 기록
-- ------------------------------------------------------------
create table if not exists kuji.rate_events (
  id    bigserial primary key,
  scope text not null,                    -- session | board_pin | owner_pin
  ref   text not null,                    -- campaign_id / store_id
  ok    boolean not null default true,
  at    timestamptz not null default now()
);
create index if not exists rate_events_lookup
  on kuji.rate_events (scope, ref, at desc);

-- 기록 남기기. 가끔 오래된 것을 치운다(테이블이 무한히 커지지 않게).
create or replace function kuji.rate_hit(p_scope text, p_ref text, p_ok boolean default true)
returns void language plpgsql security definer set search_path = kuji, public as $$
begin
  insert into kuji.rate_events (scope, ref, ok) values (p_scope, p_ref, p_ok);
  if random() < 0.01 then
    delete from kuji.rate_events where at < now() - interval '2 days';
  end if;
end $$;

-- 창(window) 안의 시도 횟수
create or replace function kuji.rate_count(
  p_scope text, p_ref text, p_window interval, p_only_fail boolean default false
) returns int language sql security definer set search_path = kuji, public as $$
  select count(*)::int from kuji.rate_events
   where scope = p_scope and ref = p_ref and at > now() - p_window
     and (not p_only_fail or ok = false);
$$;

-- ------------------------------------------------------------
-- 보드 세션 열기 — 빈도 제한 + PIN 대입 차단
--
--   뽑기권 발급 : 분당 rate_per_min 회 (기본 6)
--   PIN 실패    : 10분 내 5회 실패하면 10분간 잠금
-- ------------------------------------------------------------
create or replace function kuji.open_session(p_token text, p_pin text default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_campaign uuid; v_store uuid; v_mode text; v_pin text;
  v_left int; v_code text; v_box int; v_limit int;
  v_fails int; v_recent int;
begin
  select c.id, c.store_id, c.board_mode, s.board_pin, c.current_box, c.rate_per_min
    into v_campaign, v_store, v_mode, v_pin, v_box, v_limit
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  if v_campaign is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  -- PIN 대입 차단
  if v_mode = 'pin' then
    v_fails := kuji.rate_count('board_pin', v_store::text, interval '10 minutes', true);
    if v_fails >= 5 then
      return json_build_object('ok', false, 'reason', 'LOCKED', 'minutes', 10);
    end if;

    if p_pin is null or p_pin <> v_pin then
      perform kuji.rate_hit('board_pin', v_store::text, false);
      return json_build_object('ok', false, 'reason', 'BAD_PIN',
                               'left', greatest(0, 4 - v_fails));
    end if;
  end if;

  -- 발급 빈도 제한
  v_recent := kuji.rate_count('session', v_campaign::text, interval '1 minute');
  if v_recent >= v_limit then
    return json_build_object('ok', false, 'reason', 'RATE_LIMIT', 'perMin', v_limit);
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

  perform kuji.rate_hit('session', v_campaign::text, true);

  return json_build_object('ok', true, 'pass', v_code, 'campaignId', v_campaign, 'left', v_left);
end $$;

-- ------------------------------------------------------------
-- 사장님 로그인 관문 — 토큰 + PIN 을 한 번에 확인하고 대입을 막는다
-- 서버 라우트(service_role)에서만 호출한다.
--
--   PIN 실패 10분 내 5회 → 10분 잠금
-- ------------------------------------------------------------
create or replace function kuji.owner_gate(p_token text, p_pin text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_store uuid; v_name text; v_branch text; v_pin text;
  v_campaign uuid; v_title text; v_fails int;
begin
  select id, name, branch, owner_pin into v_store, v_name, v_branch, v_pin
  from kuji.stores where owner_token = p_token;

  -- 토큰이 틀리면 어떤 매장인지 알 수 없으므로 기록할 대상도 없다
  if v_store is null then
    return json_build_object('ok', false, 'reason', 'UNAUTHORIZED');
  end if;

  v_fails := kuji.rate_count('owner_pin', v_store::text, interval '10 minutes', true);
  if v_fails >= 5 then
    return json_build_object('ok', false, 'reason', 'LOCKED', 'minutes', 10);
  end if;

  if p_pin is null or p_pin <> v_pin then
    perform kuji.rate_hit('owner_pin', v_store::text, false);
    return json_build_object('ok', false, 'reason', 'UNAUTHORIZED',
                             'left', greatest(0, 4 - v_fails));
  end if;

  select id, title into v_campaign, v_title
  from kuji.campaigns where store_id = v_store
  order by created_at desc limit 1;

  if v_campaign is null then
    return json_build_object('ok', false, 'reason', 'NO_CAMPAIGN');
  end if;

  return json_build_object(
    'ok', true,
    'storeId', v_store, 'campaignId', v_campaign,
    'storeName', v_name, 'branch', v_branch, 'campaignTitle', v_title
  );
end $$;

-- ------------------------------------------------------------
-- 대시보드에 최근 활동을 노출 (이상 징후 감지용)
-- ------------------------------------------------------------
create or replace function kuji.owner_stats(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_box int; v_store uuid;
begin
  select current_box, store_id into v_box, v_store from kuji.campaigns where id = p_campaign;

  return json_build_object(
    'box',      v_box,
    'total',    (select total_tickets from kuji.campaigns where id = p_campaign),
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
                 where c.campaign_id = p_campaign and c.used_at is null)
  );
end $$;

-- ------------------------------------------------------------
-- 권한: 기록 함수는 내부용, open_session 만 anon 에게 열어둔다
-- ------------------------------------------------------------
revoke all on function kuji.rate_hit(text,text,boolean),
                       kuji.rate_count(text,text,interval,boolean),
                       kuji.owner_gate(text,text)
  from anon, authenticated;

grant execute on function kuji.open_session(text,text) to anon, authenticated;
grant execute on function kuji.owner_gate(text,text)   to service_role;
grant execute on function kuji.owner_stats(uuid)       to service_role;

alter table kuji.rate_events enable row level security;

select title, rate_per_min from kuji.campaigns order by created_at desc limit 2;
