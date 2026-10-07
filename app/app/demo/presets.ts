import { FOOD_DEMO, type DemoPreset } from '../fx/endgame/sim';

/**
 * 공개 데모 — 홈페이지 · 영업에서 "직접 해 보기"로 여는 판. 메모리에서 돌아 DB 에 아무것도 쓰지 않는다.
 * 브랜드는 데모용 가상 브랜드다(실제 회사 이름 · 로고를 쓰지 않는다). 뷰티는 우리 채널(뷰티성분사전).
 * 상품 · 광고 사진은 Flow 로 뽑았다 — 시트 · 고른 원본 · 설치 스크립트는 kuventing/assets/demo/.
 * 광고 사진이 있으면 대기 화면 첫 장이 모션 광고가 된다(사진 + 키커 · 제목 · 설명 · 가격, 끝에 매장 사인 컷).
 */
export type Demo = DemoPreset & { label: string; note: string };

export const DEMOS: Record<string, Demo> = {
  arven: {
    label: '아르벤 EV 시승 페스타',
    note: '자동차 전시장 시승 행사 · 시승 1팀 = 1장',
    theme: 'photo-arven', font: 'pretendard', title: 'EV 시승 페스타', drawVerb: '시승',
    store: { name: '아르벤 강남 전시장', branch: null, logo: null },
    prizes: [
      { grade: 'A', name: '아르벤 골프백', qty: 1, useWhen: 'now', image: '/demo/arven/a-golfbag.jpg' },
      { grade: 'B', name: '아르벤 장우산', qty: 3, useWhen: 'now', image: '/demo/arven/b-umbrella.jpg' },
      { grade: 'C', name: '아르벤 텀블러', qty: 8, useWhen: 'now', image: '/demo/arven/c-tumbler.jpg' },
      { grade: 'D', name: 'EV 충전 1만원', qty: 13, useWhen: 'later', image: '/demo/arven/d-charge.jpg' },
      { grade: 'E', name: '라운지 아메리카노', qty: 25, useWhen: 'now', image: '/demo/arven/e-coffee.jpg' },
    ],
    finale: { name: '주말 시승 1박 2일', image: '/demo/arven/finale.jpg', label: '피날레 보너스' },
    promos: [
      { kicker: 'EV 시승 페스타', title: '한 번 타 보면\n압니다', sub: '예약 없이 전시장에서 바로', price: '시승 무료', image: '/demo/arven/slide-1.jpg' },
      { kicker: '실내', title: '달리는 라운지', sub: '넓은 화면과 조용한 실내, 앉아 보면 압니다', image: '/demo/arven/slide-2.jpg' },
      { kicker: '피날레 보너스', title: '주말엔 바닷길로', sub: '주말 시승 1박 2일, 판에 단 한 장', image: '/demo/arven/slide-3.jpg' },
      { kicker: '시승 선물', title: '시승 1팀 = 1장', sub: '골프백 · 장우산 · 텀블러 · 충전 쿠폰', price: '꽝 없음', image: '/demo/arven/slide-4.jpg' },
    ],
    drawn: 14,
  },
  beauty: {
    label: '뷰티성분사전 팝업',
    note: '팝업 스토어 럭키드로우 · 체험 1회 = 1장',
    theme: 'light-beauty', font: 'pretendard', title: '오늘의 성분 뽑기', drawVerb: '체험',
    store: { name: '뷰티성분사전 팝업', branch: '성수', logo: null },
    prizes: [
      { grade: 'A', name: '본품 풀세트', qty: 1, useWhen: 'now', image: '/demo/beauty/a-fullset.jpg' },
      { grade: 'B', name: '본품 택1', qty: 4, useWhen: 'now', image: '/demo/beauty/b-serum.jpg' },
      { grade: 'C', name: '미니 키트', qty: 10, useWhen: 'now', image: '/demo/beauty/c-minikit.jpg' },
      { grade: 'D', name: '샘플 3종', qty: 15, useWhen: 'now', image: '/demo/beauty/d-sample.jpg' },
      { grade: 'E', name: '온라인 15% 할인', qty: 20, useWhen: 'later', image: '/demo/beauty/e-coupon.jpg' },
    ],
    finale: { name: '팝업 한정 세트', image: '/demo/beauty/finale.jpg', label: '피날레 보너스' },
    promos: [
      { kicker: 'POP-UP · 성수', title: '성분부터 보고\n고르는 팝업', sub: '뷰티성분사전이 고른 제품을 직접 발라 보세요', image: '/demo/beauty/slide-1.jpg' },
      { kicker: '오늘의 성분', title: '바르기 전에,\n성분부터', sub: '제형 · 향 · 흡수감을 체험존에서', image: '/demo/beauty/slide-2.jpg' },
      { kicker: '체험존', title: '체험 1회 = 1장', sub: '꽝 없는 뽑기, 본품 풀세트까지', price: '꽝 없음', image: '/demo/beauty/slide-3.jpg' },
      { kicker: '피날레 보너스', title: '팝업 한정 세트', sub: '판에 단 한 장, 팝업에서만', image: '/demo/beauty/slide-4.jpg' },
    ],
    drawn: 16,
  },
  food: {
    ...FOOD_DEMO,
    label: '라멘집 오픈 이벤트',
    note: '음식점 · 1테이블 결제 = 1장',
    store: { name: '합정 라멘집', branch: null, logo: null },
    // 라멘집 시험 때 쓴 메뉴 사진(이미지규격.md 대로 뽑은 것)
    promos: [
      { title: '매운 미소라멘', sub: '직접 볶은 미소와 고추기름', price: '11,000원', image: '/img/menu-미소라멘.jpg' },
      { title: '차슈덮밥', sub: '두툼한 차슈 5장, 특제 간장 베이스', price: '12,000원', image: '/img/menu-차슈덮밥세트.jpg' },
      { title: '교자 6개', sub: '주문 즉시 굽습니다', price: '6,000원', image: '/img/menu-교자.jpg' },
    ],
    drawn: 12,
  },
};
