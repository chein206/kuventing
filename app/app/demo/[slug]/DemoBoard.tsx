'use client';

import { useState } from 'react';
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
 * 업종 데모 — 실제 카운터 화면 그대로. 위 얇은 띠에 어떤 행사인지 적고, 처음부터 다시 볼 수 있게 한다.
 * 띠는 판 위에 덮지 않고 흐름 안에 둔다 — 덮으면 판 맨 위 줄(매장 이름 · 남은 수)이나 아래 버튼을 가린다.
 * 끝물 조작판(/fx/endgame)과 달리 손님 화면만 보여 준다 — 홈페이지 · 영업에서 "직접 해 보기"로 연다.
 */
export default function DemoBoard({ slug, build, quick, sound }: {
  slug: string; build: string; quick?: 'tap' | 'open'; sound?: boolean;
}) {
  const [sim] = useState(() => liveSim(slug));
  // 빠른 열기 — 홈페이지 첫 화면에 얹는 판. 띠 없이 판만, 누르면 고르기 없이 맨 윗등급 표가 바로 열린다
  const [q] = useState(() => (quick ? { pick: () => sim.pickTop(), open: quick === 'open', sound } : undefined));
  if (q) {
    return (
      <div className="demo-wrap quick">
        <BoardClient token={`demo-${slug}`} build={build} quick={q} />
      </div>
    );
  }
  return (
    <div className="demo-wrap">
      <div className="demo-tag">
        <b>데모</b>
        <span>{DEMOS[slug].note}</span>
        <button onClick={() => sim.newBox()}>새 판</button>
      </div>
      <BoardClient token={`demo-${slug}`} build={build} />
    </div>
  );
}
