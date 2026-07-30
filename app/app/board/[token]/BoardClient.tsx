'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { sb, getBoard, draw, type Board, type DrawResult, type Prize } from '@/lib/supabase';
import Ticket from './Ticket';
import { Icon } from '@/lib/Icon';
import MotionAd, { buildScenes, scenesDuration } from './MotionAd';

type Ad = {
  title: string; sub?: string; price?: string; image?: string | null;
  pos?: 'top' | 'mid' | 'bottom' | null;   // 자막 위치. 사진마다 접시 자리가 달라서 고르게 한다
};
type Config = {
  campaignId: string; title: string; status: string; theme: string;
  mode: 'pin' | 'open'; ads: Ad[];
  idleSeconds: number;       // 무동작 시 초기화면 복귀
  slideSeconds: number;      // 광고 슬라이드 넘김
  resultSeconds: number;     // 결과 화면 유지
  autoOpenSeconds: number;   // 오픈 화면 방치 시 자동 개봉
  lastOneName: string | null;
  lastOneImage: string | null;
  lastOneLabel: string | null;   // "라스트원상"은 특정 브랜드 용어라 쓰지 않는다
  store: { name: string; branch: string | null; logo: string | null };
  error?: string;
};

// DB 값이 없을 때(마이그레이션 전) 쓰는 기본값
const DEF = { idle: 20, slide: 6, result: 40, autoOpen: 45 };

// 오픈 화면 배경에 뿌리는 반짝임. 매 렌더 흔들리지 않게 모듈 수준에서 한 번만 만든다.
const TWINKLES = Array.from({ length: 60 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 61 + 7) % 100}%`,
  s: 3 + ((i * 7) % 5),
  dur: `${2 + ((i * 13) % 9) * 0.35}s`,
  delay: `-${((i * 17) % 21) * 0.3}s`,
}));

// 찢기는 자리에서 튀는 불티
// 티켓이 돌아 나오는 시간. board.css 의 pullOut 과 같이 움직인다
const PULL_MS = 1150;

const TEAR_SPARKS = Array.from({ length: 18 }, (_, i) => ({
  top: `${(i * 100) / 18 + 2}%`,
  dx: 26 + ((i * 23) % 46),          // 오른쪽으로 튀는 거리
  dy: ((i % 5) - 2) * 16,            // 위아래 흩어짐
  s: 4 + ((i * 5) % 6),
  dur: `${0.5 + ((i * 11) % 7) * 0.09}s`,
  delay: `-${((i * 7) % 13) * 0.07}s`,
}));

type Step = 'attract' | 'pin' | 'list' | 'grid' | 'open' | 'result';

/**
 * 사진이 아니라 그림(할인권 SVG 같은 것)인지.
 * 그림은 자르면 안 된다 — 안에 이미 글자와 테두리가 들어 있다.
 * 광고 사진을 자르지 않는 것과 같은 이유다.
 */
const isFlat = (src: string) => /\.svg($|\?)/i.test(src);

const GRADES = 'ABCDEFGH';
const gradeColor = (g: string) => {
  const i = GRADES.indexOf(g.toUpperCase());
  return i >= 0 ? `var(--g${GRADES[i].toLowerCase()})` : 'var(--gh)';
};

export default function BoardClient({ token }: { token: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [step, setStep] = useState<Step>('attract');
  const [pass, setPass] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  // 뽑은 티켓이 돌아 나오는 연출 (칸 위치 → 화면 가운데)
  const [pull, setPull] = useState<{ dx: number; dy: number; s: number; w: number } | null>(null);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState(false);
  const [slide, setSlide] = useState(0);
  const [pops, setPops] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const stepRef = useRef(step);
  stepRef.current = step;
  const lastTouch = useRef(Date.now());

  /* ---------- 설정 + 보드 로딩 ---------- */
  useEffect(() => {
    (async () => {
      const { data } = await sb().rpc('get_board_config', { p_token: token });
      const c = data as Config;
      if (!c || c.error) { setCfg({ ...(c ?? {}), error: 'NOT_FOUND' } as Config); return; }
      document.documentElement.dataset.theme = c.theme || 'warm';
      setCfg(c);
      setBoard(await getBoard(c.campaignId));
    })();
  }, [token]);

  const refresh = useCallback(async () => {
    if (!cfg) return;
    const b = await getBoard(cfg.campaignId);
    setBoard((prev) => {
      if (prev) {
        const before = new Set(prev.board.filter((s) => s.grade).map((s) => s.pos));
        const fresh = b.board.filter((s) => s.grade && !before.has(s.pos)).map((s) => s.pos);
        if (fresh.length) setPops(fresh);
      }
      return b;
    });
  }, [cfg]);

  // 실시간 + 폴링
  useEffect(() => {
    if (!cfg) return;
    const client = sb();
    const ch = client
      .channel(`board:${cfg.campaignId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'kuji', table: 'tickets', filter: `campaign_id=eq.${cfg.campaignId}` },
        () => refresh())
      .subscribe();
    const t = setInterval(refresh, 6000);
    return () => { client.removeChannel(ch); clearInterval(t); };
  }, [cfg, refresh]);

  useEffect(() => {
    if (!pops.length) return;
    const t = setTimeout(() => setPops([]), 800);
    return () => clearTimeout(t);
  }, [pops]);

  /* ---------- 광고 슬라이드 순환 ---------- */
  /**
   * 첫 장은 모션 광고다. 사진 있는 광고 슬라이드로 씬을 만들어 돌린다.
   * 사진이 하나도 없으면 예전처럼 글자 슬라이드를 쓴다.
   */
  const scenes = useMemo(
    () => buildScenes(
      cfg?.ads ?? [],
      { name: cfg?.store.name ?? '', branch: cfg?.store.branch },
      board?.left ?? 0,
      board?.campaign?.total ?? 0,
    ),
    [cfg?.ads, cfg?.store.name, cfg?.store.branch, board?.left, board?.campaign?.total],
  );

  const slideCount = 1 + (cfg?.ads?.length ?? 0);
  useEffect(() => {
    if (step !== 'attract' || slideCount <= 1) return;
    // 모션 광고는 씬 길이의 합만큼 머문다. 중간에 잘리면 사인 컷을 못 본다
    const ms = slide === 0 && scenes.length
      ? scenesDuration(scenes) * 1000
      : (cfg?.slideSeconds ?? DEF.slide) * 1000;
    const t = setTimeout(() => setSlide((s) => (s + 1) % slideCount), ms);
    return () => clearTimeout(t);
    // slide 가 바뀔 때마다 타이머를 다시 건다 = 손으로 넘기면 대기시간도 초기화된다
  }, [step, slideCount, cfg?.slideSeconds, slide, scenes]);

  // 손으로 넘기기
  const swipeX = useRef<number | null>(null);
  const go = (d: number) => setSlide((s) => (s + d + slideCount) % slideCount);

  /* ---------- 유휴 복귀 ---------- */
  const goAttract = useCallback(() => {
    setStep('attract'); setSel(null); setPass(null); setResult(null);
    setPin(''); setPinErr(false); setMsg(null); setSlide(0);
  }, []);

  useEffect(() => {
    const bump = () => { lastTouch.current = Date.now(); };
    window.addEventListener('pointerdown', bump);
    // 뽑기 흐름 화면(PIN·상품목록·티켓고르기)만 대상.
    // 오픈 화면은 자동 개봉이, 결과 화면은 자체 카운트다운이 따로 처리한다.
    const WATCH = ['pin', 'list', 'grid'];
    const t = setInterval(() => {
      if (!WATCH.includes(stepRef.current)) return;
      const idle = (Date.now() - lastTouch.current) / 1000;
      if (idle > (cfg?.idleSeconds ?? DEF.idle)) goAttract();
    }, 1000);
    return () => { window.removeEventListener('pointerdown', bump); clearInterval(t); };
  }, [cfg?.idleSeconds, goAttract]);

  /* ---------- 화면 꺼짐 방지 ---------- */
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<typeof lock> } };
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  /* ---------- 세션 열기 ---------- */
  async function openSession(p?: string) {
    const { data } = await sb().rpc('open_session', { p_token: token, p_pin: p ?? null });
    const r = data as {
      ok: boolean; reason?: string; pass?: string;
      left?: number; minutes?: number; perMin?: number;
    };
    if (!r?.ok) {
      if (r?.reason === 'BAD_PIN') {
        setPinErr(true); setPin('');
        setMsg(r.left ? `PIN이 맞지 않습니다 (남은 시도 ${r.left}회)` : 'PIN이 맞지 않습니다');
        return;
      }
      // PIN을 여러 번 틀렸을 때 — 대입 시도를 막는다
      if (r?.reason === 'LOCKED') {
        setPin('');
        setMsg(`PIN을 여러 번 틀렸습니다. ${r.minutes ?? 10}분 후 다시 시도해주세요`);
        setStep('attract');
        return;
      }
      // 짧은 시간에 너무 많이 뽑혔을 때
      if (r?.reason === 'RATE_LIMIT') {
        setMsg('잠시만 기다려주세요');
        setStep('attract');
        return;
      }
      if (r?.reason === 'BOX_EMPTY') { setMsg('티켓이 모두 소진되었습니다'); return; }
      setMsg('시작할 수 없습니다'); return;
    }
    setMsg(null);
    setPass(r.pass!);
    setPinErr(false);
    setStep('list');
  }

  function start() {
    if (!cfg) return;
    // 전체화면은 사용자 제스처 안에서만 요청할 수 있다
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    }
    if (board && board.left === 0) { setMsg('티켓이 모두 소진되었습니다'); return; }
    if (cfg.mode === 'pin') { setPin(''); setPinErr(false); setStep('pin'); }
    else openSession();
  }

  /* ---------- 뽑기 ----------
     미는 만큼 결과가 드러나야 하므로, 오픈 화면에 들어오는 순간 서버에서 결과를 미리 받아둔다.
     당기는 동작은 연출이고, 티켓은 이미 이 시점에 확정된다.                        */
  const [snap, setSnap] = useState<Prize[]>([]);
  const [pending, setPending] = useState<DrawResult | null>(null);
  const [px, setPx] = useState(0);          // 손잡이 위치(px)
  const [grip, setGrip] = useState(false);  // 손잡이를 잡고 있는 중 = 카드가 떨린다
  const [revealing, setRevealing] = useState(false);
  const [slowOpen, setSlowOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(1);
  const finished = useRef(false);

  const KNOB = 62;
  // 무게감 조절은 이 두 값. 실제 손가락 이동거리 = 카드폭 × (THRESHOLD ÷ DRAG_RATIO)
  //   1.0 / 0.60 → 0.60배 (가벼움)   0.85 / 0.65 → 0.76배 (지금)   0.62 / 0.78 → 1.26배 (너무 무거움)
  const DRAG_RATIO = 0.85;   // 손잡이가 손가락을 따라오는 비율. 낮을수록 무겁다
  const THRESHOLD = 0.65;    // 카드 폭 대비 이만큼 밀면 열린다

  // 오픈 화면 진입 시 결과 선취득
  useEffect(() => {
    if (step !== 'open' || pending || sel === null || !pass) return;
    let alive = true;
    (async () => {
      try {
        const r = await draw(pass, sel);
        if (!alive) return;
        setSnap(board?.prizes ?? []);
        setPending(r);
        setPass(null);
        refresh();
      } catch (e) {
        const m = String((e as { message?: string })?.message ?? e);
        if (m.includes('TICKET_TAKEN')) {
          setMsg('방금 나간 티켓입니다. 다른 자리를 골라주세요');
          setSel(null); refresh(); setStep('grid');
        } else if (m.includes('PASS_')) {
          setMsg('시간이 지났습니다. 다시 시작해주세요'); goAttract();
        } else { setMsg('뽑기에 실패했습니다'); setStep('grid'); }
      }
    })();
    return () => { alive = false; };
  }, [step, pending, sel, pass, board, refresh, goAttract]);

  // 끝까지 열기 — 무겁게 밀려나간 뒤 결과로 넘어간다
  const finish = useCallback((slow = false) => {
    if (finished.current || !pending) return;
    finished.current = true;
    setSlowOpen(slow);
    setGrip(false);
    setRevealing(true);
    setPx(maxX.current);
    setTimeout(() => {
      setResult(pending);
      setStep('result');
    }, slow ? 1400 : 950);
  }, [pending]);

  const resetOpenState = useCallback(() => {
    setPending(null); setPx(0); setRevealing(false); setSlowOpen(false); setGrip(false);
    finished.current = false; dragging.current = false;
  }, []);

  // 초기화면으로 돌아가면 오픈 상태를 비운다
  useEffect(() => { if (step === 'attract') resetOpenState(); }, [step, resetOpenState]);

  /**
   * 고른 티켓이 판에서 튀어나오며 돌아 나온다.
   *
   * 종이 쿠지에서 뽑은 한 장을 집어 드는 동작을 화면으로 옮긴 자리다.
   * 50칸 중 하나를 눌렀을 뿐인데 바로 개봉 화면으로 넘어가면
   * "내가 저걸 골랐다"는 감각이 안 남는다.
   *
   * 칸의 실제 위치에서 화면 가운데까지를 CSS 변수로 넘기고 애니메이션은 CSS 가 한다.
   * (좌표를 자바스크립트로 매 프레임 계산하면 태블릿에서 끊긴다)
   */
  const pullOut = useCallback(() => {
    if (sel === null) return;
    const tile = document.querySelector<HTMLElement>(`.tk2[data-pos="${sel}"]`);
    if (!tile) { resetOpenState(); setMsg(null); setStep('open'); return; }

    const r = tile.getBoundingClientRect();
    const targetW = Math.min(window.innerWidth * 0.72, 460);
    setPull({
      dx: r.left + r.width / 2 - window.innerWidth / 2,
      dy: r.top + r.height / 2 - window.innerHeight / 2,
      s: r.width / targetW,
      w: targetW,
    });
    setMsg(null);
    setTimeout(() => { resetOpenState(); setPull(null); setStep('open'); }, PULL_MS);
  }, [sel, resetOpenState]);

  // 화면이 바뀐 것도 활동으로 친다. 이게 없으면 진입하자마자 유휴 타이머에 걸릴 수 있다
  useEffect(() => { lastTouch.current = Date.now(); }, [step]);

  // 손님이 카드를 열다 말고 가버려도 상품이 사라지지 않게 일정 시간 뒤 자동으로 연다
  useEffect(() => {
    if (step !== 'open' || !pending) return;
    const t = setTimeout(() => finish(true), (cfg?.autoOpenSeconds ?? DEF.autoOpen) * 1000);
    return () => clearTimeout(t);
  }, [step, pending, finish, cfg?.autoOpenSeconds]);

  /* ================= 렌더 ================= */
  if (!cfg) return <div className="bd" style={{ display: 'grid', placeItems: 'center' }}><div className="spin" /></div>;
  if (cfg.error) {
    return (
      <div className="bd" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: 40 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>보드를 찾을 수 없습니다</h2>
          <p style={{ color: 'var(--ink-dim)', marginTop: 8 }}>주소의 토큰을 확인하세요.</p>
        </div>
      </div>
    );
  }

  const left = board?.left ?? 0;
  const total = board?.campaign?.total ?? 0;

  return (
    <div className="bd" onPointerDown={() => { lastTouch.current = Date.now(); }}>
      <div className="bar">
        {/* 오픈 화면에서는 뒤로 가면 이미 확정된 상품을 잃으므로 내보내지 않는다 */}
        {step !== 'attract' && step !== 'open' && (
          <button className="home" onClick={goAttract} aria-label="처음으로"><Icon name="close" /></button>
        )}
        <div className="nm">{cfg.store.name}{cfg.store.branch ? ` · ${cfg.store.branch}` : ''}</div>
        <div className="rt">
          <b>{left}</b><i>/{total}</i>
          <small>남은 티켓</small>
        </div>
      </div>

      {step === 'attract' && (
        <>
          <div
            className="stage"
            onPointerDown={(e) => { swipeX.current = e.clientX; }}
            onPointerUp={(e) => {
              if (swipeX.current === null) return;
              const dx = e.clientX - swipeX.current;
              swipeX.current = null;
              if (slideCount > 1 && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            }}
            onPointerCancel={() => { swipeX.current = null; }}
          >
            {slide === 0 && scenes.length ? (
              <MotionAd scenes={scenes} key="m" />
            ) : slide === 0 || !cfg.ads?.length ? (
              <div className="slide kuji" key="k">
                <div className="eyebrow">꽝 없는 뽑기</div>
                <h1>주문하시면<br /><em>한 장</em> 뽑습니다</h1>
                <p className="lead">모든 티켓에 상품이 들어있습니다.<br />남은 티켓은 아래에서 직접 확인하세요.</p>
                <div className="hero"><b>{left}</b><span>장 남음</span></div>
              </div>
            ) : (
              <AdSlide ad={cfg.ads[slide - 1]} key={`a${slide}`} />
            )}
            {slideCount > 1 && (
              <div className="dots">
                {Array.from({ length: slideCount }, (_, i) => (
                  <i key={i} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} />
                ))}
              </div>
            )}
          </div>

          <div className="foot">
            {/* 잔여 현황을 눌러도 뽑기가 시작된다 */}
            <div className="statuszone" onClick={start} role="button">
              {/* 등급별 잔여 칩은 뺐다. 위 칸(24/50)과 아래 티켓 판이 이미 같은 것을
                  말하고 있어서 셋이 겹쳤다. 등급별 수량은 다음 화면 상품 카드에 있다 */}
              <Mini board={board} pops={pops} />
            </div>
            <button className="touch" onClick={start}>화면을 눌러 뽑기 시작</button>
            {msg && <p style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, marginTop: 10 }}>{msg}</p>}
          </div>
        </>
      )}

      {step === 'pin' && (
        <div className="page">
          <h2 className="ttl">
            직원 확인
            <small>{pinErr ? (msg ?? 'PIN이 맞지 않습니다') : '주문하신 손님만 뽑을 수 있습니다'}</small>
          </h2>
          <div className="pin">
            <div className="pindots">
              {Array.from({ length: 4 }, (_, i) => <i key={i} className={i < pin.length ? 'f' : ''} />)}
            </div>
            <div className="keys">
              {['1','2','3','4','5','6','7','8','9','del','0','ok'].map((k) => (
                <button
                  key={k}
                  aria-label={k === 'del' ? '한 글자 지우기' : k === 'ok' ? '확인' : k}
                  onClick={() => {
                  if (k === 'del') setPin((v) => v.slice(0, -1));
                  else if (k === 'ok') openSession(pin);
                  else if (pin.length < 6) {
                    const next = pin + k;
                    setPin(next);
                    if (next.length === 4) openSession(next);
                  }
                }}>
                  {k === 'del' ? <Icon name="backspace" />
                    : k === 'ok' ? <Icon name="check" strokeWidth={2.6} />
                    : k}
                </button>
              ))}
            </div>
          </div>
          <button className="big ghost" onClick={goAttract}>취소</button>
        </div>
      )}

      {step === 'list' && board && (
        <div className="page">
          <h2 className="ttl">{cfg.title}<small>무엇이 남았는지 확인하세요</small></h2>
          <div className="pgrid">
            {board.prizes.map((p) => (
              <div
                key={p.grade}
                className={`pcard ${p.left === 0 ? 'out' : ''} ${p.image ? 'shot' : 'nopic'}`}
                style={{ ['--gc' as string]: gradeColor(p.grade) }}
              >
                {/* 사진이 카드를 채우고 이름은 아래 띠에만 얹는다.
                    카드를 위아래로 나누면 사진이 남는 높이만큼 눌려 작아진다. */}
                {p.image
                  ? <img className={`pshot ${isFlat(p.image) ? 'flat' : ''}`} src={p.image} alt="" />
                  : <span className="pbig">{p.grade}</span>}
                <span className="pgrade">{p.grade}</span>
                <div className="pbar">
                  <b>{p.name}</b>
                  <span>{p.left === 0 ? '소진' : `${p.left}개`}</span>
                </div>
              </div>
            ))}

            {cfg.lastOneName && (
              <div className={`pcard last ${cfg.lastOneImage ? 'shot' : 'nopic'}`}>
                {cfg.lastOneImage
                  ? <img className={`pshot ${isFlat(cfg.lastOneImage) ? 'flat' : ''}`} src={cfg.lastOneImage} alt="" />
                  : <span className="pbig"><Icon name="star" /></span>}
                <span className="pgrade wide">{cfg.lastOneLabel ?? '마지막 보상'}</span>
                <div className="pbar">
                  <b>{cfg.lastOneName}</b>
                  <span>1개</span>
                </div>
              </div>
            )}
          </div>
          <button className="big" onClick={() => setStep('grid')}>티켓 고르기</button>
        </div>
      )}

      {step === 'grid' && board && (
        <div className="page">
          <h2 className="ttl">티켓을 고르세요<small>검은 칸은 이미 나간 티켓입니다. 세어보면 남은 구성을 알 수 있습니다.</small></h2>
          <div className="tgrid">
            {board.board.map((s) => s.grade ? (
              <div key={s.pos} className="tk2 used">
                <Ticket variant="tile" used accent={gradeColor(s.grade)} className="art" />
                <span style={{ color: gradeColor(s.grade) }}>{s.grade}</span>
              </div>
            ) : (
              <div key={s.pos} data-pos={s.pos} className={`tk2 ${sel === s.pos ? 'sel' : ''}`}
                   onClick={() => setSel(sel === s.pos ? null : s.pos)}>
                <Ticket variant="tile" className="art" />
                <span>{s.pos}</span>
              </div>
            ))}
          </div>
          <div className="rowbtn">
            <button className="big ghost" style={{ flex: 1 }} onClick={() => {
              const open = board.board.filter((s) => !s.grade);
              if (open.length) setSel(open[Math.floor(Math.random() * open.length)].pos);
            }}>랜덤</button>
            <button className="big" style={{ flex: 2 }} disabled={sel === null || !!pull}
                    onClick={pullOut}>이 티켓으로 뽑기</button>
          </div>
          {msg && <p style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, marginTop: 10 }}>{msg}</p>}

          {/* 고른 티켓이 판에서 돌면서 튀어나온다 */}
          {pull && (
            <div className="pullwrap" aria-hidden="true">
              <div className="pullflash" />
              <div
                className="pullcard"
                style={{
                  ['--dx' as string]: `${pull.dx}px`,
                  ['--dy' as string]: `${pull.dy}px`,
                  ['--s' as string]: pull.s,
                  ['--w' as string]: `${pull.w}px`,
                }}
              >
                <Ticket variant="tile" className="art" />
                <span>{sel}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'open' && (
        <div className="page">
          <h2 className="ttl">
            {sel}번 티켓
            <small>{revealing ? '열리는 중…' : '금색 손잡이를 천천히 오른쪽으로 미세요'}</small>
          </h2>
          <div className={`openstage ${revealing ? 'firing' : ''}`}>
            {/* 배경 반짝임 */}
            <div className="twinkles">
              {TWINKLES.map((t, i) => (
                <i key={i} style={{
                  left: t.left, top: t.top, width: t.s, height: t.s,
                  animationDuration: t.dur, animationDelay: t.delay,
                }} />
              ))}
            </div>
            <div
              className={`peel ${revealing ? 'go' : ''} ${slowOpen ? 'slow' : ''} ${grip ? 'grip' : ''}`}
              ref={cardRef}
              style={{
                ['--px' as string]: `${px}px`,
                // 많이 밀수록 크게 떨린다
                ['--sh' as string]: Math.min(6, (px / (maxX.current || 1)) * 7).toFixed(2),
              }}
            >
              {/* 아래층 — 미는 만큼 드러난다 */}
              <div className="under">
                {pending ? (
                  <>
                    <div className="ug" style={{ background: gradeColor(pending.grade) }}>
                      {pending.image ? <img src={pending.image} alt="" /> : pending.grade}
                    </div>
                    <div className="un">{pending.name}</div>
                  </>
                ) : <div className="spin" />}
              </div>

              {/* 위층 — 티켓 표면 */}
              <div className="cover">
                <Ticket variant="full" className="art" />
                {/* 미는 방향 안내 화살표 */}
                <div className="guide"><span>›</span><span>›</span><span>›</span></div>
                <div className="lbl">
                  <b>{cfg.store.name}</b>
                  <span>{cfg.title}</span>
                </div>
              </div>

              <div
                className="knob"
                onPointerDown={(e) => {
                  if (!pending || finished.current) return;
                  dragging.current = true;
                  setGrip(true);
                  startX.current = e.clientX - px;
                  maxX.current = (cardRef.current?.clientWidth ?? 400) - KNOB - 20;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  const raw = (e.clientX - startX.current) * DRAG_RATIO;
                  const v = Math.max(0, Math.min(maxX.current, raw));
                  setPx(v);
                  if (v > maxX.current * THRESHOLD) { dragging.current = false; finish(false); }
                }}
                onPointerUp={() => {
                  if (!dragging.current) return;
                  dragging.current = false;
                  setGrip(false);
                  if (!finished.current) { setRevealing(false); setPx(0); }
                }}
              >›</div>

              {/* 찢기는 자리에서 튀는 빛 + 불티 */}
              <div className="tear">
                <div className="beam" />
                {TEAR_SPARKS.map((s, i) => (
                  <i key={i} style={{
                    top: s.top, width: s.s, height: s.s,
                    ['--dx' as string]: `${s.dx}px`,
                    ['--dy' as string]: `${s.dy}px`,
                    animationDuration: s.dur, animationDelay: s.delay,
                  }} />
                ))}
              </div>
            </div>

            {/* 이 시점엔 티켓이 이미 확정돼 있다. 되돌아가면 상품을 잃으므로 여는 길만 남긴다 */}
            <div className="rowbtn" style={{ width: '100%', maxWidth: 460 }}>
              <button className="big ghost" style={{ flex: 1 }} disabled={!pending || revealing}
                      onClick={() => finish(false)}>바로 열기</button>
              <button className="big" style={{ flex: 1 }} disabled={!pending || revealing}
                      onClick={() => finish(true)}>천천히 열기</button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <ResultView r={result} campaignId={cfg.campaignId} prizes={snap}
                    lastOneImage={cfg.lastOneImage}
                    lastOneLabel={cfg.lastOneLabel ?? '마지막 보상'}
                    seconds={cfg.resultSeconds ?? DEF.result} onDone={goAttract} />
      )}
    </div>
  );
}

/* ================= 광고 슬라이드 ================= */
function AdSlide({ ad }: { ad: Ad }) {
  // 사진이 있으면 화면을 꽉 채우고 글자를 위에 얹는다. 없으면 글자만.
  if (!ad.image) {
    return (
      <div className="slide ad">
        <div className="kind">오늘의 메뉴</div>
        <h1>{ad.title}</h1>
        {ad.sub && <p className="sub">{ad.sub}</p>}
        {ad.price && <div className="price">{ad.price}</div>}
      </div>
    );
  }
  return (
    <div className="slide ad full" data-pos={ad.pos ?? 'bottom'}>
      {/* 뒤에는 흐리게 채우고 위에는 원본을 통째로 얹는다 — 어떤 비율이든 안 잘린다 */}
      <div className="shot">
        <img className="blur" src={ad.image} alt="" aria-hidden="true" />
        <img className="main" src={ad.image} alt="" />
      </div>
      <div className="cap">
        <div className="kind">오늘의 메뉴</div>
        <h1>{ad.title}</h1>
        {ad.sub && <p className="sub">{ad.sub}</p>}
        {ad.price && <div className="price">{ad.price}</div>}
      </div>
    </div>
  );
}

/* ================= 미니 그리드 ================= */
function Mini({ board, pops }: { board: Board | null; pops: number[] }) {
  if (!board) return null;
  return (
    <div className="mini">
      {board.board.map((s) => (
        <i key={s.pos} className={`${s.grade ? 'u' : ''} ${pops.includes(s.pos) ? 'pop' : ''}`}>
          <Ticket variant="tile" used={!!s.grade}
                  accent={s.grade ? gradeColor(s.grade) : undefined} className="art" />
          <b style={s.grade ? { color: gradeColor(s.grade) } : undefined}>{s.grade ?? ''}</b>
        </i>
      ))}
    </div>
  );
}

/* ================= 결과 ================= */
function ResultView({
  r, campaignId, prizes, seconds, lastOneImage, lastOneLabel, onDone,
}: {
  r: DrawResult; campaignId: string; prizes: Prize[]; seconds: number;
  lastOneImage: string | null; lastOneLabel: string; onDone: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [sec, setSec] = useState(seconds);

  useEffect(() => {
    if (r.useWhen !== 'later') return;
    const raw = r.code.replace('-', '');
    const q = qrcode(0, 'M');
    q.addData(`${location.origin}/c/${campaignId}/${raw}`);
    q.make();
    setQr(q.createDataURL(5, 2));
  }, [r, campaignId]);

  // 상태 갱신 함수 안에서 부모를 건드리면 렌더 도중 setState가 되어버린다. 분리한다.
  useEffect(() => {
    const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (sec === 0) onDone(); }, [sec, onDone]);

  const heavy = r.isLastOne || ['A', 'B'].includes(r.grade);
  const COLORS_C = ['var(--gold)', 'var(--accent)', 'var(--gb)', 'var(--gd)', '#fff'];

  // 끊기지 않는 색종이 비 — 각자 다른 지연/속도로 무한 반복
  const [sparks] = useState(() =>
    Array.from({ length: heavy ? 90 : 45 }, (_, i) => {
      const dur = 2.2 + Math.random() * 2.4;
      return {
        left: `${Math.random() * 100}%`,
        bg: COLORS_C[i % COLORS_C.length],
        w: 6 + Math.round(Math.random() * 6),
        h: 8 + Math.round(Math.random() * 10),
        dur: `${dur}s`,
        delay: `-${Math.random() * dur}s`,   // 음수 지연 = 처음부터 화면 가득
        round: Math.random() < 0.35,
      };
    }));

  // 주기적으로 터지는 폭죽
  type Burst = { id: number; x: number; y: number; parts: { tx: number; ty: number; bg: string }[] };
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    let id = 0;
    const fire = () => {
      const n = heavy ? 22 : 14;
      const b: Burst = {
        id: id++,
        x: 12 + Math.random() * 76,
        y: 14 + Math.random() * 46,
        parts: Array.from({ length: n }, (_, i) => {
          const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
          const d = 70 + Math.random() * 90;
          return {
            tx: Math.cos(a) * d,
            ty: Math.sin(a) * d + 30,   // 살짝 아래로 떨어지게
            bg: COLORS_C[i % COLORS_C.length],
          };
        }),
      };
      setBursts((v) => [...v, b]);
      setTimeout(() => setBursts((v) => v.filter((x) => x.id !== b.id)), 1100);
    };
    fire();
    const t = setInterval(fire, heavy ? 700 : 1100);
    return () => clearInterval(t);
  }, [heavy]);

  return (
    <div className="page">
      <div className="res">
        <div className="spark rain">
          {sparks.map((s, i) => (
            <i
              key={i}
              className={s.round ? 'r' : ''}
              style={{
                left: s.left, background: s.bg,
                width: s.w, height: s.h,
                animationDuration: s.dur, animationDelay: s.delay,
              }}
            />
          ))}
        </div>

        {bursts.map((b) => (
          <div className="burst" key={b.id} style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            {b.parts.map((p, i) => (
              <i key={i} style={{
                background: p.bg,
                ['--tx' as string]: `${p.tx}px`,
                ['--ty' as string]: `${p.ty}px`,
              }} />
            ))}
          </div>
        ))}

        <div className="congratsbar">
          {r.isLastOne && <span className="lastbadge">{lastOneLabel}</span>}
          축하합니다!
        </div>

        {/* 막차 보너스가 나오면 그쪽이 주인공. 등급 상품은 아래에 함께 표시한다 */}
        {r.isLastOne && r.lastOneName ? (
          <>
            <div className="shotbox gold">
              {lastOneImage
                ? <img src={lastOneImage} alt="" />
                : <div className="noimg"><Icon name="star" /></div>}
            </div>
            <div className="gtag gold">{lastOneLabel}</div>
            <h1>{r.lastOneName}</h1>

            <div className="alsobar">
              <div className="thumb" style={{ background: gradeColor(r.grade) }}>
                {r.image ? <img src={r.image} alt="" /> : r.grade}
              </div>
              <div className="tx">
                <div className="k">함께 지급됩니다</div>
                <div className="v">
                  <b style={{ color: gradeColor(r.grade) }}>{r.grade}상</b> {r.name}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="shotbox" style={{ ['--gc' as string]: gradeColor(r.grade) }}>
              {r.image
                ? <img src={r.image} alt="" />
                : <div className="noimg">{r.grade}</div>}
            </div>
            <div className="gtag" style={{ background: gradeColor(r.grade) }}>{r.grade}상</div>
            <h1>{r.name}</h1>
          </>
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

        <div className="gchips" style={{ justifyContent: 'center', marginTop: 10 }}>
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
