'use client';

import { useEffect, useRef } from 'react';

/**
 * 실제 장면 사진 속 기기 화면에 대기 화면(광고판) 영상을 원근 맞춰 얹는다.
 * 원근 변환(matrix3d)은 사진 크기(1376×768) 좌표계로 구해 두었다(assets/site/screen_fit.py) — 그 좌표계 층을 칸 폭에 맞춰 줄인다.
 * 사진은 바로 보이고(첫 그림), 영상 층은 줄인 뒤에만 보인다 — 줄이기 전엔 원래 크기라 엉뚱한 자리에 크게 뜬다.
 */
export const SCENE_W = 1376;

export default function Scene({ photo, video, poster, matrix, alt }: {
  photo: string; video: string; poster: string; matrix: string; alt: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = box.current, l = layer.current;
    if (!b || !l) return;
    const fit = () => {
      l.style.transform = `scale(${b.clientWidth / SCENE_W})`;
      l.setAttribute('data-ready', '');
    };
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    fit();
    return () => ro.disconnect();
  }, []);

  return (
    <div className="kv-scene" ref={box}>
      <img className="kv-scene-photo" src={photo} alt={alt} width={SCENE_W} height={768} />
      <div className="kv-scene-layer" ref={layer} aria-hidden="true">
        <video autoPlay muted loop playsInline preload="metadata" poster={poster} data-inview style={{ transform: matrix }}>
          <source src={video} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
