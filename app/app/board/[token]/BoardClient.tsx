'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sb, getBoard, draw, type Board, type DrawResult, type Prize } from '@/lib/supabase';
import Ticket from './Ticket';
import ResultView from './ResultView';
import OpenView from './OpenView';
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
  /** 뽑는 조건 — "주문"하시면 · "시승"하시면 · "체험"하시면. 027 전에는 없다 → 주문 */
  drawVerb?: string | null;
  store: { name: string; branch: string | null; logo: string | null };
  error?: string;
};

// DB 값이 없을 때(마이그레이션 전) 쓰는 기본값
const DEF = { idle: 20, slide: 6, result: 40, autoOpen: 45, motion: 6 };

// 티켓이 돌아 나오는 시간. board.css 의 pullOut 과 같이 움직인다
const PULL_MS = 1150;

type Step = 'attract' | 'pin' | 'list' | 'grid' | 'open' | 'result';

/** 표에 찍히는 매장 이름 — 돌아 나오는 카드와 개봉 화면 3D 표가 같은 글자를 써야 같은 겉면 그림을 나눠 쓴다 */
const storeOf = (c: Config) => c.store.name + (c.store.branch ? ` · ${c.store.branch}` : '');

/** 새 버전 반영 — 묻는 간격 · 손님 없음으로 칠 무동작 · 배포 뒤 기다림 · 실패 뒤 쉼 */
const UPD = { poll: 5 * 60_000, idle: 60_000, grace: 10 * 60_000, retry: 30 * 60_000 };

export default function BoardClient({ token, build }: { token: string; build: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [step, setStep] = useState<Step>('attract');
  const [pass, setPass] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  // 뽑은 티켓이 돌아 나오는 연출 (칸 위치 → 화면 가운데)
  // from — 카드가 멈추는 자리(개봉 화면 3D 표가 여기서 시작) · face — 3D 표와 같은 겉면 · fd — 겉면이 올라오는 늦춤(ms)
  // out — 3D 표가 떠서 겹쳐 걷히는 중
  const [pull, setPull] = useState<{
    dx: number; dy: number; s: number; w: number; no: number;
    from: { x: number; y: number; w: number };
    face: HTMLCanvasElement | null; fd: number; out: boolean;
  } | null>(null);
  const pullTok = useRef(0);
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
      cfg?.drawVerb || '주문',
    ),
    [cfg?.ads, cfg?.store.name, cfg?.store.branch, board?.left, board?.campaign?.total,
     cfg?.motionSeconds, cfg?.drawVerb],
  );

  const slideCount = 1 + (cfg?.ads?.length ?? 0);

  /* ---------- 새 버전 — 손님이 없을 때 한 번 새로고침 ----------
     보드는 한 페이지 안에서 화면만 바뀐다. 새로고침하기 전까지 새로 배포한 게 안 들어간다.
     5분마다 "지금 배포 번호"만 묻는다(화면은 그대로). 다르면 표시만 해 두고, 아래가 다 맞을 때만 바꾼다.
     - 대기(광고) 화면 — 여기로 올 때 손님 상태(PIN · 뽑기권 · 고른 칸 · 결과)는 이미 다 지웠다
     - 마지막 터치 후 60초 — 광고를 보다 다가온 손님 손 밑에서 바뀌지 않게
     - 새 버전을 알고 10분 뒤 — 잘못 배포해도 그 안에 되돌리면 매장까지 안 간다
     - 새 보드 페이지가 정상으로 열린다
     그리고 광고 슬라이드가 넘어가는 순간에 바꾼다. 원래 화면이 바뀌는 때라 덜 튄다. */
  const upd = useRef<{ v: string; seen: number; ok: boolean; checking: boolean; failAt: number } | null>(null);

  const tryReload = useCallback(() => {
    const u = upd.current;
    if (!u?.ok || stepRef.current !== 'attract' || Date.now() - lastTouch.current < UPD.idle) return false;
    // 방금 같은 버전으로 새로고침했는데 또 다르다고 나오면(캐시 등) 30분은 다시 안 한다 — 끝없이 돌지 않게
    try {
      const last = JSON.parse(sessionStorage.getItem('kuvt-reload') ?? 'null') as { v: string; at: number } | null;
      if (last?.v === u.v && Date.now() - last.at < UPD.retry) { u.ok = false; u.failAt = Date.now(); return false; }
      sessionStorage.setItem('kuvt-reload', JSON.stringify({ v: u.v, at: Date.now() }));
    } catch { /* 저장소를 못 쓰는 기기 — 그냥 바꾼다 */ }
    location.reload();
    return true;
  }, []);

  useEffect(() => {
    const ask = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { v } = (await r.json()) as { v?: string };
        if (!v) return;
        // 되돌리기로 내 번호가 다시 최신이 됐으면 기다리던 것도 거둔다
        if (v === build) { upd.current = null; return; }
        if (upd.current?.v !== v) upd.current = { v, seen: Date.now(), ok: false, checking: false, failAt: 0 };
      } catch { /* 오프라인 — 다음에 다시 묻는다 */ }
    };
    ask();
    const poll = setInterval(ask, UPD.poll);
    const vis = () => { if (document.visibilityState === 'visible') ask(); };
    document.addEventListener('visibilitychange', vis);
    // 5초마다 — 바꿀 때가 됐나. 새 페이지가 정상으로 열리는지 먼저 본다(고장 난 배포로 매장 화면을 넘기지 않게)
    const tick = setInterval(() => {
      const u = upd.current, now = Date.now();
      if (!u || u.checking) return;
      if (u.ok) { if (slideCount <= 1) tryReload(); return; }   // 넘길 광고가 없으면 기다리지 않는다
      if (stepRef.current !== 'attract' || now - lastTouch.current < UPD.idle) return;
      if (now - u.seen < UPD.grace || now - u.failAt < UPD.retry) return;
      u.checking = true;
      fetch(location.pathname, { cache: 'no-store' })
        .then((r) => { u.ok = r.ok; if (!r.ok) u.failAt = Date.now(); })
        .catch(() => { u.failAt = Date.now(); })
        .finally(() => { u.checking = false; });
    }, 5000);
    return () => { clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', vis); };
  }, [build, tryReload, slideCount]);

  useEffect(() => {
    if (step !== 'attract' || slideCount <= 1) return;
    // 모션 광고는 씬 길이의 합만큼 머문다. 중간에 잘리면 사인 컷을 못 본다
    const ms = slide === 0 && scenes.length
      ? scenesDuration(scenes) * 1000
      : (cfg?.slideSeconds ?? DEF.slide) * 1000;
    // 새 버전이 기다리고 있으면 넘기는 대신 바꾼다
    const t = setTimeout(() => { if (!tryReload()) setSlide((s) => (s + 1) % slideCount); }, ms);
    return () => clearTimeout(t);
    // slide 가 바뀔 때마다 타이머를 다시 건다 = 손으로 넘기면 대기시간도 초기화된다
  }, [step, slideCount, cfg?.slideSeconds, slide, scenes, tryReload]);

  // 손으로 넘기기
  const swipeX = useRef<number | null>(null);
  const go = (d: number) => setSlide((s) => (s + d + slideCount) % slideCount);

  /* ---------- 유휴 복귀 ---------- */
  const goAttract = useCallback(() => {
    pullTok.current++; setPull(null);
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

  /* ---------- 화면 꺼짐 방지 ----------
     화면이 꺼졌다 켜지거나 다른 앱에 다녀오면 브라우저가 잠금을 풀어 버린다 — 다시 보일 때마다 다시 건다 */
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<typeof lock> } };
    const grab = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => { document.removeEventListener('visibilitychange', grab); lock?.release().catch(() => {}); };
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
    if (board && board.left === 0) { setMsg('티켓이 모두 소진되었습니다'); return; }
    if (cfg.mode === 'pin') { setPin(''); setPinErr(false); setStep('pin'); }
    else openSession();
  }

  /* ---------- 뽑기 ----------
     미는 만큼 결과가 드러나야 하므로, 오픈 화면에 들어오는 순간 서버에서 결과를 미리 받아둔다.
     당기는 동작은 연출이고, 티켓은 이미 이 시점에 확정된다.                        */
  const [snap, setSnap] = useState<Prize[]>([]);
  const [pending, setPending] = useState<DrawResult | null>(null);
  // 결과 화면 3D 는 뽑기 흐름에 들어온 뒤에만 받는다 — 대기 화면은 광고가 먼저 떠야 한다.
  // 상품 목록 · 티켓 고르기 동안 렌더러를 만들고 셰이더를 미리 굽고(warm), 개봉 화면에서는 상품 사진을 받아 둔다
  useEffect(() => {
    if (step !== 'list' && step !== 'grid' && step !== 'open') return;
    import('./fx3d/open3d').then((m) => {
      m.getOpen()?.warm();
      // 결과가 올 때 그리면 개봉 화면 첫머리가 멈칫한다 — 쪽지 바탕 · 등급별 양각을 고르는 동안 미리
      if (cfg && board) {
        m.primeSlips(themeOf(cfg.theme).art.photo?.ratio ?? 2, board.prizes.map((p) => p.grade),
          { store: storeOf(cfg), title: cfg.title, no: 0 });
      }
    }).catch(() => {});
    import('./fx3d/result3d')
      .then((m) => {
        m.getStage()?.warm();
        sfx.preloadFanfares();
        if (step === 'open' && pending) {
          m.preload(pending.isLastOne && pending.lastOneName ? cfg?.lastOneImage ?? null : pending.image);
        }
      })
      .catch(() => {});
  }, [step, pending, cfg, board]);

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
          pullTok.current++; setPull(null);
          setSel(null); refresh(); setStep('grid');
        } else if (m.includes('PASS_')) {
          setMsg('시간이 지났습니다. 다시 시작해주세요'); goAttract();
        } else { pullTok.current++; setPull(null); setMsg('뽑기에 실패했습니다'); setStep('grid'); }
      }
    })();
    return () => { alive = false; };
  }, [step, pending, sel, pass, board, refresh, goAttract]);

  // 개봉 화면이 다 열고 등급까지 보여 준 뒤 부른다 — 결과 화면으로
  const opened = useCallback(() => {
    if (!pending) return;
    setResult(pending);
    setStep('result');
    // 팡파레는 결과 화면이 카드가 뒤집히는 순간에 직접 울린다(ResultView)
  }, [pending]);

  const resetOpenState = useCallback(() => {
    sfx.grindStop();
    setPending(null);
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
    if (sel === null || !cfg) return;
    const tile = document.querySelector<HTMLElement>(`.tk2[data-pos="${sel}"]`);
    if (!tile) { resetOpenState(); setMsg(null); setStep('open'); return; }

    const r = tile.getBoundingClientRect();
    const targetW = Math.min(window.innerWidth * 0.72, 460);
    const tok = ++pullTok.current;
    const t0 = performance.now();
    setPull({
      dx: r.left + r.width / 2 - window.innerWidth / 2,
      dy: r.top + r.height / 2 - window.innerHeight / 2,
      s: r.width / targetW,
      w: targetW,
      no: sel,
      from: { x: window.innerWidth / 2, y: window.innerHeight / 2, w: targetW },
      face: null, fd: 0, out: false,
    });
    // 3D 표와 같은 겉면을 돌아 나오는 동안 그려 둔다. 빨리 도는 사이(0.3초 무렵)에 칸 그림에서 이 그림으로 바뀐다.
    // 늦게 오면(0.65초 넘어 — 회전이 느려져 바뀌는 게 보인다) 칸 그림 그대로 두고 3D 가 이어받는다
    import('./fx3d/open3d')
      .then((m) => m.ticketFace(themeOf(cfg.theme).art, {
        no: sel, title: cfg.title, store: storeOf(cfg), font: fontOf(cfg.font).stack,
      }))
      .then((face) => {
        const at = performance.now() - t0;
        if (pullTok.current !== tok || at > 650) return;
        setPull((p) => (p ? { ...p, face, fd: Math.max(0, 300 - at) } : p));
      })
      .catch(() => {});
    setMsg(null);
    // 카드는 남겨 둔 채 개봉 화면으로 — 3D 표가 처음 그려지면(shown) 그때 겹쳐 걷힌다
    setTimeout(() => { if (pullTok.current === tok) { resetOpenState(); setStep('open'); } }, PULL_MS);
    // 3D 가 끝내 안 뜨면 카드를 걷는다(평면 판으로 내려가면 그쪽이 바로 걷는다)
    setTimeout(() => { if (pullTok.current === tok) setPull(null); }, PULL_MS + 6000);
  }, [sel, cfg, resetOpenState]);

  // 개봉 화면의 3D 표가 처음 그려졌다 — 돌아 나온 카드를 겹쳐 걷는다(3D 는 그동안 카드 자리에서 기다린다)
  const shown = useCallback(() => {
    const tok = pullTok.current;
    setPull((p) => (p && !p.out ? { ...p, out: true } : p));
    setTimeout(() => { if (pullTok.current === tok) setPull(null); }, 160);
  }, []);

  // 화면이 바뀐 것도 활동으로 친다. 이게 없으면 진입하자마자 유휴 타이머에 걸릴 수 있다
  useEffect(() => { lastTouch.current = Date.now(); }, [step]);

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
  // 끝물 — 가장 낮은 등급만 남으면 사장님이 고른 방식대로(피날레 숨기기 · 바로 새 판)
  const fin = board?.finale;
  const finLabel = cfg.lastOneLabel ?? '피날레 보너스';
  const finHint = left === 1 ? `마지막 1장에 ${finLabel}` : `남은 ${left}장 중 1장에 ${finLabel}`;
  const carried = fin?.carried?.length ? fin.carried.map((c) => `${c.grade} ${c.n}장`).join(' · ') : null;
  // 방식을 미리 알린다 — 피날레가 숨거나 안 나갈 수 있으면 손님이 뽑기 전에 알아야 한다(표시광고법).
  // 이름표를 사장님이 바꾸면 받침이 달라지므로 조사를 붙이지 않는다
  const low = fin?.low ?? '가장 낮은 등급';
  const finRule = fin?.mode === 'end' || fin?.mode === 'carry' ? `${low}만 남으면 그중 1장에 ${finLabel} · 나오면 새 판`
    : fin?.mode === 'skip' ? `${low}만 남으면 ${finLabel} 없이 새 판` : null;
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
      onPointerUp={() => {
        // 전체화면은 사용자 손짓 안에서만 걸 수 있다(터치는 손을 뗄 때). 크롬 탭으로 띄운 태블릿은
        // 새로고침하면 풀리므로, 대기 화면에서는 시작 버튼이 아니어도 아무 데나 만지면 다시 건다
        // 공개 데모(/demo/*)는 홈페이지 방문자의 화면이라 걸지 않는다
        if (stepRef.current === 'attract' && !document.fullscreenElement && !token.startsWith('demo-')) {
          document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
        }
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
                <h1>{cfg.drawVerb || '주문'}하시면<br /><em>한 장</em> 뽑습니다</h1>
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
              {fin?.hidden && (
                <div className="finline"><img src="/art/seal-last.svg" alt="" />{finHint}</div>
              )}
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
            <small>{pinErr ? (msg ?? 'PIN이 맞지 않습니다') : `${cfg.drawVerb || '주문'}하신 손님만 뽑을 수 있습니다`}</small>
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
          <h2 className="ttl">
            {cfg.title}
            <small>
              {fin?.hidden ? finHint
                : carried ? `지난 판에서 넘어온 ${carried} 포함`
                : finRule ?? '무엇이 남았는지 확인하세요'}
            </small>
          </h2>
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
              <div className={`pcard last ${cfg.lastOneImage ? 'shot' : 'nopic'} ${fin?.given ? 'out' : ''}`}>
                {cfg.lastOneImage
                  ? <img className={`pshot ${isFlat(cfg.lastOneImage) ? 'flat' : ''}`} src={cfg.lastOneImage} alt="" />
                  : <span className="pbig"><Icon name="star" /></span>}
                <span className="pgrade wide">{cfg.lastOneLabel ?? '피날레 보너스'}</span>
                {/* 피날레 보너스에만 붙는 황동 검인 — 등급 상품과 한눈에 갈린다 */}
                <img className="pseal" src="/art/seal-last.svg" alt="" />
                <div className="pbar">
                  <b>{cfg.lastOneName}</b>
                  <span>
                    {fin?.given ? '나감'
                      : fin?.hidden ? (left === 1 ? '마지막 1장' : `${left}장 중 1장`)
                      : '1개'}
                  </span>
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
        <div className={`page ${pull ? 'pulling' : ''}`}>
          <h2 className="ttl">
            티켓을 선택하세요
            <small>{fin?.hidden ? finHint : '구멍이 뚫린 칸은 이미 나간 티켓입니다'}</small>
          </h2>
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
        </div>
      )}

      {step === 'open' && sel !== null && (
        <OpenView key={sel} sel={sel} pending={pending} art={art} dark={themeOf(cfg.theme).dark}
                  title={cfg.title}
                  store={storeOf(cfg)}
                  font={fontOf(cfg.font).stack}
                  autoOpenSeconds={cfg.autoOpenSeconds ?? DEF.autoOpen}
                  lastOneLabel={cfg.lastOneLabel ?? '피날레 보너스'}
                  from={pull?.from ?? null} onShown={shown}
                  onOpened={opened} />
      )}

      {step === 'result' && result && (
        <ResultView r={result} art={art} dark={themeOf(cfg.theme).dark}
                    campaignId={cfg.campaignId} prizes={snap}
                    lastOneImage={cfg.lastOneImage}
                    lastOneLabel={cfg.lastOneLabel ?? '피날레 보너스'}
                    store={storeOf(cfg)}
                    title={cfg.title}
                    seconds={cfg.resultSeconds ?? DEF.result} onDone={goAttract} />
      )}

      {/* 고른 티켓이 판에서 돌면서 튀어나온다. 개봉 화면으로 넘어가도 남아 있다가,
          3D 표가 같은 자리에 처음 그려지면 겹쳐 걷힌다 — 카드가 사라지고 3D 가 뜨기 전의 빈 틈이 없다 */}
      {pull && (
        <div className={`pullwrap ${pull.out ? 'out' : ''}`} aria-hidden="true">
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
            <Ticket art={art} size="tile" num={String(pull.no)} />
            {pull.face && (
              <div className="pullface" style={{ animationDelay: `${pull.fd}ms` }}
                   ref={(el) => { if (el && pull.face && el.firstChild !== pull.face) el.replaceChildren(pull.face); }} />
            )}
          </div>
        </div>
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
