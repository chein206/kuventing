'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  sb, getBoard, checkPass, draw,
  type Board, type DrawResult, type Prize,
} from '@/lib/supabase';

type Step = 'loading' | 'blocked' | 'list' | 'grid' | 'open' | 'result';

const gradeColor = (g: string) => {
  const i = 'ABCDE'.indexOf(g.toUpperCase());
  return i >= 0 ? `var(--g${'abcde'[i]})` : 'var(--ge)';
};

const PASS_REASON: Record<string, { t: string; d: string }> = {
  NOT_FOUND: { t: '유효하지 않은 뽑기권', d: '직원에게 다시 발급을 요청해주세요.' },
  USED:      { t: '이미 사용된 뽑기권',   d: '뽑기권은 1회만 사용할 수 있습니다.' },
  EXPIRED:   { t: '만료된 뽑기권',        d: '발급 후 3분이 지났습니다.\n직원에게 다시 요청해주세요.' },
  BOX_EMPTY: { t: '티켓이 모두 소진되었습니다', d: '다음 박스를 기다려주세요.' },
};

export default function DrawClient({ pass }: { pass: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [blocked, setBlocked] = useState<{ t: string; d: string } | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [result, setResult] = useState<DrawResult | null>(null);
  // 결과 화면의 "남은 티켓" 칩은 뽑기 직전 스냅샷 기준으로 계산한다.
  // refresh() 이후의 board를 쓰면 이미 차감된 값에서 또 빼게 된다.
  const [snapPrizes, setSnapPrizes] = useState<Prize[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [freshPos, setFreshPos] = useState<number[]>([]);

  const stepRef = useRef(step);
  stepRef.current = step;

  const refresh = useCallback(async () => {
    try {
      const b = await getBoard();
      setBoard((prev) => {
        // 다른 손님이 뽑은 자리를 표시해준다
        if (prev) {
          const before = new Set(prev.board.filter((s) => s.grade).map((s) => s.pos));
          const now = b.board.filter((s) => s.grade && !before.has(s.pos)).map((s) => s.pos);
          if (now.length) setFreshPos(now);
        }
        return b;
      });
      return b;
    } catch {
      return null;
    }
  }, []);

  // 최초 진입 — 뽑기권 검증 + 보드 조회
  useEffect(() => {
    (async () => {
      try {
        const [p, b] = await Promise.all([checkPass(pass), getBoard()]);
        if (!p.ok) {
          setBlocked(PASS_REASON[p.reason ?? 'NOT_FOUND'] ?? PASS_REASON.NOT_FOUND);
          setStep('blocked');
          return;
        }
        if (!b.campaign) {
          setBlocked({ t: '이벤트를 찾을 수 없습니다', d: '' });
          setStep('blocked');
          return;
        }
        if (b.left === 0) {
          setBlocked(PASS_REASON.BOX_EMPTY);
          setStep('blocked');
          return;
        }
        document.documentElement.dataset.theme = b.campaign.theme || 'warm';
        setBoard(b);
        setStep('list');
      } catch {
        setBlocked({ t: '연결에 실패했습니다', d: '잠시 후 다시 시도해주세요.' });
        setStep('blocked');
      }
    })();
  }, [pass]);

  // 실시간 + 폴링 (Realtime이 막혀 있어도 폴링으로 동작한다)
  useEffect(() => {
    if (!board?.campaign) return;
    const id = board.campaign.id;

    const client = sb();
    const ch = client
      .channel(`tickets:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'kuji', table: 'tickets', filter: `campaign_id=eq.${id}` },
        () => { if (stepRef.current === 'list' || stepRef.current === 'grid') refresh(); }
      )
      .subscribe();

    const t = setInterval(() => {
      if (stepRef.current === 'list' || stepRef.current === 'grid') refresh();
    }, 5000);

    return () => { client.removeChannel(ch); clearInterval(t); };
  }, [board?.campaign?.id, refresh]);

  useEffect(() => {
    if (!freshPos.length) return;
    const t = setTimeout(() => setFreshPos([]), 700);
    return () => clearTimeout(t);
  }, [freshPos]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- 오픈 ---------- */
  const cardRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);

  async function doDraw() {
    if (sel === null || busy) return;
    setBusy(true);
    cardRef.current?.classList.add('opened');
    try {
      const r = await draw(pass, sel);
      setSnapPrizes(board?.prizes ?? []);
      setResult(r);
      setTimeout(() => { setStep('result'); setBusy(false); }, 460);
      refresh();
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e);
      cardRef.current?.classList.remove('opened');
      resetKnob();
      setBusy(false);
      if (msg.includes('TICKET_TAKEN')) {
        setToast('방금 다른 분이 그 티켓을 뽑았습니다');
        setSel(null);
        await refresh();
        setStep('grid');
      } else if (msg.includes('PASS_')) {
        setBlocked(PASS_REASON[msg.includes('EXPIRED') ? 'EXPIRED' : 'USED']);
        setStep('blocked');
      } else {
        setToast('뽑기에 실패했습니다. 다시 시도해주세요');
        setStep('grid');
      }
    }
  }

  function resetKnob() {
    if (knobRef.current) { knobRef.current.style.left = '10px'; knobRef.current.classList.remove('drag'); }
  }

  /* ---------- 렌더 ---------- */
  if (step === 'loading') {
    return <div className="app"><div className="state"><div className="spin" /><p>불러오는 중</p></div></div>;
  }

  if (step === 'blocked') {
    return (
      <div className="app">
        <div className="state">
          <div className="ic">🎫</div>
          <h2>{blocked?.t}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{blocked?.d}</p>
        </div>
      </div>
    );
  }

  const b = board!;
  const c = b.campaign!;

  return (
    <div className="app">
      {step === 'list' && <PrizeList board={b} onGo={() => setStep('grid')} />}

      {step === 'grid' && (
        <section className="screen">
          <div className="hd">
            <button className="back" onClick={() => setStep('list')}>←</button>
            <div className="tt"><h1>티켓 고르기</h1></div>
            <div className="stock">
              <div className="lb">잔여 / 총</div>
              <div className="nm">{b.left}<i>/{c.total}</i></div>
            </div>
          </div>

          <div className="selbar">
            <p><b>{sel === null ? 0 : 1}</b>/1 선택됨</p>
            <button onClick={() => {
              const open = b.board.filter((s) => !s.grade);
              if (open.length) setSel(open[Math.floor(Math.random() * open.length)].pos);
            }}>랜덤 선택</button>
          </div>

          <div className="gridwrap">
            <div className="grid">
              {b.board.map((s) => s.grade ? (
                <div key={s.pos} className={`tk used ${freshPos.includes(s.pos) ? 'fresh' : ''}`}>
                  <span style={{ color: gradeColor(s.grade) }}>{s.grade}</span>
                </div>
              ) : (
                <div key={s.pos}
                     className={`tk ${sel === s.pos ? 'sel' : ''}`}
                     onClick={() => setSel(sel === s.pos ? null : s.pos)}>
                  <div className="dot" /><div className="kj">뽑기</div>
                </div>
              ))}
            </div>
            <p className="note">이미 나간 티켓은 등급이 공개됩니다.<br />남은 티켓에 무엇이 들었는지 셀 수 있습니다.</p>
          </div>

          <div className="cta">
            <button className="btn" disabled={sel === null}
                    onClick={() => { resetKnob(); setStep('open'); }}>뽑기 시작</button>
          </div>
        </section>
      )}

      {step === 'open' && (
        <section className="screen">
          <div className="openwrap">
            <h2>뽑기를 시작합니다<small>초록 손잡이를 오른쪽으로 미세요</small></h2>
            <div className="drawcard" ref={cardRef}>
              <div className="lbl">{c.store.name}<br />{c.title}</div>
              <div className="track" />
              <div className="bar" />
              <div
                className="knob"
                ref={knobRef}
                onPointerDown={(e) => {
                  dragging.current = true; startX.current = e.clientX;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  knobRef.current?.classList.add('drag');
                }}
                onPointerMove={(e) => {
                  if (!dragging.current || !cardRef.current || !knobRef.current) return;
                  const w = cardRef.current.clientWidth;
                  const dx = Math.max(0, Math.min(w - 58, e.clientX - startX.current));
                  knobRef.current.style.left = `${10 + dx}px`;
                  if (dx > w * 0.58) { dragging.current = false; doDraw(); }
                }}
                onPointerUp={() => { if (dragging.current) { dragging.current = false; resetKnob(); } }}
              >›</div>
            </div>
            <div className="openbtns">
              <button className="pri" onClick={doDraw} disabled={busy}>바로 열기</button>
            </div>
          </div>
        </section>
      )}

      {step === 'result' && result && (
        <Result r={result} prizes={snapPrizes} left={result.left}
                onBack={async () => { await refresh(); setSel(null); setStep('grid'); }} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ================= 상품 목록 ================= */
function PrizeList({ board, onGo }: { board: Board; onGo: () => void }) {
  const c = board.campaign!;
  return (
    <section className="screen">
      <div className="hd">
        <div className="tt">
          <div className="shop">{c.store.name}{c.store.branch ? ` · ${c.store.branch}` : ''}</div>
          <h1>{c.title}</h1>
        </div>
        <div className="stock">
          <div className="lb">잔여 / 총</div>
          <div className="nm">{board.left}<i>/{c.total}</i></div>
        </div>
      </div>

      <div className="prizes">
        {board.prizes.map((p) => <PrizeRow key={p.grade} p={p} />)}
        {c.lastOneName && (
          <div className="pz last">
            <div className="badge">
              {c.lastOneImage ? <img src={c.lastOneImage} alt="" /> : '★'}
            </div>
            <div className="pz-body">
              <div className="pz-name">라스트 보상 — {c.lastOneName}</div>
              <div className="pz-sub">마지막 티켓을 뽑으면 등급 상품과 함께 지급</div>
            </div>
            <div className="pz-left"><div className="n">1</div><div className="l">잔여</div></div>
          </div>
        )}
      </div>

      <div className="cta"><button className="btn" onClick={onGo}>뽑으러 가기</button></div>
    </section>
  );
}

function PrizeRow({ p }: { p: Prize }) {
  const cells = Math.min(p.qty, 14);
  const filled = Math.round((p.left / p.qty) * cells);
  return (
    <div className={`pz ${p.left === 0 ? 'out' : ''}`}>
      <div className="badge" style={{ background: gradeColor(p.grade) }}>
        {p.image ? <img src={p.image} alt="" /> : p.grade}
      </div>
      <div className="pz-body">
        <div className="pz-name">{p.name}</div>
        <div className="pz-sub">{p.useWhen === 'now' ? '그 자리에서 사용' : '다음 방문 시 사용'}</div>
        <div className="gauge">
          {Array.from({ length: cells }, (_, i) => <i key={i} className={i < filled ? 'f' : ''} />)}
        </div>
      </div>
      <div className="pz-left"><div className="n">{p.left}</div><div className="l">잔여</div></div>
    </div>
  );
}

/* ================= 결과 ================= */
function Result({
  r, prizes, left, onBack,
}: { r: DrawResult; prizes: Prize[]; left: number; onBack: () => void }) {
  const heavy = r.isLastOne || ['A', 'B'].includes(r.grade);
  const [sparks] = useState(() =>
    Array.from({ length: heavy ? 60 : 22 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${-10 - Math.random() * 40}px`,
      bg: ['var(--gold)', 'var(--accent)', 'var(--gb)', 'var(--gd)'][i % 4],
      dur: `${1.1 + Math.random() * 1.1}s`,
      delay: `${Math.random() * 0.5}s`,
    }))
  );

  return (
    <section className="screen">
      <div className="result">
        <div className="spark">
          {sparks.map((s, i) => (
            <i key={i} style={{ left: s.left, top: s.top, background: s.bg,
                                animationDuration: s.dur, animationDelay: s.delay }} />
          ))}
        </div>

        {r.isLastOne && <div className="lastone">LAST ONE</div>}
        <div className="congrats">축하합니다</div>
        <div className="rgrade" style={{ background: gradeColor(r.grade) }}>
          {r.image ? <img src={r.image} alt="" /> : r.grade}
        </div>
        <div className="rname">{r.name}</div>
        <div className="rsub">
          {r.useWhen === 'now'
            ? '그 자리에서 사용 · 계산 시 직원에게'
            : `다음 방문 시 사용 · ${new Date(r.expiresAt).toLocaleDateString('ko-KR')}까지`}
        </div>

        {r.isLastOne && r.lastOneName && (
          <div className="bonus">
            <div className="bi">★</div>
            <div>
              <div className="bt">마지막 티켓 확정 보상</div>
              <div className="bn">{r.lastOneName}</div>
            </div>
          </div>
        )}

        <div className="coupon">
          <div className="cl">쿠폰 코드</div>
          <div className="cc">{r.code}</div>
          <div className="cx">계산 시 직원에게 보여주세요 · 1회만 사용 가능</div>
        </div>

        <div className="after">
          <div className="at">남은 티켓 {left}장</div>
          <div className="row">
            {prizes.map((p) => {
              const l = p.grade === r.grade ? p.left - 1 : p.left;
              return <span key={p.grade} className={`chip ${l <= 0 ? 'z' : ''}`}>{p.grade}상 {Math.max(0, l)}</span>;
            })}
          </div>
        </div>
      </div>

      <div className="cta">
        <button className="btn ghost" onClick={onBack}>남은 티켓 보기</button>
      </div>
    </section>
  );
}
