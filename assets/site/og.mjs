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

// 2판(10-07) — 팝업 입구 장면 사진 위에 실제 대기 화면(뷰티 팝업 판)을 원근 맞춰 얹고(홈페이지 첫 화면과 같은 변환),
// 왼쪽은 남색으로 눌러 제목을 얹는다. 금빛 번쩍임 · 뽑기 말투는 뺐다(「사행성 느낌」)
const POPUP = 'matrix3d(0.28433166,-0.04106174,0,-0.00010319,0.00293412,0.45052272,0,0.00000483,0,0,1,0,846.71380615,61.28153992,0,1)';
const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800&family=Black+Han+Sans&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#070B16;color:#F3F1EA;font-family:'Pretendard Variable',sans-serif;position:relative}
.scene{position:absolute;left:150px;top:-30px;width:1376px;height:768px;transform:scale(.92);transform-origin:0 0}
.scene>img{position:absolute;inset:0;width:1376px;height:768px}
.scene>.scr{position:absolute;left:0;top:0;width:540px;height:864px;transform-origin:0 0;transform:${POPUP};
  background:url(${img('site/screen-beauty.jpg')}) center/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#070B16 0%,#070B16 30%,rgba(7,11,22,.86) 46%,rgba(7,11,22,.3) 64%,rgba(7,11,22,0) 76%)}
.copy{position:absolute;left:76px;top:92px;width:640px}
.logo{display:flex;align-items:center;gap:14px;font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800;font-size:21px;letter-spacing:.08em}
.logo img{width:42px;height:42px;border-radius:11px}
.label{margin-top:58px;font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800;font-size:17px;letter-spacing:.16em;color:#FFC83D}
h1{margin-top:16px;font-family:'Black Han Sans',sans-serif;font-weight:400;font-size:74px;line-height:1.14}
h1 em{font-style:normal;color:#FFC83D}
p{margin-top:24px;font-size:25px;color:#C3CAD8;letter-spacing:-.02em}
</style></head><body>
<div class="scene"><img src="${img('site/scene-popup.jpg')}"><div class="scr"></div></div>
<div class="shade"></div>
<div class="copy">
  <div class="logo"><img src="${png('icon-192.png')}">KUVENTING</div>
  <div class="label">SIGNAGE + LUCKY DRAW</div>
  <h1>평소엔 광고판,<br><em>누르면 럭키드로우</em></h1>
  <p>팝업 스토어, 행사장, 매장 카운터의 화면 하나로</p>
</div>
</body></html>`;

const b = await pw.chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'networkidle' });
// 한글 제목 글꼴은 글자 조각(unicode-range)마다 따로 받는다 — 쓰는 글자를 콕 집어 불러 둔다
await p.evaluate(() => document.fonts.load('74px "Black Han Sans"', '평소엔 광고판, 누르면 럭키드로우'));
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
const tmp = path.join(PUB, 'site', 'og.tmp.png');
await p.screenshot({ path: tmp });
await b.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-q:v', '3', path.join(PUB, 'site', 'og.jpg')]);
fs.rmSync(tmp);
console.log('og.jpg', Math.round(fs.statSync(path.join(PUB, 'site', 'og.jpg')).size / 1024) + 'KB');
