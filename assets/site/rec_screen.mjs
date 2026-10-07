// 대기 화면(광고판)만 녹화 — 데모 판을 열어 두고 손대지 않은 채 모션 광고가 도는 몇 초를 뜬다
//   node assets/site/rec_screen.mjs food 14        (kuventing 폴더에서) → assets/site/_rec/screen-food/{f/*.jpg, list.txt}
// 굽기: ffmpeg -f concat -safe 0 -i list.txt -vf fps=30,scale=540:-2 … (build 는 lab 샘플 README 참고)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const SLUG = process.argv[2] || 'food';
const SEC = Number(process.argv[3] || 14);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_rec', `screen-${SLUG}`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'f'), { recursive: true });

const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 1280 } });
const p = await ctx.newPage();
await p.addInitScript(() => addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style'); s.textContent = '.demo-tag{display:none!important}'; document.head.appendChild(s);
}));
await p.goto(`https://kuvt.scpadlab.com/demo/${SLUG}`, { waitUntil: 'load', timeout: 120000 });
await p.waitForSelector('.touch', { timeout: 120000 });
await p.evaluate(() => document.fonts.ready);
// 광고 사진을 다 받아 둔다(첫 바퀴에 빈 칸이 안 보이게) — 그리고 첫 컷부터 다시 보이도록 새로 연다
const imgs = await p.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.src));
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.touch', { timeout: 120000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);

const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', (f) => {
  frames.push({ ts: f.metadata.timestamp, data: f.data });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 800, maxHeight: 1280, everyNthFrame: 1 });
await p.waitForTimeout(SEC * 1000);
await cdp.send('Page.stopScreencast');

frames.sort((a, z) => a.ts - z.ts);
let list = 'ffconcat version 1.0\n';
frames.forEach((f, i) => {
  const name = `f/${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(f.data, 'base64'));
  const next = frames[i + 1]?.ts ?? f.ts + 0.4;
  list += `file '${name}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
});
list += `file 'f/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
fs.writeFileSync(path.join(OUT, 'list.txt'), list);
console.log(`screen-${SLUG} | 프레임 ${frames.length} | ${(frames.at(-1).ts - frames[0].ts).toFixed(1)}초 | 사진 ${imgs.length}`);
await b.close();
