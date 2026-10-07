/**
 * 전용 엣지(CDP 9333, blog-auto/EDGE.md)에서 Flow 새 프로젝트를 만들고 이름을 붙인다 — 생성 버튼은 누르지 않는다.
 * 다른 작업 탭(휠매치 Forge 등)은 건드리지 않는다: 기본은 **새 탭**을 연다. 계정 주소(/u/N)는 열려 있는 Flow 탭을 따른다.
 *
 *   node scripts/flow-newproj.mjs "쿠벤팅 데모 상품"               → 새 탭 · 마지막 줄 PROJECT=<id>
 *   node scripts/flow-newproj.mjs "쿠벤팅 데모 광고" --tab <id>    → 내가 전에 연 그 프로젝트 탭을 다시 써서
 *   node scripts/flow-newproj.mjs "쿠벤팅 데모 광고" --u 1         → 계정 자리를 정해서(/u/1). 찍힌 계정 메일을 같이 보여 준다
 *     (10-07: 엣지를 새로 띄우면 u/0 이 프로 계정이라 그림에 ✦ 가 찍힌다 — 울트라 계정 자리로 만든다)
 *
 * 그다음 shorts-lab 의 flow_still 로 시트를 뽑는다 — assets/demo/README.md
 */
let pw;
try { pw = await import('playwright-core'); }
catch { pw = await import('file:///C:/Users/Nam-PC/Desktop/cld/shorts-lab/tools/pw/node_modules/playwright-core/index.mjs'); }

const args = process.argv.slice(2);
const NAME = args[0] || '쿠벤팅';
const ti = args.indexOf('--tab');
const TAB = ti >= 0 ? args[ti + 1] : '';
const ui = args.indexOf('--u');
const U = ui >= 0 ? args[ui + 1] : '';

const browser = await pw.chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const flowTab = ctx.pages().find((p) => /flow\.google\.com/.test(p.url()));
const BASE = U ? `https://flow.google.com/u/${U}`
  : flowTab?.url().match(/^https:\/\/flow\.google\.com(\/u\/\d+)?/)?.[0] ?? 'https://flow.google.com';
const page = TAB ? ctx.pages().find((p) => p.url().includes(`/project/${TAB}`)) : await ctx.newPage();
if (!page) { console.log('그 프로젝트 탭 없음 —', TAB); process.exit(1); }
const pause = (ms = 700) => page.waitForTimeout(ms);

await page.bringToFront();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await pause(5000);
if (await page.evaluate(() => navigator.webdriver)) { console.log('navigator.webdriver=true — 멈춤'); process.exit(1); }
// 어느 계정 자리인지 — 계정 단추의 이름표에서 메일만 읽는다(누르지 않는다. 그 창은 로그아웃 단추가 있는 구글 계정 창)
const who = await page.evaluate(() => [...document.querySelectorAll('[aria-label*="@"]')]
  .map((e) => e.getAttribute('aria-label').match(/[\w.+-]+@[\w.-]+/)?.[0]).filter(Boolean)[0] ?? '');
console.log(`계정 ${who || '(못 읽음)'} · ${BASE}`);
// 열린 창의 투명 덮개가 남아 있으면 첫 클릭이 안 먹는다(flow_upload 와 같다)
for (let i = 0; i < 3; i++) {
  const bd = page.locator('.cdk-overlay-backdrop').filter({ visible: true });
  if (!(await bd.count())) break;
  await page.keyboard.press('Escape'); await pause(500);
}
const btn = page.locator('button').filter({ hasText: /새 프로젝트|New project/ }).first();
if (!(await btn.count())) { console.log('「새 프로젝트」 버튼 없음 — 로그인 확인 필요:', page.url()); process.exit(1); }
await btn.click();
await page.waitForURL(/\/project\//, { timeout: 30000 }); await pause(4000);
const id = page.url().match(/\/project\/([0-9a-f-]+)/)[1];
const title = page.locator('input[aria-label="수정 가능한 텍스트"]').first();
if (await title.count()) {
  await title.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(NAME);
  await page.keyboard.press('Enter'); await pause(1200);
  // 이름 칸에 포커스가 남으면 다음 도구의 설정 칩 첫 클릭이 안 먹는다
  await page.locator('[contenteditable=true]').filter({ visible: true }).last().click().catch(() => {});
}
console.log(`이름 ${NAME} · ${BASE}`);
console.log(`PROJECT=${id}`);
process.exit(0);
