/**
 * 브랜드 테마 원판을 그린다 — 아르벤(전기차 시승) · 뷰티성분사전(팝업).
 *
 * 사진 판(photo-letterpress)과 같은 규칙으로 만든다 — 표(천공이 실제로 뚫린 투명 PNG) · 미니 칸 · 검인 도장 ·
 * 봉인 · 판 바닥(이음새 없는 타일) · 상품 교환권. 사진 대신 SVG 로 그려 크롬으로 굽는다(AI 생성 없음 · 상표 걱정 없음).
 * 브랜드는 데모용 가상 브랜드다 — 실제 회사 이름 · 로고를 쓰지 않는다.
 *
 *   node scripts/theme-art.mjs            전부
 *   node scripts/theme-art.mjs arven      아르벤만
 *
 * 크롬 · playwright-core · ffmpeg 가 필요하다(playwright-core 가 없으면 shorts-lab 것을 빌린다).
 * 표의 천공 열은 가로 76% — lib/boardArt.ts 의 perf 와 같아야 번호가 천공 왼쪽 가운데에 앉는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO = path.join(ROOT, 'public', 'photo');
const DEMO = path.join(ROOT, 'public', 'demo');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PERF = 0.76;
const only = process.argv[2];

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Noto+Sans+KR:wght@500;700;900&display=swap">';

/* ------------------------------------------------------------ 공통 조각 */
const holes = (x, y0, y1, step, r) => {
  let s = '';
  for (let y = y0; y <= y1; y += step) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`;
  return s;
};
const grain = (id, rgb, a, freq = 0.9) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7"/>` +
  `<feColorMatrix values="0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 ${a} 0"/></filter>`;

/* ------------------------------------------------------------ 아르벤 — 전기차 프리미엄, 일렉트릭 블루 */
const AR = { body0: '#1D222B', body1: '#11141A', body2: '#090A0D', blue: '#3C78FF', blueD: '#1E50F0', plat: '#DCE0E6', dim: '#8C95A3', ink: '#E9ECF1' };

const arvenEmblem = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle r="50" fill="none" stroke="${AR.plat}" stroke-width="5"/>
  <path d="M-25 23 L0 -29 L25 23" fill="none" stroke="${AR.blue}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M-12 5 L12 5" stroke="${AR.blue}" stroke-width="7" stroke-linecap="round"/></g>`;

const arvenTicket = (W, H, mini) => {
  const px = Math.round(W * PERF), r = mini ? 18 : 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="b" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="${AR.body0}"/><stop offset=".55" stop-color="${AR.body1}"/><stop offset="1" stop-color="${AR.body2}"/></linearGradient>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".4" stop-color="#fff" stop-opacity=".015"/><stop offset=".41" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="bl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${AR.blueD}"/><stop offset=".5" stop-color="${AR.blue}"/><stop offset="1" stop-color="${AR.blueD}"/></linearGradient>
  ${grain('n', [1, 1, 1], 0.045)}
  <clipPath id="c"><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r}"/></clipPath>
  <mask id="h"><rect width="${W}" height="${H}" fill="#fff"/>${holes(px, mini ? 22 : 58, H - (mini ? 22 : 58), mini ? 13 : 26, mini ? 2.6 : 6)}</mask>
</defs>
<g mask="url(#h)">
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r}" fill="url(#b)"/>
  <g clip-path="url(#c)">
    <rect width="${W}" height="${H}" filter="url(#n)"/>
    <rect x="${px}" y="0" width="${W - px}" height="${H}" fill="#07080A" opacity=".5"/>
    <polygon points="6,6 ${W * 0.54},6 ${W * 0.2},${H - 6} 6,${H - 6}" fill="url(#g)"/>
    <rect x="6" y="${H - (mini ? 20 : 46)}" width="${px - 6}" height="${mini ? 5 : 10}" fill="url(#bl)"/>
  </g>
  <rect x="${mini ? 14 : 30}" y="${mini ? 14 : 30}" width="${W - (mini ? 28 : 60)}" height="${H - (mini ? 28 : 60)}" rx="${mini ? 10 : 30}" fill="none" stroke="${AR.blue}" stroke-opacity=".42" stroke-width="${mini ? 1.5 : 2}"/>
  ${mini
    ? `${arvenEmblem(60, H / 2, 0.42)}`
    : `${arvenEmblem(120, 124)}
  <text x="196" y="142" font-family="Montserrat" font-weight="600" font-size="50" letter-spacing="16" fill="${AR.ink}">ARVEN</text>
  <text x="80" y="628" font-family="Noto Sans KR" font-weight="500" font-size="27" fill="#AEB6C2">아르벤 EV 시승 패스</text>
  <text x="80" y="670" font-family="Montserrat" font-weight="500" font-size="22" letter-spacing="7" fill="${AR.dim}">ELECTRIC TEST DRIVE PASS</text>
  <circle cx="${(px + W) / 2}" cy="112" r="36" fill="none" stroke="${AR.blue}" stroke-width="3"/>
  <text x="${(px + W) / 2}" y="124" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="30" fill="${AR.blue}">EV</text>
  <text transform="translate(${(px + W) / 2 + 12} ${H / 2 + 40}) rotate(90)" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="38" letter-spacing="12" fill="${AR.blue}">TEST DRIVE</text>`}
</g></svg>`;
};

/* 고무 도장 — 잉크가 고르지 않게 거친 결로 깎는다 */
const rubber = (id, freq = 1.1) =>
  `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="4" result="t"/>` +
  `<feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="m"/>` +
  `<feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;

const arvenStamp = () => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<defs>${rubber('r')}<path id="ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0"/></defs>
<g filter="url(#r)" fill="none" stroke="${AR.blue}" opacity=".92">
  <circle cx="150" cy="150" r="132" stroke-width="10"/><circle cx="150" cy="150" r="88" stroke-width="3"/>
  <path d="M112 152 L140 180 L192 120" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <text font-family="Montserrat" font-weight="700" font-size="25" letter-spacing="6" fill="${AR.blue}" stroke="none"><textPath href="#ring">ARVEN · TEST DRIVE · ARVEN · TEST DRIVE ·</textPath></text>
</g></svg>`;

const arvenSeal = () => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<defs>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2F4F7"/><stop offset=".5" stop-color="#8C95A3"/><stop offset="1" stop-color="#E6E9EE"/></linearGradient>
  <radialGradient id="en" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#5C8BFF"/><stop offset=".6" stop-color="${AR.blueD}"/><stop offset="1" stop-color="#0E2A80"/></radialGradient>
</defs>
<circle cx="150" cy="150" r="140" fill="url(#rim)"/><circle cx="150" cy="150" r="118" fill="url(#en)"/>
<circle cx="150" cy="150" r="104" fill="none" stroke="#DCE0E6" stroke-opacity=".5" stroke-width="2"/>
<path d="M60 96 Q150 40 240 96" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="18" stroke-linecap="round"/></svg>`;

/* 카본 직조 — 2/2 능직. 16px 칸 32개가 4칸 주기로 돌아 512 타일 가장자리가 그대로 이어진다.
   대비를 세게 두면 바구니 짜임으로 보인다 — 결은 빛을 받을 때만 살짝 보이게 */
const carbon = () => {
  let cells = '';
  for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
    const h = (i + j) % 4 < 2;
    cells += `<rect x="${i * 16}" y="${j * 16}" width="16" height="16" fill="url(#${h ? 'gh' : 'gv'})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
  <linearGradient id="gh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101216"/><stop offset=".5" stop-color="#1A1D22"/><stop offset="1" stop-color="#101216"/></linearGradient>
  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D0F12"/><stop offset=".5" stop-color="#15181C"/><stop offset="1" stop-color="#0D0F12"/></linearGradient>
  ${grain('n', [1, 1, 1], 0.035, 1.4)}
</defs><rect width="512" height="512" fill="#0D0F12"/>${cells}<rect width="512" height="512" filter="url(#n)"/></svg>`;
};

/* ------------------------------------------------------------ 뷰티성분사전 — 블러시 크림 · 로즈골드 · 플럼 (채널 색) */
const BE = { pap0: '#FAF0EB', pap1: '#F1DFD7', plum: '#4A2338', plum2: '#8E6B78', coral: '#D9735E', rose: '#C98D76', rose2: '#E7B8A6' };

/* 진주 분자 — 채널 아이콘(진주 셋 + 로즈골드 막대)을 선으로 옮긴 것 */
const molecule = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-30 -60 L44 6 M44 6 L-46 46 M-46 46 L-30 -60" stroke="url(#rg)" stroke-width="11" stroke-linecap="round"/>
  <circle cx="-30" cy="-60" r="34" fill="url(#pearl)"/><circle cx="44" cy="6" r="34" fill="url(#pearl)"/><circle cx="-46" cy="46" r="34" fill="url(#pearl)"/>
  <circle cx="58" cy="-58" r="5" fill="${BE.rose}"/><circle cx="-82" cy="-8" r="4" fill="${BE.rose}"/><circle cx="20" cy="74" r="4" fill="${BE.rose}"/></g>`;
const beautyDefs = `<linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${BE.rose2}"/><stop offset=".5" stop-color="${BE.rose}"/><stop offset="1" stop-color="${BE.rose2}"/></linearGradient>
  <radialGradient id="pearl" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F7ECE8"/><stop offset=".85" stop-color="#E2CCC6"/><stop offset="1" stop-color="#CDB3AC"/></radialGradient>`;

const beautyTicket = (W, H, mini) => {
  const px = Math.round(W * PERF), r = mini ? 16 : 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="b" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${BE.pap0}"/><stop offset="1" stop-color="${BE.pap1}"/></linearGradient>
  ${beautyDefs}
  ${grain('n', [0.29, 0.14, 0.2], 0.05)}
  <clipPath id="c"><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r}"/></clipPath>
  <mask id="h"><rect width="${W}" height="${H}" fill="#fff"/>${holes(px, mini ? 22 : 64, H - (mini ? 22 : 58), mini ? 13 : 26, mini ? 2.6 : 6)}</mask>
</defs>
<g mask="url(#h)">
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r}" fill="url(#b)"/>
  <g clip-path="url(#c)">
    <rect width="${W}" height="${H}" filter="url(#n)"/>
    <rect x="6" y="6" width="${W - 12}" height="${mini ? 9 : 20}" fill="url(#rg)"/>
    <rect x="${px}" y="0" width="${W - px}" height="${H}" fill="#EAD2C8" opacity=".45"/>
  </g>
  <rect x="${mini ? 14 : 30}" y="${mini ? 22 : 46}" width="${W - (mini ? 28 : 60)}" height="${H - (mini ? 36 : 76)}" rx="${mini ? 9 : 24}" fill="none" stroke="${BE.rose}" stroke-opacity=".55" stroke-width="${mini ? 1.5 : 2}"/>
  ${mini
    ? `${molecule(W - 48, H / 2 + 4, 0.34)}`
    : `<text x="80" y="146" font-family="Noto Sans KR" font-weight="900" font-size="58" fill="${BE.plum}">뷰티성분사전</text>
  <text x="456" y="144" font-family="Montserrat" font-weight="600" font-size="28" letter-spacing="8" fill="${BE.coral}">POP-UP</text>
  <text x="80" y="628" font-family="Noto Sans KR" font-weight="500" font-size="27" fill="${BE.plum2}">성분 카드 — 뽑으면 오늘의 성분이 나옵니다</text>
  <text x="80" y="670" font-family="Montserrat" font-weight="500" font-size="22" letter-spacing="7" fill="#A0848E">INGREDIENT CARD</text>
  ${molecule((px + W) / 2 + 8, H / 2 + 6, 1.05)}`}
</g></svg>`;
};

const beautyStamp = () => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<defs>${rubber('r', 1.6)}<path id="ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0"/></defs>
<g filter="url(#r)" fill="none" stroke="#C2456A" opacity=".95">
  <circle cx="150" cy="150" r="132" stroke-width="11"/><circle cx="150" cy="150" r="88" stroke-width="4"/>
  <text x="150" y="170" text-anchor="middle" font-family="Noto Sans KR" font-weight="900" font-size="58" fill="#C2456A" stroke="none">확인</text>
  <text font-family="Noto Sans KR" font-weight="700" font-size="24" letter-spacing="5" fill="#C2456A" stroke="none"><textPath href="#ring">뷰티성분사전 · POP-UP · 뷰티성분사전 · POP-UP ·</textPath></text>
</g></svg>`;

const beautySeal = () => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<defs>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D2C4"/><stop offset=".5" stop-color="${BE.rose}"/><stop offset="1" stop-color="#EBC1B0"/></linearGradient>
  <radialGradient id="in" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="#9A4A6A"/><stop offset=".65" stop-color="${BE.plum}"/><stop offset="1" stop-color="#2E1222"/></radialGradient>
</defs>
<circle cx="150" cy="150" r="140" fill="url(#rim)"/><circle cx="150" cy="150" r="116" fill="url(#in)"/>
<circle cx="150" cy="150" r="102" fill="none" stroke="#F3D2C4" stroke-opacity=".55" stroke-width="2"/>
<path d="M62 98 Q150 44 238 98" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="16" stroke-linecap="round"/></svg>`;

/* 흰 대리석 — 구름결(아주 옅게) 위에 맥(가는 회색 줄). stitchTiles 로 1024 타일 가장자리를 잇는다 */
const marble = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <filter id="cl" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0045" numOctaves="4" seed="3" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 .80  0 0 0 0 .78  0 0 0 0 .76  1.4 0 0 0 -.55"/></filter>
  <filter id="v1" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0032 .0085" numOctaves="5" seed="21" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 0 .8 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
    <feColorMatrix values="0 0 0 0 .58  0 0 0 0 .55  0 0 0 0 .53  0 0 0 1 0"/><feGaussianBlur stdDeviation=".7"/></filter>
  <filter id="v2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .014" numOctaves="4" seed="8" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 .55 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
    <feColorMatrix values="0 0 0 0 .66  0 0 0 0 .63  0 0 0 0 .61  0 0 0 1 0"/><feGaussianBlur stdDeviation=".5"/></filter>
</defs>
<rect width="1024" height="1024" fill="#F5F3F0"/>
<rect width="1024" height="1024" filter="url(#cl)" opacity=".55"/>
<rect width="1024" height="1024" filter="url(#v2)" opacity=".45"/>
<rect width="1024" height="1024" filter="url(#v1)" opacity=".7"/></svg>`;

/* ------------------------------------------------------------ 상품 교환권 — 결과 화면이 자르지 않게 *.flat.png */
const ICON = {
  golf: '<rect x="34" y="40" width="52" height="68" rx="12"/><path d="M44 40 V18 M60 40 V10 M76 40 V22"/><circle cx="44" cy="14" r="5"/><circle cx="60" cy="8" r="5"/><path d="M70 22 L82 18"/><path d="M34 62 H86"/>',
  umbrella: '<path d="M14 58 Q60 6 106 58 Q90 48 76 58 Q62 46 46 58 Q32 48 14 58 Z"/><path d="M60 34 V96 Q60 108 48 106"/>',
  tumbler: '<path d="M38 22 H82 L76 108 H44 Z"/><path d="M34 22 H86 V14 H34 Z"/><path d="M42 50 H78"/>',
  charge: '<rect x="30" y="18" width="60" height="88" rx="12"/><path d="M64 34 L48 64 H64 L54 90"/>',
  coffee: '<path d="M30 46 H86 V72 Q86 96 58 96 Q30 96 30 72 Z"/><path d="M86 54 Q104 54 102 68 Q100 80 86 78"/><path d="M48 18 Q42 28 48 36 M62 14 Q56 26 62 36"/><path d="M24 106 H92"/>',
  key: '<rect x="30" y="24" width="60" height="78" rx="22"/><circle cx="60" cy="52" r="10"/><path d="M48 80 H72"/><path d="M60 24 V10 H80"/>',
  set: '<rect x="18" y="44" width="26" height="62" rx="6"/><rect x="48" y="26" width="26" height="80" rx="6"/><rect x="78" y="56" width="26" height="50" rx="6"/><path d="M54 26 V16 H68 V26"/>',
  bottle: '<path d="M44 46 H76 V104 Q76 110 70 110 H50 Q44 110 44 104 Z"/><path d="M52 46 V30 H68 V46"/><path d="M60 30 V12"/><circle cx="60" cy="10" r="5"/><path d="M50 70 H70"/>',
  pouch: '<path d="M22 46 H98 L90 104 H30 Z"/><path d="M44 46 Q44 24 60 24 Q76 24 76 46"/><path d="M40 70 H80"/>',
  sachet: '<rect x="16" y="30" width="26" height="70" rx="4"/><rect x="47" y="22" width="26" height="78" rx="4"/><rect x="78" y="34" width="26" height="66" rx="4"/><path d="M16 42 H42 M47 34 H73 M78 46 H104"/>',
  tag: '<path d="M22 60 L60 22 H98 V60 L60 98 Z"/><circle cx="80" cy="40" r="7"/><path d="M50 62 L70 52 M48 72 L58 66"/>',
  gift: '<rect x="20" y="48" width="80" height="58" rx="6"/><rect x="14" y="34" width="92" height="16" rx="4"/><path d="M60 34 V106"/><path d="M60 34 Q40 10 32 26 Q28 36 60 34 Q80 10 88 26 Q92 36 60 34"/>',
};

const voucher = (b, v) => {
  const dark = b === 'arven';
  const c = dark
    ? { bg0: '#161A21', bg1: '#0C0E12', band: 'url(#bl)', brand: 'ARVEN', brandF: 'Montserrat', brandC: AR.ink, title: '#F3F5F8', sub: AR.dim, icon: AR.blue, edge: AR.blue }
    : { bg0: '#FBF2EE', bg1: '#F2E1D9', band: 'url(#rg)', brand: '뷰티성분사전', brandF: 'Noto Sans KR', brandC: BE.plum, title: BE.plum, sub: BE.coral, icon: BE.rose, edge: BE.rose };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${c.bg0}"/><stop offset="1" stop-color="${c.bg1}"/></linearGradient>
  <linearGradient id="bl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${AR.blueD}"/><stop offset=".5" stop-color="${AR.blue}"/><stop offset="1" stop-color="${AR.blueD}"/></linearGradient>
  ${beautyDefs}
  <clipPath id="c"><rect x="14" y="14" width="972" height="532" rx="28"/></clipPath>
</defs>
<rect x="14" y="14" width="972" height="532" rx="28" fill="url(#bg)"/>
<g clip-path="url(#c)"><rect x="14" y="14" width="972" height="16" fill="${c.band}"/></g>
<rect x="34" y="50" width="932" height="476" rx="18" fill="none" stroke="${c.edge}" stroke-opacity=".4" stroke-width="2"/>
<text x="76" y="118" font-family="${c.brandF}" font-weight="${dark ? 600 : 900}" font-size="${dark ? 34 : 36}" letter-spacing="${dark ? 11 : 0}" fill="${c.brandC}">${c.brand}</text>
<text x="76" y="292" font-family="Noto Sans KR" font-weight="900" font-size="${v.title.length > 7 ? 70 : 84}" fill="${c.title}">${v.title}</text>
<text x="80" y="356" font-family="Montserrat" font-weight="600" font-size="26" letter-spacing="8" fill="${c.sub}">${v.sub}</text>
<text x="80" y="470" font-family="Noto Sans KR" font-weight="500" font-size="24" fill="${dark ? '#6F7784' : '#A0848E'}">${v.note}</text>
<g transform="translate(704 130) scale(2.2)" fill="none" stroke="${c.icon}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON[v.icon]}</g>
</svg>`;
};

const ARVEN_PRIZES = [
  { file: 'a-golfbag', title: '골프백', sub: 'GOLF BAG', note: '아르벤 투어 스탠드백', icon: 'golf' },
  { file: 'b-umbrella', title: '장우산', sub: 'UMBRELLA', note: '아르벤 자동 장우산', icon: 'umbrella' },
  { file: 'c-tumbler', title: '텀블러', sub: 'TUMBLER', note: '아르벤 스테인리스 텀블러', icon: 'tumbler' },
  { file: 'd-charge', title: 'EV 충전 1만원', sub: 'CHARGING CREDIT', note: '아르벤 충전 카드에 바로 적립', icon: 'charge' },
  { file: 'e-coffee', title: '아메리카노', sub: 'COFFEE', note: '전시장 라운지 커피', icon: 'coffee' },
  { file: 'finale', title: '주말 시승 1박 2일', sub: 'WEEKEND DRIVE', note: '원하는 아르벤 모델로 주말 내내', icon: 'key' },
];
const BEAUTY_PRIZES = [
  { file: 'a-fullset', title: '본품 풀세트', sub: 'FULL SET', note: '팝업 라인 본품 3종', icon: 'set' },
  { file: 'b-bottle', title: '본품 택1', sub: 'FULL SIZE', note: '원하는 본품 하나', icon: 'bottle' },
  { file: 'c-minikit', title: '미니 키트', sub: 'MINI KIT', note: '여행용 미니 4종 파우치', icon: 'pouch' },
  { file: 'd-sample', title: '샘플 3종', sub: 'SAMPLES', note: '오늘의 성분 샘플', icon: 'sachet' },
  { file: 'e-coupon', title: '온라인 15% 할인', sub: 'ONLINE COUPON', note: '팝업이 끝나도 온라인몰에서', icon: 'tag' },
  { file: 'finale', title: '팝업 한정 세트', sub: 'LIMITED EDITION', note: '이번 팝업에서만 파는 세트', icon: 'gift' },
];

/* ------------------------------------------------------------ 굽기 */
const jobs = [];
if (!only || only === 'arven') {
  jobs.push(
    { out: path.join(PHOTO, 'ticket-arven.png'), w: 1400, h: 757, svg: arvenTicket(1400, 757, false) },
    { out: path.join(PHOTO, 'ticket-arven-mini.png'), w: 400, h: 216, svg: arvenTicket(400, 216, true) },
    { out: path.join(PHOTO, 'stamp-arven.png'), w: 300, h: 300, svg: arvenStamp() },
    { out: path.join(PHOTO, 'seal-arven.png'), w: 300, h: 300, svg: arvenSeal() },
    { out: path.join(PHOTO, 'surface-carbon.jpg'), w: 512, h: 512, svg: carbon(), jpg: true },
    ...ARVEN_PRIZES.map((v) => ({ out: path.join(DEMO, 'arven', `${v.file}.flat.png`), w: 1000, h: 560, svg: voucher('arven', v) })),
  );
}
if (!only || only === 'beauty') {
  jobs.push(
    { out: path.join(PHOTO, 'ticket-beauty.png'), w: 1400, h: 757, svg: beautyTicket(1400, 757, false) },
    { out: path.join(PHOTO, 'ticket-beauty-mini.png'), w: 400, h: 216, svg: beautyTicket(400, 216, true) },
    { out: path.join(PHOTO, 'stamp-beauty.png'), w: 300, h: 300, svg: beautyStamp() },
    { out: path.join(PHOTO, 'seal-beauty.png'), w: 300, h: 300, svg: beautySeal() },
    { out: path.join(PHOTO, 'surface-marble.jpg'), w: 1024, h: 1024, svg: marble(), jpg: true },
    ...BEAUTY_PRIZES.map((v) => ({ out: path.join(DEMO, 'beauty', `${v.file}.flat.png`), w: 1000, h: 560, svg: voucher('beauty', v) })),
  );
}

const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
for (const j of jobs) {
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  await page.setViewportSize({ width: j.w, height: j.h });
  await page.setContent(`<html><head>${FONTS}<style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${j.svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const png = j.jpg ? j.out.replace(/\.jpg$/, '.tmp.png') : j.out;
  await (await page.$('svg')).screenshot({ path: png, omitBackground: !j.jpg });
  if (j.jpg) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '3', j.out]);
    fs.rmSync(png);
  }
  console.log('ok', path.relative(ROOT, j.out), `${Math.round(fs.statSync(j.out).size / 1024)}KB`);
}
await browser.close();
