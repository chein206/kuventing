// SIGNAGE 장 녹화 — 업종마다 대기 화면의 첫 컷(올린 사진 한 장 + 문구가 모션 광고로 도는 몇 초)만 뜬다.
// 홈페이지는 이걸 업종 순서대로 이어 붙인 영상 하나를 돌리고, 재생 위치로 왼쪽 「올린 것」 사진을 맞춘다(build_signage.py).
//   node assets/site/rec_signage.mjs beauty cafe food arven      (kuventing 폴더에서)
//   → assets/site/_rec/sig-<업종>/{f/*.jpg, list.txt, marks.json}
// 첫 컷의 시작을 잡으려고 녹화를 먼저 켜 두고 새로 연다 — 「누르면 시작」 단추가 뜬 때가 모션 광고 첫 컷의 시작이다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const BASE = process.env.BASE || 'https://kuvt.scpadlab.com';
const SLUGS = process.argv.slice(2);
const SEC = 7.2;   // 첫 컷(6.5초) + 여유 — 자르는 건 build_signage.py 가 한다
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_rec');

const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

for (const slug of SLUGS) {
  const OUT = path.join(ROOT, `sig-${slug}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'f'), { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 800, height: 1280 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = '.demo-tag{display:none!important}'; document.head.appendChild(s);
  }));
  // 한 번 열어 광고 사진을 다 받아 둔다(두 번째 열 때 첫 컷부터 사진이 바로 뜨게)
  await p.goto(`${BASE}/demo/${slug}`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.touch', { timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500);

  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ ts: f.metadata.timestamp, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 800, maxHeight: 1280, everyNthFrame: 1 });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.touch', { timeout: 120000 });
  const scene = Date.now() / 1000;
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
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ first: frames[0]?.ts, last: frames.at(-1)?.ts, scene, n: frames.length }, null, 1));
  console.log(`sig-${slug} | 프레임 ${frames.length} | 첫 컷 시작 ${(scene - frames[0].ts).toFixed(2)}초 | 끝 ${(frames.at(-1).ts - frames[0].ts).toFixed(1)}초`);
  await ctx.close();
}
await b.close();
