'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/lib/Icon';

export type SigItem = { key: string; tag: string; photo: string; text: string };

/**
 * SIGNAGE — 업종이 돌아가며 바뀐다. 왼쪽은 사장님이 올린 것(사진 한 장 + 문구), 오른쪽은 그걸로 만든 대기 화면(실제 녹화).
 * 화면 영상은 업종별 첫 컷을 seg 초씩 순서대로 이어 붙인 하나다(assets/site/build_signage.py) — 재생 위치 ÷ seg 로 왼쪽을 맞춘다.
 * 아래 업종 칩을 누르면 그 업종으로 건너뛴다. 재생 · 멈춤은 SiteMotion 이 화면에 보일 때만(data-inview)
 */
export default function SignageCycle({ items, video, poster, seg }: {
  items: SigItem[]; video: string; poster: string; seg: number;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const on = () => setI(Math.min(items.length - 1, Math.floor(el.currentTime / seg)));
    el.addEventListener('timeupdate', on);
    return () => el.removeEventListener('timeupdate', on);
  }, [items.length, seg]);

  const jump = (k: number) => {
    const el = v.current;
    if (!el) return;
    el.currentTime = k * seg + 0.05;
    setI(k);
    el.play().catch(() => {});
  };

  return (
    <div className="kv-sig-flow">
      <figure className="kv-sig-in" data-reveal>
        <div className="kv-sig-stack">
          {items.map((x, k) => (
            <img key={x.key} src={x.photo} alt={k === i ? `올린 사진 — ${x.tag}` : ''} className={k === i ? 'on' : ''}
              width={640} height={853} loading="lazy" />
          ))}
        </div>
        <figcaption><b>올린 것</b>사진 한 장 + 문구 「{items[i].text}」</figcaption>
      </figure>
      <span className="kv-sig-arrow" aria-hidden="true" data-reveal style={{ ['--i' as string]: 1 }}><Icon name="up" /></span>
      <figure className="kv-sig-out" data-reveal style={{ ['--i' as string]: 2 }}>
        <div className="kv-device">
          <div className="kv-screen">
            <video ref={v} autoPlay muted loop playsInline preload="metadata" poster={poster} data-inview>
              <source src={video} type="video/mp4" />
            </video>
          </div>
        </div>
        <figcaption><b>화면에서는</b>천천히 다가오는 사진과 떠오르는 문구</figcaption>
      </figure>
      <div className="kv-sig-tabs" role="group" aria-label="업종별 광고 보기">
        {items.map((x, k) => (
          <button key={x.key} type="button" className={k === i ? 'on' : ''} aria-pressed={k === i} onClick={() => jump(k)}>
            {x.tag}
          </button>
        ))}
      </div>
    </div>
  );
}
