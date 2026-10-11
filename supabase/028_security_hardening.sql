-- ============================================================
-- 028. 보안 점검(10-11) 후속 — 돌려도 화면 동작은 그대로다
--
-- 1) set_ads: 광고 사진은 「이미 이 판 광고에 있던 주소」만 받는다
--    광고 칸에 아무 문자열이나 들어갈 수 있었다. 남의 매장 사진 주소(get_board 로 보임)를 넣었다 빼면
--    서버가 그 파일을 지웠다 — 앱 쪽(dropImage 를 그 캠페인 폴더로 묶음, 커밋 c5a7bb5)에서 이미 막았고,
--    여기서는 남의 · 바깥 주소를 아예 저장하지 못하게 한 번 더 막는다.
--    새 사진은 늘 업로드 API(set_ad_image)가 먼저 DB 에 넣고, 화면은 그 주소를 그대로 돌려보내므로 정상 흐름은 안 걸린다.
--    걸리면 BAD_IMAGE(앱이 「화면을 새로 고친 뒤 다시 올려 주세요」로 안내).
--
-- 2) gen_code: random() → 암호용 난수(gen_random_uuid 의 무작위 바이트)
--    매장 · 판 토큰, 사장님 주소, 뽑기권, 쿠폰 번호가 모두 이 함수로 만들어진다.
--    random() 은 예측 가능한 난수라 바꾼다. 이름 · 인자 · 글자 모양(32자, 헷갈리는 0 O 1 I 없음)은 그대로.
--    이미 나간 토큰 · 쿠폰은 그대로 쓸 수 있다(새로 만드는 것부터 바뀐다).
--
-- 3) 함수 권한 다시 잠그기 + 확인
--    016 의 `alter default privileges in schema kuji revoke ... from public` 은 실제로는 효과가 없다
--    (스키마 단위로는 전역 기본 권한인 PUBLIC EXECUTE 를 못 거둔다). 그래서 새 함수를 만드는 마이그레이션은
--    끝에 꼭 아래 3) 블록을 붙인다. 맨 끝 확인 쿼리 결과는 손님용 6개만 나와야 한다.
-- ============================================================

-- ------------------------------------------------------------
-- 1) set_ads — 021 그대로 + 사진 주소 확인
-- ------------------------------------------------------------
create or replace function kuji.set_ads(p_campaign uuid, p_ads json)
returns json language plpgsql security definer set search_path = kuji, public as $$
declare
  v_old    jsonb;
  v_new    jsonb := '[]'::jsonb;
  it       json;
  v_title  text;
  v_sub    text;
  v_price  text;
  v_image  text;
  v_pos    text;
  v_n      int := 0;
  v_have   jsonb := '[]'::jsonb;   -- 지금 이 판 광고에 들어 있는 사진 주소들
  v_kept   jsonb := '[]'::jsonb;
  v_gone   jsonb := '[]'::jsonb;
begin
  select ads into v_old from kuji.campaigns where id = p_campaign;
  if v_old is null then
    return json_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(e->>'image'), '[]'::jsonb) into v_have
    from jsonb_array_elements(v_old) e
   where e->>'image' is not null;

  for it in select * from json_array_elements(p_ads) loop
    v_n := v_n + 1;
    if v_n > 10 then
      return json_build_object('ok', false, 'reason', 'TOO_MANY');
    end if;

    v_title := btrim(coalesce(it->>'title', ''));
    v_sub   := btrim(coalesce(it->>'sub', ''));
    v_price := btrim(coalesce(it->>'price', ''));
    v_image := nullif(btrim(coalesce(it->>'image', '')), '');

    -- 사진은 업로드 API 가 먼저 넣은 것만 — 남의 매장 · 바깥 주소는 받지 않는다
    if v_image is not null and not (v_have ? v_image) then
      return json_build_object('ok', false, 'reason', 'BAD_IMAGE', 'at', v_n);
    end if;

    -- 옛 값도 받아 준다. 화면이 갱신되기 전 요청이 섞일 수 있다
    v_pos := lower(btrim(coalesce(it->>'pos', 'bl')));
    v_pos := case v_pos
               when 'top' then 'tl' when 'mid' then 'ml' when 'bottom' then 'bl'
               else v_pos end;
    if v_pos not in ('tl', 'tr', 'ml', 'mr', 'bl', 'br') then
      return json_build_object('ok', false, 'reason', 'BAD_POS', 'at', v_n);
    end if;

    if v_title = '' and v_image is null then
      return json_build_object('ok', false, 'reason', 'EMPTY_SLIDE', 'at', v_n);
    end if;
    if length(v_title) > 30 or length(v_sub) > 60 or length(v_price) > 20 then
      return json_build_object('ok', false, 'reason', 'TOO_LONG', 'at', v_n);
    end if;

    v_new := v_new || jsonb_build_object(
      'title', v_title,
      'sub',   nullif(v_sub, ''),
      'price', nullif(v_price, ''),
      'image', v_image,
      'pos',   v_pos
    );
    if v_image is not null then
      v_kept := v_kept || to_jsonb(v_image);
    end if;
  end loop;

  select coalesce(jsonb_agg(s.url), '[]'::jsonb) into v_gone
    from (select e->>'image' as url
            from jsonb_array_elements(v_old) e
           where e->>'image' is not null) s
   where not (v_kept ? s.url);

  update kuji.campaigns set ads = v_new where id = p_campaign;

  return json_build_object('ok', true, 'count', v_n, 'gone', v_gone);
end $$;

-- ------------------------------------------------------------
-- 2) gen_code — 암호용 난수
--    gen_random_uuid() 는 Postgres 13+ 내장(운영체제 암호 난수). v4 UUID 16바이트 중
--    버전 · 변형 비트가 섞인 6번 · 8번 바이트를 빼고 14바이트만 쓴다. 32자에서 고르므로 바이트 % 32 는 치우침이 없다
-- ------------------------------------------------------------
create or replace function kuji.gen_code(len int default 6)
returns text language plpgsql volatile as $$
declare
  chars constant text  := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32자
  pick  constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15];
  out   text := '';
  b     bytea;
  i     int := 0;
begin
  while length(out) < len loop
    if i % 14 = 0 then
      b := uuid_send(gen_random_uuid());
    end if;
    out := out || substr(chars, (get_byte(b, pick[(i % 14) + 1]) % 32) + 1, 1);
    i := i + 1;
  end loop;
  return out;
end $$;

-- ------------------------------------------------------------
-- 3) 함수 권한 다시 잠그기(016 1 · 2 와 같다 — 몇 번 돌려도 같다)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'kuji'
       and p.proname in ('get_board_config', 'open_session', 'get_board', 'check_pass', 'draw', 'get_coupon')
  loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 확인 — 손님 키(anon)로 부를 수 있는 kuji 함수. 6개(get_board_config · open_session · get_board ·
-- check_pass · draw · get_coupon)만 나와야 한다. 다른 이름이 보이면 알려 주세요
-- ------------------------------------------------------------
select p.oid::regprocedure as anon_callable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'kuji'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;
