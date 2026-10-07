'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/lib/Icon';

type Demo = { slug: string; title: string; rule: string; desc: string; brand: string; photo: string };

/**
 * 업종 데모 — 세 판이 나란히 있고 가리킨 판이 넓어진다(아코디언).
 * 「데모 열기」는 넓은 화면이면 이 페이지 위에 태블릿 모양으로 실제 데모를 띄운다(iframe).
 * 폰은 화면이 좁아 새 탭에서 데모를 통째로 연다(링크 기본 동작).
 * 데모는 메모리에서만 돈다 — DB 에 아무것도 쓰지 않는다(app/demo).
 */
export default function Demos({ items }: { items: Demo[] }) {
  const [open, setOpen] = useState(0);
  const [live, setLive] = useState<Demo | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (live && !d.open) d.showModal();
    if (!live && d.open) d.close();
  }, [live]);

  const launch = (e: React.MouseEvent, d: Demo) => {
    if (!matchMedia('(min-width: 1024px)').matches) return;
    e.preventDefault();
    setLive(d);
  };

  return (
    <>
      <div className="kv-demos-row">
        {items.map((d, i) => (
          <article
            key={d.slug}
            className={`kv-demo${i === open ? ' open' : ''}`}
            data-reveal
            style={{ ['--i' as string]: i }}
            onPointerEnter={() => setOpen(i)}
            onFocus={() => setOpen(i)}
          >
            <img src={d.photo} alt="" loading="lazy" />
            <div className="kv-demo-copy">
              <p className="kv-demo-rule">{d.rule}</p>
              <h3>{d.title}</h3>
              <div className="kv-demo-more">
                <p>{d.desc}</p>
                <a className="kv-btn primary" href={`/demo/${d.slug}`} target="_blank" rel="noopener" onClick={(e) => launch(e, d)}>
                  데모 열기
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <dialog
        ref={dlg}
        className="kv-modal"
        aria-label={live ? `${live.brand} 데모` : '데모'}
        onClose={() => setLive(null)}
        onClick={(e) => { if (e.target === e.currentTarget) setLive(null); }}
      >
        {live && (
          <>
            <div className="kv-device modal">
              <div className="kv-screen">
                <iframe
                  src={`/demo/${live.slug}`} title={`${live.brand} 데모`} allow="autoplay; fullscreen"
                  // 데모를 한 번 누르면 키보드가 iframe 안으로 들어가 Esc 가 창까지 안 온다 — 안에서도 듣는다(같은 출처)
                  onLoad={(e) => {
                    try {
                      e.currentTarget.contentWindow?.addEventListener('keydown', (k) => { if (k.key === 'Escape') setLive(null); });
                    } catch { /* 다른 출처면 닫기 단추와 바깥 누르기로 닫는다 */ }
                  }}
                />
              </div>
            </div>
            <div className="kv-modal-bar">
              <span>{live.brand}</span>
              <a href={`/demo/${live.slug}`} target="_blank" rel="noopener">새 창에서 열기</a>
            </div>
            <button className="kv-modal-x" onClick={() => setLive(null)} aria-label="데모 닫기"><Icon name="close" /></button>
          </>
        )}
      </dialog>
    </>
  );
}
