import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import Link from 'next/link';
import { FONTS } from '@/lib/fonts';
import { SITE_URL } from '@/lib/site';
import SiteFooter, { BIZ } from '../site/SiteFooter';
import '../site/site.css';

/**
 * 개인정보처리방침 — 홈페이지 도입 문의가 이름 · 연락처를 받으므로 공개한다(개인정보 보호법 제30조).
 * 홈페이지와 같은 판(남색 · site.css)에 읽는 글로. 사업자 정보는 SiteFooter 의 BIZ 하나를 같이 쓴다.
 *
 * 국외 이전(제28조의8)은 10-07 실제 자리를 재서 적었다 — 바뀌면 여기도
 *  - 문의 표(Supabase): 일본 도쿄(AWS ap-northeast-1) — db 호스트 IPv6 를 AWS 공개 IP 대역표에 맞춰 확인
 *  - 서버(Vercel 함수): 미국(iad1) — 응답 머리 x-vercel-id
 *  - 알림 메일(Resend) · 메일함(Gmail): 미국
 * 보관 기간 1년은 문의 폼 동의 문구(ContactForm)와 같아야 한다.
 */
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--kv-display', display: 'swap' });
const PRETENDARD = FONTS.find((f) => f.key === 'pretendard')!.css!;
const BLACK_HAN = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap';
const EFFECTIVE = '2026년 10월 7일';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/privacy' },
  title: '개인정보처리방침 | 쿠벤팅',
  description: '쿠벤팅 홈페이지 도입 문의와 서비스에서 처리하는 개인정보, 보관 기간, 위탁과 국외 이전, 이용자의 권리를 알려 드립니다.',
};

export const viewport: Viewport = { maximumScale: 5, userScalable: true, themeColor: '#070B16' };

const ITEMS = [
  ['도입 문의(홈페이지 문의 폼)', '필수: 이름 또는 상호, 업종, 연락처(전화번호 또는 이메일)\n선택: 문의 내용', '문의 폼에 직접 입력'],
  ['메일 문의', '보낸 메일 주소, 이름, 메일 내용', `문의 메일(${BIZ.email})로 직접 보낸 경우`],
  ['자동 생성 정보', '접속 IP 주소, 브라우저 정보, 접속 일시, 문의를 보낸 페이지 주소', '홈페이지와 서비스를 이용하는 과정에서 자동 생성'],
];

const TRUSTEES = [
  ['Supabase Inc.', '문의 내용 저장(데이터베이스 운영)'],
  ['Vercel Inc.', '홈페이지와 서비스 운영(서버, 접속 기록)'],
  ['Resend', '문의 접수 알림 메일 발송'],
  ['Google LLC', '문의 알림과 메일 문의의 수신 · 보관(Gmail)'],
];

const ABROAD = [
  ['Supabase Inc.\nsupabase.com/privacy', '일본(도쿄)', '문의 항목 전부', '문의 저장 · 문의일로부터 1년'],
  ['Vercel Inc.\nvercel.com/legal/privacy-policy', '미국', '문의 항목, 자동 생성 정보', '서버 처리와 접속 기록 · 처리 후 지체 없이(접속 기록은 최대 3개월)'],
  ['Resend\nresend.com/legal/privacy-policy', '미국', '문의 항목', '알림 메일 발송 · 발송 기록 보관 기간'],
  ['Google LLC\npolicies.google.com/privacy', '미국', '문의 항목, 메일 문의 내용', '메일 수신 · 보관 · 문의일로부터 1년'],
];

const lines = (t: string) => t.split('\n').map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>);

export default function PrivacyPage() {
  return (
    <div className={`kv ${display.variable}`}>
      <link rel="stylesheet" href={PRETENDARD} precedence="default" />
      <link rel="stylesheet" href={BLACK_HAN} precedence="default" />

      <header className="kv-doc-nav">
        <div className="kv-nav-in">
          <Link className="kv-logo" href="/" aria-label="쿠벤팅 홈페이지">
            <img src="/icon-192.png" alt="" width={32} height={32} />
            <span>KUVENTING</span>
          </Link>
          <Link className="kv-btn primary sm" href="/#contact" style={{ marginLeft: 'auto' }}>도입 문의</Link>
        </div>
      </header>

      <main className="kv-doc">
        <p className="kv-label">PRIVACY</p>
        <h1>개인정보처리방침</h1>
        <p className="kv-doc-date">시행일 {EFFECTIVE}</p>
        <p className="kv-doc-lead">
          {BIZ.name}(이하 「회사」)는 「개인정보 보호법」에 따라 쿠벤팅 홈페이지(kuventing.scpadlab.com)와
          쿠벤팅 서비스(kuvt.scpadlab.com)를 이용하는 분의 개인정보를 보호하고, 관련 고충을 빠르고 원활하게 처리하기 위해
          다음과 같이 개인정보처리방침을 정해 공개합니다.
        </p>

        <h2><i>01</i>처리하는 개인정보 항목과 수집 방법</h2>
        <div className="kv-doc-table">
          <table>
            <thead><tr><th>구분</th><th>항목</th><th>수집 방법</th></tr></thead>
            <tbody>{ITEMS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{lines(b)}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
        <p>
          쿠벤팅 판(매장 화면)과 데모는 손님의 이름이나 연락처를 받지 않습니다.
          경품 쿠폰(QR)에는 쿠폰 번호와 경품 정보만 담깁니다.
        </p>

        <h2><i>02</i>처리 목적</h2>
        <ul>
          <li>도입 문의 응대: 상담, 경품과 광고 구성 제안, 회신 연락</li>
          <li>서비스 안내</li>
          <li>서비스 안정성 확보와 부정 이용 방지(자동 생성 정보)</li>
        </ul>

        <h2><i>03</i>보유 및 이용 기간</h2>
        <ul>
          <li><b>도입 문의</b>: 문의일로부터 1년 동안 보관한 뒤 파기합니다. 상담이 계약으로 이어지면 계약 이행과 관계 법령이 정한 기간 동안 보관합니다.</li>
          <li><b>메일 문의</b>: 문의일로부터 1년</li>
          <li><b>접속 기록</b>: 최대 3개월(통신비밀보호법)</li>
        </ul>

        <h2><i>04</i>제3자 제공</h2>
        <p>
          회사는 개인정보를 제3자에게 제공하지 않습니다. 다만 정보주체가 미리 동의한 경우,
          법률에 특별한 규정이 있거나 법령상 의무를 지키기 위해 불가피한 경우에는 예외로 합니다.
        </p>

        <h2><i>05</i>처리 위탁</h2>
        <p>원활한 서비스 운영을 위해 아래 업체에 개인정보 처리를 맡기고 있습니다.</p>
        <div className="kv-doc-table">
          <table>
            <thead><tr><th>수탁자</th><th>위탁 업무</th></tr></thead>
            <tbody>{TRUSTEES.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody>
          </table>
        </div>

        <h2><i>06</i>국외 이전</h2>
        <p>
          위탁 업무를 위해 아래와 같이 개인정보가 국외로 이전됩니다(개인정보 보호법 제28조의8).
          이전은 문의를 보내거나 홈페이지에 접속할 때 암호화된 네트워크로 이루어집니다.
        </p>
        <div className="kv-doc-table">
          <table>
            <thead><tr><th>이전받는 자 · 연락처</th><th>국가</th><th>항목</th><th>목적 · 보유 기간</th></tr></thead>
            <tbody>{ABROAD.map(([a, b, c, d]) => <tr key={a}><td>{lines(a)}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>)}</tbody>
          </table>
        </div>
        <p>
          국외 이전을 원하지 않으시면 문의 폼 대신 전화({BIZ.phone})로 문의해 주세요.
          이 경우 문의 폼과 메일 알림을 거치지 않습니다.
        </p>

        <h2><i>07</i>파기 절차와 방법</h2>
        <p>
          보유 기간이 끝나거나 처리 목적을 이루면 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로 지우고,
          종이 문서는 분쇄하거나 소각합니다.
        </p>

        <h2><i>08</i>정보주체의 권리와 행사 방법</h2>
        <p>
          언제든지 개인정보의 열람, 정정, 삭제, 처리 정지를 요구하실 수 있습니다.
          아래 개인정보 보호책임자에게 메일이나 전화로 요청하시면 10일 안에 조치하고 결과를 알려 드립니다.
          법정대리인이나 위임을 받은 사람을 통해서도 요구하실 수 있습니다.
        </p>

        <h2><i>09</i>안전성 확보 조치</h2>
        <ul>
          <li>홈페이지와 서버 사이의 모든 전송을 암호화(HTTPS)합니다.</li>
          <li>문의 기록은 서버만 읽고 쓸 수 있게 막아, 외부에서 직접 접근할 수 없습니다.</li>
          <li>개인정보를 다루는 사람을 대표 1인으로 최소화합니다.</li>
        </ul>

        <h2><i>10</i>자동 수집 장치(쿠키)</h2>
        <p>
          홈페이지는 광고나 방문 분석을 위한 쿠키를 쓰지 않습니다. 데모 화면은 화면 상태를 브라우저 저장소에 잠시 기록할 수 있으나,
          개인을 알아볼 수 있는 정보는 담기지 않습니다.
        </p>

        <h2><i>11</i>개인정보 보호책임자</h2>
        <div className="kv-doc-box">
          <p><b>성명</b> {BIZ.ceo}</p>
          <p><b>직책</b> 대표</p>
          <p><b>연락처</b> <a href={`mailto:${BIZ.email}`}>{BIZ.email}</a> · {BIZ.phone}</p>
        </div>

        <h2><i>12</i>권익 침해 구제 방법</h2>
        <p>개인정보 침해에 대한 신고나 상담이 필요하시면 아래 기관에 문의하실 수 있습니다.</p>
        <ul>
          <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청: 1301 (www.spo.go.kr)</li>
          <li>경찰청: 182 (ecrm.police.go.kr)</li>
        </ul>

        <h2><i>13</i>처리방침의 변경</h2>
        <p>
          이 개인정보처리방침은 {EFFECTIVE}부터 적용됩니다. 내용이 바뀌면 시행 7일 전부터 이 페이지에 알립니다.
        </p>

        <h2><i>14</i>사업자 정보</h2>
        <div className="kv-doc-box">
          <p><b>상호</b> {BIZ.name}</p>
          <p><b>대표자</b> {BIZ.ceo}</p>
          <p><b>사업자등록번호</b> {BIZ.regNo}</p>
          <p><b>주소</b> {BIZ.address}</p>
          <p><b>연락처</b> {BIZ.phone} · {BIZ.email}</p>
        </div>
      </main>

      <SiteFooter demos={false} />
    </div>
  );
}
