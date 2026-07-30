-- ============================================================
-- 020. 모션 광고 컷 길이 기본값 3초 → 6초
--
-- 실제로 태블릿 앞에 서서 보니 3초는 빠르다. 사진을 눈으로 좇기 전에 넘어간다.
-- 메뉴 이름을 읽고, 가격이 뜨는 걸 보고, 접시를 한 번 더 보는 데 6초쯤 걸린다.
--
-- 컷 하나가 6초면 사진 4장 매장은 6.5 + 6 + 6 + 6 + 5.5 = 30초다.
-- 손님이 계산하고 서 있는 시간보다 길지만, 한 바퀴를 다 볼 필요는 없다.
-- 어느 순간에 봐도 메뉴가 크게 떠 있는 것이 목적이다.
-- ============================================================

alter table kuji.campaigns
  alter column motion_seconds set default 6.0;

-- 이미 있는 매장도 기본값으로 올린다. 따로 조절해 둔 매장이 아직 없다.
update kuji.campaigns set motion_seconds = 6.0 where motion_seconds = 3.0;

-- 확인
select title, motion_seconds, slide_seconds from kuji.campaigns order by created_at desc;
