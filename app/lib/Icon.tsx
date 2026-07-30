/**
 * 화면에 쓰는 그림은 전부 여기서 그린다. 이모지를 쓰지 않는다.
 *
 * 이모지는 기기마다 모양이 다르다. 사장님 폰(삼성)·태블릿(안드로이드)·
 * 내 PC(윈도우)에서 각각 다르게 그려지고, 색도 우리가 못 정한다.
 * 카운터에 세워 두는 화면이라 글자색과 톤이 어긋나면 바로 티가 난다.
 *
 * 규칙
 *  - 24×24 좌표계, 선 두께 1.8, 색은 currentColor
 *  - 크기는 부모의 font-size 를 따른다 (1em). 필요하면 className 으로 덮어쓴다
 *  - 장식용이라 aria-hidden. 뜻이 필요한 자리는 부모에 aria-label 을 단다
 */

type Props = { name: IconName; className?: string; strokeWidth?: number };

export type IconName =
  | 'ticket' | 'key' | 'chart' | 'check' | 'gift' | 'megaphone'
  | 'close' | 'camera' | 'plus' | 'minus' | 'star'
  | 'up' | 'down' | 'backspace' | 'keypad' | 'clock' | 'warn';

/** 선으로 그리는 아이콘 */
const STROKE: Partial<Record<IconName, React.ReactNode>> = {
  // 티켓 — 좌우가 오목한 표
  ticket: <>
    <path d="M3 8.5V6.2c0-.7.6-1.2 1.2-1.2h15.6c.7 0 1.2.5 1.2 1.2v2.3a3.5 3.5 0 0 0 0 7v2.3c0 .7-.5 1.2-1.2 1.2H4.2c-.6 0-1.2-.5-1.2-1.2v-2.3a3.5 3.5 0 0 0 0-7Z" />
    <path d="M9 8v8" strokeDasharray="2 2.4" />
  </>,
  key: <>
    <circle cx="8" cy="8" r="4" />
    <path d="M10.9 10.9 20 20M17 17l-2 2 2 2 2-2-2-2" />
  </>,
  // 막대그래프 — 홈·대시보드
  chart: <>
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V7M17 20v-9" />
  </>,
  check: <path d="M5 12.8 9.6 17.4 19 8" />,
  // 선물 상자 — 상품
  gift: <>
    <path d="M4 10.5h16V19c0 .8-.6 1.4-1.4 1.4H5.4C4.6 20.4 4 19.8 4 19v-8.5Z" />
    <path d="M3 7.4h18v3.1H3zM12 7.4v13" />
    <path d="M12 7.4C11 4.6 9.7 3.4 8.3 3.6c-1.9.3-2 2.8-.3 3.8M12 7.4c1-2.8 2.3-4 3.7-3.8 1.9.3 2 2.8.3 3.8" />
  </>,
  megaphone: <>
    <path d="M4 10.2 15.5 5.4v13.2L4 13.8Z" />
    <path d="M15.5 8.6a3.4 3.4 0 0 1 0 6.8" />
    <path d="M6.8 14.6l1.1 4.6c.2.7.9 1.1 1.6.9l.6-.2c.7-.2 1.1-.9.9-1.6l-1-4" />
  </>,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />,
  camera: <>
    <path d="M3.6 8.8h3.1l1.4-2.2h7.8l1.4 2.2h3.1c.5 0 .9.4.9.9v8.4c0 .5-.4.9-.9.9H3.6c-.5 0-.9-.4-.9-.9V9.7c0-.5.4-.9.9-.9Z" />
    <circle cx="12" cy="14" r="3.3" />
  </>,
  plus: <path d="M12 5.6v12.8M5.6 12h12.8" />,
  minus: <path d="M5.6 12h12.8" />,
  up: <path d="M12 19V6M6.4 11.6 12 6l5.6 5.6" />,
  down: <path d="M12 5v13M17.6 12.4 12 18l-5.6-5.6" />,
  backspace: <>
    <path d="M8.4 5.6h11c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4h-11L2.8 12Z" />
    <path d="M11.6 9.6 16 14.4M16 9.6l-4.4 4.8" />
  </>,
  keypad: <>
    <path d="M2.8 6.6h18.4c.6 0 1 .5 1 1v8.8c0 .6-.4 1-1 1H2.8c-.6 0-1-.4-1-1V7.6c0-.5.4-1 1-1Z" />
    <path d="M6 10h.01M9.4 10h.01M12.8 10h.01M16.2 10h.01M19 10h.01M6 13.6h.01M8.6 13.6h6.8M17.6 13.6h.01" />
  </>,
  clock: <>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.2V12l3.4 2.2" />
  </>,
  warn: <>
    <path d="M12 4.2 21 19.4H3Z" />
    <path d="M12 9.6v4.2M12 16.6h.01" />
  </>,
};

/** 칠해서 그리는 아이콘 — 별은 선보다 채움이 눈에 잘 들어온다 */
const FILL: Partial<Record<IconName, React.ReactNode>> = {
  star: <path d="M12 3.4l2.7 5.6 6.1.85-4.45 4.3 1.07 6.05L12 17.35 6.57 20.2l1.07-6.05L3.2 9.85l6.1-.85Z" />,
};

export function Icon({ name, className, strokeWidth = 1.8 }: Props) {
  const filled = FILL[name];
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...(filled
        ? { fill: 'currentColor' }
        : {
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          })}
    >
      {filled ?? STROKE[name]}
    </svg>
  );
}
