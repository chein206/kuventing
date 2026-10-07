import Link from 'next/link';

/**
 * 홈페이지 바닥글 — 첫 화면(/site)과 개인정보처리방침(/privacy)이 같이 쓴다.
 * 사업자 정보는 SCPAD 견적 앱(byd-quo) 약관 · 로그인 화면에 이미 공개해 둔 것과 같다 — 바뀌면 둘 다 고친다.
 */
export const BIZ = {
  name: '에스씨피에이디(SCPAD)',
  ceo: '남광희',
  regNo: '149-10-03295',
  address: '경상북도 문경시 양지3길 3-1, 1층(모전동)',
  phone: '010-5090-3180',
  email: 'scpad206@gmail.com',
} as const;

export default function SiteFooter({ demos = true }: { demos?: boolean }) {
  return (
    <footer className="kv-foot">
      <div className="kv-foot-in">
        <div className="kv-foot-brand">
          <Link className="kv-logo" href="/" aria-label="쿠벤팅 홈페이지">
            <img src="/icon-192.png" alt="" width={28} height={28} /><span>KUVENTING</span>
          </Link>
          <p>평소엔 광고판, 누르면 럭키드로우</p>
          {/* 폼 말고 메일로 바로 묻고 싶은 사람 — 폼 문의도 같은 메일로 알림이 간다(lib/notify.ts) */}
          <p className="kv-foot-mail">문의 메일 <a href={`mailto:${BIZ.email}`}>{BIZ.email}</a></p>
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
          <span>상호 {BIZ.name}</span><span>대표 {BIZ.ceo}</span><span>사업자등록번호 {BIZ.regNo}</span>
        </p>
        <p>
          <span>주소 {BIZ.address}</span><span>전화 {BIZ.phone}</span><span>메일 {BIZ.email}</span>
        </p>
        <p className="kv-foot-legal">
          <Link href="/privacy"><b>개인정보처리방침</b></Link>
          <span>© 2026 SCPAD Lab</span>
        </p>
      </div>
    </footer>
  );
}
