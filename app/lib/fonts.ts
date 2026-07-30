/**
 * 카운터 화면 글꼴.
 *
 * 한글 웹폰트는 파일이 크다(글자가 1만 자가 넘는다). 통째로 받으면
 * 4G 태블릿에서 첫 화면이 늦게 뜬다. 그래서 두 가지를 지킨다.
 *
 *  1. **기본값은 내려받지 않는다.** 기기에 있는 글꼴을 쓴다. 고르지 않은 매장은
 *     지금까지와 똑같이 즉시 뜬다.
 *  2. 고른 매장만 그 글꼴을 받는다. 그것도 **쓰는 글자 조각만** 받는다 —
 *     구글 폰트와 프리텐다드 CDN 둘 다 unicode-range 로 잘라 두어서,
 *     브라우저가 화면에 실제로 그리는 글자의 조각만 가져간다.
 *     한 매장 화면은 메뉴 이름 몇 개라 보통 100KB 안쪽으로 끝난다.
 *
 * 글꼴은 매장 성격이지 우리 취향이 아니다. 라멘집과 카페가 같은 글꼴일 이유가 없다.
 */

export type FontKey = 'system' | 'pretendard' | 'myeongjo' | 'gothic' | 'dodum';

export type FontDef = {
  key: FontKey;
  label: string;
  note: string;          // 어떤 매장에 어울리는지
  css: string | null;    // 내려받을 스타일시트. null 이면 받지 않는다
  stack: string;         // font-family 값
};

const SYSTEM = "'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',system-ui,sans-serif";

export const FONTS: FontDef[] = [
  {
    key: 'system',
    label: '기본',
    note: '내려받지 않아 가장 빠르다',
    css: null,
    stack: SYSTEM,
  },
  {
    key: 'pretendard',
    label: '프리텐다드',
    note: '깔끔한 고딕. 숫자가 잘 읽힌다',
    css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css',
    stack: `'Pretendard Variable',${SYSTEM}`,
  },
  {
    key: 'myeongjo',
    label: '본명조',
    note: '차분하고 고급스럽다. 한식·일식·베이커리',
    css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap',
    stack: `'Noto Serif KR','Nanum Myeongjo',serif`,
  },
  {
    key: 'gothic',
    label: '고딕 A1',
    note: '좁고 단단하다. 이름이 길어도 안 눌린다',
    css: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;900&display=swap',
    stack: `'Gothic A1',${SYSTEM}`,
  },
  {
    key: 'dodum',
    label: '고운돋움',
    note: '부드럽고 둥글다. 카페·디저트',
    css: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap',
    stack: `'Gowun Dodum',${SYSTEM}`,
  },
];

export const FONT_MAP: Record<string, FontDef> =
  Object.fromEntries(FONTS.map((f) => [f.key, f]));

export const fontOf = (k?: string | null): FontDef => FONT_MAP[k ?? ''] ?? FONTS[0];

/**
 * 스타일시트를 한 번만 붙인다.
 * 이미 붙어 있으면 아무 일도 하지 않으므로 여러 번 불러도 된다.
 */
export function loadFont(k?: string | null) {
  if (typeof document === 'undefined') return;
  const f = fontOf(k);
  if (!f.css) return;
  const id = `kuvt-font-${f.key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = f.css;
  document.head.appendChild(link);
}
