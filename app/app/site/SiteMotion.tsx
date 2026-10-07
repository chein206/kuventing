'use client';

import { useEffect } from 'react';

/**
 * 홈페이지 움직임 — IntersectionObserver 하나로 세 가지를 맡는다.
 *  1. [data-reveal] 화면에 들어오면 .in 을 붙여 나타나게(위로 떠오름) — 읽는 순서를 잡아 준다
 *  2. [data-count="50>36"] 들어올 때 숫자를 줄여 세기 — "남은 수가 줄어든다"를 직접 보여 준다
 *  3. video[data-inview] 화면 밖이면 멈추고 들어오면 재생 — 안 보이는 영상이 휴대폰 배터리를 먹지 않게
 * 움직임을 줄이라고 해 둔 기기(prefers-reduced-motion)는 숫자는 바로 끝값, 영상은 멈춘 첫 화면만.
 */
export default function SiteMotion() {
  useEffect(() => {
    const root = document.querySelector('.kv');
    if (!root) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (el instanceof HTMLVideoElement) {
          if (e.isIntersecting && !reduce) el.play().catch(() => {});
          else el.pause();
          continue;
        }
        if (!e.isIntersecting) continue;
        el.classList.add('in');
        if (el.dataset.count) countDown(el, reduce);
        io.unobserve(el);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

    root.querySelectorAll('[data-reveal], [data-count], video[data-inview]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

/** 50 → 36 처럼 줄여 센다. 글자만 바꾸므로 리액트를 다시 그리지 않는다 */
function countDown(el: HTMLElement, reduce: boolean) {
  const [from, to] = (el.dataset.count ?? '').split('>').map(Number);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return;
  if (reduce) { el.textContent = String(to); return; }
  const t0 = performance.now(), dur = 1800;
  el.textContent = String(from);
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
