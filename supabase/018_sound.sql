-- ============================================================
-- 018. 뽑기 소리
--
-- 카운터 화면에 소리를 넣는다. 다만 **기본은 꺼둔다.**
--
-- 주방 소리·손님 대화·매장 음악이 이미 있는 자리다. 태블릿 스피커로 그걸 이길 수
-- 없고, 사장님이 시끄럽다고 느끼면 태블릿을 통째로 음소거해 버린다.
-- 그러면 우리가 만든 걸 아무도 못 듣는다. 켜는 건 매장에서 들어 보고 정할 일이다.
--
-- 대기화면(광고)에는 원천적으로 소리를 넣을 수 없다 — 브라우저가 사용자 터치 전
-- 자동 재생을 막는다. 이것도 오히려 맞다. 손님이 뽑는 순간에만 소리가 나고
-- 나머지 시간은 조용하다.
--
-- off  소리 없음 (기본)
-- soft 작게
-- loud 크게
-- ============================================================

alter table kuji.campaigns
  add column if not exists sound text not null default 'off';

alter table kuji.campaigns
  drop constraint if exists campaigns_sound_chk;
alter table kuji.campaigns
  add constraint campaigns_sound_chk check (sound in ('off', 'soft', 'loud'));

-- ------------------------------------------------------------
-- 카운터 화면이 읽는 설정에 소리를 실어 보낸다
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
select title, sound, board_mode from kuji.campaigns order by created_at desc;
