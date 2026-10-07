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
  cafe: {
    label: '망원 디저트 카페',
    note: '카페 신메뉴 이벤트 · 음료 1잔 주문 = 1장',
    theme: 'light-west', font: 'pretendard', title: '신메뉴 럭키드로우', drawVerb: '주문',
    store: { name: '망원 디저트 카페', branch: null, logo: null },
    // 카페 시험 때 쓴 상품 · 메뉴 사진(이미지규격.md 대로 뽑은 것). 구성은 lib/presets.ts 카페 · 디저트와 같다
    prizes: [
      { grade: 'A', name: '케익 + 음료 세트', qty: 1, useWhen: 'now', image: '/img/prize-cafe-a.jpg' },
      { grade: 'B', name: '딸기 케익 1조각', qty: 3, useWhen: 'now', image: '/img/prize-cafe-b.jpg' },
      { grade: 'C', name: '아인슈페너 1잔', qty: 6, useWhen: 'now', image: '/img/prize-cafe-c.jpg' },
      { grade: 'D', name: '아이스 아메리카노', qty: 12, useWhen: 'now', image: '/img/prize-cafe-d.jpg' },
      { grade: 'E', name: '1,000원 할인', qty: 28, useWhen: 'later', image: '/art/coupon-1000.svg' },
    ],
    finale: { name: '케익 + 음료 2잔 세트', image: '/img/prize-cafe-last.jpg', label: '피날레 보너스' },
    promos: [
      { kicker: '오늘의 디저트', title: '딸기 생크림 케익', sub: '매일 아침 굽는 시트, 생딸기 가득', price: '6,500원', image: '/img/menu-딸기생크림케익.jpg' },
      { kicker: '시그니처', title: '아인슈페너', sub: '직접 휘핑한 크림 아래 진한 커피', price: '5,500원', image: '/img/menu-아인슈페너.jpg' },
      { kicker: '둘이 오면', title: '케익 세트', sub: '케익 한 조각에 음료 두 잔', price: '14,000원', image: '/img/menu-딸기케익세트.jpg' },
    ],
    drawn: 10,
  },
  chicken: {
    label: '을지로 치킨 호프',
    note: '치킨 · 호프 치맥 이벤트 · 1테이블 주문 = 1장',
    // 밤 장사라 어두운 참나무 판(사진 판 · 활판 입장권). 구성은 lib/presets.ts 치킨 · 호프와 같다 — 치킨 1마리는 다음 방문(14일)
    theme: 'photo-letterpress', font: 'pretendard', title: '치맥 럭키드로우', drawVerb: '주문',
    store: { name: '을지로 치킨 호프', branch: null, logo: null },
    prizes: [
      { grade: 'A', name: '치킨 1마리', qty: 1, useWhen: 'later', image: '/demo/chicken/a-chicken.jpg' },
      { grade: 'B', name: '치즈볼 무료', qty: 3, useWhen: 'now', image: '/demo/chicken/b-cheeseball.jpg' },
      { grade: 'C', name: '생맥주 1잔', qty: 8, useWhen: 'now', image: '/demo/chicken/c-beer.jpg' },
      { grade: 'D', name: '음료 1잔', qty: 10, useWhen: 'now', image: '/demo/chicken/d-cola.jpg' },
      { grade: 'E', name: '2,000원 할인', qty: 28, useWhen: 'later', image: '/art/coupon-2000.svg' },
    ],
    finale: { name: '치킨 1마리 + 생맥주 2잔', image: '/demo/chicken/finale.jpg', label: '피날레 보너스' },
    promos: [
      { kicker: '오늘의 치킨', title: '바삭한 후라이드', sub: '주문 즉시 두 번 튀깁니다', price: '19,000원', image: '/demo/chicken/slide-1.jpg' },
      { kicker: '반반', title: '양념 반\n후라이드 반', sub: '고민될 땐 둘 다', price: '20,000원', image: '/demo/chicken/slide-2.jpg' },
      { kicker: '치맥', title: '생맥주와 함께', sub: '치킨 주문 1테이블 = 1장, 꽝 없음', image: '/demo/chicken/slide-3.jpg' },
    ],
    drawn: 12,
  },
};
