-- ============================================================
-- 005 — 화면 시간 설정을 DB로 뺀다 (사장님 화면에서 조절)
-- 값은 지금 코드에 박혀 있던 것과 동일하게 기본값을 준다.
-- ============================================================

alter table kuji.campaigns
  add column if not exists slide_seconds     int not null default 6,   -- 광고 슬라이드 넘김
  add column if not exists result_seconds    int not null default 40,  -- 결과 화면 자동 복귀
  add column if not exists auto_open_seconds int not null default 45;  -- 오픈 화면 방치 시 자동 개봉

-- 보드 설정 조회에 시간값 추가
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
    'ads',         c.ads,
    'lastOneName', c.last_one_name,
    'lastOneImage',c.last_one_image,
    'store', json_build_object('name', s.name, 'branch', s.branch, 'logo', s.logo_url)
  ) into v
  from kuji.campaigns c join kuji.stores s on s.id = c.store_id
  where c.board_token = p_token;

  return coalesce(v, json_build_object('error', 'NOT_FOUND'));
end $$;

grant execute on function kuji.get_board_config(text) to anon, authenticated;

select title, slide_seconds, result_seconds, auto_open_seconds, idle_seconds
from kuji.campaigns
order by created_at desc
limit 1;
