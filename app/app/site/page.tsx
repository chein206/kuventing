import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { Icon } from '@/lib/Icon';
import { FONTS } from '@/lib/fonts';
import { SITE_URL } from '@/lib/site';
import SiteMotion from './SiteMotion';
import Scene from './Scene';
import QuickOpen, { type QuickItem } from './QuickOpen';
import SignageCycle, { type SigItem } from './SignageCycle';
import HowSteps, { type HowSet } from './HowSteps';
import Demos from './Demos';
import ContactForm from './ContactForm';
import SiteFooter from './SiteFooter';
import './site.css';

/**
 * 쿠벤팅 공식 홈페이지. 팝업 · 행사 담당자와 매장 사장님에게 "화면 하나가 광고판이 되고 럭키드로우가 된다"를
 * 실제 화면으로 보여 주고 도입 문의를 받는다.
 *
 * - 판은 로고의 남색 그대로 어둡게. 강조는 노랑(로고 금색을 납작하게) 하나 — 빛줄기 · 금가루 · 금박 글자 같은
 *   번쩍임은 빼서 카지노처럼 보이지 않게 했다(10-07 「사행성 느낌」)
 * - 장 머리는 영어 한 단어(SIGNAGE · LUCKY DRAW …), 제목은 굵은 한글(블랙한산스) — 젊은 쪽 행사를 겨냥
 * - 움직이는 그림은 전부 실제 화면이다 — 데모 대기 화면 녹화(assets/site/rec_screen.mjs)를 장면 사진(Flow) 속 기기 화면에
 *   원근 맞춰 얹었다(screen_fit.py). 장면 사진은 만든 그림이고 화면 속 광고만 실제다(사진 아래에 적어 둔다)
 * - 기기는 고객이 가진 화면(태블릿 · 스탠드형 터치스크린 · 키오스크) — 대여는 말하지 않는다(사장님 10-07)
 * - 첫 화면에서 바로 열어 본다 — 실제 데모 판을 빠른 열기로(고르기 없이 표 → 맨 윗등급). SIGNAGE 는 업종이 돌아가며 바뀐다
 *   (차만 나오면 업종이 고정돼 보이고 어둡다 — 사장님 10-07)
 * - 디자인 · 사진 제작까지 맡아 준다는 것(DONE FOR YOU) — 「머리 아프게 신경 쓸 것 없이 상품만 신경 쓰면 된다」(사장님 10-07)
 * - 주소는 kuventing.scpadlab.com — 그 주소의 / 가 이 페이지다(next.config.ts)
 */

// 영문 장 머리 · 워드마크. 한글 본문은 프리텐다드(CDN 조각), 한글 제목은 블랙한산스(구글 글꼴 조각)
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--kv-display', display: 'swap' });
const PRETENDARD = FONTS.find((f) => f.key === 'pretendard')!.css!;
const BLACK_HAN = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap';

export const metadata: Metadata = {
  // 카톡 · 검색 미리보기 그림과 대표 주소는 홈페이지 주소로(서비스 주소 /site 로 열려도 같은 곳을 가리킨다)
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: '쿠벤팅 | 평소엔 광고판, 누르면 럭키드로우',
  description: '팝업 스토어, 행사장, 매장 카운터의 화면 하나로 움직이는 광고와 경품 이벤트를 함께 돌립니다. 디자인과 사진은 저희가 만들고, 상품만 정하시면 됩니다.',
  openGraph: {
    title: '쿠벤팅 | 평소엔 광고판, 누르면 럭키드로우',
    description: '화면 하나로 움직이는 광고와 경품 이벤트를 함께. 디자인 · 사진은 저희가, 상품만 정하세요.',
    // 그림을 바꾸면 v 를 올린다 — 같은 주소면 메신저 · SNS 가 옛 그림을 계속 보여 준다(카톡은 공유 디버거에서 캐시도 지워야 한다)
    images: ['/site/og.jpg?v=2'],
    url: '/',
    siteName: '쿠벤팅',
    type: 'website',
    locale: 'ko_KR',
  },
};

export const viewport: Viewport = { maximumScale: 5, userScalable: true, themeColor: '#070B16' };

// 장면 사진 속 화면 자리 — screen_fit.py 가 구한 원근 변환(영상 540×864 → 사진 1376×768 좌표)
const M = {
  popup: 'matrix3d(0.28433166,-0.04106174,0,-0.00010319,0.00293412,0.45052272,0,0.00000483,0,0,1,0,846.71380615,61.28153992,0,1)',
  counter: 'matrix3d(0.11229332,-0.11316589,0,-0.00032479,-0.13827646,0.36325627,0,-0.00008351,0,0,1,0,835.90441895,248.50479126,0,1)',
};

// 첫 화면 바로 열어 보기 — 업종 단추 순서. 포스터는 assets/site/quick_poster.mjs <업종>
const QUICK_ITEMS: QuickItem[] = [
  { slug: 'beauty', tag: '뷰티 팝업', poster: '/site/quick-beauty.jpg' },
  { slug: 'cafe', tag: '카페', poster: '/site/quick-cafe.jpg' },
  { slug: 'chicken', tag: '치킨 호프', poster: '/site/quick-chicken.jpg' },
  { slug: 'arven', tag: '시승 행사', poster: '/site/quick-arven.jpg' },
  { slug: 'food', tag: '라멘집', poster: '/site/quick-food.jpg' },
];

// SIGNAGE — 업종 순서는 signage.mp4 를 이어 붙인 순서와 같아야 한다(build_signage.py cafe beauty chicken food arven). 밝은 카페부터
const SIG: SigItem[] = [
  { key: 'cafe', tag: '카페', photo: '/site/sig/cafe.jpg', text: '딸기 생크림 케익 6,500원' },
  { key: 'beauty', tag: '뷰티 팝업', photo: '/site/sig/beauty.jpg', text: '성분부터 보고 고르는 팝업' },
  { key: 'chicken', tag: '치킨 호프', photo: '/site/sig/chicken.jpg', text: '바삭한 후라이드 19,000원' },
  { key: 'food', tag: '음식점', photo: '/site/sig/food.jpg', text: '매운 미소라멘 11,000원' },
  { key: 'arven', tag: '시승 행사', photo: '/site/sig/arven.jpg', text: '한 번 타 보면 압니다' },
];
const SIG_SEG = 6;

// 가진 화면 그대로 — 기기 모양만 다르고 화면은 같은 판(실제 대기 화면 녹화)
const DEVICES = [
  { kind: 'tablet', video: '/site/screen-food.mp4', poster: '/site/screen-food.jpg', name: '태블릿', note: '매장 카운터' },
  { kind: 'stand', video: '/site/screen-beauty.mp4', poster: '/site/screen-beauty.jpg', name: '스탠드형 터치스크린', note: '팝업 입구 · 체험존' },
  { kind: 'kiosk', video: '/site/screen-arven.mp4', poster: '/site/screen-arven.jpg', name: '키오스크', note: '행사장 · 전시장' },
];

const STICKERS = [
  { img: 'golfbag', name: '골프백' },
  { img: 'cake', name: '딸기 케이크' },
  { img: 'serum', name: '세럼 본품' },
  { img: 'ramen', name: '라멘 한 그릇' },
];

const VS = [
  ['스탬프를 다 모아야 사은품', '체험 한 번에 바로 한 번 참여'],
  ['뽑기통과 룰렛 앞의 긴 줄', '화면에서 고르고 직접 밀어 여는 3D 개봉'],
  ['인증샷 올리면 증정', '남은 경품이 실시간으로 보여 지금 참여'],
  ['행사가 끝나면 그걸로 끝', 'QR 쿠폰으로 온라인몰과 매장까지 이어짐'],
  ['종이 집계와 수기 정산', '남은 수와 쿠폰 사용을 폰에서 확인'],
];

const IDEAS = [
  { icon: 'megaphone' as const, t: '대기줄을 광고 시간으로', d: '입장 줄 앞에 스탠드형 스크린 하나. 기다리는 동안 신제품 광고가 돕니다.' },
  { icon: 'check' as const, t: '체험 미션마다 한 번', d: '체험존을 하나 끝낼 때마다 참여 한 번. 동선이 자연스럽게 길어집니다.' },
  { icon: 'star' as const, t: '마지막 한 장엔 피날레', d: '판의 마지막 한 장에 한정 굿즈를 겁니다. 끝물에도 손님이 남습니다.' },
  { icon: 'ticket' as const, t: '팝업 이후엔 쿠폰', d: '온라인몰 할인 쿠폰으로 팝업이 끝난 뒤까지 이어지게 합니다.' },
];

const DEMOS = [
  {
    slug: 'beauty', title: '뷰티 팝업 스토어', rule: '체험 1회가 한 번',
    desc: '성분 체험존 럭키드로우. 본품 풀세트부터 미니 키트, 온라인 할인 쿠폰까지.',
    brand: '뷰티성분사전 팝업', photo: '/demo/beauty/slide-1.jpg',
  },
  {
    slug: 'arven', title: '자동차 시승 행사', rule: '시승 1팀이 한 번',
    desc: '전시장 시승 페스타. 골프백, 장우산, 충전 쿠폰에 피날레는 주말 시승.',
    brand: '아르벤 EV 시승 페스타', photo: '/demo/arven/slide-1.jpg',
  },
  {
    slug: 'cafe', title: '카페 신메뉴 이벤트', rule: '음료 1잔 주문이 한 번',
    desc: '디저트 카페 신메뉴 럭키드로우. 케익 세트, 케익, 아인슈페너에 다음에 쓰는 할인 쿠폰.',
    brand: '망원 디저트 카페', photo: '/img/menu-딸기생크림케익.jpg',
  },
  {
    slug: 'chicken', title: '치킨 호프 치맥 이벤트', rule: '1테이블 주문이 한 번',
    desc: '치맥 럭키드로우. 치킨 1마리, 치즈볼, 생맥주에 다음에 쓰는 할인 쿠폰.',
    brand: '을지로 치킨 호프', photo: '/demo/chicken/slide-1.jpg',
  },
  {
    slug: 'food', title: '라멘집 오픈 이벤트', rule: '1테이블 결제가 한 번',
    desc: '오픈 기념 이벤트. 차슈덮밥 세트, 라멘, 교자에 나중에 쓰는 할인 쿠폰.',
    brand: '합정 라멘집', photo: '/img/menu-미소라멘.jpg',
  },
];

// HOW IT WORKS — 손님 4단계(사장님 10-07: 광고 + 현황 → 남은 선물 → 픽 → 열기 → 럭키). 화면은 실제 데모 녹화(build_steps.py),
// 업종 다섯이 4초마다 돌아간다(HowSteps). 업종 순서는 첫 화면 · SIGNAGE 단추와 같게
const STEPS = [
  { n: '01', tag: 'WATCH', t: '보고', d: '평소엔 광고판. 남은 선물이 몇 장인지 같이 보입니다.', alt: '광고와 남은 티켓 수가 보이는 대기 화면' },
  { n: '02', tag: 'CHECK', t: '확인하고', d: '어떤 선물이 몇 개 남았는지 먼저 봅니다.', alt: '등급별 남은 선물 목록' },
  { n: '03', tag: 'PICK', t: '고르고', d: '마음에 드는 표 한 장을 직접 고릅니다.', alt: '표 한 장을 고른 화면' },
  { n: '04', tag: 'OPEN', t: '열면, 럭키!', d: '표를 밀어 열면 선물이 나옵니다. 남은 한 장까지.', alt: '맨 윗등급 선물이 나온 결과 화면' },
];
const HOW_SETS: HowSet[] = [
  { key: 'beauty', tag: '뷰티 팝업' },
  { key: 'cafe', tag: '카페' },
  { key: 'chicken', tag: '치킨 호프' },
  { key: 'arven', tag: '시승 행사' },
  { key: 'food', tag: '라멘집' },
];

// DONE FOR YOU — 사장님 일은 하나, 저희 일은 다섯
const WE_DO = [
  { icon: 'ticket' as const, t: '판 디자인', d: '브랜드 색과 분위기에 맞춰 판, 표, 글꼴을 만듭니다.' },
  { icon: 'megaphone' as const, t: '광고 화면', d: '대기 화면에 도는 모션 광고의 문구와 순서를 짭니다.' },
  { icon: 'camera' as const, t: '사진 제작', d: '사진이 없어도 됩니다. 상품 사진과 광고 사진까지 만들어 드립니다.' },
  { icon: 'gift' as const, t: '경품 구성', d: '등급별 수량과 마지막 피날레까지 업종에 맞게 제안합니다.' },
  { icon: 'check' as const, t: '화면 띄우기', d: '가진 기기에 주소 하나만 열어 두면 끝입니다.' },
];

const FAQ = [
  { q: '기기를 따로 사야 하나요?', a: '가지고 계신 태블릿, 스탠드형 터치스크린, 키오스크에서 브라우저로 엽니다. 앱 설치도 필요 없어요.' },
  { q: '비용은 얼마인가요?', a: '행사 규모와 기간에 따라 달라요. 도입 문의를 남겨 주시면 맞춰서 안내드립니다.' },
  { q: '디자인이나 사진은 직접 해야 하나요?', a: '아니요. 판 디자인, 광고 문구, 사진까지 저희가 만들어 드려요. 사진이 없어도 됩니다.' },
  { q: '경품은 누가 정해요?', a: '매장이나 브랜드가 정합니다. 무엇을 몇 개 걸지만 알려 주시면 등급과 수량은 같이 맞춰 드려요.' },
  { q: '좋은 경품이 먼저 다 나가면요?', a: '하위 등급만 남았을 때 끝까지 갈지, 피날레를 걸고 새 판을 열지 고를 수 있어요.' },
  { q: '손님 쿠폰은 어떻게 써요?', a: '손님 폰에 QR 쿠폰으로 남고, 다시 왔을 때 사장님 폰에서 사용 처리합니다.' },
];

export default function SitePage() {
  return (
    <div className={`kv ${display.variable}`}>
      {/* 움직임은 JS 가 켜졌을 때만 숨겼다가 보여 준다 — 첫 그림 전에 표시해 두어야 깜빡이지 않는다 */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('kv-js')" }} />
      <link rel="stylesheet" href={PRETENDARD} precedence="default" />
      <link rel="stylesheet" href={BLACK_HAN} precedence="default" />
      <link rel="preload" as="image" href="/site/scene-popup.jpg" />
      <link rel="preload" as="image" href="/site/quick-beauty.jpg" />
      <SiteMotion />

      <header className="kv-nav">
        <div className="kv-nav-in">
          <a className="kv-logo" href="#top" aria-label="쿠벤팅 처음으로">
            <img src="/icon-192.png" alt="" width={32} height={32} />
            <span>KUVENTING</span>
          </a>
          <nav className="kv-links" aria-label="홈페이지 메뉴">
            <a href="#signage">SIGNAGE</a>
            <a href="#draw">LUCKY DRAW</a>
            <a href="#play">NEW PLAY</a>
            <a href="#demos">DEMO</a>
          </nav>
          <a className="kv-btn primary sm" href="#contact">도입 문의</a>
        </div>
      </header>

      <main id="top">
        {/* ── 첫 화면 — 팝업 · 행사와 매장 카운터를 나란히 ── */}
        <section className="kv-hero">
          <div className="kv-hero-copy">
            <p className="kv-label">SIGNAGE + LUCKY DRAW</p>
            <h1 className="kv-h1">평소엔 광고판,<br /><em>누르면 럭키드로우</em></h1>
            <p className="kv-lead">팝업 입구의 스탠드형 스크린, 행사장 키오스크, 매장 카운터 태블릿까지. 브라우저가 열리는 화면이면 됩니다.</p>
            <div className="kv-ctas">
              <a className="kv-btn primary" href="#contact">도입 문의</a>
              <a className="kv-btn ghost" href="#demos">데모 해 보기</a>
            </div>
            <p className="kv-hero-note"><Icon name="check" />디자인과 사진은 저희가 만듭니다. 상품만 정하세요.</p>
          </div>
          {/* 뒤는 팝업 입구 장면(평소엔 광고판), 앞은 실제 판을 바로 열어 보는 태블릿(누르면 럭키드로우) */}
          <div className="kv-hero-try">
            <figure className="kv-shot a">
              <Scene photo="/site/scene-popup.jpg" video="/site/screen-beauty.mp4" poster="/site/screen-beauty.jpg" matrix={M.popup}
                alt="뷰티 팝업 입구의 스탠드형 스크린" />
              <figcaption><b>팝업 입구</b>평소엔 광고판</figcaption>
            </figure>
            <QuickOpen items={QUICK_ITEMS} />
          </div>
        </section>

        {/* ── 한 줄 흐르는 글자(이 페이지 하나뿐) ── */}
        <div className="kv-marq" aria-hidden="true">
          <div>
            {[0, 1].map((k) => (
              <span key={k}><b>DIGITAL SIGNAGE</b> + <b>LUCKY DRAW</b> + <b>REVISIT COUPON</b> + </span>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS — 손님은 이렇게(첫 화면 바로 다음) ── */}
        <section className="kv-sec kv-how" id="how">
          <div className="kv-head">
            <p className="kv-label" data-reveal>HOW IT WORKS</p>
            <h2 className="kv-h2" data-reveal>보고, 확인하고, 고르고,<br />열면 럭키!</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              손님은 이렇게 참여합니다. 앱 설치도 회원 가입도 없이, 화면 앞에서 1분이면 끝납니다.
            </p>
          </div>
          <HowSteps steps={STEPS} sets={HOW_SETS} />
        </section>

        {/* ── SIGNAGE ── */}
        <section className="kv-sec kv-signage" id="signage">
          <div className="kv-sig-copy">
            <p className="kv-label" data-reveal>SIGNAGE</p>
            <h2 className="kv-h2" data-reveal>줄 서는 3분,<br />광고가 일합니다</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              신제품, 시승 차량, 오늘의 메뉴. 사진과 문구만 넣으면 천천히 움직이는 광고가 만들어져 화면에서 돕니다.
            </p>
          </div>
          {/* 올린 사진 한 장 → 화면에서는 움직이는 광고. 업종이 돌아가며 바뀐다 */}
          <SignageCycle items={SIG} video="/site/signage.mp4" poster="/site/signage.jpg" seg={SIG_SEG} />
        </section>

        {/* ── LUCKY DRAW ── */}
        <section className="kv-sec kv-draw" id="draw">
          <div className="kv-draw-stage" data-reveal>
            <div className="kv-device">
              <div className="kv-screen">
                <video autoPlay muted loop playsInline preload="metadata" poster="/site/open.jpg" data-inview>
                  <source src="/site/open.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
            {STICKERS.map((s, i) => (
              <div className={`kv-sticker s${i + 1}`} key={s.img}>
                <img src={`/site/m/${s.img}.jpg`} alt="" width={480} height={480} loading="lazy" />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
          <div className="kv-draw-copy">
            <p className="kv-label" data-reveal>LUCKY DRAW</p>
            <h2 className="kv-h2" data-reveal>모든 참여에 경품,<br />손님이 먼저 누릅니다</h2>
            <ul className="kv-points">
              <li data-reveal><b>한 번 하면 한 번</b>결제, 시승, 체험 한 번마다 참여 한 번. 조건은 행사마다 정합니다.</li>
              <li data-reveal style={{ ['--i' as string]: 1 }}><b>직접 밀어 여는 손맛</b>손님이 화면의 표를 밀어 열고, 그 자리에서 경품을 확인합니다.</li>
              <li data-reveal style={{ ['--i' as string]: 2 }}>
                <b>남은 경품이 실시간으로</b>다른 손님이 참여하면 바로 줄어듭니다. 줄어드는 숫자가 다음 손님을 부릅니다.
                <span className="kv-left"><span data-count="50>36">36</span> / 50 남음</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ── NEW PLAY — 늘 하던 팝업 이벤트 말고 ── */}
        <section className="kv-sec kv-play" id="play">
          <div className="kv-head">
            <p className="kv-label" data-reveal>NEW PLAY</p>
            <h2 className="kv-h2" data-reveal>스탬프, 룰렛, 인증샷.<br />이번 팝업은 다르게</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              늘 보던 이벤트에는 손님도 금방 익숙해집니다. 같은 경품이라도 참여하는 방식이 바뀌면 다시 눈길이 갑니다.
            </p>
          </div>
          <div className="kv-vs">
            <div className="kv-vs-head" aria-hidden="true"><span>늘 하던 이벤트</span><span>쿠벤팅으로 바꾸면</span></div>
            {VS.map(([a, b], i) => (
              <div className="kv-vs-row" key={a} data-reveal style={{ ['--i' as string]: i }}>
                <p className="was">{a}</p>
                <Icon name="up" className="kv-vs-arrow" />
                <p className="now">{b}</p>
              </div>
            ))}
          </div>
          <h3 className="kv-h3" data-reveal>이렇게 써 보세요</h3>
          <div className="kv-ideas">
            {IDEAS.map((d, i) => (
              <article key={d.t} data-reveal style={{ ['--i' as string]: i }}>
                <span className="kv-idea-ic"><Icon name={d.icon} /></span>
                <h4>{d.t}</h4>
                <p>{d.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── ANYWHERE — 가진 화면 그대로 ── */}
        <section className="kv-sec kv-any" id="anywhere">
          <div className="kv-head">
            <p className="kv-label" data-reveal>ANYWHERE</p>
            <h2 className="kv-h2" data-reveal>가지고 계신<br />화면이면 됩니다</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              앱 설치 없이 브라우저로 열고, 세로 화면에 맞춰 뜹니다. 카운터, 입구, 체험존 어디에 세워도 됩니다.
            </p>
          </div>
          <figure className="kv-shot kv-any-scene" data-reveal>
            <Scene photo="/site/scene-counter.jpg" video="/site/screen-food.mp4" poster="/site/screen-food.jpg" matrix={M.counter}
              alt="라멘집 카운터 위 태블릿" />
            <figcaption><b>매장 카운터</b>계산대 옆 태블릿 한 대 · 장면 사진은 예시이고 화면 속 광고는 실제 쿠벤팅 화면입니다</figcaption>
          </figure>
          <div className="kv-lineup">
            {DEVICES.map((d, i) => (
              <figure className={`kv-unit ${d.kind}`} key={d.kind} data-reveal style={{ ['--i' as string]: i }}>
                <div className="kv-unit-body">
                  <div className="kv-screen">
                    <video autoPlay muted loop playsInline preload="metadata" poster={d.poster} data-inview>
                      <source src={d.video} type="video/mp4" />
                    </video>
                  </div>
                </div>
                <div className="kv-unit-foot" aria-hidden="true" />
                <figcaption><b>{d.name}</b>{d.note}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── DONE FOR YOU — 상품만 정하면 나머지는 저희가 ── */}
        <section className="kv-sec kv-done" id="done">
          <div className="kv-head">
            <p className="kv-label" data-reveal>DONE FOR YOU</p>
            <h2 className="kv-h2" data-reveal>상품만 정하세요,<br />나머지는 저희가</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              디자인도 사진도 저희가 만듭니다. 머리 아프게 신경 쓸 것 없이, 매장 화면에 띄워 두기만 하면 됩니다.
            </p>
          </div>
          <div className="kv-split">
            <div className="kv-you" data-reveal>
              <span className="kv-split-tag">사장님이 하실 일</span>
              <span className="kv-you-mark" aria-hidden="true"><Icon name="check" strokeWidth={2.2} /></span>
              <p className="kv-you-big">상품 정하기</p>
              <p className="kv-you-sub">무엇을 몇 개 걸지만 알려 주세요.<br />나머지는 아래처럼 저희가 합니다.</p>
            </div>
            <div className="kv-we" data-reveal style={{ ['--i' as string]: 1 }}>
              <span className="kv-split-tag">쿠벤팅이 하는 일</span>
              <ul>
                {WE_DO.map((w) => (
                  <li key={w.t}>
                    <span className="kv-we-ic"><Icon name={w.icon} /></span>
                    <span><b>{w.t}</b>{w.d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── DEMO ── */}
        <section className="kv-sec kv-demos" id="demos">
          <div className="kv-head">
            <p className="kv-label" data-reveal>DEMO</p>
            <h2 className="kv-h2" data-reveal>업종마다 다른 판,<br />직접 눌러 보세요</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              데모는 화면 안에서만 돌아갑니다. 마음껏 눌러도 실제 행사와는 상관이 없습니다.
            </p>
          </div>
          <Demos items={DEMOS} />
          <p className="kv-fine">아르벤은 데모를 위해 만든 가상 브랜드입니다.</p>
        </section>

        {/* ── REVISIT ── */}
        <section className="kv-sec kv-revisit" id="revisit">
          <div className="kv-revisit-copy">
            <p className="kv-label" data-reveal>REVISIT</p>
            <h2 className="kv-h2" data-reveal>행사가 끝나도<br />손님이 돌아오게</h2>
            <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
              나중에 쓰는 경품은 QR 쿠폰으로 손님 폰에 남습니다. 경품, 광고 사진, 쿠폰 사용까지 사장님 폰 하나로 관리합니다.
            </p>
            <ul className="kv-chips" aria-label="사장님 폰에서 하는 일" data-reveal style={{ ['--i' as string]: 2 }}>
              <li>경품과 수량</li><li>광고 사진과 문구</li><li>쿠폰 사용 처리</li><li>판 테마와 글꼴</li><li>끝물 방식</li>
            </ul>
          </div>
          <img className="kv-revisit-img" src="/site/coupon.jpg" alt="결과 화면의 QR 쿠폰" width={540} height={390} loading="lazy" data-reveal />
        </section>

        {/* ── FAQ — 말풍선 ── */}
        <section className="kv-sec kv-faq" id="faq">
          <p className="kv-label" data-reveal>FAQ</p>
          <h2 className="kv-h2" data-reveal>많이 물어보세요</h2>
          <div className="kv-chat">
            {FAQ.map((f, i) => (
              <div className="kv-qa" key={f.q}>
                <p className="kv-bubble q" data-reveal style={{ ['--i' as string]: i % 2 }}>{f.q}</p>
                <p className="kv-bubble a" data-reveal style={{ ['--i' as string]: (i % 2) + 1 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 도입 문의 ── */}
        <section className="kv-contact" id="contact">
          <p className="kv-label" data-reveal>CONTACT</p>
          <h2 className="kv-h2" data-reveal>다음 팝업, 다음 행사,<br />화면 하나로 열어 보세요</h2>
          <p className="kv-sub" data-reveal style={{ ['--i' as string]: 1 }}>
            업종과 일정만 남겨 주세요. 맞는 광고와 경품 구성을 제안드립니다.
          </p>
          <ContactForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
