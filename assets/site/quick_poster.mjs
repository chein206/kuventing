// 첫 화면 「바로 열어 보기」 포스터 — 빠른 열기 판(/demo/<업종>?quick=open)이 표를 내민 순간. 판(iframe)이 뜨기 전에 이 그림을 보인다
//   node assets/site/quick_poster.mjs beauty      (kuventing 폴더에서) → app/public/site/quick-<업종>.jpg (640×1024)
// 홈페이지는 판을 480×768 로 그려 틀 폭에 맞춰 줄인다(QuickOpen.tsx) — 포스터도 같은 크기로 그려야 판이 뜰 때 안 튄다
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const BASE = process.env.BASE || 'https://kuvt.scpadlab.com';
const SLUG = process.argv[2] || 'beauty';
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public');
const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const p = await (await b.newContext({ viewport: { width: 480, height: 768 }, deviceScaleFactor: 4 / 3 })).newPage();
await p.goto(`${BASE}/demo/${SLUG}?quick=open`, { waitUntil: 'load', timeout: 120000 });
await p.waitForSelector('.op3wrap .tslot.grip:not(.off)', { timeout: 60000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(900);
const tmp = path.join(PUB, 'site', `quick-${SLUG}.tmp.png`);
await p.screenshot({ path: tmp });
await b.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-q:v', '3', path.join(PUB, 'site', `quick-${SLUG}.jpg`)]);
fs.rmSync(tmp);
console.log(`quick-${SLUG}.jpg`, Math.round(fs.statSync(path.join(PUB, 'site', `quick-${SLUG}.jpg`)).size / 1024) + 'KB');
