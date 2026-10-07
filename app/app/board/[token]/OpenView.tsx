'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import type { DrawResult } from '@/lib/supabase';
import type { Art } from '@/lib/boardArt';
import * as sfx from '@/lib/sfx';
import Ticket from './Ticket';
import { gradeColor, isFlat, tierOf } from './grade';
import type { OpenFrame, OpenScene } from './fx3d/open3d';

/**
 * 개봉 화면 (4페이지).
 *
 * 3D 판 — 손잡이로 밀면 표가 말려 올라가고 안쪽 인쇄면이 드러난다. 등급 글자는 양각으로 숨어 있다가
 * 열수록 왼쪽 획부터 보이고, 다 열면 박이 차오른다. 상품은 다음(결과) 화면에서 나온다.
 * 그림은 fx3d/open3d 가 그리고, 이 컴포넌트는 글자 층(제목 · 손잡이 · 버튼)과 손가락만 맡는다.
 *
 * WebGL 을 못 쓰는 기기는 예전 평면 판으로 내려간다(아래 Open2D — 예전 코드 그대로).
 *
 * 이 화면에 들어온 순간 티켓은 이미 서버에서 확정됐다(pending). 미는 동작은 연출이다.
 */
type Props = {
  sel: number;
  /** 서버가 확정한 결과 — 화면에 들어온 직후 도착한다. 그전에는 못 민다 */
  pending: DrawResult | null;
  art: Art;
  dark: boolean;
  /** 표에 찍히는 회차 제목 · 매장 이름, 그 글꼴 */
  title: string;
  store: string;
  font: string;
  /** 손님이 열다 말고 가 버리면 이만큼 뒤에 저절로 연다 — 상품이 사라지지 않게 */
  autoOpenSeconds: number;
  lastOneLabel: string;
  /** 다 열고 등급까지 보여 준 뒤 — 결과 화면으로 */
  onOpened: () => void;
  /** 판에서 돌아 나온 카드가 멈춘 자리(화면 px) — 3D 표가 여기서 시작한다. 없으면 제자리에서 */
  from?: { x: number; y: number; w: number } | null;
  /** 표가 화면에 처음 그려진 뒤 — 돌아 나온 카드를 걷는다 */
  onShown?: () => void;
  /** 표 위 빈자리에 희미하게 깜빡이는 안내 — 홈페이지 빠른 열기에서만(「직접 열어 보세요」). 잡거나 열기 시작하면 사라진다 */
  hint?: string;
};

export default function OpenView(props: Props) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const fallback = useCallback(() => setMode('2d'), []);
  return mode === '3d' ? <Open3D {...props} fallback={fallback} /> : <Open2D {...props} />;
}

/**
 * 여는 손잡이 — 'paper' 면 손잡이 없이 표를 잡아 넘긴다(표 자리 어디든 · 표 끝이 가끔 들썩인다).
 * 'knob' 은 황동 손잡이. 3D 표 위에 얹은 평면 사진이라 기울기 · 빛이 안 맞아 어색했다(사장님).
 * 매장 보드는 아직 손잡이 — 끝물 데모(/fx/endgame)에서 먼저 종이로 보고, 확인되면 기본값을 바꾼다
 */
export type Grip = 'knob' | 'paper';
let GRIP: Grip = 'knob';
export const setGrip = (g: Grip) => { GRIP = g; };

/* ============================================================ 3D 판 */

/**
 * 손가락 이동(표 폭 대비) → 연 정도. 앞쪽은 빨리 열리고 글자 구간은 촘촘하다.
 * 손가락으로 표 폭의 0.79 배를 밀면 93%(OPEN_AT)에 닿아 나머지가 저절로 열린다.
 */
const F_END = 0.9;
const curve = (f: number) => { const u = Math.min(1, Math.max(0, f / F_END)); return 1.5 * u - 0.5 * u * u; };
const uncurve = (p: number) => F_END * (1.5 - Math.sqrt(Math.max(0, 2.25 - 2 * p)));

function Open3D({
  sel, pending, art, dark, title, store, font, autoOpenSeconds, lastOneLabel, onOpened, fallback, from, onShown, hint,
}: Props & { fallback: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const arrowsRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const btnsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OpenScene | null>(null);
  const drag = useRef<{ x0: number; f0: number; w: number } | null>(null);
  const lastAct = useRef(0);
  const autoRef = useRef(false);
  const openedRef = useRef(onOpened);
  // 다 열린 순간의 반짝임은 등급 금속을 따른다 — 결과가 도착하면 적어 둔다
  const gradeRef = useRef('E');
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(false);
  const [done, setDone] = useState(false);
  const [grip] = useState<Grip>(() => GRIP);
  // 한 번이라도 잡았으면 더는 들썩이지 않는다(놓은 자리에서 기다린다)
  const touched = useRef(false);
  // 안내(hint)는 처음 잡는 순간 걷는다
  const [held, setHeld] = useState(false);

  useEffect(() => { openedRef.current = onOpened; }, [onOpened]);
  // 카드가 멈춘 자리는 처음 뜰 때 한 번만 읽는다 — 카드가 걷혀 값이 사라져도 3D 를 다시 띄우지 않게
  const fromRef = useRef(from ?? null);
  const shownRef = useRef(onShown);
  useEffect(() => { shownRef.current = onShown; }, [onShown]);
  useEffect(() => { lastAct.current = Date.now(); }, []);

  // 매 프레임 3D 가 부른다 — 손잡이 · 화살표 · 어둠 · 버튼을 리액트 상태를 거치지 않고 옮긴다
  const paint = useCallback((f: OpenFrame) => {
    const kn = knobRef.current, ar = arrowsRef.current, vg = vigRef.current, bt = btnsRef.current;
    if (kn) {
      kn.style.transform = `translate(${f.x + 8}px,${f.y}px) translateY(-50%)`;
      kn.style.opacity = f.done ? '0' : '1';
    }
    if (ar) {
      // 손잡이 판은 손잡이 오른쪽, 종이 판은 표 끝 바로 옆에서 흘러간다
      ar.style.transform = `translate(${f.x + (grip === 'paper' ? 30 : 104)}px,${f.y}px) translateY(-50%)`;
      ar.style.opacity = !f.done && !autoRef.current && f.p < 0.75 && f.k < 0.3 ? '1' : '0';
    }
    if (vg) {
      vg.style.opacity = f.k.toFixed(3);
      vg.style.setProperty('--vx', `${f.lx.toFixed(0)}px`);
      vg.style.setProperty('--vy', `${f.ly.toFixed(0)}px`);
    }
    if (bt) bt.style.opacity = f.done ? '0' : (1 - f.k).toFixed(3);
    // 그라인더는 미는 동안만 · 글자 구간에서는 살짝 낮춘다. 심장 소리와 긴장음은 화면 박자 그대로
    if ((drag.current || autoRef.current) && !f.done) sfx.grindSet(f.p, f.k);
    if (f.beat > 0) sfx.heartbeat(f.beat);
    sfx.tensionSet(f.done ? 0 : f.k, f.p);
  }, [grip]);

  // 3D 를 띄운다 — 뽑기 흐름에 들어올 때 미리 받아 둔 모듈을 꺼내 쓴다
  useEffect(() => {
    let alive = true;
    let sc: OpenScene | null = null;
    (async () => {
      try {
        const m = await import('./fx3d/open3d');
        const s = m.getOpen();
        const host = wrapRef.current?.closest('.bd') as HTMLElement | null;
        if (!alive) return;
        if (!s || !host || !slotRef.current || !wrapRef.current) { fallback(); return; }
        sc = s;
        await s.play({
          host, slot: slotRef.current, layer: wrapRef.current, art, dark,
          ticket: { no: sel, title, store, font },
          from: fromRef.current,
          shown: () => { if (alive) shownRef.current?.(); },
          frame: paint,
          finale: () => {
            if (!alive) return;
            drag.current = null;
            sfx.grindStop();
            sfx.tensionStop();
            sfx.reveal(gradeRef.current);
            setDone(true);
          },
          done: () => { if (alive) openedRef.current(); },
          lost: () => { if (alive) fallback(); },
        });
        if (!alive) { s.stop(); return; }
        sceneRef.current = s;
        setReady(true);
      } catch {
        if (alive) fallback();
      }
    })();
    return () => {
      alive = false;
      sceneRef.current = null;
      sc?.stop();
      sfx.grindStop();
      sfx.tensionStop();
    };
  }, [sel, art, dark, title, store, font, paint, fallback]);

  // 결과가 오면 바닥에 등급 쪽지를 깐다 — 그때부터 밀 수 있다
  useEffect(() => {
    if (!ready || !pending) return;
    // 피날레 연출은 보너스가 정해져 있을 때만 — 등급 글자 자체는 그 표의 실제 등급이다
    const finale = pending.isLastOne && !!pending.lastOneName;
    gradeRef.current = pending.grade;
    sceneRef.current?.setResult(pending.grade, tierOf(pending.grade, finale), { store, title, no: sel, paper: art.photo?.slip });
  }, [ready, pending, store, title, sel, art]);

  const start = useCallback((slow: boolean) => {
    const sc = sceneRef.current;
    if (!sc || !sc.ready) return;
    drag.current = null;
    autoRef.current = true;
    setAuto(true);
    sfx.grindStart();
    sc.autoOpen(slow);
  }, []);

  // 열다 말고 가 버리면 저절로 연다 — 마지막으로 만진 때부터 센다
  useEffect(() => {
    if (!ready || !pending || auto || done) return;
    const iv = setInterval(() => {
      if (drag.current) { lastAct.current = Date.now(); return; }
      if (Date.now() - lastAct.current > autoOpenSeconds * 1000) start(true);
    }, 500);
    return () => clearInterval(iv);
  }, [ready, pending, auto, done, autoOpenSeconds, start]);

  const canPush = ready && !!pending && !auto && !done;
  const last = !!pending?.isLastOne && !!pending?.lastOneName;

  // 종이 판 — 밀 수 있게 되면 표 끝이 가끔 들썩인다. 버튼으로 열거나 손이 닿으면 멈춘다
  useEffect(() => {
    if (grip !== 'paper') return;
    sceneRef.current?.setPeek(canPush && !touched.current);
  }, [grip, canPush]);

  // 미는 손 — 손잡이 판은 손잡이에, 종이 판은 표 자리에 붙인다
  const onDown = (e: RPE<HTMLDivElement>) => {
    const sc = sceneRef.current;
    if (!sc || !sc.ready || !canPush) return;
    touched.current = true;
    setHeld(true);
    sc.setPeek(false);
    drag.current = { x0: e.clientX, f0: uncurve(sc.progress), w: slotRef.current?.clientWidth || 400 };
    e.currentTarget.setPointerCapture(e.pointerId);
    lastAct.current = Date.now();
    sfx.grindStart();
  };
  const onMove = (e: RPE<HTMLDivElement>) => {
    const d = drag.current, sc = sceneRef.current;
    if (!d || !sc) return;
    sc.setTarget(curve(d.f0 + (e.clientX - d.x0) / d.w));
    lastAct.current = Date.now();
  };
  const onUp = () => { if (drag.current) { drag.current = null; sfx.grindStop(); } };
  const hands = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

  return (
    <div className="page op3wrap" ref={wrapRef}>
      <h2 className="ttl">
        {sel}번 티켓
        <small>
          {auto || done ? '열리는 중…'
            : grip === 'paper' ? '표를 오른쪽으로 천천히 넘기세요' : '황동 손잡이를 천천히 오른쪽으로 미세요'}
        </small>
      </h2>
      <div className="op3">
        {/* 표 자리 — 3D 가 이 칸을 재서 앉는다. 종이 판은 이 칸이 곧 손잡이다 */}
        {grip === 'paper'
          ? (
            <div className={`tslot grip ${canPush ? '' : 'off'}${hint ? ' hinted' : ''}`} ref={slotRef} {...hands}>
              {hint && canPush && !held && <span className="op3hint" aria-hidden="true">{hint}</span>}
            </div>
          )
          : <div className="tslot" ref={slotRef} />}
        <div className="opfoot">
          {/* 이 시점엔 티켓이 이미 확정돼 있다. 되돌아가면 상품을 잃으므로 여는 길만 남긴다 */}
          <div className="rowbtn" ref={btnsRef}>
            <button className="big ghost" disabled={!canPush} onClick={() => start(false)}>바로 열기</button>
            <button className="big" disabled={!canPush} onClick={() => start(true)}>천천히 열기</button>
          </div>
          {done && pending && (
            <div className="cap3">
              <b>{pending.grade} 등급 당첨</b>
              <span>{last ? `${lastOneLabel}까지 함께 나옵니다` : '다음 화면에서 상품이 나옵니다'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 글자 구간에 들어서면 주변이 어두워진다 — 숨죽이는 순간. 글자 자리만 비켜 간다 */}
      <div className="vig3" ref={vigRef} />
      <div className="arrows3" ref={arrowsRef} aria-hidden="true"><span>›</span><span>›</span><span>›</span></div>
      {grip === 'knob' && (
        <div
          className={`knob3 ${art.photo ? 'photo' : ''} ${canPush ? '' : 'off'}`}
          ref={knobRef}
          style={{ opacity: 0 }}
          role="slider"
          aria-label="손잡이를 오른쪽으로 밀어 열기"
          aria-valuemin={0}
          aria-valuemax={100}
          {...hands}
        >
          <div className="kin">
            {art.photo
              ? <img className="lever" src={art.photo.leverSrc} alt="" draggable={false} />
              : <><i className="comb" /><span>❯</span></>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ 평면 판 (WebGL 이 없을 때) */

// 오픈 화면 배경에 뿌리는 반짝임. 매 렌더 흔들리지 않게 모듈 수준에서 한 번만 만든다.
const TWINKLES = Array.from({ length: 60 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 61 + 7) % 100}%`,
  s: 3 + ((i * 7) % 5),
  dur: `${2 + ((i * 13) % 9) * 0.35}s`,
  delay: `-${((i * 17) % 21) * 0.3}s`,
}));

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

const KNOB = 62;
// 무게감 조절은 이 두 값. 실제 손가락 이동거리 = 카드폭 × (THRESHOLD ÷ DRAG_RATIO)
//   1.0 / 0.60 → 0.60배 (가벼움)   0.85 / 0.65 → 0.76배 (지금)   0.62 / 0.78 → 1.26배 (너무 무거움)
const DRAG_RATIO = 0.85;   // 손잡이가 손가락을 따라오는 비율. 낮을수록 무겁다
const THRESHOLD = 0.65;    // 카드 폭 대비 이만큼 밀면 열린다

function Open2D({ sel, pending, art, title, store, autoOpenSeconds, onOpened, onShown }: Props) {
  const [px, setPx] = useState(0);          // 손잡이 위치(px)
  const [grip, setGrip] = useState(false);  // 손잡이를 잡고 있는 중 = 카드가 떨린다
  const [revealing, setRevealing] = useState(false);
  const [slowOpen, setSlowOpen] = useState(false);
  const [sh, setSh] = useState(0);          // 많이 밀수록 크게 떨린다
  const cardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(1);
  const finished = useRef(false);

  // 끝까지 열기 — 무겁게 밀려나간 뒤 결과로 넘어간다
  const finish = useCallback((slow = false) => {
    if (finished.current || !pending) return;
    finished.current = true;
    setSlowOpen(slow);
    setGrip(false);
    setRevealing(true);
    setPx(maxX.current);
    sfx.grindStop();
    sfx.reveal(pending.grade);
    setTimeout(onOpened, slow ? 1400 : 950);
  }, [pending, onOpened]);

  // 손님이 카드를 열다 말고 가버려도 상품이 사라지지 않게 일정 시간 뒤 자동으로 연다
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => finish(true), autoOpenSeconds * 1000);
    return () => clearTimeout(t);
  }, [pending, finish, autoOpenSeconds]);

  useEffect(() => () => sfx.grindStop(), []);
  // 평면 판은 바로 그려진다 — 돌아 나온 카드를 걷는다
  useEffect(() => { onShown?.(); }, [onShown]);

  return (
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
            ['--sh' as string]: sh.toFixed(2),
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
                    sub={art.photo ? title : undefined} />
            {/* 미는 방향 안내 화살표 */}
            <div className="guide"><span>›</span><span>›</span><span>›</span></div>
            {/* 표면 조판 — 손잡이가 지나가는 왼쪽과 스텁은 비운다.
                글자색은 종이 잉크를 따른다. 종이가 크라프트지라 흰 글자는 안 읽힌다 */}
            {!art.photo && <div className="lbl" style={{ color: art.numc }}>
              <span className="ev">{title}</span>
              <b>{store}</b>
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
              setSh(Math.min(6, (v / Math.max(1, maxX.current)) * 7));
              sfx.grindSet(v / Math.max(1, maxX.current));
              if (v > maxX.current * THRESHOLD) { dragging.current = false; finish(false); }
            }}
            onPointerUp={() => {
              if (!dragging.current) return;
              dragging.current = false;
              setGrip(false);
              sfx.grindStop();
              if (!finished.current) { setRevealing(false); setPx(0); setSh(0); }
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
  );
}
