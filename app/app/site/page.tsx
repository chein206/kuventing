import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { Icon } from '@/lib/Icon';
import { FONTS } from '@/lib/fonts';
import SiteMotion from './SiteMotion';
import Steps from './Steps';
import Demos from './Demos';
import ContactForm from './ContactForm';
import './site.css';

/**
 * 쿠벤팅 공식 홈페이지. 사장님 · 행사 담당자에게 "이게 뭔지"를 실제 화면으로 보여 주고 도입 문의를 받는다.
 *
 * - 판 · 색은 로고(남색 바탕 + 금색 표)를 그대로 키웠다. 금색 하나만 강조색으로 쓴다
 * - 움직이는 그림은 전부 실제 화면이다 — 데모 판을 손님처럼 한 바퀴 돌며 녹화한 영상(assets/site/build_assets.py)
 * - 이 앱(kuvt)은 서비스 도메인이라 검색을 막아 둔다(robots.ts). 홈페이지 도메인을 붙이면 그 주소의 / 를 여기로 돌린다
 */

// 영문 워드마크 · 큰 숫자. 한글은 프리텐다드(CDN 조각 받기 — 카운터 화면과 같은 주소)
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--kv-display', display: 'swap' });
const PRETENDARD = FONTS.find((f) => f.key === 'pretendard')!.css!;

export const metadata: Metadata = {
  title: '쿠벤팅 | 꽝 없는 매장 뽑기판',
  description: '결제, 시승, 체험 한 번에 한 장. 태블릿 하나로 매장에 여는 꽝 없는 뽑기판, 쿠벤팅.',
  openGraph: {
    title: '쿠벤팅 | 꽝 없는 매장 뽑기판',
    description: '결제, 시승, 체험 한 번에 한 장. 태블릿 하나로 매장에 여는 꽝 없는 뽑기판.',
    images: ['/site/og.jpg'],
    type: 'website',
    locale: 'ko_KR',
  },
};

const PRIZES = [
  { img: 'golfbag', name: '골프백', kind: '시승 행사' },
  { img: 'cake', name: '딸기 케이크', kind: '카페' },
  { img: 'fullset', name: '본품 풀세트', kind: '뷰티 팝업' },
  { img: 'ramen', name: '라멘 한 그릇', kind: '음식점' },
  { img: 'umbrella', name: '장우산', kind: '시승 행사' },
  { img: 'einspanner', name: '아인슈페너', kind: '카페' },
  { img: 'serum', name: '세럼 본품', kind: '뷰티 팝업' },
  { img: 'gyoza', name: '교자', kind: '음식점' },
  { img: 'coffee', name: '라운지 커피', kind: '시승 행사' },
  { img: 'giftset', name: '한정 세트', kind: '뷰티 팝업' },
  { img: 'donburi', name: '차슈덮밥 세트', kind: '음식점' },
  { img: 'tumbler', name: '텀블러', kind: '시승 행사' },
];

const STEPS = [
  {
    t: '화면을 누르면 시작',
    d: '결제한 손님이 카운터 태블릿을 누릅니다. 직원 PIN을 거쳐 한 번씩만 열리게 할 수도 있습니다.',
    img: '/site/step-1.jpg', alt: '대기 화면. 라멘 광고와 남은 티켓 판',
  },
  {
    t: '남은 티켓에서 한 장',
    d: '판에 남은 칸이 그대로 보입니다. 줄어드는 숫자가 다음 손님을 부릅니다.',
    img: '/site/step-2.jpg', alt: '50장 티켓 판에서 21번을 고른 화면',
  },
  {
    t: '직접 밀어서 열기',
    d: '표 끝을 잡아 밀면 등급이 금박으로 떠오릅니다. 높은 등급일수록 연출도 커집니다.',
    img: '/site/step-3.jpg', alt: '표를 열자 금색 B 등급이 드러나는 3D 화면',
  },
  {
    t: '바로 받거나 쿠폰으로',
    d: '지금 주는 상품은 직원이 바로 건네고, 나중 상품은 QR 쿠폰으로 남습니다. 쿠폰이 다음 방문을 만듭니다.',
    img: '/site/step-4.jpg', alt: '라멘 1그릇 무료 당첨 결과 화면',
  },
];

const DEMOS = [
  {
    slug: 'arven', title: '자동차 시승 행사', rule: '시승 1팀이 한 장',
    desc: '전시장 시승 페스타. 골프백, 장우산, 충전 쿠폰에 피날레는 주말 시승.',
    brand: '아르벤 EV 시승 페스타', photo: '/demo/arven/slide-1.jpg',
  },
  {
    slug: 'beauty', title: '뷰티 팝업 스토어', rule: '체험 1회가 한 장',
    desc: '성분 체험존 럭키드로우. 본품 풀세트부터 미니 키트, 온라인 할인 쿠폰까지.',
    brand: '뷰티성분사전 팝업', photo: '/demo/beauty/slide-1.jpg',
  },
  {
    slug: 'food', title: '음식점과 카페', rule: '1테이블 결제가 한 장',
    desc: '오픈 기념 뽑기. 차슈덮밥 세트, 라멘, 교자에 나중에 쓰는 할인 쿠폰.',
    brand: '합정 라멘집', photo: '/img/menu-미소라멘.jpg',
  },
];

const FAQ = [
  {
    q: '비용은 얼마인가요?',
    a: '매장 규모와 행사 기간에 따라 다릅니다. 도입 문의를 남겨 주시면 행사에 맞춰 안내드립니다.',
  },
  {
    q: '상품은 누가 준비하나요?',
    a: '상품은 매장이나 브랜드가 정합니다. 등급, 수량, 사진만 알려 주시면 판은 저희가 만들어 드립니다.',
  },
  {
    q: '어떤 기기가 필요한가요?',
    a: '카운터에 둘 태블릿 하나면 됩니다. 앱 설치 없이 브라우저로 열고, 화면 업데이트도 알아서 받습니다.',
  },
  {
    q: '쿠폰은 손님이 어떻게 쓰나요?',
    a: '나중에 쓰는 상품은 QR 쿠폰으로 드립니다. 손님 폰에 저장해 두었다가 다시 왔을 때 보여 주면 됩니다.',
  },
  {
    q: '좋은 상품이 다 나가면 어떻게 되나요?',
    a: '하위 등급만 남았을 때 끝까지 진행할지, 피날레 보너스를 걸고 새 판을 열지 사장님이 고릅니다.',
  },
];

export default function SitePage() {
  return (
    <div className={`kv ${display.variable}`}>
      {/* 움직임은 JS 가 켜졌을 때만 숨겼다가 보여 준다 — 첫 그림 전에 표시해 두어야 깜빡이지 않는다 */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('kv-js')" }} />
      <link rel="stylesheet" href={PRETENDARD} precedence="default" />
      <link rel="preload" as="image" href="/site/hero.jpg" />
      <SiteMotion />

      <header className="kv-nav">
        <div className="kv-nav-in">
          <a className="kv-logo" href="#top" aria-label="쿠벤팅 처음으로">
            <img src="/icon-192.png" alt="" width={32} height={32} />
            <span>KUVENTING</span>
          </a>
          <nav className="kv-links" aria-label="홈페이지 메뉴">
            <a href="#how">흐름</a>
            <a href="#demos">데모</a>
            <a href="#features">기능</a>
            <a href="#faq">질문</a>
          </nav>
          <a className="kv-btn primary sm" href="#contact">도입 문의</a>
        </div>
      </header>

      <main id="top">
        {/* ── 첫 화면 ── */}
        <section className="kv-hero">
          <div className="kv-hero-copy">
            <h1 className="kv-h1">
              <span className="ln">뽑으러 오는 손님,</span>
              <span className="ln"><em>쿠벤팅</em>이 만듭니다</span>
            </h1>
            <p className="kv-lead">결제, 시승, 체험 한 번에 한 장. 태블릿 하나로 매장에 여는 꽝 없는 뽑기판입니다.</p>
            <div className="kv-ctas">
              <a className="kv-btn primary" href="#demos">데모 해 보기</a>
              <a className="kv-btn ghost" href="#contact">도입 문의</a>
            </div>
          </div>
          <div className="kv-stage" aria-label="카운터 태블릿에서 손님이 한 장을 뽑는 실제 화면">
            <div className="kv-glow" />
            <div className="kv-device hero">
              <div className="kv-screen">
                <video autoPlay muted loop playsInline preload="auto" poster="/site/hero.jpg" data-inview>
                  <source src="/site/hero.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </section>

        {/* ── 상품 띠 ── */}
        <section className="kv-strip" aria-label="상품 예시">
          <p className="kv-strip-title" data-reveal>골프백부터 라멘 한 그릇까지. 상품은 매장이 정합니다.</p>
          <div className="kv-marquee">
            <ul className="kv-track">
              {[...PRIZES, ...PRIZES].map((p, i) => (
                <li className="kv-item" key={i} aria-hidden={i >= PRIZES.length || undefined}>
                  <img src={`/site/m/${p.img}.jpg`} alt={i < PRIZES.length ? p.name : ''} width={480} height={480} loading="lazy" />
                  <b>{p.name}</b>
                  <span>{p.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 손님 쪽 흐름 ── */}
        <section className="kv-steps" id="how">
          <h2 className="kv-h2" data-reveal>누르고, 고르고, 열면 끝</h2>
          <Steps items={STEPS} />
        </section>

        {/* ── 업종 데모 ── */}
        <section className="kv-demos" id="demos">
          <h2 className="kv-h2" data-reveal>업종마다 다른 판,<br />직접 뽑아 보세요</h2>
          <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
            데모는 화면 안에서만 돌아갑니다. 마음껏 뽑아도 실제 매장과는 상관이 없습니다.
          </p>
          <Demos items={DEMOS} />
          <p className="kv-fine">아르벤은 데모를 위해 만든 가상 브랜드입니다.</p>
        </section>

        {/* ── 기능 ── */}
        <section className="kv-feat" id="features">
          <h2 className="kv-h2" data-reveal>행사에 필요한 건<br />다 들어 있습니다</h2>
          <div className="kv-bento">
            <article className="kv-cell count" data-reveal>
              <img className="kv-count-strip" src="/site/board-strip.jpg" alt="대기 화면 아래의 남은 티켓 판. 50장 중 38장 남음" width={800} height={330} loading="lazy" />
              <div className="kv-big">
                <span data-count="50>36">36</span><small>/ 50</small>
              </div>
              <div className="kv-count-copy">
                <h3>남은 수가 보이는 판</h3>
                <p>다른 손님이 뽑으면 바로 줄어듭니다. 마감이 다가오는 게 보이면 손님이 서두릅니다.</p>
              </div>
            </article>

            <article className="kv-cell open" data-reveal style={{ ['--i' as string]: 1 }}>
              <div className="kv-device mini">
                <div className="kv-screen">
                  <video muted loop playsInline preload="none" poster="/site/open.jpg" data-inview>
                    <source src="/site/open.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
              <h3>밀어서 여는 3D 개봉</h3>
              <p>손님이 직접 표를 밀어 엽니다. 등급이 드러나는 순간이 행사의 하이라이트가 됩니다.</p>
            </article>

            <article className="kv-cell coupon" data-reveal style={{ ['--i' as string]: 2 }}>
              <img src="/site/coupon.jpg" alt="결과 화면의 QR 쿠폰" width={540} height={400} loading="lazy" />
              <h3>나중 상품은 QR 쿠폰</h3>
              <p>손님 폰에 저장되는 쿠폰이라 다음 방문 때 그대로 씁니다.</p>
            </article>

            <article className="kv-cell finale media" data-reveal style={{ ['--i' as string]: 1 }}>
              <img src="/demo/arven/finale.jpg" alt="피날레 보너스로 건 주말 시승 차량" width={1000} height={1000} loading="lazy" />
              <div className="kv-cell-copy">
                <h3>마지막엔 피날레 보너스</h3>
                <p>판이 끝날 무렵 한 장에 더 큰 상품을 겁니다. 하위 등급만 남아도 손님이 끝까지 붙습니다.</p>
              </div>
            </article>

            <article className="kv-cell theme" data-reveal style={{ ['--i' as string]: 2 }}>
              <div className="kv-fan" aria-hidden="true">
                <img src="/site/t/letterpress.png" alt="" loading="lazy" />
                <img src="/site/t/brass.png" alt="" loading="lazy" />
                <img src="/site/t/beauty.png" alt="" loading="lazy" />
                <img src="/site/t/arven.png" alt="" loading="lazy" />
              </div>
              <h3>매장에 맞는 판</h3>
              <p>활판 입장권, 황동 표, 브랜드 전용 키카드까지. 글꼴과 색도 매장이 고릅니다.</p>
            </article>

            <article className="kv-cell owner" data-reveal>
              <div className="kv-owner-ic"><Icon name="keypad" /></div>
              <div>
                <h3>사장님 폰에서 관리</h3>
                <p>판 설정은 사장님 폰 하나로 관리합니다. 카운터에 가지 않아도 상품과 문구를 고칠 수 있습니다.</p>
              </div>
              <ul className="kv-chips" aria-label="바꿀 수 있는 것">
                <li>상품과 수량</li><li>상품 사진</li><li>광고 문구</li><li>판 테마와 글꼴</li><li>끝물 방식</li>
              </ul>
            </article>
          </div>
        </section>

        {/* ── 질문 ── */}
        <section className="kv-faq" id="faq">
          <h2 className="kv-h2" data-reveal>자주 묻는 질문</h2>
          <div className="kv-faq-list">
            {FAQ.map((f, i) => (
              <details key={i} data-reveal style={{ ['--i' as string]: i }}>
                <summary>{f.q}<span className="kv-plus" aria-hidden="true"><Icon name="plus" /></span></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── 도입 문의 ── */}
        <section className="kv-contact" id="contact">
          <h2 className="kv-h2" data-reveal>다음 행사,<br />뽑기판으로 열어 보세요</h2>
          <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
            업종과 일정만 남겨 주세요. 맞는 판과 상품 구성을 제안드립니다.
          </p>
          <ContactForm />
        </section>
      </main>

      <footer className="kv-foot">
        <div className="kv-foot-in">
          <div className="kv-foot-brand">
            <span className="kv-logo"><img src="/icon-192.png" alt="" width={28} height={28} /><span>KUVENTING</span></span>
            <p>꽝 없는 매장 뽑기판</p>
          </div>
          <nav className="kv-foot-links" aria-label="데모 바로가기">
            <a href="/demo/arven" target="_blank" rel="noopener">자동차 시승 데모</a>
            <a href="/demo/beauty" target="_blank" rel="noopener">뷰티 팝업 데모</a>
            <a href="/demo/food" target="_blank" rel="noopener">음식점 데모</a>
          </nav>
          <p className="kv-copy">© 2026 SCPAD Lab</p>
        </div>
      </footer>
    </div>
  );
}
