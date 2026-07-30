-- ============================================================
-- 매장 뽑기 이벤트 — Supabase 스키마
-- 대상 프로젝트: SCPAD EDU (giaqwbakjbgahvygcehx)
-- 전용 스키마 `kuji` 안에만 생성한다. public(기존 EDU 테이블)은 건드리지 않는다.
--
-- 실행 방법
--   1. Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run
--   2. Settings > API > Exposed schemas 에 `kuji` 추가 (이거 안 하면 API에서 안 보임)
--
-- ⚠️ 아래 첫 줄 `drop schema if exists kuji cascade` 는 kuji 스키마만 지운다.
--    개발 중 재실행용이다. 운영 데이터가 쌓인 뒤에는 그 줄을 지우고 실행할 것.
-- ============================================================

drop schema if exists kuji cascade;
create schema kuji;

grant usage on schema kuji to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 테이블
-- ------------------------------------------------------------
create table kuji.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  branch      text,
  logo_url    text,
  owner_pin   text not null,              -- MVP용 간이 인증. 추후 Supabase Auth로 교체
  created_at  timestamptz not null default now()
);

create table kuji.campaigns (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references kuji.stores(id) on delete cascade,
  title          text not null,
  status         text not null default 'draft',   -- draft | live | ended
  total_tickets  int  not null,
  theme          text not null default 'warm',    -- warm | modern | neon
  starts_at      timestamptz,
  ends_at        timestamptz,
  last_one_name  text,                            -- 라스트 보상(등급 상품과 함께 지급)
  last_one_image text,
  created_at     timestamptz not null default now()
);

create table kuji.prizes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kuji.campaigns(id) on delete cascade,
  grade       text not null,                      -- A B C D E ...
  name        text not null,
  qty         int  not null check (qty >= 0),
  use_when    text not null default 'later',      -- now(그 자리) | later(다음 방문)
  valid_days  int  not null default 7,
  image_url   text,
  sort        int  not null default 0,
  unique (campaign_id, grade)
);

-- 사전 셔플된 티켓 슬롯. 손님이 고르는 자리 = position
create table kuji.tickets (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kuji.campaigns(id) on delete cascade,
  position    int  not null,
  prize_id    uuid not null references kuji.prizes(id) on delete cascade,
  drawn_at    timestamptz,
  unique (campaign_id, position)
);
create index on kuji.tickets (campaign_id, drawn_at);

-- 뽑기권. 사장님이 계산할 때 발급
create table kuji.draw_passes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kuji.campaigns(id) on delete cascade,
  code        text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table kuji.coupons (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kuji.campaigns(id) on delete cascade,
  ticket_id   uuid not null unique references kuji.tickets(id) on delete cascade,
  prize_id    uuid not null references kuji.prizes(id) on delete cascade,
  code        text not null,
  is_last_one boolean not null default false,
  expires_at  timestamptz,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, code)
);
create index on kuji.coupons (campaign_id, used_at);

-- ------------------------------------------------------------
-- RLS : 테이블 직접 접근 전부 차단.
-- 손님/사장님 모두 아래 security definer 함수로만 접근한다.
-- (안 뽑힌 티켓의 prize_id가 노출되면 게임이 깨지므로 필수)
-- ------------------------------------------------------------
alter table kuji.stores      enable row level security;
alter table kuji.campaigns   enable row level security;
alter table kuji.prizes      enable row level security;
alter table kuji.tickets     enable row level security;
alter table kuji.draw_passes enable row level security;
alter table kuji.coupons     enable row level security;
-- 정책을 하나도 만들지 않음 = anon/authenticated 직접 접근 전부 거부

-- ------------------------------------------------------------
-- 유틸
-- ------------------------------------------------------------
-- 혼동되는 문자(0,O,1,I) 제외한 코드 생성
create or replace function kuji.gen_code(len int default 6)
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out   text := '';
begin
  for i in 1..len loop
    out := out || substr(chars, floor(random()*length(chars))::int + 1, 1);
  end loop;
  return out;
end $$;

-- ------------------------------------------------------------
-- 캠페인 티켓 생성 (사전 셔플)
-- prizes 를 다 넣은 뒤 호출한다. 이미 뽑기가 시작됐으면 거부.
-- ------------------------------------------------------------
create or replace function kuji.build_tickets(p_campaign uuid)
returns int language plpgsql security definer set search_path = kuji, public as $$
declare
  v_total int;
  v_sum   int;
begin
  if exists (select 1 from kuji.tickets where campaign_id = p_campaign and drawn_at is not null) then
    raise exception 'ALREADY_STARTED';
  end if;

  select total_tickets into v_total from kuji.campaigns where id = p_campaign;
  select coalesce(sum(qty),0) into v_sum from kuji.prizes where campaign_id = p_campaign;
  if v_sum <> v_total then
    raise exception 'QTY_MISMATCH:%:%', v_sum, v_total;
  end if;

  delete from kuji.tickets where campaign_id = p_campaign;

  insert into kuji.tickets (campaign_id, position, prize_id)
  select p_campaign,
         row_number() over (order by random()),   -- 여기서 셔플
         x.prize_id
  from (
    select p.id as prize_id
    from kuji.prizes p, generate_series(1, p.qty)
    where p.campaign_id = p_campaign
  ) x;

  return v_total;
end $$;

-- ------------------------------------------------------------
-- 손님: 캠페인 상태 조회 (상품 목록 + 잔여 + 티켓 보드)
-- 안 뽑힌 티켓은 grade 를 null 로 내려 내용이 새지 않게 한다.
-- ------------------------------------------------------------
create or replace function kuji.get_board(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json;
begin
  select json_build_object(
    'campaign', (
      select json_build_object(
        'id', c.id, 'title', c.title, 'status', c.status, 'theme', c.theme,
        'total', c.total_tickets, 'endsAt', c.ends_at,
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
        'left', (select count(*) from kuji.tickets t where t.prize_id = p.id and t.drawn_at is null)
      ) order by p.sort, p.grade), '[]'::json)
      from kuji.prizes p where p.campaign_id = p_campaign
    ),
    'board', (
      select coalesce(json_agg(json_build_object(
        'pos', t.position,
        'grade', case when t.drawn_at is null then null else p.grade end
      ) order by t.position), '[]'::json)
      from kuji.tickets t join kuji.prizes p on p.id = t.prize_id
      where t.campaign_id = p_campaign
    ),
    'left', (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at is null)
  ) into v;
  return v;
end $$;

-- ------------------------------------------------------------
-- 손님: 뽑기권 확인
-- ------------------------------------------------------------
create or replace function kuji.check_pass(p_code text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare r record;
begin
  select * into r from kuji.draw_passes where code = p_code;
  if not found             then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  if r.used_at is not null then return json_build_object('ok', false, 'reason', 'USED');      end if;
  if r.expires_at < now()  then return json_build_object('ok', false, 'reason', 'EXPIRED');   end if;
  return json_build_object('ok', true, 'campaignId', r.campaign_id);
end $$;

-- ------------------------------------------------------------
-- 손님: 뽑기 (핵심)
--   1. 뽑기권 잠그고 검증
--   2. 티켓 슬롯 원자적으로 선점  ← 동시성은 이 한 줄이 처리
--   3. 뽑기권 소진
--   4. 쿠폰 발급
-- 두 명이 같은 자리를 동시에 눌러도
-- update ... where drawn_at is null 이 한 명에게만 성공한다.
-- ------------------------------------------------------------
create or replace function kuji.draw(p_pass text, p_position int)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_pass    kuji.draw_passes%rowtype;
  v_ticket  kuji.tickets%rowtype;
  v_prize   kuji.prizes%rowtype;
  v_code    text;
  v_left    int;
  v_is_last boolean;
  v_exp     timestamptz;
begin
  -- 1. 뽑기권
  select * into v_pass from kuji.draw_passes where code = p_pass for update;
  if not found                  then raise exception 'PASS_NOT_FOUND'; end if;
  if v_pass.used_at is not null then raise exception 'PASS_USED';      end if;
  if v_pass.expires_at < now()  then raise exception 'PASS_EXPIRED';   end if;

  -- 2. 티켓 선점
  update kuji.tickets set drawn_at = now()
  where campaign_id = v_pass.campaign_id
    and position = p_position
    and drawn_at is null
  returning * into v_ticket;
  if not found then raise exception 'TICKET_TAKEN'; end if;

  -- 3. 뽑기권 소진
  update kuji.draw_passes set used_at = now() where id = v_pass.id;

  select * into v_prize from kuji.prizes where id = v_ticket.prize_id;

  select count(*) into v_left
  from kuji.tickets where campaign_id = v_pass.campaign_id and drawn_at is null;
  v_is_last := (v_left = 0);

  v_exp := case when v_prize.use_when = 'later'
                then now() + (v_prize.valid_days || ' days')::interval
                else now() + interval '2 hours' end;

  -- 4. 쿠폰 (코드 충돌 시 재시도)
  loop
    begin
      v_code := kuji.gen_code(6);
      insert into kuji.coupons (campaign_id, ticket_id, prize_id, code, is_last_one, expires_at)
      values (v_pass.campaign_id, v_ticket.id, v_prize.id, v_code, v_is_last, v_exp);
      exit;
    exception when unique_violation then
      -- 코드만 다시 뽑아 재시도
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

-- ------------------------------------------------------------
-- 손님: 쿠폰 다시보기
-- ------------------------------------------------------------
create or replace function kuji.get_coupon(p_campaign uuid, p_code text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v json;
begin
  select json_build_object(
    'grade', p.grade, 'name', p.name, 'image', p.image_url,
    'code', substr(c.code,1,3) || '-' || substr(c.code,4,3),
    'isLastOne', c.is_last_one, 'expiresAt', c.expires_at, 'usedAt', c.used_at
  ) into v
  from kuji.coupons c join kuji.prizes p on p.id = c.prize_id
  where c.campaign_id = p_campaign and c.code = replace(upper(p_code),'-','');
  return coalesce(v, json_build_object('error','NOT_FOUND'));
end $$;

-- ------------------------------------------------------------
-- 사장님: 뽑기권 발급 (3분 유효)
-- ------------------------------------------------------------
create or replace function kuji.issue_pass(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_code text; v_left int;
begin
  select count(*) into v_left from kuji.tickets where campaign_id = p_campaign and drawn_at is null;
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

-- ------------------------------------------------------------
-- 사장님: 쿠폰 사용처리
-- ------------------------------------------------------------
create or replace function kuji.redeem(p_campaign uuid, p_code text)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_c kuji.coupons%rowtype; v_p kuji.prizes%rowtype; v_clean text;
begin
  v_clean := replace(upper(trim(p_code)), '-', '');
  select * into v_c from kuji.coupons where campaign_id = p_campaign and code = v_clean for update;
  if not found then return json_build_object('ok', false, 'reason','NOT_FOUND'); end if;
  if v_c.used_at is not null then
    return json_build_object('ok', false, 'reason','ALREADY_USED', 'usedAt', v_c.used_at);
  end if;
  if v_c.expires_at < now() then
    return json_build_object('ok', false, 'reason','EXPIRED', 'expiresAt', v_c.expires_at);
  end if;

  update kuji.coupons set used_at = now() where id = v_c.id;
  select * into v_p from kuji.prizes where id = v_c.prize_id;

  return json_build_object('ok', true, 'grade', v_p.grade, 'name', v_p.name,
                           'isLastOne', v_c.is_last_one,
                           'lastOneName', case when v_c.is_last_one
                             then (select last_one_name from kuji.campaigns where id = p_campaign) else null end);
end $$;

-- ------------------------------------------------------------
-- 사장님: 대시보드
-- ------------------------------------------------------------
create or replace function kuji.owner_stats(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
begin
  return json_build_object(
    'total',    (select total_tickets from kuji.campaigns where id = p_campaign),
    'left',     (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at is null),
    'drawn',    (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at is not null),
    'today',    (select count(*) from kuji.tickets where campaign_id = p_campaign and drawn_at::date = current_date),
    'coupons',  (select count(*) from kuji.coupons where campaign_id = p_campaign),
    'redeemed', (select count(*) from kuji.coupons where campaign_id = p_campaign and used_at is not null),
    'byGrade',  (select coalesce(json_agg(json_build_object(
                    'grade', p.grade, 'name', p.name, 'qty', p.qty,
                    'left', (select count(*) from kuji.tickets t where t.prize_id = p.id and t.drawn_at is null)
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
-- 실행 권한
--  anon      : 손님용 함수만
--  service_role : 사장님용 함수 (Next.js 서버 라우트에서만 호출)
-- ------------------------------------------------------------
revoke all on all functions in schema kuji from anon, authenticated;

grant execute on function kuji.get_board(uuid)            to anon, authenticated;
grant execute on function kuji.check_pass(text)           to anon, authenticated;
grant execute on function kuji.draw(text,int)             to anon, authenticated;
grant execute on function kuji.get_coupon(uuid,text)      to anon, authenticated;

grant execute on function kuji.build_tickets(uuid)        to service_role;
grant execute on function kuji.issue_pass(uuid)           to service_role;
grant execute on function kuji.redeem(uuid,text)          to service_role;
grant execute on function kuji.owner_stats(uuid)          to service_role;

-- ------------------------------------------------------------
-- Realtime : 잔여 실시간 갱신용
-- (실패해도 무방 — 그 경우 앱이 폴링으로 대체한다)
-- ------------------------------------------------------------
alter publication supabase_realtime add table kuji.tickets;
