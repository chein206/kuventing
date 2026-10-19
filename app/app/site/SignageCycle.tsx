'use client';

import { useEffect, useRef, useState } from 'react';

export type SigItem = { key: string; tag: string; photo: string; text: string };

/**
 * SIGNAGE — 올린 사진 한 장이 화면에서 광고가 되는 과정을 영상 하나로(10-19 홈페이지 수정 5).
 * 영상은 업종마다 seg 초: 사진 카드 → 펴지며 광고 칸을 채우고 문구가 떠오름 → 실제 판 대기 화면 → 다음 업종
 * (모션그래프 세션 vidops/remotion/src/kuventing/KvSignage.tsx · public/site/signage-v2.mp4). 재생 위치 ÷ seg 로 아래 칩을 맞춘다.
 * 칩을 누르면 그 업종으로 건너뛴다. 재생 · 멈춤은 SiteMotion 이 화면에 보일 때만(data-inview)
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
    <div className="kv-sig-flow one">
      <figure className="kv-sig-out" data-reveal>
        <div className="kv-device">
          <div className="kv-screen">
            <video ref={v} autoPlay muted loop playsInline preload="metadata" poster={poster} data-inview>
              <source src={video} type="video/mp4" />
            </video>
          </div>
        </div>
        <figcaption><b>사진 한 장 + 문구</b>「{items[i].text}」 → 화면에서 도는 광고 · 데모</figcaption>
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
