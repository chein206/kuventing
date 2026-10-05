'use client';

import { useEffect, useReducer, useState } from 'react';
import BoardClient from '../../board/[token]/BoardClient';
import { setGrip } from '../../board/[token]/OpenView';
import { setDemoServer } from '@/lib/supabase';
import { EndgameSim } from '../../fx/endgame/sim';
import { DEMOS } from '../presets';

// 판은 하나만 — 개발 모드는 첫 렌더를 두 번 돌려 판이 둘 생긴다
let live: { slug: string; sim: EndgameSim } | null = null;
function liveSim(slug: string) {
  if (!live || live.slug !== slug) {
    setGrip('paper');
    live = { slug, sim: new EndgameSim(DEMOS[slug]) };
    setDemoServer(live.sim.client);
  }
  return live.sim;
}

/**
 * 업종 데모 — 실제 카운터 화면 그대로. 오른쪽 위 작은 띠에서 처음부터 다시 볼 수 있다.
 * 끝물 조작판(/fx/endgame)과 달리 손님 화면만 보여 준다 — 홈페이지 · 영업에서 "직접 해 보기"로 연다.
 */
export default function DemoBoard({ slug, build }: { slug: string; build: string }) {
  const [sim] = useState(() => liveSim(slug));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => sim.subscribe(bump), [sim]);
  const s = sim.state();
  return (
    <>
      <BoardClient token={`demo-${slug}`} build={build} />
      <div className="demo-tag">
        <span>데모 · {s.left}장 남음</span>
        <button onClick={() => sim.newBox()}>새 판</button>
      </div>
    </>
  );
}
