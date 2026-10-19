import Link from 'next/link';

/**
 * 홈페이지 바닥글 — 첫 화면(/site)과 개인정보처리방침(/privacy)이 같이 쓴다.
 * 사업자 표기는 대표 10-19 지정 한 줄(상호 · 대표 · 등록번호 · 소재지 시까지 · 사무소 · 이메일 · ©) — 전체 주소 · 전화는 바닥글에 안 적는다.
 * 전화는 처리방침(국외 이전을 원치 않을 때의 문의 길 · 보호책임자 연락처)에만 남긴다.
 */
export const BIZ = {
  name: '에스씨피에이디(SCPAD Lab)',
  ceo: '남광희',
  regNo: '149-10-03295',
  seat: '경상북도 문경시',
  office: '서울 강북구 덕릉로',
  phone: '010-5090-3180',
  email: 'scpad206@gmail.com',
  instagram: '@kuventing', // 10-19 개설 — 바닥글 · 처리방침(DM 문의)
} as const;

export default function SiteFooter({ demos = true }: { demos?: boolean }) {
  return (
    <footer className="kv-foot">
      <div className="kv-foot-in">
        <div className="kv-foot-brand">
          <Link className="kv-logo" href="/" aria-label="쿠벤팅 홈페이지">
            <img src="/brand/mark.svg" alt="" width={40} height={25} /><span>KUVENTING</span>
          </Link>
          <p>평소엔 광고판, 누르면 럭키드로우</p>
          {/* 폼 말고 메일로 바로 묻고 싶은 사람 — 폼 문의도 같은 메일로 알림이 간다(lib/notify.ts) */}
          <p className="kv-foot-mail">문의 메일 <a href={`mailto:${BIZ.email}`}>{BIZ.email}</a></p>
          <p className="kv-foot-mail">인스타그램 <a href="https://www.instagram.com/kuventing/" target="_blank" rel="noopener">{BIZ.instagram}</a></p>
        </div>
        {demos && (
          <nav className="kv-foot-links" aria-label="데모 바로가기">
            <a href="/demo/beauty" target="_blank" rel="noopener">뷰티 팝업 데모</a>
            <a href="/demo/arven" target="_blank" rel="noopener">시승 행사 데모</a>
            <a href="/demo/cafe" target="_blank" rel="noopener">카페 데모</a>
            <a href="/demo/chicken" target="_blank" rel="noopener">치킨 호프 데모</a>
            <a href="/demo/food" target="_blank" rel="noopener">라멘집 데모</a>
          </nav>
        )}
      </div>
      <div className="kv-foot-biz">
        <p>
          <span>{BIZ.name}</span><span>대표 {BIZ.ceo}</span><span>사업자등록번호 {BIZ.regNo}</span>
          <span>소재지 {BIZ.seat}</span><span>사무소 {BIZ.office}</span><span>이메일 {BIZ.email}</span>
        </p>
        <p className="kv-foot-legal">
          <Link href="/privacy"><b>개인정보처리방침</b></Link>
          <span>© 2026 SCPAD Lab. All rights reserved.</span>
        </p>
      </div>
    </footer>
  );
}
