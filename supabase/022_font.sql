-- ============================================================
-- 022. 카운터 화면 글꼴
--
-- 글꼴은 매장 성격이지 우리 취향이 아니다. 라멘집과 카페가 같은 글꼴일 이유가 없다.
--
-- 다만 한글 웹폰트는 파일이 크다(글자가 1만 자가 넘는다). 그래서 **기본값은
-- 내려받지 않는다** — 기기에 있는 글꼴을 쓴다. 고르지 않은 매장은 지금까지와
-- 똑같이 즉시 뜬다. 고른 매장만 그 글꼴을, 그것도 쓰는 글자 조각만 받는다.
--
-- system     기본 (내려받지 않음)
-- pretendard 프리텐다드 — 깔끔한 고딕
-- myeongjo   본명조 — 차분·고급
-- gothic     고딕 A1 — 좁고 단단함
-- dodum      고운돋움 — 부드럽고 둥글다
-- ============================================================

alter table kuji.campaigns
  add column if not exists font text not null default 'system';

alter table kuji.campaigns
  drop constraint if exists campaigns_font_chk;
alter table kuji.campaigns
  add constraint campaigns_font_chk
  check (font in ('system', 'pretendard', 'myeongjo', 'gothic', 'dodum'));

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
    'font',        c.font,
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
select title, font, sound, motion_seconds from kuji.campaigns order by created_at desc;
