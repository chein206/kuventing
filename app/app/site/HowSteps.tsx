'use client';

import { useEffect, useRef, useState } from 'react';

export type HowStep = { n: string; tag: string; t: string; d: string; alt: string };
export type HowSet = { key: string; tag: string };

/**
 * HOW IT WORKS — 손님 4단계. 업종마다 실제 판 화면 한 벌(4장)씩, 4초마다 네 화면이 같이 다음 업종으로 바뀐다(사장님 10-07).
 * - 그림: /site/how/<업종>-1..4.jpg (assets/site/build_steps.py) — 단계 순서대로 살짝 늦게 바뀌어 왼쪽에서 오른쪽으로 물결친다
 * - 화면에 보일 때만 돈다. 업종 단추로 건너뛰면 그 자리에서 다시 4초를 센다. 움직임 줄이기를 켠 사람에겐 돌리지 않는다
 */
export default function HowSteps({ steps, sets, ms = 4000 }: { steps: HowStep[]; sets: HowSet[]; ms?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  const [seen, setSeen] = useState(false);
  const [tick, setTick] = useState(0);   // 단추를 누르면 타이머를 다시 건다

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setK((x) => (x + 1) % sets.length), ms);
    return () => clearInterval(t);
  }, [seen, ms, sets.length, tick]);

  return (
    <div ref={box}>
      <div className="kv-how-tabs" role="group" aria-label="업종별 화면">
        {sets.map((s, i) => (
          <button key={s.key} type="button" className={i === k ? 'on' : ''} aria-pressed={i === k}
            onClick={() => { setK(i); setTick((t) => t + 1); }}>
            {s.tag}
          </button>
        ))}
      </div>
      <ol className="kv-steps">
        {steps.map((s, i) => (
          <li key={s.n} data-reveal style={{ ['--i' as string]: i }}>
            <div className="kv-step-dev">
              <div className="kv-step-stack">
                {sets.map((x, j) => (
                  <img key={x.key} src={`/site/how/${x.key}-${i + 1}.jpg`} alt={j === k ? `${s.alt} — ${x.tag}` : ''}
                    className={j === k ? 'on' : ''} width={480} height={768} loading="lazy"
                    style={{ transitionDelay: `${i * 90}ms` }} />
                ))}
              </div>
            </div>
            <div className="kv-step-copy">
              <span className="kv-step-n">{s.n}<i>{s.tag}</i></span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
