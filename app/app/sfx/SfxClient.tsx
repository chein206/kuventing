'use client';

import { useEffect, useRef, useState } from 'react';
import * as sfx from '@/lib/sfx';

/**
 * 소리 미리듣기.
 *
 * 소리는 글로 설명이 안 된다. 태블릿 스피커에서 직접 들어 봐야 고를 수 있다.
 * 매장에 나가기 전에 이 화면에서 확정음을 비교하고, 볼륨도 여기서 가늠한다.
 */
export default function SfxClient() {
  const [mode, setMode] = useState<sfx.SoundMode>('soft');
  const [ready, setReady] = useState(false);
  const [grinding, setGrinding] = useState(false);
  const push = useRef(0);
  const timer = useRef<number | null>(null);

  // 브라우저는 사용자가 만지기 전에 소리를 못 내게 막는다
  const wake = () => { sfx.unlock(mode); setReady(true); };

  useEffect(() => { if (ready) sfx.setMode(mode); }, [mode, ready]);
  useEffect(() => () => { sfx.grindStop(); sfx.peelStop(); }, []);

  /**
   * 종이 벗기기를 흉내낸다 — 쪼는 손 그대로: 빨리 밀다가, 글자 앞에서 멈칫, 조금씩 쪼다가, 끝은 단숨에.
   * [초, 빠르기 0~1]
   */
  const [peeling, setPeeling] = useState(false);
  const ptimer = useRef<number | null>(null);
  function demoPeel() {
    wake();
    if (peeling) return;
    setPeeling(true);
    const plan: [number, number][] = [[0, .75], [.7, .2], [1.0, 0], [1.6, .12], [1.9, 0], [2.3, .16], [2.6, 0], [3.0, .9], [3.35, 0]];
    const t0 = performance.now();
    sfx.peelStart();
    ptimer.current = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      let v = 0;
      for (const [at, val] of plan) if (t >= at) v = val;
      sfx.peelSet(v);
      if (t >= 3.4) {
        window.clearInterval(ptimer.current!);
        sfx.peelStop();
        sfx.snap();
        setPeeling(false);
      }
    }, 30);
  }

  /** 미는 동작을 흉내낸다 — 0에서 1까지 2초 동안 올린다 */
  function demoGrind() {
    wake();
    if (grinding) return;
    setGrinding(true);
    push.current = 0;
    sfx.grindStart();
    timer.current = window.setInterval(() => {
      push.current += 0.04;
      sfx.grindSet(push.current);
      if (push.current >= 1) {
        window.clearInterval(timer.current!);
        sfx.grindStop();
        sfx.snap();
        setGrinding(false);
      }
    }, 80);
  }

  return (
    <div className="sx" onPointerDown={wake}>
      <header>
        <h1>쿠벤팅 소리</h1>
        <p>태블릿 스피커로 들어 보고 고르세요. 화면을 한 번 누른 뒤부터 소리가 납니다.</p>
      </header>

      <section>
        <h2>볼륨</h2>
        <div className="seg">
          {([['off', '끔'], ['soft', '작게'], ['loud', '크게']] as const).map(([v, l]) => (
            <button key={v} aria-pressed={mode === v} onClick={() => { setMode(v); sfx.unlock(v); setReady(true); }}>
              {l}
            </button>
          ))}
        </div>
        <p className="n">사장님 화면 홈 탭에서도 같은 값을 고릅니다.</p>
      </section>

      <section>
        <h2>여는 소리</h2>
        <button className="row big" onClick={demoPeel} disabled={peeling}>
          <b>{peeling ? '벗기는 중…' : '종이 벗기기 — 쪼다가 단숨에, 확정음까지'}</b>
          <span>3D 개봉 화면. 빨리 밀면 촘촘하게, 멈추면 조용해집니다</span>
        </button>
        <button className="row" onClick={demoGrind} disabled={grinding}>
          <b>{grinding ? '갈리는 중…' : '지이익 — 예전 그라인더'}</b>
          <span>WebGL 이 안 되는 기기의 평면 개봉 화면에만 남아 있습니다</span>
        </button>
      </section>

      <section>
        <h2>확정음 <em>티켓이 확정되는 순간</em></h2>
        {(Object.keys(sfx.SNAP_LABEL) as sfx.SnapKind[]).map((k) => (
          <button key={k} className="row" onClick={() => { wake(); sfx.snapOf(k); }}>
            <b>{sfx.SNAP_LABEL[k]}</b>
            <span>{k}</span>
          </button>
        ))}
        <p className="n">
          지금 화면에 들어가 있는 것은 <b>팡</b>입니다. 다른 걸 고르면 바꿔 드립니다.
        </p>
      </section>

      <section>
        <h2>결과 팡파레 <em>등급이 높을수록 음이 많다</em></h2>
        <div className="grades">
          {['A', 'B', 'C', 'D', 'E'].map((g) => (
            <button key={g} onClick={() => { wake(); sfx.fanfare(g); }}>{g}</button>
          ))}
          <button className="last" onClick={() => { wake(); sfx.fanfare('A', true); }}>피날레 보너스</button>
        </div>
      </section>
    </div>
  );
}
