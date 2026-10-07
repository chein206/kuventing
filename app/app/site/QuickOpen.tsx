'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/lib/Icon';

export type QuickItem = { slug: string; tag: string; poster: string };

/**
 * 첫 화면 「바로 열어 보기」 — 실제 데모 판을 빠른 열기(/demo/<업종>?quick=open)로 태블릿 틀 안에 띄운다.
 * 고르는 단계 없이 표가 바로 나오고, 밀면 맨 윗등급이 열린다. 결과 뒤엔 대기 화면(광고) → 누르면 다시. 저절로 열지는 않는다.
 * - 아래 업종 단추로 판을 바꾼다(사장님 10-07). 소리는 기본 끔 — 「소리 켜기」는 판에 postMessage 로 알리고, 판을 바꿀 때는 주소에 싣는다
 * - 판은 480×768 로 그려 틀 폭에 맞춰 줄인다 — 태블릿 크기(800)로 그리면 틀 안에서 판 글자가 너무 작아진다
 * - 페이지가 다 뜬 뒤에 부른다(첫 그림을 늦추지 않게). 그 전엔 같은 크기로 찍은 포스터(assets/site/quick_poster.mjs)
 * - 터치 기기는 한 번 눌러야 켜진다 — 켜기 전엔 손가락이 판 위에 있어도 페이지가 스크롤된다(덮개는 CSS 가 터치 기기에서만 보인다).
 *   폰은 판(3D)을 미리 받지 않는다 — 누른 뒤에 받고, 표가 뜰 때까지 덮개에 「여는 중」
 */
const W = 480;
const H = 768;

export default function QuickOpen({ items }: { items: QuickItem[] }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [k, setK] = useState(0);              // 지금 업종
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sound, setSound] = useState(false);
  // 판을 바꿀 때만 주소를 새로 만든다 — 소리 단추가 iframe 을 다시 불러오지 않게(소리는 postMessage 로)
  const [src, setSrc] = useState(`/demo/${items[0].slug}?quick=open`);
  const item = items[k];

  // 틀 폭에 맞춰 줄인다 — 크기가 바뀔 때마다 iframe 에 바로 쓴다(상태로 돌리면 늘 한 박자 늦다)
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(() => {
      if (frame.current) frame.current.style.transform = `scale(${b.clientWidth / W})`;
    });
    ro.observe(b);
    return () => ro.disconnect();
  }, [load, src]);

  // 페이지가 다 뜬 뒤 판을 부른다(터치 기기는 누를 때까지 기다린다)
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) return;
    let t = 0;
    const go = () => { t = window.setTimeout(() => setLoad(true), 400); };
    if (document.readyState === 'complete') go();
    else addEventListener('load', go, { once: true });
    return () => { removeEventListener('load', go); clearTimeout(t); };
  }, []);

  // 판이 표를 내밀면 포스터를 걷는다 — iframe 의 load 는 판이 그려지기 전에 온다(같은 출처라 안을 들여다볼 수 있다)
  useEffect(() => {
    if (!load) return;
    const t = setInterval(() => {
      if (frame.current?.contentDocument?.querySelector('.op3wrap .tslot, .touch, .res3')) { setReady(true); clearInterval(t); }
    }, 250);
    const stop = setTimeout(() => { setReady(true); clearInterval(t); }, 15000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [load, src]);

  const pick = (i: number) => {
    if (i === k) return;
    setK(i);
    setReady(false);
    setSrc(`/demo/${items[i].slug}?quick=open${sound ? '&sound=1' : ''}`);
  };
  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    frame.current?.contentWindow?.postMessage({ kuvt: 'sound', on }, location.origin);
  };

  return (
    <div className="kv-quick">
      <div className="kv-device kv-quick-dev">
        <div className="kv-screen" ref={box}>
          <img key={item.slug} src={item.poster} alt={`${item.tag} 판 — 표를 밀어 여는 화면`} width={640} height={1024} />
          {load && (
            <iframe key={src} ref={frame} src={src} title={`쿠벤팅 바로 열어 보기 데모 · ${item.tag}`}
              className={ready ? 'on' : ''} style={{ width: W, height: H }} />
          )}
          {!(armed && ready) && (
            <button type="button" className="kv-quick-cover" disabled={armed} onClick={() => { setLoad(true); setArmed(true); }}>
              <span>{armed ? '여는 중…' : <><Icon name="up" />눌러서 직접 열어 보기</>}</span>
            </button>
          )}
        </div>
      </div>
      <div className="kv-quick-bar">
        <div className="kv-quick-tabs" role="group" aria-label="데모 업종">
          {items.map((x, i) => (
            <button key={x.slug} type="button" className={i === k ? 'on' : ''} aria-pressed={i === k} onClick={() => pick(i)}>
              {x.tag}
            </button>
          ))}
        </div>
        <button type="button" className={`kv-quick-snd${sound ? ' on' : ''}`} aria-pressed={sound} onClick={toggleSound}>
          {sound ? '소리 끄기' : '소리 켜기'}
        </button>
      </div>
      <p className="kv-quick-hint"><b>실제 판 그대로</b>표를 오른쪽으로 밀면 열립니다</p>
    </div>
  );
}
