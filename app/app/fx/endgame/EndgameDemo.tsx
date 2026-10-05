'use client';

import { useEffect, useReducer, useState } from 'react';
import BoardClient from '../../board/[token]/BoardClient';
import { setGrip, type Grip } from '../../board/[token]/OpenView';
import { setDemoServer } from '@/lib/supabase';
import { EndgameSim, MODES } from './sim';

// 판은 하나만 — 개발 모드는 첫 렌더를 두 번 돌려 판이 둘 생기고, 조작판과 보드가 서로 다른 판을 보게 된다
let live: EndgameSim | null = null;
function liveSim(theme: string, font: string, grip: Grip) {
  if (!live) {
    setGrip(grip);
    live = new EndgameSim(theme, font);
    setDemoServer(live.client);
  }
  return live;
}

/**
 * 끝물 데모 — 실제 카운터 화면 위에 작은 조작판을 띄운다.
 * 판은 메모리에서 돌고(sim.ts), 보드는 그 판을 실제 서버처럼 부른다. DB 에는 아무것도 쓰지 않는다.
 */
export default function EndgameDemo({ theme, font, grip, build }: { theme: string; font: string; grip: Grip; build: string }) {
  // 보드보다 먼저 가짜 서버를 꽂아야 한다 — 보드는 처음 뜰 때 설정을 부른다.
  // 이 주소에서만 쓰는 화면이라 떠날 때 되돌리지 않는다(다른 화면은 새로 읽히며 다시 실제 서버를 잡는다)
  const [sim] = useState(() => liveSim(theme, font, grip));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [open, setOpen] = useState(true);
  useEffect(() => sim.subscribe(bump), [sim]);

  const s = sim.state();
  const hidden = sim.hidden();
  // 끝물이 가까우면 상위 등급 칸 번호를 알려 준다 — 그 칸을 골라 전환 순간을 직접 볼 수 있게
  const upper = s.rest.filter((x) => x.grade !== s.low);

  return (
    <>
      <BoardClient token="demo" build={build} />
      <div className="egd">
        <button className="egd-tab" onClick={() => setOpen(!open)}>
          끝물 데모 · {sim.box}회차 · 남은 {s.left}장{hidden ? ' · 피날레 숨음' : ''}
        </button>
        {open && (
          <div className="egd-body">
            <label>방식 (사장님 화면 › 박스 › 끝물 방식)</label>
            <div className="egd-row">
              {MODES.map(([m, l]) => (
                <button key={m} aria-pressed={sim.mode === m} onClick={() => sim.setMode(m)}>{l}</button>
              ))}
            </div>
            <label>판 만들기</label>
            <div className="egd-row">
              <button onClick={() => sim.newBox()}>새 판 (손으로)</button>
              <button onClick={() => sim.lowOnly(7)}>{s.low}만 7장 남기기</button>
              <button onClick={() => sim.oneUpper(7)}>D 1장 + {s.low} 7장</button>
            </div>
            <label>뽑기</label>
            <div className="egd-row">
              <button onClick={() => sim.otherDraw()}>다른 손님 1명 뽑기</button>
              <button aria-pressed={sim.force} disabled={!hidden} onClick={() => sim.toggleForce()}>
                다음 뽑기에 피날레
              </button>
            </div>
            {upper.length > 0 && upper.length <= 3 && (
              <p className="egd-hint">
                상위 등급 칸: {upper.map((x) => `${x.pos}번(${x.grade})`).join(' · ')} — 이 칸을 고르면 끝물이 시작됩니다
              </p>
            )}
            <ol className="egd-log">
              {sim.log.map((l, i) => <li key={`${sim.log.length}-${i}`}>{l}</li>)}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}
