'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 초기화면 첫 장 — 모션 광고 "고요한 한 그릇"
 *
 * Claude Design 프로젝트 `광고 A 고요한 한그릇.dc.html` 을 우리 화면으로 옮긴 것이다.
 * 원본은 1080×1920 세로 영상으로 뽑는 시안이고(ad-a.jsx + ad-kit.jsx),
 * 여기서는 MP4 로 굽지 않고 화면에서 직접 돌린다. 이유는 두 가지다.
 *
 *  1. 메뉴가 바뀌면 영상을 다시 뽑아야 한다. 사장님이 광고 탭에서 사진과 문구를
 *     고치면 이 광고도 같이 바뀌어야 맞다. 데이터로 돌리면 그게 공짜다.
 *  2. 태블릿이 4G 인 매장도 있다. 15초 세로 영상은 첫 로딩이 무겁다.
 *
 * 원본에서 그대로 가져온 것
 *  - 무대 구성: 사진 전체 + 어두움 겹 + 가독성 그라데이션 + 비네트
 *  - 카메라: 느린 확대·상승(켄번즈). 씬마다 시작·끝 값이 이어진다
 *  - 세 가지 움직임만 쓴다 — fade / drift / rise. 다른 이징은 없다
 *  - 자간 넓은 금색 키커 + 명조 제목 + 고딕 본문, 가격은 한 박자 늦게
 *  - 마지막 사인 컷: 매장명 + 한 줄 + 정보 + KUVENTING
 *
 * 우리 쪽에 맞춘 것
 *  - 씬을 사장님이 넣은 광고 슬라이드에서 만든다 (사진 있는 것만)
 *  - 사인 컷의 문구는 남은 티켓 수로 채운다. 영업시간·주소는 아직 DB에 없다
 *  - 크기는 폭에 비례한다. 원본은 1080 폭 기준 px 이므로 --u(1 디자인px 의 실제 px)로 환산
 *  - 움직임은 CSS 애니메이션이 만든다. 원본은 매 프레임 JS 로 진행도를 계산하는데
 *    (영상으로 굽기 위한 구조다) 태블릿에서 15초를 그렇게 돌리면 끊긴다
 */

export type MotionCam = {
  z0: number; z1: number;   // 확대 시작·끝
  y0: number; y1: number;   // 위로 밀기 시작·끝 (%)
  d0: number; d1: number;   // 어두움 시작·끝
  px: number;               // 사진 가로 초점 (%)
};

export type MotionScene =
  | {
      kind: 'dish';
      dur: number; photo: string; cam: MotionCam;
      kicker: string; title: string; desc?: string | null; price?: string | null;
      top: number;              // 자막 세로 위치 (1920 기준)
      pos: AdPos;               // 그늘을 자막 쪽으로 옮기는 데 쓴다
    }
  | {
      kind: 'set';
      dur: number; photo: string; cam: MotionCam;
      kicker: string; title: string; items: string[]; price?: string | null;
      top: number;
      pos: AdPos;
    }
  | {
      kind: 'sign';
      dur: number; photo: string; cam: MotionCam;
      store: string; tagline: string; info: string;
      top: number;
    };

/** 원본 씬의 카메라 값. 씬 수가 늘면 돌려 쓴다 */
const CAMS: MotionCam[] = [
  // 배율 1.00 을 쓰지 않는다. 정확히 1 이면 브라우저가 변형 없는 경로로 그려서
  // 애니메이션이 시작되는 순간 한 번 튄다
  { z0: 1.02, z1: 1.09, y0: 0, y1: -1.5, d0: 0.10, d1: 0.20, px: 34 },
  { z0: 1.02, z1: 1.10, y0: 0, y1: -1.5, d0: 0.12, d1: 0.24, px: 26 },
  { z0: 1.02, z1: 1.10, y0: 0, y1: -1.5, d0: 0.12, d1: 0.24, px: 32 },
  { z0: 1.02, z1: 1.10, y0: 0, y1: -1.5, d0: 0.14, d1: 0.28, px: 40 },
];
const SIGN_CAM: MotionCam = { z0: 1.10, z1: 1.18, y0: -2, y1: -3.5, d0: 0.34, d1: 0.46, px: 34 };

/** 자막 자리 — 세로(t/m/b) + 가로(l/r) */
export type AdPos = 'tl' | 'tr' | 'ml' | 'mr' | 'bl' | 'br';

/** 옛 값(top/mid/bottom)도 읽어 준다 */
export function normPos(v?: string | null): AdPos {
  const m: Record<string, AdPos> = { top: 'tl', mid: 'ml', bottom: 'bl' };
  const k = (v ?? '').toLowerCase();
  if (k in m) return m[k];
  return (['tl', 'tr', 'ml', 'mr', 'bl', 'br'] as const).includes(k as AdPos) ? (k as AdPos) : 'bl';
}

type AdIn = {
  title?: string; sub?: string | null; price?: string | null;
  image?: string | null; pos?: string | null;
  /** 제목 위 금색 머리말. 없으면 「오늘의 메뉴」 — 음식점 밖(시승 · 팝업)은 행사가 정한다 */
  kicker?: string | null;
};

/**
 * 자막 세로 위치 (1920 기준).
 * 사진은 매장마다 다르다 — 접시가 아래에 있으면 글자를 위로 올려야 한다.
 * 사진 규격으로 전부 통제하려 하면 매장마다 사진을 다시 뽑게 된다.
 */
const POS_TOP: Record<string, number> = { t: 300, m: 820, b: 1240 };

/**
 * 광고 슬라이드로 씬을 만든다. 사진 없는 슬라이드는 넣지 않는다 —
 * 이 광고는 사진이 주인공이라 글자만 있는 컷은 다른 것처럼 보인다.
 */
export function buildScenes(
  ads: AdIn[],
  store: { name: string; branch?: string | null },
  left: number,
  total: number,
  cut = 3,                      // 컷 하나의 길이(초). 사장님이 조절한다
  verb = '주문',                 // 뽑는 조건 — 주문 · 시승 · 체험 …
): MotionScene[] {
  const shots = ads.filter((a) => a.image);
  if (!shots.length) return [];

  const scenes: MotionScene[] = shots.slice(0, 4).map((a, i) => ({
    kind: 'dish' as const,
    // 첫 컷은 조금 길게 — 처음 눈이 가는 자리다
    dur: i === 0 ? cut + 0.5 : cut,
    photo: a.image as string,
    cam: CAMS[i % CAMS.length],
    kicker: a.kicker || '오늘의 메뉴',
    title: a.title ?? '',
    desc: a.sub ?? null,
    price: a.price ?? null,
    top: POS_TOP[normPos(a.pos)[0]],
    pos: normPos(a.pos),
  }));

  scenes.push({
    kind: 'sign',
    // 사인 컷은 매장명만 뜨므로 짧게
    dur: Math.max(1.5, cut - 0.5),
    photo: shots[0].image as string,
    cam: SIGN_CAM,
    store: store.name + (store.branch ? ` · ${store.branch}` : ''),
    tagline: total > 0 ? `${total}장 중 ${left}장 남았습니다` : '남은 한 장까지, 럭키드로우',
    // 2.5초짜리 컷이다. 한 줄만 남긴다 — 세 줄이면 아무것도 안 읽힌다
    info: `${verb}하시면 한 장 뽑습니다`,
    top: 880,
  });

  return scenes;
}

export const scenesDuration = (s: MotionScene[]) => s.reduce((a, b) => a + b.dur, 0);

/* ============================================================ */

/** 1 디자인px 이 실제 몇 px 인지. 원본은 1080 폭 기준이다 */
function useUnit() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [u, setU] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setU(el.clientWidth / 1080);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, u };
}

export default function MotionAd({ scenes }: { scenes: MotionScene[] }) {
  const { ref, u } = useUnit();
  const [i, setI] = useState(0);

  // 씬을 순서대로 넘긴다. 진행도 계산은 CSS 가 한다
  useEffect(() => {
    if (scenes.length < 2) return;
    const t = setTimeout(
      () => setI((v) => (v + 1) % scenes.length),
      scenes[i].dur * 1000,
    );
    return () => clearTimeout(t);
  }, [i, scenes]);

  // 씬 목록이 바뀌면 처음부터
  useEffect(() => { setI(0); }, [scenes]);

  if (!scenes.length) return null;
  const s = scenes[Math.min(i, scenes.length - 1)];

  // 글자·간격은 폭에 비례한다 (원본 1080 폭 기준)
  const px = (v: number) => `${v * u}px`;
  // 세로 위치는 비율로 잡는다. 폭 기준으로 환산하면 9:16 이 아닌 무대에서 화면 밖으로 나간다
  const vh = (v: number) => `${(v / 1920) * 100}%`;

  return (
    <div className="mad" ref={ref}>
      {/* key 로 씬마다 다시 마운트해야 애니메이션이 처음부터 돈다 */}
      <div
        className="madscene"
        key={i}
        data-pos={s.kind === 'sign' ? 'sign' : s.pos}
        style={{
          ['--dur' as string]: `${s.dur}s`,
          ['--z0' as string]: s.cam.z0,
          ['--z1' as string]: s.cam.z1,
          ['--y0' as string]: `${s.cam.y0}%`,
          ['--y1' as string]: `${s.cam.y1}%`,
          ['--d0' as string]: s.cam.d0,
          ['--d1' as string]: s.cam.d1,
        }}
      >
        {/* 무대 — 사진 + 어두움 + 가독성 그라데이션 + 비네트 */}
        <div className="madshot">
          <img src={s.photo} alt="" style={{ objectPosition: `${s.cam.px}% 45%` }} />
        </div>
        <div className="maddark" />
        <div className="madlegib" />
        <div className="madvig" />

        {u > 0 && (s.kind === 'sign' ? (
          <>
            <div
              className="madcap sign"
              style={{ top: vh(s.top), left: px(96), right: px(96), gap: px(30) }}
            >
              <div className="madrule" style={{ height: px(2) }} />
              {/* 긴 매장명(지점까지 붙으면 12자 넘는다)은 두 줄로 밀려 컷을 다 먹는다.
                  글자 수에 따라 크기를 낮춘다 */}
              <div className="madstore" style={{ fontSize: px(s.store.length > 10 ? 66 : 88) }}>
                {s.store}
              </div>
              <div className="madbody" style={{ fontSize: px(36) }}>{s.tagline}</div>
            </div>

            <div
              className="madfoot"
              style={{ left: px(96), right: px(96), bottom: vh(110), gap: px(22) }}
            >
              <div className="madhair" />
              <div className="madinfo" style={{ fontSize: px(32) }}>{s.info}</div>
              <div className="madmark" style={{ fontSize: px(22) }}>KUVENTING</div>
            </div>
          </>
        ) : (
          <div
            className={`madcap ${s.pos[1] === 'r' ? 'right' : ''}`}
            style={{
              top: vh(s.top), width: px(888), gap: px(26),
              ...(s.pos[1] === 'r' ? { right: px(96) } : { left: px(96) }),
            }}
          >
            <div className="madkicker" style={{ fontSize: px(30) }}>{s.kicker}</div>
            <div className="madtitle" style={{ fontSize: px(100) }}>{s.title}</div>
            {s.kind === 'dish' && s.desc && (
              <div className="madbody" style={{ fontSize: px(34) }}>{s.desc}</div>
            )}
            {s.kind === 'set' && (
              <div className="maditems" style={{ gap: px(18), marginTop: px(6) }}>
                {s.items.map((it, n) => (
                  <div
                    className="maditem" key={it}
                    style={{ gap: px(20), animationDelay: `calc(var(--dur) * ${0.2 + n * (0.42 / Math.max(s.items.length, 1))})` }}
                  >
                    <div className="madtick" style={{ width: px(28) }} />
                    <div style={{ fontSize: px(36) }}>{it}</div>
                  </div>
                ))}
              </div>
            )}
            {s.price && (
              <div className="madprice" style={{ gap: px(22) }}>
                <div className="madtick wide" style={{ width: px(44) }} />
                <div style={{ fontSize: px(38) }}>{s.price}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
