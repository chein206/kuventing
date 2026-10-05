/**
 * Flow 프로젝트의 그림을 전부 **2K 업스케일**로 받는다 — 이미지 0크레딧(메뉴에 크레딧 표시가 있으면 멈춘다).
 * 모션 광고는 사진을 1.1배까지 키운다 — 1K(896×1200)는 태블릿에서 1:1 리샘플링 구간에 걸려 줄이 기어다닌다
 * (카운터화면.md §2-4). 그래서 광고 사진은 2K 로 받는다.
 *
 *   node scripts/flow-2k.mjs <프로젝트 id> <저장 폴더>
 *
 * 2K 파일은 이름이 없다 — 받은 뒤 1K 후보와 그림을 대조해 이름을 붙인다(assets/demo/match2k.py).
 * 주의(10-05): 두 번째 계정 자리(/u/1/)에서는 2K 를 눌러도 3분 동안 파일이 안 왔다 — 그때는 1K 를 키워 쓴다(install.py).
 * 첫 자리(/u/0/) 탭에서 다시 시험해 볼 것
 * 붙는 법 · 탭 규칙은 cld/blog-auto/EDGE.md (전용 엣지 CDP 9333, 창 · 탭 안 닫음).
 */
import fs from 'node:fs';
import path from 'node:path';

let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const [PROJECT, OUTDIR] = process.argv.slice(2);
if (!PROJECT || !OUTDIR) { console.log('usage: node scripts/flow-2k.mjs <project id> <out dir>'); process.exit(1); }
const OUT = path.resolve(OUTDIR);
fs.mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes(`/project/${PROJECT}`));
if (!page) { console.log('그 프로젝트 탭 없음 —', PROJECT); process.exit(1); }
if (await page.evaluate(() => navigator.webdriver)) { console.log('navigator.webdriver=true — 멈춤'); process.exit(1); }
await page.bringToFront();
const pause = (ms = 700) => page.waitForTimeout(ms);
const backToList = async () => {
  if (/\/edit\//.test(page.url())) { await page.locator('button[aria-label*="뒤로"]').first().click(); await pause(1500); }
};
await backToList();

// 결과 칸 — 큰 그림만(아이콘 · 썸네일 제외). 위에서부터 차례로
const tiles = async () => page.evaluate(() => [...document.querySelectorAll('img')]
  .filter((i) => i.naturalWidth > 300 && i.getBoundingClientRect().width > 100)
  .map((i) => i.src));
const srcs = [...new Set(await tiles())];
console.log(`그림 ${srcs.length}장`);

let n = 0;
for (const src of srcs) {
  n++;
  const file = path.join(OUT, `${String(n).padStart(2, '0')}.jpg`);
  if (fs.existsSync(file)) { console.log(`  ${n} 이미 있음`); continue; }
  await backToList();
  const img = page.locator(`img[src="${src}"]`).first();
  await img.scrollIntoViewIfNeeded().catch(() => {});
  await img.click();
  await page.waitForURL(/\/edit\//, { timeout: 15000 }); await pause(1200);
  await page.locator('button[aria-label="미디어 다운로드"]').first().click(); await pause(900);
  const item = page.locator('.cdk-overlay-container [role=menuitem], .cdk-overlay-container button')
    .filter({ hasText: /2K/ }).filter({ visible: true }).first();
  if (!(await item.isVisible().catch(() => false))) { console.log(`  ${n}: 2K 항목 없음 — 건너뜀`); await page.keyboard.press('Escape'); continue; }
  if (/크레딧/.test(await item.innerText())) { console.log('2K 항목에 크레딧 표시 — 멈춤'); process.exit(1); }
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), item.click()]);
  await d.saveAs(file);
  console.log(`  ${n} 저장 ${path.basename(file)} (${Math.round(fs.statSync(file).size / 1024)}KB)`);
  await pause(600);
}
await backToList();
process.exit(0);
