-- ============================================================
-- 011 — 주소 재발급
--
-- 링크가 새면(단톡방 공유, 직원 퇴사, 손님이 URL 촬영) 지금은 대응 수단이 없다.
-- 토큰만 새로 뽑으면 옛 주소는 즉시 죽는다.
--
-- 카운터 주소를 바꾸면 태블릿에서 주소를 다시 열어야 한다.
-- 사장님 주소를 바꾸면 본인 링크도 바뀌므로 새 주소로 이동해야 한다.
-- 발행된 쿠폰·티켓·박스 회차는 건드리지 않는다.
-- ============================================================

create or replace function kuji.rotate_board_token(p_campaign uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_new text;
begin
  loop
    begin
      v_new := kuji.gen_code(12);
      update kuji.campaigns set board_token = v_new where id = p_campaign;
      if not found then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
      exit;
    exception when unique_violation then
      -- 우연히 겹치면 다시 뽑는다
    end;
  end loop;

  -- 이미 발급된 뽑기권은 무효화한다. 새 주소로 다시 시작하게.
  update kuji.draw_passes set used_at = now()
   where campaign_id = p_campaign and used_at is null and expires_at > now();

  return json_build_object('ok', true, 'token', v_new);
end $$;

create or replace function kuji.rotate_owner_token(p_store uuid)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare v_new text;
begin
  loop
    begin
      v_new := kuji.gen_code(12);
      update kuji.stores set owner_token = v_new where id = p_store;
      if not found then return json_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return json_build_object('ok', true, 'token', v_new);
end $$;

revoke all on function kuji.rotate_board_token(uuid), kuji.rotate_owner_token(uuid)
  from anon, authenticated;
grant execute on function kuji.rotate_board_token(uuid) to service_role;
grant execute on function kuji.rotate_owner_token(uuid) to service_role;
