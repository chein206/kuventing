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

export type ThemeKey =
  | 'dark-west' | 'dark-east' | 'light-west' | 'light-east'
  | 'photo-letterpress' | 'photo-brass'
  | 'classic'
  | 'photo-arven' | 'light-beauty';

/**
 * 사진 원판 한 벌.
 *
 * 사진마다 **천공 열 위치가 다르다**(활판 73.8% · 검표 64.5% · 황동 75.6%).
 * 번호를 천공 왼쪽 영역의 가운데에 앉히려면 그 값을 각각 들고 있어야 한다.
 * 재서 상수로 갖고 있지 않으면 원판을 바꿀 때마다 번호가 어긋난다.
 *
 * **여러 원판을 한 판에 섞어 쓰면 안 된다** — 천공 자리가 칸마다 달라 보인다.
 */
export type Photo = {
  /** 큰 카드·타일용 원판 (배경 없는 투명 PNG, 천공이 실제로 뚫려 있다) */
  src: string;
  /** 미니 칸 전용 원판 — 괘선 한 줄 + 여백뿐 */
  miniSrc: string;
  /** 가로 ÷ 세로 */
  ratio: number;
  /** 천공 열의 가로 위치 (0~1). 1 이면 천공이 없다 */
  perf: number;
  /** 검인 도장. 글자까지 사진이고 잉크 농담이 알파에 들어 있다 */
  stampSrc: string;
  /** 원판에 눌러 둔 빈 도장 자리. 없으면 오른쪽 기본 자리에 찍는다 */
  stampAt?: { x: number; y: number; d: number };
  /** 밀랍 봉인 — 가운데가 비어 있어 글자를 얹을 수 있다 */
  sealSrc: string;
  /** 개봉 화면에서 미는 황동 레버 (가로로 찍힌 것을 세워 쓴다) */
  leverSrc: string;
  /** 판 표면 — 이음새 없이 반복된다 */
  surface: string;
  /** 개봉 화면에서 말려 올라간 표 뒷면 색. 없으면 크라프트지 */
  back?: string;
  /** 쓴 칸 덮개. 없으면 어둡게 — 밝은 판에서 검은 덮개는 판에 구멍이 난 것처럼 무겁다 */
  dim?: string;
  /** 결과 카드에서 그림(교환권) 둘레 바탕. 없으면 먹색 — 밝은 교환권을 먹색에 앉히면 액자만 보인다 */
  mat?: string;
};

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

  /**
   * 사진 원판.
   *
   * 있으면 티켓을 벡터로 그리지 않고 이 사진을 깐다. 종이 섬유, 잉크가 눌린 자리,
   * 황동 포일의 각도별 광택은 벡터로 흉내 낼 수 없다.
   *
   * 다만 **미니 칸(69×49)은 사진이 진다** — 그 크기로 줄이면 2중 괘선이 한 줄로
   * 뭉개진다. 그래서 미니 칸 전용 원판을 따로 둔다.
   */
  photo?: Photo;

  /* ── 처음 만든 판이 쓰는 것들 ── */
  /** 뜯는 자리를 천공 대신 점선으로 */
  dash?: number;
  /** 4갈래 반짝별 */
  star?: number;
  /** 줄무늬(바코드 흉내) */
  bars?: number;
  /** 좌우 옆구리가 반원으로 파인 입장권 실루엣 */
  notch?: boolean;
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

/**
 * 처음 만든 판 — 남색 바탕에 금선.
 *
 * 활판 입장권으로 갈아 끼우면서 지운 게 아니라 **한 칸으로 옮겼다.**
 * 셋(별·바코드·점선)이 벡터 UI 의 상투구인 것은 맞지만, 그게 곧 못 쓸 물건이라는
 * 뜻은 아니다. 어떤 매장은 이쪽이 어울리고, 무엇보다 **고를 수 있어야 비교가 된다.**
 * 첫 매장에서 사장님이 둘을 나란히 보고 정하면 된다.
 *
 * 종이결·기요셰·검인은 넣지 않는다 — 그건 활판 쪽의 문법이고, 여기 섞으면
 * 둘 다 아닌 것이 된다.
 */
const CLASSIC: Art = {
  pap: '#1E2E52',
  ink: '#C9A24B',
  numc: '#EFE0B8',
  numFont: "'Pretendard','Apple SD Gothic Neo',sans-serif",
  radius: 8,
  band: 0, bandSrc: '',
  ros: 0, rosSrc: '',
  grain: 0, grainSrc: '',
  perf: 0, stamp: 0,
  dash: 1, star: 1, bars: 1, notch: true,
};

/* ------------------------------------------------------------
   사진 판 — 원판을 사진으로 찍어 얹는다.

   사진이 이긴 것   종이 섬유 · 잉크가 눌린 자리 · 황동 포일의 각도별 광택.
                   특히 포일은 벡터로 흉내 낼 수 없다.
   벡터가 이긴 것   미니 칸(69×49). 사진을 그 크기로 줄이면 괘선이 뭉개진다.
                   그래서 미니 칸은 전용 원판을 따로 쓴다.

   운용은 와이파이라 용량은 우선순위가 낮다. 사진을 쓸지 말지는 **읽히는지**로만 가른다.
------------------------------------------------------------ */
const PHOTO_BASE = {
  stampSrc: '/photo/stamp-geom.png',
  sealSrc: '/photo/seal-wax.png',
  leverSrc: '/photo/handle-brass.png',
  surface: '/photo/surface-oak.jpg',
  miniSrc: '/photo/ticket-mini.png',
};

/** 활판 입장권 — 크라프트지 · 2중 활판 괘선 · 실제로 뚫린 천공 */
const PHOTO_LETTERPRESS: Photo = {
  ...PHOTO_BASE, src: '/photo/ticket-letterpress.png', ratio: 1.877, perf: 0.738,
};
/** 황동 포일 — 각도에 따라 색이 변한다. 사진으로 뽑아 가장 값을 한 장 */
const PHOTO_BRASS: Photo = {
  ...PHOTO_BASE, src: '/photo/ticket-brass.png', ratio: 1.891, perf: 0.756,
};

/* ------------------------------------------------------------
   브랜드 판 — 업종 데모용 가상 브랜드. 사진 대신 SVG 로 그려 구운 원판(scripts/theme-art.mjs).
   규칙은 사진 판과 같다(천공 76% · 미니 칸 · 검인 · 봉인 · 이음새 없는 바닥).
   사장님 화면의 테마 고르기에는 안 나온다(brand) — 행사를 맡을 때 우리가 붙인다.
------------------------------------------------------------ */
/** 아르벤 — 전기차 시승. 블랙 키 카드 · 일렉트릭 블루 · 카본 바닥 */
const PHOTO_ARVEN: Photo = {
  src: '/photo/ticket-arven.png', miniSrc: '/photo/ticket-arven-mini.png', ratio: 1400 / 757, perf: 0.76,
  stampSrc: '/photo/stamp-arven.png', stampAt: { x: 0.88, y: 0.5, d: 0.22 },
  sealSrc: '/photo/seal-arven.png', leverSrc: '/photo/handle-brass.png',
  surface: '/photo/surface-carbon.jpg', back: '#1A1E25',
};
/** 뷰티성분사전 — 팝업. 블러시 성분 카드 · 로즈골드 · 흰 대리석 바닥(채널 화면 톤) */
const PHOTO_BEAUTY: Photo = {
  src: '/photo/ticket-beauty.png', miniSrc: '/photo/ticket-beauty-mini.png', ratio: 1400 / 757, perf: 0.76,
  stampSrc: '/photo/stamp-beauty.png', stampAt: { x: 0.88, y: 0.5, d: 0.22 },
  sealSrc: '/photo/seal-beauty.png', leverSrc: '/photo/handle-brass.png',
  surface: '/photo/surface-marble.jpg', back: '#EAD2C8',
  dim: 'rgba(74,35,56,.32)', mat: '#E4C9BF',
};
const BRAND_ART = (photo: Photo, pap: string, numc: string, numFont: string): Art => ({
  pap, ink: numc, numc, numFont, radius: 5,
  band: 0, bandSrc: '', ros: 0, rosSrc: '', grain: 0, grainSrc: '', perf: 0, stamp: 0,
  photo,
});

const PHOTO_ART = (photo: Photo, ink: string, radius: number): Art => ({
  pap: '#D3C1A1',
  ink,
  numc: ink,
  numFont: "Georgia,'Times New Roman',serif",
  radius,
  band: 0, bandSrc: '',
  ros: 0, rosSrc: '',
  grain: 0, grainSrc: '',
  perf: 0, stamp: 0,
  photo,
});

export type ThemeDef = {
  key: ThemeKey;
  label: string;
  /** 어떤 매장에 어울리는지 — 사장님이 고를 때 읽는 한 줄 */
  note: string;
  dark: boolean;
  art: Art;
  /** 브랜드 판 — 사장님 테마 고르기에는 안 나온다 */
  brand?: boolean;
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
  {
    key: 'photo-letterpress',
    label: '사진 판 · 활판 입장권',
    note: '진짜 종이를 찍어 얹었다. 참나무 판 위 · 밀랍 봉인',
    dark: true,
    art: PHOTO_ART(PHOTO_LETTERPRESS, '#2B2118', 10),
  },
  {
    key: 'photo-brass',
    label: '사진 판 · 황동 포일',
    note: '포일이 각도에 따라 색이 변한다. 상등 판',
    dark: true,
    art: PHOTO_ART(PHOTO_BRASS, '#7E5F18', 2),
  },
  {
    key: 'classic',
    label: '처음 만든 판 · 남색 입장권',
    note: '남색 바탕에 금선. 무늬 없이 단순하다',
    dark: true,
    art: CLASSIC,
  },
  {
    key: 'photo-arven',
    label: '브랜드 · 아르벤 EV 시승',
    note: '블랙 키 카드 · 일렉트릭 블루 · 카본 바닥 (데모 가상 브랜드)',
    dark: true,
    art: BRAND_ART(PHOTO_ARVEN, '#14171C', '#EEF1F6', "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif"),
    brand: true,
  },
  {
    key: 'light-beauty',
    label: '브랜드 · 뷰티성분사전 팝업',
    note: '블러시 성분 카드 · 로즈골드 · 흰 대리석 바닥',
    dark: false,
    art: BRAND_ART(PHOTO_BEAUTY, '#F3E3DC', '#4A2338', "Georgia,'Times New Roman',serif"),
    brand: true,
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
