// @kuventing 댓글 · DM 훑기 — 읽기만 한다(답 · 좋아요 · 팔로우 안 함) (10-19)
//   node kuventing/sns/tools/ig_inbox.mjs        (cld 폴더에서)
// 하는 일
//   1) 엣지(CDP 9333) 인스타가 @kuventing 인지 확인 — 아니면 「전환」 목록에서 바꿈(목록에 없으면 멈춤)
//   2) DM 받은편지함 · 메시지 요청(팔로우 안 한 사람 = 처음 문의가 여기로 옴) 글자를 읽음
//   3) queue.json 에서 올라간 칸(url)마다 게시물을 열어 댓글을 읽음
//   4) 지난번(sns/inbox/last.json)과 달라진 줄만 「새로 보임」으로 출력 → 답할 것만 초안 → 대표 승인 → 답
// 답글 · DM 답장은 이 도구가 하지 않는다(초안 승인 뒤 따로)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNS = path.join(HERE, '..');
const CLD = path.join(SNS, '..', '..');
const require = createRequire(path.join(CLD, 'blog-auto', 'pw') + path.sep);
const { chromium } = require('playwright-core');
const AS = 'kuventing';
const OUT = path.join(SNS, 'inbox');
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
let p = ctx.pages().find((x) => x.url().includes('instagram.com'));
if (!p) p = await ctx.newPage();
const text = () => p.evaluate(() => document.body.innerText);
const go = async (u, ms = 4500) => { await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(ms); };

async function whoAmI() {
  await go('https://www.instagram.com/accounts/edit/', 3000);
  const t = await text();
  const i = t.lastIndexOf('프로필 편집');
  return i < 0 ? '' : (t.slice(i).split('\n')[1] || '').trim();
}
let me = await whoAmI();
if (me !== AS) {
  await go('https://www.instagram.com/', 3000);
  await p.getByText('전환', { exact: true }).filter({ visible: true }).first().click();
  await p.waitForTimeout(2000);
  const row = p.locator('[role=dialog]').last().getByText(AS, { exact: true });
  if (!(await row.count())) { console.log(`전환 목록에 ${AS} 없음 — 대표 로그인 필요`); process.exit(2); }
  await row.first().click(); await p.waitForTimeout(6000);
  me = await whoAmI();
  if (me !== AS) { console.log('계정 전환 실패', me); process.exit(2); }
}
console.log('계정', me);

const snap = {};
// DM — 받은편지함은 목록이 늦게 그려져 한 번 더 기다린다
await go('https://www.instagram.com/direct/inbox/', 6000);
snap.inbox = (await text()).split('\n').map((s) => s.trim()).filter(Boolean);
await go('https://www.instagram.com/direct/requests/', 5000);
snap.requests = (await text()).split('\n').map((s) => s.trim()).filter(Boolean);

// 올라간 게시물 댓글
const q = JSON.parse(fs.readFileSync(path.join(SNS, 'weekly', 'queue.json'), 'utf8'));
snap.posts = {};
for (const it of q.items.filter((x) => x.status === 'posted' && x.url)) {
  await go(it.url, 5000);
  snap.posts[it.id] = (await text()).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 400);
}

const lastF = path.join(OUT, 'last.json');
const last = fs.existsSync(lastF) ? JSON.parse(fs.readFileSync(lastF, 'utf8')) : { inbox: [], requests: [], posts: {} };
const fresh = (a = [], z = []) => { const s = new Set(z); return a.filter((l) => !s.has(l) && l.length > 1); };
const out = { at: new Date().toISOString(), inbox: fresh(snap.inbox, last.inbox), requests: fresh(snap.requests, last.requests), posts: {} };
for (const [id, lines] of Object.entries(snap.posts)) out.posts[id] = fresh(lines, last.posts?.[id]);

fs.writeFileSync(lastF, JSON.stringify(snap, null, 2));
const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
fs.appendFileSync(path.join(OUT, `${day}.jsonl`), JSON.stringify(out) + '\n');

const n = out.inbox.length + out.requests.length + Object.values(out.posts).reduce((s, a) => s + a.length, 0);
console.log(n ? `새로 보임 ${n}줄` : '새로 보인 것 없음');
if (out.requests.length) console.log('메시지 요청:', out.requests.slice(0, 40).join(' | '));
if (out.inbox.length) console.log('받은편지함:', out.inbox.slice(0, 40).join(' | '));
for (const [id, a] of Object.entries(out.posts)) if (a.length) console.log(`댓글(${id}):`, a.slice(0, 40).join(' | '));
process.exit(0);
