/**
 * 카운터 화면 테마 — 판 밝기 × 문양.
 *
 * 예전 이름(따뜻한·모던·네온)은 **취향**이라 사장님이 무엇을 고르는지 알 수 없었다.
 * 두 축으로 쪼개면 각각 고를 이유가 생긴다.
 *
 *   판 밝기  매장 조명과 유리창 방향이 정한다.
 *            밤 장사면 어두운 판, 낮에 창가 자리면 밝은 판.
 *   문양      업종이 정한다. 서양 활판(극장 입장권) / 동양 인찰(한지 + 전각).
 *
 * 2 × 2 = 4가지. 티켓은 같은 뼈대를 쓰고 종이색·잉크·무늬만 갈린다.
 *
 * 티켓 아트의 "AI티"는 **둥근 사각 + 금색 테두리 + 4갈래 반짝별 + 가짜 바코드**
 * 조합에서 나온다. 넷 다 벡터 UI가 습관적으로 그리는 모양이라 눈이 곧바로
 * "프로그램이 그린 그림"으로 읽는다. 대신 실제 입장권의 문법을 쓴다 —
 * 종이결, 2중 활판 괘선, 천공(구멍), 지폐용 기요셰 무늬, 검인 도장.
 */

export type ThemeKey = 'dark-west' | 'dark-east' | 'light-west' | 'light-east';

export type Art = {
  /** 종이색 */
  pap: string;
  /** 잉크색 — 괘선·번호·천공이 다 이 색이다 */
  ink: string;
  /** 번호 색 (보통 잉크와 같지만 박 판은 다르다) */
  numc: string;
  numFont: string;
  radius: number;
  /** 보안 잔무늬 띠 세기. 0이면 안 그린다 */
  band: number;
  bandSrc: string;
  /** 스텁 로제트 세기 */
  ros: number;
  rosSrc: string;
  /** 종이결 세기 */
  grain: number;
  grainSrc: string;
  /** 천공(구멍 줄) 세기 */
  perf: number;
  /** 검인 도장 세기 */
  stamp: number;
  /** 동양 판 — 도장이 사각 전각이고 무늬가 아사노하 */
  east?: boolean;
};

/* ------------------------------------------------------------
   종이결 — 이미지를 받지 않고 그린다.

   원안은 512px 핑크노이즈 PNG 타일이었다. 태블릿에서 칸 50개가 같은 타일을
   물고 있으면 첫 화면이 그만큼 늦고, 파일도 따로 관리해야 한다.
   feTurbulence 는 브라우저가 계산하는 같은 종류의 노이즈라 결과가 거의 같고
   받아올 것이 없다. 데이터 URI 라 요청도 0이다.
------------------------------------------------------------ */
function grain(freq: number, octaves: number, seed: number, rgb: [number, number, number], a: number) {
  const [r, g, b] = rgb;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${a} ${a * 0.6} ${a * 0.3} 0 0"/>` +
    `</filter><rect width="180" height="180" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** 크라프트지 — 거칠고 잔결이 굵다 */
const KRAFT = grain(0.82, 4, 7, [0.29, 0.22, 0.13], 0.62);
/** 한지 — 결이 성기고 부드럽다 */
const HANJI = grain(0.42, 3, 11, [0.34, 0.28, 0.18], 0.44);

const WEST = (pap: string): Art => ({
  pap,
  ink: '#2B2118',
  numc: '#2B2118',
  numFont: "Georgia,'Times New Roman',serif",
  radius: 3,
  band: 0.14, bandSrc: '/art/guilloche-band.svg',
  ros: 0.18, rosSrc: '/art/guilloche-rosette.svg',
  grain: 0.74, grainSrc: KRAFT,
  perf: 0.85, stamp: 0.9,
});

const EAST = (pap: string): Art => ({
  pap,
  ink: '#33291C',
  numc: '#33291C',
  numFont: "Batang,'Apple SD Gothic Neo',Georgia,serif",
  radius: 2,
  band: 0.14, bandSrc: '/art/asanoha.svg',
  ros: 0, rosSrc: '',
  grain: 0.6, grainSrc: HANJI,
  perf: 0.8, stamp: 0.9,
  east: true,
});

export type ThemeDef = {
  key: ThemeKey;
  label: string;
  /** 어떤 매장에 어울리는지 — 사장님이 고를 때 읽는 한 줄 */
  note: string;
  dark: boolean;
  art: Art;
};

export const THEMES: ThemeDef[] = [
  {
    key: 'dark-west',
    label: '어두운 판 · 서양 활판',
    note: '검은 판에 크라프트 표. 밤 장사 · 라멘 · 바',
    dark: true,
    art: WEST('#D3C1A1'),
  },
  {
    key: 'dark-east',
    label: '어두운 판 · 동양 인찰',
    note: '한지 표에 주홍 전각. 일식 · 한식 · 전통주',
    dark: true,
    art: EAST('#E6DCC6'),
  },
  {
    key: 'light-west',
    label: '밝은 판 · 서양 활판',
    note: '낮에 유리창 밖에서 가장 잘 읽힌다. 카페 · 베이커리 · 분식',
    dark: false,
    art: WEST('#C8B58F'),
  },
  {
    key: 'light-east',
    label: '밝은 판 · 동양 인찰',
    note: '한지 판에 한지 표. 테두리와 도장으로만 가른다',
    dark: false,
    art: EAST('#DCD0B2'),
  },
];

export const THEME_MAP: Record<string, ThemeDef> =
  Object.fromEntries(THEMES.map((t) => [t.key, t]));

/** 예전 이름으로 저장된 매장 — 판 밝기만 맞춰서 옮긴다 */
const LEGACY: Record<string, ThemeKey> = {
  modern: 'dark-west',
  neon: 'dark-west',
  warm: 'light-west',
};

export const themeOf = (k?: string | null): ThemeDef =>
  THEME_MAP[k ?? ''] ?? THEME_MAP[LEGACY[k ?? ''] ?? ''] ?? THEMES[0];

/** DB 에 넣기 전에 예전 이름을 새 이름으로 바꾼다 */
export const normTheme = (k?: string | null): ThemeKey => themeOf(k).key;
