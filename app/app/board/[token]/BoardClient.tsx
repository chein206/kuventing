'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sb, getBoard, draw, type Board, type DrawResult, type Prize } from '@/lib/supabase';
import Ticket from './Ticket';
import ResultView from './ResultView';
import { gradeColor, isFlat } from './grade';
import { Icon } from '@/lib/Icon';
import MotionAd, { buildScenes, scenesDuration, normPos } from './MotionAd';
import * as sfx from '@/lib/sfx';
import { fontOf, loadFont } from '@/lib/fonts';
import { themeOf, type Art } from '@/lib/boardArt';

type Ad = {
  title: string; sub?: string; price?: string; image?: string | null;
  pos?: string | null;   // 자막 위치(tl/tr/ml/mr/bl/br). 사진마다 접시 자리가 다르다
};
type Config = {
  campaignId: string; title: string; status: string; theme: string;
  mode: 'pin' | 'open'; ads: Ad[];
  idleSeconds: number;       // 무동작 시 초기화면 복귀
  slideSeconds: number;      // 광고 슬라이드 넘김
  resultSeconds: number;     // 결과 화면 유지
  autoOpenSeconds: number;   // 오픈 화면 방치 시 자동 개봉
  sound?: sfx.SoundMode;     // 뽑기 소리. 기본은 꺼둔다 (카운터 소음 환경)
  motionSeconds?: number;    // 모션 광고 컷 하나의 길이
  font?: string;             // 화면 글꼴. 기본은 내려받지 않는다
  lastOneName: string | null;
  lastOneImage: string | null;
  lastOneLabel: string | null;   // "라스트원상"은 특정 브랜드 용어라 쓰지 않는다
  store: { name: string; branch: string | null; logo: string | null };
  error?: string;
};

// DB 값이 없을 때(마이그레이션 전) 쓰는 기본값
const DEF = { idle: 20, slide: 6, result: 40, autoOpen: 45, motion: 6 };

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

/**
 * 찢는 자리에서 튀는 불티 — 그라인더로 철을 자를 때 나는 그것.
 *
 * 앞서 쓰던 "오른쪽으로 직진하는 굵은 알 18개"는 튀는 느낌만 있고 불꽃이 아니었다.
 * 그라인더 불꽃의 특징은 넷이다.
 *   1. 많고 잘다        — 굵은 알 몇 개가 아니라 잔 불티가 쏟아진다
 *   2. 원뿔로 퍼진다     — 자르는 방향의 반대(왼쪽)로, 뒤·아래로 부챗살처럼
 *   3. 중력으로 휜다     — 직선이 아니라 포물선. 끝에서 아래로 처진다
 *   4. 흰 코어 → 주황    — 갓 튄 것은 흰빛, 식으면서 주황·빨강으로 죽는다
 * 길쭉한 막대로 그려 잔상(궤적)을 만든다. 동그란 점은 눈이 불꽃으로 안 읽는다.
 */
const TEAR_SPARKS = Array.from({ length: 46 }, (_, i) => {
  // -1..1 로 퍼지는 부챗살. 가운데가 촘촘하도록 세제곱
  const spread = ((i % 13) / 6 - 1) ** 3;
  const speed = 30 + ((i * 17) % 62);          // 멀리 가는 것과 금방 죽는 것을 섞는다
  return {
    top: `${((i * 37) % 100)}%`,
    len: 5 + ((i * 7) % 9),                    // 막대 길이 = 잔상
    thick: 1.5 + ((i * 3) % 3) * 0.6,
    dx: -(speed * 0.5) - 8,                    // 자르는 방향의 반대로
    dy: spread * 46 + 16,                      // 부챗살 + 아래로 처짐
    fall: 26 + ((i * 11) % 30),                // 끝에서 더 떨어지는 양(중력)
    rot: spread * 34,
    dur: `${0.34 + ((i * 13) % 9) * 0.05}s`,
    delay: `-${((i * 19) % 23) * 0.045}s`,
    hot: i % 4 === 0,                          // 넷 중 하나는 더 밝고 크게
  };
});

type Step = 'attract' | 'pin' | 'list' | 'grid' | 'open' | 'result';

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
      document.documentElement.dataset.theme = themeOf(c.theme).key;
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
      cfg?.motionSeconds ?? DEF.motion,
    ),
    [cfg?.ads, cfg?.store.name, cfg?.store.branch, board?.left, board?.campaign?.total,
     cfg?.motionSeconds],
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

  // 사장님이 소리 설정을 바꾸면 볼륨을 따라간다
  useEffect(() => { sfx.setMode(cfg?.sound ?? 'off'); }, [cfg?.sound]);

  // 고른 글꼴만 내려받는다. 기본값은 받지 않으므로 첫 화면이 늦어지지 않는다
  useEffect(() => { loadFont(cfg?.font); }, [cfg?.font]);

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

  // 결과 화면 3D 는 뽑기 흐름에 들어온 뒤에만 받는다 — 대기 화면은 광고가 먼저 떠야 한다.
  // 상품 목록 · 티켓 고르기 동안 렌더러를 만들고 셰이더를 미리 굽고(warm), 개봉 화면에서는 상품 사진을 받아 둔다
  useEffect(() => {
    if (step !== 'list' && step !== 'grid' && step !== 'open') return;
    import('./fx3d/result3d')
      .then((m) => {
        m.getStage()?.warm();
        if (step === 'open' && pending) m.preload(pending.isLastOne ? cfg?.lastOneImage ?? null : pending.image);
      })
      .catch(() => {});
  }, [step, pending, cfg?.lastOneImage]);

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
    sfx.grindStop();
    sfx.snap();
    setTimeout(() => {
      setResult(pending);
      setStep('result');
      sfx.fanfare(pending.grade, !!pending.isLastOne);
    }, slow ? 1400 : 950);
  }, [pending]);

  const resetOpenState = useCallback(() => {
    sfx.grindStop();
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
  // 티켓 아트는 테마가 정한다 — 판 밝기가 종이색을, 문양이 무늬와 도장을 고른다
  const art = themeOf(cfg.theme).art;

  return (
    <div
      className="bd"
      style={{
        fontFamily: fontOf(cfg.font).stack,
        // 사진 원판은 2:1 이 아니다(활판 1.877 · 황동 1.891). 칸 비율을 테마가 정한다
        ['--tk-ratio' as string]: String(art.photo?.ratio ?? 2),
        // 판 표면 — 사진 판은 참나무 판 위에 표를 늘어놓는다
        ['--surface' as string]: art.photo ? `url(${art.photo.surface})` : 'none',
      }}
      onPointerDown={() => {
        lastTouch.current = Date.now();
        // 브라우저는 사용자가 만지기 전에는 소리를 못 내게 막는다. 여기서만 깨울 수 있다
        sfx.unlock(cfg.sound ?? 'off');
      }}
    >
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
              <div className="railhead">
                <span>남은 티켓</span><i /><em>{left} / {total}</em>
              </div>
              <Mini board={board} art={art} pops={pops} />
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
                {/* 막차 보너스에만 붙는 황동 검인 — 등급 상품과 한눈에 갈린다 */}
                <img className="pseal" src="/art/seal-last.svg" alt="" />
                <div className="pbar">
                  <b>{cfg.lastOneName}</b>
                  <span>1개</span>
                </div>
              </div>
            )}
          </div>
          <button className="big cd" onClick={() => setStep('grid')}>
            티켓 고르기
            <Cooldown seconds={cfg.idleSeconds ?? DEF.idle} lastTouch={lastTouch} />
          </button>
        </div>
      )}

      {step === 'grid' && board && (
        <div className="page">
          <h2 className="ttl">티켓을 선택하세요<small>구멍이 뚫린 칸은 이미 나간 티켓입니다</small></h2>
          <div className="tgrid">
            {board.board.map((s) => s.grade ? (
              <div key={s.pos} className="tk2 used">
                <Ticket art={art} size="tile" used num={s.grade} gradeColor={gradeColor(s.grade)} />
              </div>
            ) : (
              <div key={s.pos} data-pos={s.pos} className={`tk2 ${sel === s.pos ? 'sel' : ''}`}
                   onClick={() => setSel(sel === s.pos ? null : s.pos)}>
                <Ticket art={art} size="tile" num={String(s.pos)} sel={sel === s.pos} />
              </div>
            ))}
          </div>
          <div className="rowbtn">
            <button className="big ghost" style={{ flex: 1 }} onClick={() => {
              const open = board.board.filter((s) => !s.grade);
              if (open.length) setSel(open[Math.floor(Math.random() * open.length)].pos);
            }}>랜덤</button>
            <button className="big cd" style={{ flex: 2 }} disabled={sel === null || !!pull}
                    onClick={pullOut}>
              이 티켓으로 뽑기
              <Cooldown seconds={cfg.idleSeconds ?? DEF.idle} lastTouch={lastTouch} />
            </button>
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
                <Ticket art={art} size="tile" num={sel ? String(sel) : ''} />
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'open' && (
        <div className="page">
          <h2 className="ttl">
            {sel}번 티켓
            <small>{revealing ? '열리는 중…' : '황동 손잡이를 천천히 오른쪽으로 미세요'}</small>
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
              className={`peel ${art.photo ? 'photo' : ''} ${revealing ? 'go' : ''} ${slowOpen ? 'slow' : ''} ${grip ? 'grip' : ''}`}
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
                    <div className={`ug ${pending.image && isFlat(pending.image) ? 'flat' : ''}`}
                         style={{ background: gradeColor(pending.grade) }}>
                      {pending.image ? <img src={pending.image} alt="" /> : pending.grade}
                    </div>
                    <div className="un">{pending.name}</div>
                  </>
                ) : <div className="spin" />}
              </div>

              {/* 위층 — 티켓 표면 */}
              <div className="cover">
                <Ticket art={art} size="big"
                        num={art.photo && sel ? String(sel) : ''}
                        sub={art.photo ? cfg.title : undefined} />
                {/* 미는 방향 안내 화살표 */}
                <div className="guide"><span>›</span><span>›</span><span>›</span></div>
                {/* 표면 조판 — 손잡이가 지나가는 왼쪽과 스텁은 비운다.
                    글자색은 종이 잉크를 따른다. 종이가 크라프트지라 흰 글자는 안 읽힌다 */}
                {!art.photo && <div className="lbl" style={{ color: art.numc }}>
                  <span className="ev">{cfg.title}</span>
                  <b>{cfg.store.name}</b>
                  <span className="no" style={{ fontFamily: art.numFont }}>NO. {sel}</span>
                </div>}
                {/* 손잡이가 미끄러지는 홈 */}
                <div className="slot" />
                {/* 사진 판은 천공선이 실제로 뚫려 있다 — 그 자리에서 빛이 샌다 */}
                {art.photo && (
                  <div className="perfbeam" style={{ left: `${art.photo.perf * 100}%` }} />
                )}
              </div>

              <div
                className="knob"
                onPointerDown={(e) => {
                  if (!pending || finished.current) return;
                  dragging.current = true;
                  setGrip(true);
                  sfx.grindStart();
                  startX.current = e.clientX - px;
                  maxX.current = (cardRef.current?.clientWidth ?? 400) - KNOB - 20;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  const raw = (e.clientX - startX.current) * DRAG_RATIO;
                  const v = Math.max(0, Math.min(maxX.current, raw));
                  setPx(v);
                  sfx.grindSet(v / Math.max(1, maxX.current));
                  if (v > maxX.current * THRESHOLD) { dragging.current = false; finish(false); }
                }}
                onPointerUp={() => {
                  if (!dragging.current) return;
                  dragging.current = false;
                  setGrip(false);
                  sfx.grindStop();
                  if (!finished.current) { setRevealing(false); setPx(0); }
                }}
              >
                {/* 빗살 홈 — 손가락이 걸리는 자리. 동그란 금색 알은 "게임 버튼"으로
                    읽혀서, 실제로 쥐고 미는 물건의 모양으로 바꿨다 */}
                {art.photo
                  ? <img className="lever" src={art.photo.leverSrc} alt="" draggable={false} />
                  : <><i className="comb" /><span>❯</span></>}
              </div>

              {/* 찢기는 자리에서 새는 빛 + 그라인더 불꽃 */}
              <div className="tear">
                <div className="beam" />
                <div className="core" />
                {TEAR_SPARKS.map((s, i) => (
                  <i key={i} className={s.hot ? 'hot' : ''} style={{
                    top: s.top, width: s.len, height: s.thick,
                    ['--dx' as string]: `${s.dx}px`,
                    ['--dy' as string]: `${s.dy}px`,
                    ['--fall' as string]: `${s.fall}px`,
                    ['--rot' as string]: `${s.rot}deg`,
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
        <ResultView r={result} art={art} dark={themeOf(cfg.theme).dark}
                    campaignId={cfg.campaignId} prizes={snap}
                    lastOneImage={cfg.lastOneImage}
                    lastOneLabel={cfg.lastOneLabel ?? '마지막 보상'}
                    store={cfg.store.name + (cfg.store.branch ? ` · ${cfg.store.branch}` : '')}
                    title={cfg.title}
                    seconds={cfg.resultSeconds ?? DEF.result} onDone={goAttract} />
      )}
    </div>
  );
}

/* ================= 남은 시간 표시 ================= */

/**
 * 버튼 안에서 줄어드는 띠 + 남은 초.
 *
 * 손을 놓으면 초기화면으로 돌아간다는 걸 손님이 모르면 갑자기 화면이 바뀐 것처럼 느낀다.
 * 남은 시간을 버튼에 얹어 두면 "아직 시간이 있다"와 "곧 넘어간다"가 같이 읽힌다.
 *
 * 이 컴포넌트만 초당 다시 그린다. 부모(티켓 50칸이 있는 화면)를 다시 그리면
 * 태블릿에서 눈에 보이게 버벅인다.
 */
function Cooldown({ seconds, lastTouch }: { seconds: number; lastTouch: React.RefObject<number> }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = () => {
      const used = (Date.now() - (lastTouch.current ?? Date.now())) / 1000;
      setLeft(Math.max(0, seconds - used));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [seconds, lastTouch]);

  const pct = Math.max(0, Math.min(100, (left / seconds) * 100));
  return (
    <>
      <i className="cdbar" style={{ width: `${pct}%` }} aria-hidden="true" />
      <em className="cdnum">{Math.ceil(left)}</em>
    </>
  );
}

/* ================= 광고 슬라이드 ================= */
function AdSlide({ ad }: { ad: Ad }) {
  // 사진이 있으면 화면을 꽉 채우고 글자를 위에 얹는다. 없으면 글자만.
  if (!ad.image) {
    return (
      <div className="slide promo">
        <div className="kind">오늘의 메뉴</div>
        <h1>{ad.title}</h1>
        {ad.sub && <p className="sub">{ad.sub}</p>}
        {ad.price && <div className="price">{ad.price}</div>}
      </div>
    );
  }
  return (
    <div className="slide promo full" data-pos={normPos(ad.pos)}>
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
function Mini({ board, art, pops }: { board: Board | null; art: Art; pops: number[] }) {
  if (!board) return null;
  return (
    <div className="mini">
      {board.board.map((s) => (
        <i key={s.pos} className={`${s.grade ? 'u' : ''} ${pops.includes(s.pos) ? 'pop' : ''}`}>
          <Ticket art={art} size="mini" used={!!s.grade}
                  num={s.grade ?? ''} gradeColor={s.grade ? gradeColor(s.grade) : null} />
        </i>
      ))}
    </div>
  );
}
