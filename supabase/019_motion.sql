-- ============================================================
-- 019. 모션 광고 컷 길이
--
-- 첫 장 모션 광고의 컷 길이가 코드에 박혀 있었다(3.5 / 3 / 2.5초).
-- 매장마다 메뉴 이름 길이도, 손님이 서 있는 시간도 다르다.
-- 사장님이 조절할 수 있어야 한다.
--
-- 값 하나만 둔다 — 컷 하나의 길이. 나머지는 여기서 파생한다.
--   첫 컷    +0.5초 (처음 눈이 가는 자리라 조금 길게)
--   가운데    그대로
--   사인 컷  -0.5초 (매장명만 뜨므로 짧게)
-- 노브를 여럿 두면 사장님이 안 만진다. 하나면 만진다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists motion_seconds numeric(4,1) not null default 3.0;

alter table kuji.campaigns
  drop constraint if exists campaigns_motion_chk;
alter table kuji.campaigns
  add constraint campaigns_motion_chk check (motion_seconds between 1.5 and 10);

-- ------------------------------------------------------------
-- 카운터 화면이 읽는 설정에 실어 보낸다
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
    'motionSeconds',   c.motion_seconds,
    'sound',       c.sound,
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

-- 016 의 원칙: 화면이 부르는 함수만 anon 에 열어 둔다
revoke all on function kuji.get_board_config(text) from public, anon, authenticated;
grant execute on function kuji.get_board_config(text) to service_role;
grant execute on function kuji.get_board_config(text) to anon, authenticated;

-- 확인
select title, motion_seconds, slide_seconds, sound from kuji.campaigns order by created_at desc;
