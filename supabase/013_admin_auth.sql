-- ============================================================
-- 013 — 운영자 인증을 Supabase Auth 로 교체
--
-- 지금까지는 주소에 시크릿을 박아 썼다(/admin/<48자>).
-- URL·화면 공유·브라우저 히스토리에 비밀이 남고, 비번을 바꾸려면
-- 환경변수를 고쳐 재배포해야 했다.
--
-- byd-quo 어드민과 같은 방식으로 맞춘다: 이메일+비밀번호 로그인 후
-- 운영자 명단(kuji.admins)에 있는지 확인한다.
-- ============================================================

create table if not exists kuji.admins (
  user_id    uuid primary key,          -- auth.users.id
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);

alter table kuji.admins enable row level security;   -- 직접 접근 차단

-- 이 사용자가 운영자인가
create or replace function kuji.is_admin(p_user uuid)
returns boolean language sql security definer set search_path = kuji, public as $$
  select exists (select 1 from kuji.admins where user_id = p_user);
$$;

-- 운영자 등록 (서버에서만 호출)
create or replace function kuji.admin_upsert(p_user uuid, p_email text, p_name text default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
begin
  insert into kuji.admins (user_id, email, name)
  values (p_user, p_email, p_name)
  on conflict (user_id) do update set email = excluded.email, name = coalesce(excluded.name, kuji.admins.name);
  return json_build_object('ok', true, 'userId', p_user, 'email', p_email);
end $$;

-- ------------------------------------------------------------
-- 대시보드 — 전 매장 합계
-- ------------------------------------------------------------
create or replace function kuji.admin_overview()
returns json language plpgsql security definer set search_path = kuji, public as $$
begin
  return json_build_object(
    'stores',    (select count(*) from kuji.stores),
    'live',      (select count(*) from kuji.campaigns where status = 'live'),
    'drawnToday',(select count(*) from kuji.tickets where drawn_at::date = current_date),
    'coupons',   (select count(*) from kuji.coupons),
    'redeemed',  (select count(*) from kuji.coupons where used_at is not null),
    'pending',   (select count(*) from kuji.coupons where used_at is null and expires_at > now()),
    'expiring',  (select count(*) from kuji.coupons
                   where used_at is null and expires_at between now() and now() + interval '3 days'),
    -- 손 봐야 하는 매장들
    'lowStock',  (select coalesce(json_agg(json_build_object(
                     'store', s.name, 'branch', s.branch, 'left', x.left, 'total', c.total_tickets
                   ) order by x.left), '[]'::json)
                  from kuji.campaigns c
                  join kuji.stores s on s.id = c.store_id
                  cross join lateral (
                    select count(*)::int as left from kuji.tickets t
                     where t.campaign_id = c.id and t.box = c.current_box and t.drawn_at is null
                  ) x
                  where c.status = 'live' and x.left <= 5),
    'risky',     (select coalesce(json_agg(json_build_object(
                     'store', s.name, 'branch', s.branch,
                     'samePin', (s.owner_pin = s.board_pin),
                     'openMode', (c.board_mode = 'open'),
                     'pinFails', kuji.rate_count('board_pin', s.id::text, interval '1 day', true)
                                 + kuji.rate_count('owner_pin', s.id::text, interval '1 day', true)
                   )), '[]'::json)
                  from kuji.stores s
                  join kuji.campaigns c on c.store_id = s.id
                  where s.owner_pin = s.board_pin
                     or c.board_mode = 'open'
                     or kuji.rate_count('board_pin', s.id::text, interval '1 day', true) > 0
                     or kuji.rate_count('owner_pin', s.id::text, interval '1 day', true) > 0)
  );
end $$;

-- ------------------------------------------------------------
-- 전 매장 미사용 쿠폰 (쿠폰 현황 화면)
-- ------------------------------------------------------------
create or replace function kuji.admin_coupons(p_limit int default 200)
returns json language plpgsql security definer set search_path = kuji, public as $$
begin
  return coalesce((
    select json_agg(x order by x.expires_at)
    from (
      select
        s.name as store, s.branch,
        p.grade, p.name as prize,
        substr(k.code,1,3)||'-'||substr(k.code,4,3) as code,
        k.expires_at, k.created_at,
        (k.expires_at < now()) as expired
      from kuji.coupons k
      join kuji.campaigns c on c.id = k.campaign_id
      join kuji.stores    s on s.id = c.store_id
      join kuji.prizes    p on p.id = k.prize_id
      where k.used_at is null
      order by k.expires_at
      limit p_limit
    ) x
  ), '[]'::json);
end $$;

revoke all on function kuji.is_admin(uuid), kuji.admin_upsert(uuid,text,text),
                       kuji.admin_overview(), kuji.admin_coupons(int)
  from anon, authenticated;

grant execute on function kuji.is_admin(uuid)              to service_role;
grant execute on function kuji.admin_upsert(uuid,text,text) to service_role;
grant execute on function kuji.admin_overview()            to service_role;
grant execute on function kuji.admin_coupons(int)          to service_role;
