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
  useEffect(() => () => { sfx.grindStop(); sfx.tensionStop(); }, []);

  /**
   * 글자 구간을 흉내낸다 — 4.5초 동안 숨죽임이 0 → 1 로 차오르고 심장이 점점 빨리 뛴다(화면과 같은 박자 계산).
   * 그라인더도 같이 갈아 실제 개봉처럼 겹쳐 듣는다
   */
  const [hushing, setHushing] = useState(false);
  const htimer = useRef<number | null>(null);
  function demoHush() {
    wake();
    if (hushing) return;
    setHushing(true);
    const t0 = performance.now();
    let last = t0, hb = 0;
    sfx.grindStart();
    htimer.current = window.setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      const t = (now - t0) / 1000, p = Math.min(1, .55 + t * .09), k = Math.min(1, t / 3.2);
      const ph0 = hb % 1; hb += dt * (1 + 1.9 * k); const ph = hb % 1;
      const crossed = (a: number) => (ph >= ph0 ? ph0 < a && a <= ph : a > ph0 || a <= ph);
      if (crossed(.1)) sfx.heartbeat(k); else if (crossed(.28)) sfx.heartbeat(.55 * k);
      sfx.grindSet(p, k);
      sfx.tensionSet(k, p);
      if (t >= 4.5) {
        window.clearInterval(htimer.current!);
        sfx.grindStop(); sfx.tensionStop(); sfx.snap();
        setHushing(false);
      }
    }, 20);
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
        <button className="row big" onClick={demoGrind} disabled={grinding}>
          <b>{grinding ? '갈리는 중…' : '지이익 — 확정음까지 한 번에'}</b>
          <span>손잡이를 끝까지 미는 2초를 그대로 재현합니다</span>
        </button>
        <button className="row big" onClick={demoHush} disabled={hushing}>
          <b>{hushing ? '두근두근…' : '글자 구간 — 심장 소리 · 긴장음'}</b>
          <span>글자 앞에서 숨죽이는 4.5초. 심장이 점점 빨리 뛰고 낮은 소리가 차오릅니다</span>
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
