-- ============================================================
-- 002 — 카운터 옆 상시 화면(보드) 지원
-- schema.sql 실행한 뒤에 이어서 실행한다. 기존 데이터는 유지된다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists board_mode   text not null default 'pin',   -- pin | open
  add column if not exists idle_seconds int  not null default 180,     -- 이 시간 무동작이면 초기화면
  add column if not exists ads          jsonb not null default '[]'::jsonb,
  add column if not exists board_token  text;

-- 보드 전용 접속 토큰 (주소에 들어간다)
update kuji.campaigns set board_token = kuji.gen_code(12) where board_token is null;

do $$
begin
  alter table kuji.campaigns add constraint campaigns_board_token_key unique (board_token);
exception when duplicate_table or duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 보드 설정 조회 (토큰만 알면 됨. PIN은 절대 내려보내지 않는다)
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
    'ads',         c.ads,
    'lastOneName', c.last_one_name,
    'store', json_build_object('name', s.name, 'branch', s.branch, 'logo', s.logo_url)
  ) into v
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  return coalesce(v, json_build_object('error', 'NOT_FOUND'));
end $$;

-- ------------------------------------------------------------
-- 보드에서 뽑기 1회 열기
--   mode = 'pin'  : 사장님 PIN 확인 후 발급
--   mode = 'open' : 바로 발급
-- 발급된 뽑기권은 기존 draw() 가 그대로 소비한다.
-- ------------------------------------------------------------
create or replace function kuji.open_session(p_token text, p_pin text default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_campaign uuid;
  v_mode     text;
  v_pin      text;
  v_left     int;
  v_code     text;
begin
  select c.id, c.board_mode, s.owner_pin
    into v_campaign, v_mode, v_pin
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  if v_campaign is null then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;

  if v_mode = 'pin' and (p_pin is null or p_pin <> v_pin) then
    return json_build_object('ok', false, 'reason', 'BAD_PIN');
  end if;

  select count(*) into v_left from kuji.tickets where campaign_id = v_campaign and drawn_at is null;
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

grant execute on function kuji.get_board_config(text)   to anon, authenticated;
grant execute on function kuji.open_session(text, text)  to anon, authenticated;

-- ------------------------------------------------------------
-- 데모 광고 슬라이드 + 보드 토큰 확인
-- ------------------------------------------------------------
update kuji.campaigns set ads = '[
  {"title":"차슈덮밥",   "sub":"두툼한 차슈 5장, 특제 간장 베이스", "price":"12,000원", "image":null},
  {"title":"매운 미소라멘","sub":"직접 볶은 미소와 고추기름",        "price":"11,000원", "image":null},
  {"title":"교자 6개",   "sub":"주문 즉시 굽습니다",               "price":"6,000원",  "image":null}
]'::jsonb
where ads = '[]'::jsonb;

select id, title, board_mode, idle_seconds, board_token
from kuji.campaigns
order by created_at desc
limit 1;
