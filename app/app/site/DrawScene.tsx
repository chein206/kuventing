'use client';

import { useEffect, useRef, useState } from 'react';

export type DrawStep = { n: string; tag: string; t: string; big: string; d: string; alt: string };
export type DrawSet = { key: string; tag: string };
export type DrawSticker = { img: string; name: string };

/**
 * LUCKY DRAW — 손님 4단계를 큰 기기 한 대로(10-19 홈페이지 수정 1 · 4: HOW IT WORKS 와 LUCKY DRAW 를 합침).
 * - 넓은 화면: 칸이 길고(4단계 × 스크롤), 기기는 화면에 붙어 있다(sticky). 스크롤하면 기기 화면이 보고 → 확인 → 고르고 → 열면 으로 넘어간다
 * - 좁은 화면 · 터치: 붙이지 않는다(스크롤을 뺏지 않게) — 같은 기기에 단계 단추 + 3.2초마다 자동 넘김, 누르면 잠깐 멈춘다
 * - 그림: /site/how/<업종>-1..4.jpg(실제 판 녹화, assets/site/build_steps.py). 업종은 5초마다 바뀐다(사장님 10-07 「다른 업종도 4초쯤마다」)
 * - 4단계는 표가 왼쪽부터 젖혀 열리듯 오른쪽으로 걷히며 나온다(로고 · 판의 「밀어서 열기」와 같은 방향)
 * - 움직임 줄이기: 붙이지도 자동으로 넘기지도 않는다
 */
export default function DrawScene({ steps, sets, stickers }: { steps: DrawStep[]; sets: DrawSet[]; stickers: DrawSticker[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0);          // 지금 단계
  const [k, setK] = useState(0);          // 지금 업종
  const [pin, setPin] = useState(false);  // 스크롤에 붙는 판(넓은 화면)
  const [seen, setSeen] = useState(false);
  const skip = useRef(0);                 // 손으로 고른 뒤 자동 넘김을 몇 번 거를지

  // 넓고 마우스인 화면만 붙인다
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const on = () => setPin(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 붙는 판 — 칸 안에서 얼마나 내려왔는지로 단계를 정한다
  useEffect(() => {
    if (!pin) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const run = el.offsetHeight - innerHeight;
      const p = run > 0 ? Math.min(0.999, Math.max(0, -r.top / run)) : 0;
      setS(Math.floor(p * steps.length));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [pin, steps.length]);

  // 좁은 화면 — 단계 자동 넘김(보일 때만)
  useEffect(() => {
    if (pin || !seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (skip.current > 0) { skip.current--; return; }
      setS((x) => (x + 1) % steps.length);
    }, 3200);
    return () => clearInterval(t);
  }, [pin, seen, steps.length]);

  // 업종은 5초마다(보일 때만)
  useEffect(() => {
    if (!seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setK((x) => (x + 1) % sets.length), 5000);
    return () => clearInterval(t);
  }, [seen, sets.length]);

  // 단계 단추 — 붙는 판이면 그 단계 자리로 스크롤, 아니면 바로 바꾸고 두 번(약 6초) 쉰다
  const go = (i: number) => {
    const el = root.current;
    if (pin && el) {
      const run = el.offsetHeight - innerHeight;
      const top = el.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + run * ((i + 0.5) / steps.length), behavior: 'smooth' });
      return;
    }
    skip.current = 2;
    setS(i);
  };

  const cur = steps[s];
  return (
    <div ref={root} className={`kv-ds${pin ? ' pin' : ''}`} style={pin ? { height: `${steps.length * 70 + 30}vh` } : undefined}>
      <div className="kv-ds-stage">
        <ol className="kv-ds-steps" aria-label="손님이 참여하는 순서">
          {steps.map((x, i) => (
            <li key={x.n}>
              <button type="button" className={i === s ? 'on' : ''} aria-current={i === s ? 'step' : undefined} onClick={() => go(i)}>
                <span>{x.n}<em> · {x.tag}</em></span>
                <b>{x.t}</b>
              </button>
            </li>
          ))}
        </ol>

        <div className="kv-ds-dev">
          {stickers.map((st, i) => (
            <div className={`kv-sticker s${i + 1}`} key={st.img} aria-hidden="true">
              <img src={`/site/m/${st.img}.jpg`} alt="" width={480} height={480} loading="lazy" />
              <span>{st.name}</span>
            </div>
          ))}
          <div className="kv-device">
            <div className="kv-screen">
              {/* 업종 × 단계 전부 깔아 두고 켜고 끈다(바꿀 때 깜빡이지 않게). 4단계는 3단계 위로 걷히며 나온다 — 그동안 3단계를 켜 둔다 */}
              {sets.map((x, j) => steps.map((st, i) => {
                const on = j === k && (i === s || (s === steps.length - 1 && i === s - 1));
                return (
                  <img key={`${x.key}-${i}`} src={`/site/how/${x.key}-${i + 1}.jpg`}
                    alt={j === k && i === s ? `${st.alt} — ${x.tag}` : ''} width={480} height={768} loading="lazy"
                    className={`${on ? 'on' : ''}${i === steps.length - 1 ? ' peel' : ''}`} style={{ zIndex: i }} />
                );
              }))}
            </div>
          </div>
          <p className="kv-ds-set" aria-live="polite">{sets[k].tag} 판 · 실제 화면</p>
        </div>

        <div className="kv-ds-copy" aria-live="polite">
          <p className="kv-ds-n">{cur.n} · {cur.tag}</p>
          <h3 key={cur.n}>{cur.big}</h3>
          <p className="kv-ds-d">{cur.d}</p>
          <span className="kv-left"><span data-count="50>36">36</span> / 50 남음</span>
        </div>
      </div>
    </div>
  );
}
