/**
 * 홈페이지 도입 문의 — 폼(app/site/ContactForm)과 받는 쪽(app/api/inquiry)이 같은 값을 본다.
 * 길이는 supabase/027_inquiries.sql 의 check 와 같아야 한다.
 */
export const INQUIRY_KINDS = ['팝업 스토어·행사', '음식점·카페', '자동차 전시장', '뷰티·브랜드 매장', '기타'] as const;

export const INQUIRY_MAX = { name: 60, contact: 80, message: 1000 } as const;
