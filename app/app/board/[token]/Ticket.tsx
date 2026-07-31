'use client';

import type { Art } from '@/lib/boardArt';

/**
 * 티켓 한 장 — 활판 입장권.
 *
 * 예전 티켓은 둥근 사각 + 금색 테두리 + 4갈래 반짝별 + 가짜 바코드였다.
 * 넷 다 벡터 UI가 습관적으로 그리는 모양이라 눈이 "프로그램이 그린 그림"으로 읽는다.
 * 대신 실제 극장·경마장 입장권의 문법을 쓴다 — 종이결, 2중 활판 괘선, 천공(구멍),
 * 지폐용 기요셰 무늬, 검인 도장.
 *
 * 세 가지 크기가 같은 뼈대를 쓴다.
 *
 *   mini  초기화면 선반의 50칸. 2:1 이 아니다(약 1.34:1) — grid-auto-rows:1fr 이
 *         높이를 나눠 갖기 때문. preserveAspectRatio="none" 인 SVG 를 그대로 얹으면
 *         세로선과 가로선의 굵기가 서로 다르게 눌리므로 **비율과 무관한 CSS 로** 그린다.
 *         이미지도 안 쓴다 — 칸 50개 × 텍스처면 태블릿에서 무겁다.
 *   tile  티켓 선택 화면의 50칸. 정확히 2:1 이라 SVG 한 겹으로 충분하다.
 *   big   개봉 카드.
 */

export type TicketSize = 'mini' | 'tile' | 'big';

type Props = {
  art: Art;
  size?: TicketSize;
  /** 칸에 찍히는 글자. 안 나간 칸은 번호, 나간 칸은 등급 */
  num?: string;
  used?: boolean;
  sel?: boolean;
  /** 나간 칸에 남기는 등급 색 */
  gradeColor?: string | null;
  className?: string;
};

export default function Ticket({
  art, size = 'tile', num = '', used = false, sel = false, gradeColor, className,
}: Props) {
  // 나간 칸은 종이색을 갈아치우지 않고 **반투명하게 눌러 덮는다**.
  // 밝은 판·어두운 판 위에서 같은 규칙 하나로 합성돼야 한다. 불투명 검정으로 박으면
  // 밝은 판에서 위계가 뒤집힌다.
  const ink = used ? 'rgba(255,255,255,.30)' : art.ink;
  const fs = size === 'big' ? 74 : size === 'mini' ? 15 : 26;
  const kids: React.ReactNode[] = [];

  /* ── 종이 ── */
  if (art.grain && size !== 'mini') {
    kids.push(<div key="g" style={{
      position: 'absolute', inset: 0, background: `${art.grainSrc} repeat`,
      backgroundSize: size === 'big' ? '220px' : '150px',
      opacity: used ? art.grain * 0.6 : art.grain,
    }} />);
  }

  /* ── 보안 잔무늬 띠 — 미니 칸에서는 안 보이므로 그리지 않는다 ── */
  if (art.band && size !== 'mini') {
    kids.push(<div key="b" style={{
      position: 'absolute', inset: 0, background: `url(${art.bandSrc}) repeat`,
      backgroundSize: `auto ${size === 'big' ? '17%' : '26%'}`,
      opacity: used ? 0.05 : art.band,
    }} />);
  }

  /* ── 스텁 로제트 — 천공선 오른쪽 스텁 안에만 앉힌다 ── */
  if (art.ros && size !== 'mini') {
    kids.push(<img key="r" src={art.rosSrc} alt="" style={{
      position: 'absolute', right: '1%', top: '50%', transform: 'translateY(-50%)',
      height: '48%', opacity: used ? 0.08 : art.ros,
    }} />);
  }

  if (size === 'mini') {
    /* 텍스처 없이 종이 톤만 눌러 준다 */
    if (!used) kids.push(<div key="sh" style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(158deg,rgba(74,58,36,.08),rgba(74,58,36,.30))',
    }} />);
    kids.push(<div key="r1" style={{
      position: 'absolute', inset: '3px', border: `1.5px solid ${ink}`,
      borderRadius: '1px', opacity: used ? 0.45 : 0.85,
    }} />);
    if (art.perf) kids.push(<div key="pf" style={{
      position: 'absolute', top: '8%', bottom: '8%', left: '74%', width: '3px',
      background: `radial-gradient(circle at 50% 50%,${ink} 34%,transparent 36%) 0 0/3px 6px repeat-y`,
      opacity: used ? 0.45 : art.perf,
    }} />);
    if (art.dash) kids.push(<div key="ds" style={{
      position: 'absolute', top: '10%', bottom: '10%', left: '74%', width: '2px',
      background: `repeating-linear-gradient(180deg,${ink} 0 2px,transparent 2px 6px)`,
      opacity: used ? 0.5 : 1,
    }} />);
    if (art.bars) kids.push(<div key="bc" style={{
      position: 'absolute', right: '7%', top: '20%', bottom: '20%', width: '17%',
      background: `repeating-linear-gradient(90deg,${ink} 0 2px,transparent 2px 4px)`,
      opacity: used ? 0.3 : 0.85,
    }} />);
    if (art.stamp && used) kids.push(art.east
      ? <img key="sm" src="/art/inkan.svg" alt="" style={{
          position: 'absolute', right: '4%', top: '50%', height: '48%',
          transform: 'translateY(-50%)', opacity: 0.92,
        }} />
      : <div key="sm" style={{
          position: 'absolute', right: '5%', top: '50%', width: '11px', height: '11px',
          marginTop: '-5.5px', borderRadius: '50%',
          border: '2px solid #BE3E2C', opacity: 0.95,
        }} />);
  } else {
    /* ── 큰 판·타일은 정확히 2:1 이라 SVG 한 겹으로 그려도 배율이 균등하다 ── */
    const g: React.ReactNode[] = [];
    g.push(<rect key="o" x={21} y={13} width={358} height={174} rx={2}
                 fill="none" stroke={ink} strokeWidth={6} opacity={used ? 0.5 : 0.92} />);
    g.push(<rect key="i" x={33} y={25} width={334} height={150} rx={1}
                 fill="none" stroke={ink} strokeWidth={1.3} opacity={used ? 0.28 : 0.5} />);
    if (art.perf) {
      const dots = [];
      for (let y = 12; y <= 188; y += 11) dots.push(<circle key={y} cx={296} cy={y} r={2.3} />);
      g.push(<g key="pf" fill={ink} opacity={used ? 0.45 : art.perf}>{dots}</g>);
    }
    /* 처음 만든 판 — 뜯는 점선, 4갈래 별, 줄무늬 */
    if (art.dash) g.push(<line key="ds" x1={300} y1={18} x2={300} y2={182}
                               stroke={ink} strokeWidth={3} strokeDasharray="4 9"
                               strokeLinecap="round" opacity={used ? 0.5 : 1} />);
    if (art.star) g.push(<g key="st" fill={ink} opacity={used ? 0.35 : 1}>
      <path d="M46,74 Q52,94 66,100 Q52,106 46,126 Q40,106 26,100 Q40,94 46,74 Z" />
      <path d="M74,66 Q77,80 86,84 Q77,88 74,102 Q71,88 62,84 Q71,80 74,66 Z" />
    </g>);
    if (art.bars) g.push(<g key="bc" fill={ink} opacity={used ? 0.3 : 0.85}>
      {[0, 12, 20, 34, 42, 56, 68, 76].map((d, i) => (
        <rect key={i} x={300 + d} y={66} width={i % 3 === 0 ? 7 : 4} height={68} rx={1.5} />
      ))}
    </g>);
    /* 검인 — 안 나간 표에는 빈 도장 자리만, 나간 표에는 실제로 찍힌다.
       서양은 원형 스탬프, 동양은 사각 전각(篆刻). */
    if (art.stamp) {
      const RED = '#BE3E2C';
      if (art.east) {
        if (used) kids.push(<img key="sm" src="/art/inkan.svg" alt="" style={{
          position: 'absolute', right: '5%', top: '50%', height: '46%',
          transform: 'translateY(-50%) rotate(-6deg)', opacity: 0.92,
        }} />);
        else g.push(<rect key="sm" x={317} y={73} width={54} height={54} rx={2} fill="none"
                          stroke={ink} strokeWidth={1.2} strokeDasharray="3 5" opacity={0.4} />);
      } else {
        g.push(used
          ? <g key="sm" transform="rotate(-8 344 100)">
              <circle cx={344} cy={100} r={27} fill="none" stroke={RED} strokeWidth={4} opacity={0.95} />
              <circle cx={344} cy={100} r={21} fill="none" stroke={RED} strokeWidth={1.5} opacity={0.6} />
              <text x={344} y={109} textAnchor="middle" fill={RED} fontSize={24} fontWeight={800}
                    fontFamily="'Pretendard','Apple SD Gothic Neo',sans-serif">검</text>
            </g>
          : <circle key="sm" cx={344} cy={100} r={27} fill="none"
                    stroke={ink} strokeWidth={1.2} strokeDasharray="3 5" opacity={0.4} />);
      }
    }
    kids.push(<svg key="sv" viewBox="0 0 400 200" preserveAspectRatio="none"
                   style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>{g}</svg>);
  }

  /* ── 나간 칸 — 실제로 구멍이 뚫린다 ── */
  if (used) {
    // 눌러 덮는 겹이 먼저, 구멍은 그 위에. 구멍은 판이 밝든 어둡든 "뚫린 자리"여야 한다
    kids.push(<div key="ov" style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.52)',
    }} />);
    kids.push(<div key="hole" style={{
      position: 'absolute', left: '17%', top: '50%', transform: 'translateY(-50%)',
      width: size === 'mini' ? '14%' : '13%', aspectRatio: '1', borderRadius: '50%',
      background: 'rgba(0,0,0,.78)',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.14)',
    }} />);
    // 등급 색은 얇은 왼쪽 띠로만 남긴다 — 칸 전체를 물들이면 판이 알록달록해진다
    if (gradeColor) kids.push(<div key="gs" style={{
      position: 'absolute', left: '4%', top: '13%', bottom: '13%', width: '2.5%',
      borderRadius: '99px', background: gradeColor, opacity: 0.85,
    }} />);
  }

  /* ── 번호 / 등급 ── */
  if (num) kids.push(<span key="n" style={{
    position: 'absolute', left: used ? '30%' : 0, right: '26%', top: '50%',
    transform: 'translateY(-50%)', textAlign: 'center', lineHeight: 1,
    fontFamily: art.numFont, fontWeight: 700, fontSize: `${fs}px`, letterSpacing: '-.02em',
    color: used ? (gradeColor || '#5B5B63') : art.numc,
    textShadow: used ? '0 1px 3px rgba(0,0,0,.9)' : 'none',
  }}>{num}</span>);

  /* 옆구리가 반원으로 파인 입장권 실루엣.
     그라데이션 두 겹을 겹쳐 파는 방법도 있지만 그러려면 mask-composite 에 기대야 하고,
     표준 키워드와 -webkit- 구형 키워드가 브라우저마다 다르게 합성된다.
     외곽선 하나를 그린 SVG 를 마스크로 쓰면 합성 규칙이 끼어들 자리가 없다.
     미니 칸은 2:1 이 아니고 68px 밖에 안 되므로 파지 않는다 — 파면 찌그러져 보인다. */
  const notch = art.notch && size !== 'mini' ? (() => {
    const R = 18, NR = 15, W = 400, H = 200;
    const d =
      `M ${R},0 H ${W - R} A ${R},${R} 0 0 1 ${W},${R}` +
      ` V ${H / 2 - NR} A ${NR},${NR} 0 0 0 ${W},${H / 2 + NR}` +
      ` V ${H - R} A ${R},${R} 0 0 1 ${W - R},${H}` +
      ` H ${R} A ${R},${R} 0 0 1 0,${H - R}` +
      ` V ${H / 2 + NR} A ${NR},${NR} 0 0 1 0,${H / 2 - NR}` +
      ` V ${R} A ${R},${R} 0 0 1 ${R},0 Z`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
      `preserveAspectRatio="none"><path d="${d}" fill="#000"/></svg>`;
    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    return {
      maskImage: url, WebkitMaskImage: url,
      maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
      maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
    } as React.CSSProperties;
  })() : null;

  return (
    <div className={className} style={{
      position: 'absolute', inset: 0, borderRadius: `${art.radius}px`, overflow: 'hidden',
      background: art.pap,
      ...notch,
      boxShadow: used
        ? 'inset 0 3px 9px rgba(0,0,0,.7), inset 0 0 0 1px rgba(0,0,0,.5)'
        // 밝은 판에서도 표가 선반과 갈리도록 테와 그늘을 함께 둔다
        : (sel ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,.42), 0 1px 2px rgba(0,0,0,.3), 0 4px 8px -3px rgba(0,0,0,.3)'),
    }}>{kids}</div>
  );
}
