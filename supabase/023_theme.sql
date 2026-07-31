-- ============================================================
-- 023. 카운터 화면 테마 — 판 밝기 × 문양
--
-- 있던 테마 세 가지(warm·modern·neon)는 이름이 **취향**이라 사장님이 무엇을
-- 고르는지 알 수 없었다. 따뜻한 것과 미니멀한 것 중 뭘 골라야 하나?
--
-- 두 축으로 쪼개면 각각 고를 이유가 생긴다.
--
--   판 밝기  매장 조명과 유리창 방향이 정한다.
--            밤 장사면 어두운 판, 낮에 창가 자리면 밝은 판.
--   문양      업종이 정한다. 서양 활판(극장 입장권) / 동양 인찰(한지 + 전각).
--
--   dark-west   어두운 판 · 서양 활판   밤 장사 · 라멘 · 바
--   dark-east   어두운 판 · 동양 인찰   일식 · 한식 · 전통주
--   light-west  밝은 판 · 서양 활판     카페 · 베이커리 · 분식
--   light-east  밝은 판 · 동양 인찰     톤이 하나라 테두리와 도장으로만 가른다
--   classic     처음 만든 판 · 남색     남색 바탕에 금선. 무늬 없이 단순하다
--
-- 처음 만든 남색 티켓은 지운 게 아니라 한 칸으로 옮겼다. 별·바코드·점선이
-- 벡터 UI 의 상투구인 것은 맞지만 못 쓸 물건이라는 뜻은 아니다. 무엇보다
-- **고를 수 있어야 비교가 된다** — 첫 매장에서 사장님이 나란히 보고 정한다.
--
-- 옛 이름은 **판 밝기만 맞춰서** 옮긴다. neon 은 어두운 판이었으므로 dark-west 로.
-- ============================================================

update kuji.campaigns set theme = case theme
  when 'modern' then 'dark-west'
  when 'neon'   then 'dark-west'
  when 'warm'   then 'light-west'
  else theme
end
where theme in ('modern', 'neon', 'warm');

alter table kuji.campaigns
  alter column theme set default 'dark-west';

-- ------------------------------------------------------------
-- 옛 이름이 들어와도 막지 않고 옮긴다.
--
-- admin_create_store 는 클라이언트가 준 값을 그대로 넣고 기본값이 'warm' 이다.
-- 함수를 통째로 다시 쓰면 상품·등급·토큰 발급까지 같이 건드리게 되므로
-- 값을 고치는 자리를 하나만 둔다. 오래 열어 둔 어드민 탭에서 옛 값을 보내도
-- 저장이 실패하지 않는다.
-- ------------------------------------------------------------
create or replace function kuji.norm_theme() returns trigger
language plpgsql set search_path = kuji, public as $$
begin
  new.theme := case new.theme
    when 'modern' then 'dark-west'
    when 'neon'   then 'dark-west'
    when 'warm'   then 'light-west'
    else coalesce(new.theme, 'dark-west')
  end;
  return new;
end $$;

drop trigger if exists campaigns_norm_theme on kuji.campaigns;
create trigger campaigns_norm_theme
  before insert or update of theme on kuji.campaigns
  for each row execute function kuji.norm_theme();

revoke all on function kuji.norm_theme() from public, anon, authenticated;

-- 트리거가 먼저 고치므로 제약은 마지막 그물이다
alter table kuji.campaigns
  drop constraint if exists campaigns_theme_chk;
alter table kuji.campaigns
  add constraint campaigns_theme_chk
  check (theme in ('dark-west', 'dark-east', 'light-west', 'light-east', 'classic'));

-- 확인
select title, theme, font from kuji.campaigns order by created_at desc;
