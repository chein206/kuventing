'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { DrawResult, Prize } from '@/lib/supabase';
import type { Art } from '@/lib/boardArt';
import { Icon } from '@/lib/Icon';
import { gradeColor, isFlat, tierOf } from './grade';

/**
 * 결과 화면.
 *
 * 그림은 3D 층(fx3d/result3d)이 그리고, 글자는 이 위에 얹는다.
 * 카드와 메달은 글자 층에 **빈 자리**만 만들어 두고, 3D 가 그 자리를 재서 맞춰 앉는다 —
 * 그래서 쿠폰 QR 이 붙어 글자가 길어져도 카드가 글자를 덮지 않는다.
 *
 * WebGL 을 못 쓰는 기기(또는 3D 파일을 못 받은 경우)는 예전 평면 화면으로 내려간다.
 * 결과 화면은 상품을 알려 주는 자리라 그림이 안 떠도 글자는 반드시 떠야 한다.
 */
export default function ResultView({
  r, art, dark, campaignId, prizes, seconds, lastOneImage, lastOneLabel, store, title, onDone,
}: {
  r: DrawResult; art: Art; dark: boolean; campaignId: string; prizes: Prize[]; seconds: number;
  lastOneImage: string | null; lastOneLabel: string;
  /** 쪽지에 찍히는 매장 이름과 회차 제목 */
  store: string; title: string;
  onDone: () => void;
}) {
  const [sec, setSec] = useState(seconds);
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  // 글자 연출은 3D 가 실제로 돌기 시작할 때 같이 출발한다 — 셰이더를 올리는 동안 글자만 먼저 뜨면 박자가 어긋난다
  const [go, setGo] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  // 피날레 보너스가 나오면 그쪽이 주인공. 등급 상품은 아래에 함께 표시한다
  const last = r.isLastOne && !!r.lastOneName;
  const tier = tierOf(r.grade, r.isLastOne);
  const front = last ? lastOneImage : r.image;
  const name = last ? (r.lastOneName as string) : r.name;

  // 나중에 쓰는 상품은 쿠폰 QR 을 띄운다. 결과 화면은 뽑은 뒤에만 그려지므로(서버에서 안 그림) location 을 바로 쓴다
  const qr = useMemo(() => {
    if (r.useWhen !== 'later') return null;
    const q = qrcode(0, 'M');
    q.addData(`${location.origin}/c/${campaignId}/${r.code.replace('-', '')}`);
    q.make();
    return q.createDataURL(5, 2);
  }, [r, campaignId]);

  // 상태 갱신 함수 안에서 부모를 건드리면 렌더 도중 setState가 되어버린다. 분리한다.
  useEffect(() => {
    const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (sec === 0) onDone(); }, [sec, onDone]);

  // 3D 층 — 뽑기를 시작할 때 미리 받아 둔 모듈을 꺼내 쓴다
  useEffect(() => {
    if (mode !== '3d') return;
    let alive = true;
    let st: { stop(): void } | null = null;
    // 사진이 늦게 오거나 기기가 느려도 글자는 1.6초 안에는 뜬다
    const late = setTimeout(() => setGo(true), 1600);
    (async () => {
      try {
        const m = await import('./fx3d/result3d');
        const s = m.getStage();
        const host = rootRef.current?.closest('.bd') as HTMLElement | null;
        if (!alive) return;
        if (!s || !host || !cardRef.current || !coinRef.current) { setMode('2d'); return; }
        st = s;
        await s.play({
          host, cardSlot: cardRef.current, coinSlot: coinRef.current,
          grade: r.grade, tier, front, flat: !!front && isFlat(front),
          slip: { store, title, no: r.position ?? null }, dark,
          onLost: () => { if (alive) setMode('2d'); },
        });
        if (!alive) { s.stop(); return; }
        setGo(true);
      } catch {
        if (alive) setMode('2d');
      }
    })();
    return () => { alive = false; clearTimeout(late); st?.stop(); };
  }, [mode, r, tier, front, store, title, dark]);

  return (
    <div className="page res3wrap" ref={rootRef}>
      <div className={`res3 tier-${tier} ${mode === '2d' ? 'res' : go ? '' : 'hold'}`}>
        <div className="hdl">{last ? `${lastOneLabel}!` : '축하합니다!'}</div>

        {mode === '3d' ? (
          <>
            <div className="slot cardslot" ref={cardRef} />
            <div className="slot coinslot" ref={coinRef} />
          </>
        ) : (
          <>
            {/* 그림(할인권 SVG 같은 것)은 자르지 않는다 — 안에 글자와 테두리가 들어 있다 */}
            <div className={`shotbox ${last ? 'gold' : ''} ${front && isFlat(front) ? 'flat' : ''}`}
                 style={{ ['--gc' as string]: gradeColor(r.grade) }}>
              {front
                ? <img src={front} alt="" />
                : <div className="noimg">{last ? <Icon name="star" /> : r.grade}</div>}
            </div>
            {last ? (
              <div className="gtag gold">{lastOneLabel}</div>
            ) : art.photo ? (
              <div className="wax"><img src={art.photo.sealSrc} alt="" /><b>{r.grade}</b></div>
            ) : (
              <div className="gtag" style={{ background: gradeColor(r.grade) }}>{r.grade}</div>
            )}
          </>
        )}

        <h1>{name}</h1>

        {last && (
          <div className="alsobar">
            <div className="thumb" style={{ background: gradeColor(r.grade) }}>
              {r.image ? <img src={r.image} alt="" /> : r.grade}
            </div>
            <div className="tx">
              <div className="k">함께 지급됩니다</div>
              <div className="v"><b style={{ color: gradeColor(r.grade) }}>{r.grade}</b> {r.name}</div>
            </div>
          </div>
        )}

        {r.useWhen === 'now' ? (
          <div className="now">직원에게 바로 받으세요</div>
        ) : (
          <div className="cpn">
            {qr && <img src={qr} alt="쿠폰 QR" />}
            <div className="cc">
              <div className="l">쿠폰 코드</div>
              <div className="v">{r.code}</div>
              <div className="x">
                QR을 찍어 휴대폰에 저장하세요<br />
                {new Date(r.expiresAt).toLocaleDateString('ko-KR')}까지 · 1회 사용
              </div>
            </div>
          </div>
        )}

        <div className="gchips">
          {prizes.map((p) => {
            const l = p.grade === r.grade ? p.left - 1 : p.left;
            return (
              <div key={p.grade} className={`gchip ${l <= 0 ? 'zero' : ''}`}>
                <div className="d" style={{ background: gradeColor(p.grade) }}>{p.grade}</div>
                <div className="n">{Math.max(0, l)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <button className="big" onClick={onDone}>확인 ({sec})</button>
    </div>
  );
}
