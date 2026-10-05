/** 카운터 화면 여러 곳이 같이 쓰는 등급·그림 판별 */

export const GRADES = 'ABCDEFGH';

/** 등급 색 — 테마가 --ga ~ --gh 로 준다 */
export const gradeColor = (g: string) => {
  const i = GRADES.indexOf(g.toUpperCase());
  return i >= 0 ? `var(--g${GRADES[i].toLowerCase()})` : 'var(--gh)';
};

/**
 * 사진이 아니라 그림(할인권 SVG 같은 것)인지.
 * 그림은 자르면 안 된다 — 안에 이미 글자와 테두리가 들어 있다.
 * 광고 사진을 자르지 않는 것과 같은 이유다.
 */
// 평면 그림(교환권 · 쿠폰)은 자르지 않는다 — SVG, 또는 글꼴을 살리려고 PNG 로 구운 *.flat.png
export const isFlat = (src: string) => /(\.svg|\.flat\.png)($|\?)/i.test(src);

/** 결과 연출의 판 크기 — 피날레 · 금(A·B) · 구리(C) · 은(D 이하) */
export type Tier = 'L' | 'A' | 'C' | 'E';
export const tierOf = (grade: string, isLastOne: boolean): Tier =>
  isLastOne ? 'L' : grade === 'A' || grade === 'B' ? 'A' : grade === 'C' ? 'C' : 'E';
