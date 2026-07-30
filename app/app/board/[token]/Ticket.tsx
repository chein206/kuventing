'use client';

/**
 * 티켓 아트 — SVG로 직접 그린다.
 * AI 래스터 이미지는 알파가 없거나 테두리가 지저분하고 작은 크기에서 뭉개진다.
 * 벡터로 그리면 60px 그리드 칸부터 560px 오픈 카드까지 같은 모양으로 선명하다.
 * 색은 CSS 변수(--tkt-*)를 따르므로 테마별로 바꿀 수 있다.
 */

type Props = {
  variant?: 'full' | 'tile';
  used?: boolean;
  /** 개봉된 티켓에 등급 색을 입힌다 */
  accent?: string;
  className?: string;
};

const W = 400;
const H = 200;
const R = 18;      // 모서리
const NR = 15;     // 옆구리 노치 반지름

// 좌우 가운데가 반원으로 파인 티켓 외곽선
const OUTLINE =
  `M ${R},0 H ${W - R} A ${R},${R} 0 0 1 ${W},${R}` +
  ` V ${H / 2 - NR} A ${NR},${NR} 0 0 0 ${W},${H / 2 + NR}` +
  ` V ${H - R} A ${R},${R} 0 0 1 ${W - R},${H}` +
  ` H ${R} A ${R},${R} 0 0 1 0,${H - R}` +
  ` V ${H / 2 + NR} A ${NR},${NR} 0 0 1 0,${H / 2 - NR}` +
  ` V ${R} A ${R},${R} 0 0 1 ${R},0 Z`;

// 4갈래 별
const star = (cx: number, cy: number, r: number, w = 0.28) =>
  `M ${cx},${cy - r} Q ${cx + r * w},${cy - r * w} ${cx + r},${cy}` +
  ` Q ${cx + r * w},${cy + r * w} ${cx},${cy + r}` +
  ` Q ${cx - r * w},${cy + r * w} ${cx - r},${cy}` +
  ` Q ${cx - r * w},${cy - r * w} ${cx},${cy - r} Z`;

export default function Ticket({
  variant = 'full', used = false, accent, className = '',
}: Props) {
  const bg = used ? 'var(--tkt-used-bg)' : 'var(--tkt-bg)';
  const line = used ? (accent ?? 'var(--tkt-used-line)') : 'var(--tkt-line)';
  const stubX = 300;           // 뜯는 점선 위치
  const inset = 11;
  const ir = 11;               // 안쪽 테두리 모서리

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={OUTLINE} fill={bg} />

      {/* 안쪽 금선 */}
      <rect
        x={inset} y={inset} width={W - inset * 2} height={H - inset * 2}
        rx={ir} ry={ir}
        fill="none" stroke={line}
        strokeWidth={variant === 'full' ? 3 : 4}
        opacity={used ? 0.5 : 1}
      />

      {variant === 'full' && (
        <>
          {/* 별이 놓일 자리만큼 윗선을 끊는다 */}
          <rect x={126} y={inset - 6} width={78} height={12} fill={bg} />
          <g fill={line}>
            <path d={star(150, inset, 15)} />
            <path d={star(174, inset - 9, 7)} />
            <path d={star(178, inset + 9, 5)} />
          </g>

          {/* 뜯는 점선 */}
          <line
            x1={stubX} y1={inset + 4} x2={stubX} y2={H - inset - 4}
            stroke={line} strokeWidth={3} strokeDasharray="4 9" strokeLinecap="round"
          />
        </>
      )}

      {/* 타일 — 미개봉은 티켓 뒷면처럼 문양을 넣는다 */}
      {variant === 'tile' && !used && (
        <g fill={line} stroke={line}>
          {/* 왼쪽 엠블럼 */}
          <path d={star(46, H / 2, 21)} strokeWidth={0} />
          <path d={star(72, H / 2 - 20, 8)} strokeWidth={0} />

          {/* 오른쪽 바코드 */}
          <g strokeWidth={0} opacity={0.85}>
            {[0, 12, 20, 34, 42, 56, 68, 76].map((d, i) => (
              <rect key={i} x={296 + d} y={H / 2 - 34} width={i % 3 === 0 ? 7 : 4} height={68} rx={1.5} />
            ))}
          </g>
        </g>
      )}

      {/* 타일 — 개봉된 칸. 등급 색으로 얇게 물들이고 뜯긴 자국을 남긴다 */}
      {variant === 'tile' && used && (
        <>
          {/* 등급 색 은은한 배경 */}
          <path d={OUTLINE} fill={line} opacity={0.1} />
          {/* 왼쪽 등급 색 띠 */}
          <rect x={inset + 4} y={inset + 6} width={9} height={H - inset * 2 - 12} rx={4.5}
                fill={line} opacity={0.75} />
          {/* 오른쪽에 뜯긴 자국 */}
          <line
            x1={330} y1={inset + 10} x2={330} y2={H - inset - 10}
            stroke={line} strokeWidth={3} strokeDasharray="3 10" strokeLinecap="round" opacity={0.45}
          />
        </>
      )}
    </svg>
  );
}
