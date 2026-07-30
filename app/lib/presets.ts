/**
 * 업종별 상품 구성 프리셋.
 *
 * 사장님한테 빈 화면을 주면 거기서 멈춘다. 원가 계산도 못 하고 몇 개를 걸어야
 * 할지 감이 없다. 그래서 채워진 상태로 시작하고 숫자만 고치게 한다.
 * 이 프리셋 설계가 곧 우리가 받는 기획비의 실체다.
 *
 * 배분 원칙 (총 50장 기준)
 *   원가 큰 상품(세트·케익)   4% 이하   → 그 자리 지급, 객단가 상승
 *   중간 상품(단품·사이드)    10~20%    → 그 자리 지급
 *   원가 작은 상품(음료)      20~25%    → 그 자리 지급
 *   할인권                    50% 이상  → 다음 방문, 재방문 유도
 */

export type PresetPrize = {
  grade: string;
  name: string;
  qty: number;
  use_when: 'now' | 'later';
  valid_days?: number;
};

export type Preset = {
  key: string;
  label: string;
  theme: 'warm' | 'modern' | 'neon';
  lastOneName: string;
  prizes: PresetPrize[];
  ads: { title: string; sub: string; price: string; image: null }[];
};

export const TOTAL_DEFAULT = 50;

export const PRESETS: Preset[] = [
  {
    key: 'ramen',
    label: '라멘·국수',
    theme: 'modern',
    lastOneName: '차슈덮밥 세트 무료 + 굿즈',
    prizes: [
      { grade: 'A', name: '차슈덮밥 세트 무료', qty: 1, use_when: 'now' },
      { grade: 'B', name: '라멘 1그릇 무료', qty: 2, use_when: 'now' },
      { grade: 'C', name: '교자 무료', qty: 5, use_when: 'now' },
      { grade: 'D', name: '음료 무료', qty: 10, use_when: 'now' },
      { grade: 'E', name: '1,000원 할인', qty: 32, use_when: 'later', valid_days: 7 },
    ],
    ads: [
      { title: '대표 메뉴', sub: '가장 많이 나가는 메뉴를 적어주세요', price: '', image: null },
      { title: '사이드', sub: '', price: '', image: null },
    ],
  },
  {
    key: 'cafe',
    label: '카페·디저트',
    theme: 'warm',
    lastOneName: '케익 + 음료 2잔 세트',
    prizes: [
      { grade: 'A', name: '케익 + 음료 1잔 세트', qty: 1, use_when: 'now' },
      { grade: 'B', name: '케익 1조각', qty: 3, use_when: 'now' },
      { grade: 'C', name: '시그니처 음료 1잔', qty: 6, use_when: 'now' },
      { grade: 'D', name: '아메리카노 1잔', qty: 12, use_when: 'now' },
      { grade: 'E', name: '1,000원 할인', qty: 28, use_when: 'later', valid_days: 7 },
    ],
    ads: [
      { title: '대표 디저트', sub: '', price: '', image: null },
      { title: '시그니처 음료', sub: '', price: '', image: null },
    ],
  },
  {
    key: 'chicken',
    label: '치킨·호프',
    theme: 'neon',
    lastOneName: '치킨 1마리 + 생맥주 2잔',
    prizes: [
      { grade: 'A', name: '치킨 1마리 무료', qty: 1, use_when: 'later', valid_days: 14 },
      { grade: 'B', name: '사이드 메뉴 무료', qty: 3, use_when: 'now' },
      { grade: 'C', name: '생맥주 1잔 무료', qty: 8, use_when: 'now' },
      { grade: 'D', name: '음료 무료', qty: 10, use_when: 'now' },
      { grade: 'E', name: '2,000원 할인', qty: 28, use_when: 'later', valid_days: 14 },
    ],
    ads: [
      { title: '대표 메뉴', sub: '', price: '', image: null },
      { title: '오늘의 안주', sub: '', price: '', image: null },
    ],
  },
  {
    key: 'bakery',
    label: '베이커리',
    theme: 'warm',
    lastOneName: '인기 빵 3종 세트',
    prizes: [
      { grade: 'A', name: '케이크 1호 교환권', qty: 1, use_when: 'later', valid_days: 30 },
      { grade: 'B', name: '인기 빵 2개', qty: 4, use_when: 'now' },
      { grade: 'C', name: '빵 1개 무료', qty: 10, use_when: 'now' },
      { grade: 'D', name: '음료 무료', qty: 8, use_when: 'now' },
      { grade: 'E', name: '1,000원 할인', qty: 27, use_when: 'later', valid_days: 14 },
    ],
    ads: [
      { title: '오늘 구운 빵', sub: '', price: '', image: null },
      { title: '대표 케이크', sub: '', price: '', image: null },
    ],
  },
  {
    key: 'blank',
    label: '직접 입력',
    theme: 'warm',
    lastOneName: '',
    prizes: [
      { grade: 'A', name: '', qty: 1, use_when: 'now' },
      { grade: 'B', name: '', qty: 3, use_when: 'now' },
      { grade: 'C', name: '', qty: 6, use_when: 'now' },
      { grade: 'D', name: '', qty: 10, use_when: 'now' },
      { grade: 'E', name: '', qty: 30, use_when: 'later', valid_days: 7 },
    ],
    ads: [],
  },
];

/** 4자리 PIN 두 개를 서로 다르게 뽑는다 */
export function randomPins(): { owner: string; board: string } {
  const gen = () => String(Math.floor(1000 + Math.random() * 9000));
  let owner = gen();
  let board = gen();
  while (board === owner) board = gen();
  return { owner, board };
}
