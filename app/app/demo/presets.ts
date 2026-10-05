import { FOOD_DEMO, type DemoPreset } from '../fx/endgame/sim';

/**
 * 공개 데모 — 홈페이지 · 영업에서 "직접 해 보기"로 여는 판. 메모리에서 돌아 DB 에 아무것도 쓰지 않는다.
 * 브랜드는 데모용 가상 브랜드다(실제 회사 이름 · 로고를 쓰지 않는다). 뷰티는 우리 채널(뷰티성분사전).
 * 상품 그림은 scripts/theme-art.mjs 가 굽는 교환권(*.flat.png — 결과 화면이 자르지 않는다).
 */
export type Demo = DemoPreset & { label: string; note: string };

export const DEMOS: Record<string, Demo> = {
  arven: {
    label: '아르벤 EV 시승 페스타',
    note: '자동차 전시장 시승 행사 — 시승 1팀 = 1장',
    theme: 'photo-arven', font: 'pretendard', title: 'EV 시승 페스타', drawVerb: '시승',
    store: { name: '아르벤 강남 전시장', branch: null, logo: null },
    prizes: [
      { grade: 'A', name: '아르벤 골프백', qty: 1, useWhen: 'now', image: '/demo/arven/a-golfbag.flat.png' },
      { grade: 'B', name: '아르벤 장우산', qty: 3, useWhen: 'now', image: '/demo/arven/b-umbrella.flat.png' },
      { grade: 'C', name: '아르벤 텀블러', qty: 8, useWhen: 'now', image: '/demo/arven/c-tumbler.flat.png' },
      { grade: 'D', name: 'EV 충전 1만원', qty: 13, useWhen: 'later', image: '/demo/arven/d-charge.flat.png' },
      { grade: 'E', name: '라운지 아메리카노', qty: 25, useWhen: 'now', image: '/demo/arven/e-coffee.flat.png' },
    ],
    finale: { name: '주말 시승 1박 2일', image: '/demo/arven/finale.flat.png', label: '피날레 보너스' },
    drawn: 14,
  },
  beauty: {
    label: '뷰티성분사전 팝업',
    note: '팝업 스토어 럭키드로우 — 체험 1회 = 1장',
    theme: 'light-beauty', font: 'pretendard', title: '오늘의 성분 뽑기', drawVerb: '체험',
    store: { name: '뷰티성분사전 팝업', branch: '성수', logo: null },
    prizes: [
      { grade: 'A', name: '본품 풀세트', qty: 1, useWhen: 'now', image: '/demo/beauty/a-fullset.flat.png' },
      { grade: 'B', name: '본품 택1', qty: 4, useWhen: 'now', image: '/demo/beauty/b-bottle.flat.png' },
      { grade: 'C', name: '미니 키트', qty: 10, useWhen: 'now', image: '/demo/beauty/c-minikit.flat.png' },
      { grade: 'D', name: '샘플 3종', qty: 15, useWhen: 'now', image: '/demo/beauty/d-sample.flat.png' },
      { grade: 'E', name: '온라인 15% 할인', qty: 20, useWhen: 'later', image: '/demo/beauty/e-coupon.flat.png' },
    ],
    finale: { name: '팝업 한정 세트', image: '/demo/beauty/finale.flat.png', label: '피날레 보너스' },
    drawn: 16,
  },
  food: {
    ...FOOD_DEMO,
    label: '라멘집 오픈 이벤트',
    note: '음식점 — 1테이블 결제 = 1장',
    store: { name: '데모 라멘', branch: '합정', logo: null },
    drawn: 12,
  },
};
