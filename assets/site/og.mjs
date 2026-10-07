// 링크 미리보기 그림(1200×630) — 카톡 · 문자에 홈페이지 주소를 붙이면 뜨는 카드
//   node assets/site/og.mjs     (kuventing 폴더에서) → app/public/site/og.jpg
// 글꼴(프리텐다드)을 CDN 에서 받아 크롬으로 굽는다 — 그림판으로 그리면 한글 글꼴이 기기마다 달라진다
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, '..', '..', 'app', 'public');
const img = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(PUB, p)).toString('base64');
const png = (p) => 'data:image/png;base64,' + fs.readFileSync(path.join(PUB, p)).toString('base64');

const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#080C18;color:#F2EEE4;font-family:'Pretendard Variable',sans-serif;position:relative}
.glow{position:absolute;right:120px;top:40px;width:560px;height:560px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(230,190,102,.45),rgba(230,190,102,.1) 60%,transparent);filter:blur(30px)}
.blue{position:absolute;left:-200px;top:-200px;width:800px;height:700px;background:radial-gradient(closest-side,rgba(52,76,140,.45),transparent)}
.copy{position:absolute;left:84px;top:150px;width:600px}
.logo{display:flex;align-items:center;gap:14px;font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800;font-size:22px;letter-spacing:.08em}
.logo img{width:44px;height:44px;border-radius:12px}
h1{margin-top:44px;font-size:72px;line-height:1.1;letter-spacing:-.045em;font-weight:800}
h1 em{font-style:normal;color:#E6BE66}
p{margin-top:24px;font-size:26px;color:#C5CCDA;letter-spacing:-.02em}
.dev{position:absolute;right:130px;top:46px;width:330px;padding:12px;border-radius:34px;
  background:linear-gradient(155deg,#26304A,#0B101C 55%,#161E31);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),0 40px 80px -30px rgba(0,0,0,.8);
  transform:perspective(1600px) rotateY(-9deg) rotateX(3deg)}
.scr{aspect-ratio:800/1280;border-radius:22px;overflow:hidden;background:url(${img('site/step-3.jpg')}) center/cover}
</style></head><body>
<div class="blue"></div><div class="glow"></div>
<div class="copy">
  <div class="logo"><img src="${png('icon-192.png')}">KUVENTING</div>
  <h1>뽑으러 오는 손님,<br><em>쿠벤팅</em>이 만듭니다</h1>
  <p>태블릿 하나로 여는 꽝 없는 매장 뽑기판</p>
</div>
<div class="dev"><div class="scr"></div></div>
</body></html>`;

const b = await pw.chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
const tmp = path.join(PUB, 'site', 'og.tmp.png');
await p.screenshot({ path: tmp });
await b.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-q:v', '3', path.join(PUB, 'site', 'og.jpg')]);
fs.rmSync(tmp);
console.log('og.jpg', Math.round(fs.statSync(path.join(PUB, 'site', 'og.jpg')).size / 1024) + 'KB');
