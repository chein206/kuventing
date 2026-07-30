-- ============================================================
-- 004 — 보드 전용 PIN 분리
--
-- PIN이 두 개인 이유:
--   OWNER_PIN(.env)  — 사장님 웹 화면 로그인. 매장 밖으로 나가면 안 됨
--   board_pin(DB)    — 카운터 화면에서 직원이 누르는 4자리.
--                      손님 앞에서 매일 눌러야 하므로 노출을 전제로 한다.
-- 같은 값을 쓰면 손님이 어깨너머로 보고 사장님 화면에 들어갈 수 있다. 반드시 다르게.
-- ============================================================

alter table kuji.stores
  add column if not exists board_pin text not null default '1234';

-- open_session 이 owner_pin 대신 board_pin 을 보도록 교체
create or replace function kuji.open_session(p_token text, p_pin text default null)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_campaign uuid;
  v_mode     text;
  v_pin      text;
  v_left     int;
  v_code     text;
begin
  select c.id, c.board_mode, s.board_pin
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

grant execute on function kuji.open_session(text, text) to anon, authenticated;

select s.name, s.board_pin, c.board_mode, c.board_token
from kuji.stores s join kuji.campaigns c on c.store_id = s.id
order by c.created_at desc
limit 1;
