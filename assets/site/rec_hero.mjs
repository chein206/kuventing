// 홈페이지 히어로 영상 — 데모 판을 손님처럼 한 바퀴. CDP 스크린캐스트로 프레임을 떠서(가변 간격) ffmpeg 로 30fps 로 굽는다
//   node assets/site/rec_hero.mjs food 9      (kuventing 폴더에서) → assets/site/_rec/food-9/{f/*.jpg, list.txt, marks.json}
// 결과 등급은 판이 섞여서 매번 다르다 — B 이상(사진 상품)이 나올 때까지 몇 번 돌려 고른다. 고른 폴더를 build_assets.py 에 준다
import { chromium } from 'file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://kuvt.scpadlab.com';
// QUICK=1 — 빠른 열기(?quick=1): 대기 화면에서 누르면 고르기 없이 맨 윗등급 표가 바로 나온다. 홈페이지 개봉 조각을 A 로 찍을 때(build_assets --draw 전용 — list · grid 표시가 없다)
const QUICK = process.env.QUICK === '1';
const SLUG = process.argv[2] || 'food';
const TAKE = process.argv[3] || '1';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_rec');
const OUT = `${ROOT}/${SLUG}-${TAKE}`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/f`, { recursive: true });

const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const ctx = await b.newContext({ viewport: { width: 800, height: 1280 } });
const p = await ctx.newPage();
// 데모 띠는 숨기고, 손가락 자리를 보이게 — 누르면 고리, 끄는 동안은 점이 따라온다
await p.addInitScript(() => {
  const css = `.demo-tag{display:none!important}
  .op3hint{display:none!important}
  .tap-ring{position:fixed;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:3px solid rgba(255,255,255,.9);
    background:rgba(255,255,255,.16);pointer-events:none;z-index:2147483647;animation:tapRing .65s cubic-bezier(.16,1,.3,1) forwards}
  .tap-dot{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55);
    box-shadow:0 0 0 3px rgba(255,255,255,.35);pointer-events:none;z-index:2147483647;transition:opacity .25s}
  @keyframes tapRing{from{transform:scale(.45);opacity:1}to{transform:scale(1.5);opacity:0}}`;
  addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    let dot = null, moved = 0;
    addEventListener('pointerdown', (e) => {
      const r = document.createElement('div'); r.className = 'tap-ring';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 800);
      dot = document.createElement('div'); dot.className = 'tap-dot'; dot.style.opacity = '0';
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; document.body.appendChild(dot); moved = 0;
    }, true);
    addEventListener('pointermove', (e) => {
      if (!dot) return;
      if (++moved > 2) dot.style.opacity = '1';
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
    }, true);
    addEventListener('pointerup', () => { if (!dot) return; const d = dot; dot = null; d.style.opacity = '0'; setTimeout(() => d.remove(), 300); }, true);
  });
});

const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${BASE}/demo/${SLUG}${QUICK ? '?quick=1' : ''}`, { waitUntil: 'load', timeout: 120000 });
await p.waitForSelector('.touch', { timeout: 120000 });
await p.evaluate(() => document.fonts.ready);
// 상품 사진을 미리 받아 둔다 — 안 그러면 상품 목록이 빈 카드로 한 박자 보인다
await p.evaluate(() => Promise.all([...new Set([
  '/fx/prize-a.jpg', '/demo/food/b-ramen.jpg', '/fx/prize-c.jpg', '/demo/food/d-soda.jpg', '/art/coupon-1000.svg', '/fx/prize-last.jpg',
  '/demo/arven/a-golfbag.jpg', '/demo/arven/b-umbrella.jpg', '/demo/arven/c-tumbler.jpg', '/demo/arven/d-charge.jpg', '/demo/arven/e-coffee.jpg', '/demo/arven/finale.jpg',
  '/demo/beauty/a-fullset.jpg', '/demo/beauty/b-serum.jpg', '/demo/beauty/c-minikit.jpg', '/demo/beauty/d-sample.jpg', '/demo/beauty/e-coupon.jpg', '/demo/beauty/finale.jpg',
  '/img/prize-cafe-a.jpg', '/img/prize-cafe-b.jpg', '/img/prize-cafe-c.jpg', '/img/prize-cafe-d.jpg', '/img/prize-cafe-last.jpg',
  '/demo/chicken/a-chicken.jpg', '/demo/chicken/b-cheeseball.jpg', '/demo/chicken/c-beer.jpg', '/demo/chicken/d-cola.jpg', '/demo/chicken/finale.jpg', '/art/coupon-2000.svg',
])].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; }))));
await p.waitForTimeout(2500);   // 모션 광고 첫 컷이 자리 잡게

const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', (f) => {
  frames.push({ ts: f.metadata.timestamp, data: f.data });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const marks = {};
const mark = (k) => { marks[k] = Date.now() / 1000; };
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 800, maxHeight: 1280, everyNthFrame: 1 });
mark('start');
await p.waitForTimeout(1800);
mark('attract');
await p.click('.touch');
if (!QUICK) {
  await p.waitForSelector('.pgrid', { timeout: 15000 });
  await p.waitForTimeout(1500);
  mark('list');
  await p.click('.page .big.cd');
  await p.waitForSelector('.tgrid', { timeout: 15000 });
  await p.waitForTimeout(1100);
  const tiles = p.locator('.tk2:not(.used)');
  const n = await tiles.count();
  await tiles.nth(Math.floor(n * 0.37)).click();
  await p.waitForTimeout(700);
  mark('grid');
  await p.click('.rowbtn .big.cd');
}
await p.waitForSelector('.op3wrap .tslot.grip:not(.off)', { timeout: 60000 });
await p.waitForTimeout(700);
mark('open');
const s = await p.locator('.op3wrap .tslot').boundingBox();
const y = s.y + s.height / 2;
await p.mouse.move(s.x + s.width * 0.12, y);
await p.mouse.down();
for (let i = 1; i <= 44; i++) {
  const t = i / 44, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // 천천히 끌다가 놓는다
  await p.mouse.move(s.x + s.width * (0.12 + 0.88 * e), y);
  await p.waitForTimeout(26);
}
await p.mouse.up();
mark('pulled');
await p.waitForSelector('.res3', { timeout: 20000 });
await p.waitForTimeout(3400);
mark('result');
await cdp.send('Page.stopScreencast');
const grade = await p.evaluate(() => document.querySelector('.res3 .coinslot, .res3')?.closest('.bd')?.innerText?.match(/[A-E]\s*$/m)?.[0] ?? '');
const prize = await p.evaluate(() => document.querySelector('.res3 h1')?.textContent ?? '');

// 프레임 저장 + 길이(다음 프레임까지) — 화면이 멈춰 있으면 프레임이 안 오므로 시각으로 길이를 준다
frames.sort((a, z) => a.ts - z.ts);
let list = 'ffconcat version 1.0\n';
frames.forEach((f, i) => {
  const name = `f/${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(`${OUT}/${name}`, Buffer.from(f.data, 'base64'));
  const next = frames[i + 1]?.ts ?? f.ts + 0.5;
  list += `file '${name}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
});
list += `file 'f/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
fs.writeFileSync(`${OUT}/list.txt`, list);
fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify({ marks, first: frames[0]?.ts, last: frames.at(-1)?.ts, n: frames.length, prize, grade }, null, 1));
console.log(`${SLUG}-${TAKE} | 프레임 ${frames.length} | ${(frames.at(-1).ts - frames[0].ts).toFixed(1)}초 | 상품 ${JSON.stringify(prize)} | ${errs.length ? errs.slice(0, 2).join(' / ') : '오류 없음'}`);
await b.close();
