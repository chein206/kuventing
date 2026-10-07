'use client';

import { useEffect, useRef, useState } from 'react';

type Step = { t: string; d: string; img: string; alt: string };

/**
 * 손님 쪽 흐름 — 왼쪽 태블릿은 붙어 있고, 오른쪽 글을 내리면 그 단계 화면으로 바뀐다.
 * 화면 가운데 줄을 지나는 단계가 지금 단계다(rootMargin 위아래 45% 를 잘라 가운데 10% 만 본다).
 * 좁은 화면은 붙이지 않고 단계마다 화면을 글 아래에 둔다(CSS).
 */
export default function Steps({ items }: { items: Step[] }) {
  const [on, setOn] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setOn(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="kv-steps-grid">
      <div className="kv-steps-stage" aria-hidden="true">
        <div className="kv-device">
          <div className="kv-screen">
            {items.map((s, i) => (
              <img key={s.img} src={s.img} alt="" className={i === on ? 'on' : ''} width={720} height={1152} loading="lazy" />
            ))}
          </div>
        </div>
      </div>
      <ol className="kv-steps-list">
        {items.map((s, i) => (
          <li key={s.img} data-i={i} ref={(el) => { refs.current[i] = el; }} className={i === on ? 'on' : ''}>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
            <div className="kv-device kv-step-shot">
              <div className="kv-screen"><img src={s.img} alt={s.alt} width={720} height={1152} loading="lazy" /></div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
