/**
 * 자막 자리 — 세로(t/m/b) × 가로(l/r) 여섯 칸.
 *
 * DB 함수는 아는 값만 받고 나머지는 거부한다(그게 맞다).
 * 라우트에서 한 번 정리해 두면, 옛 화면이나 손으로 만든 요청이 와도
 * 400 이 아니라 기본값으로 흘러간다.
 */

export const AD_POS = ['tl', 'tr', 'ml', 'mr', 'bl', 'br'] as const;
export type AdPos = (typeof AD_POS)[number];

const LEGACY: Record<string, AdPos> = { top: 'tl', mid: 'ml', bottom: 'bl' };

export function normPos(v: unknown): AdPos {
  const k = String(v ?? '').trim().toLowerCase();
  if (k in LEGACY) return LEGACY[k];
  return (AD_POS as readonly string[]).includes(k) ? (k as AdPos) : 'bl';
}
