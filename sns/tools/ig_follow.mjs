// @kuventing 팔로우 — 대표가 채팅으로 OK 한 아이디만 (10-21)
//   node kuventing/sns/tools/ig_follow.mjs <아이디...>          (cld 폴더에서)
//   node kuventing/sns/tools/ig_follow.mjs --dry <아이디...>    → 프로필 버튼 상태만 읽기
// 규칙
//   - 계정 맞추기는 ig_post.mjs use --as=kuventing (전환 · 저장 프로필 경로 그대로)
//   - 한 번에 10곳까지, 사이 25~45초 — 새 계정이 몰아서 팔로우하면 막힌다
//   - 이미 「팔로잉」 · 「요청됨」이면 건너뜀, 누른 뒤 버튼 글자가 바뀐 것까지 확인
//   - 기록은 sns/outreach/follow-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLD = path.join(HERE, '..', '..', '..');
const PW = path.join(CLD, 'blog-auto', 'pw');
const LOG = path.join(HERE, '..', 'outreach', 'follow-log.jsonl');
const require = createRequire(PW + path.sep);
const { chromium } = require('playwright-core');

const dry = process.argv.includes('--dry');
const handles = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((h) => h.replace(/^@/, ''));
if (!handles.length) throw new Error('아이디를 적어 주세요');
if (handles.length > 10) throw new Error('한 번에 10곳까지');

console.log(execFileSync('node', ['ig_post.mjs', 'use', '--as=kuventing'], { cwd: PW, encoding: 'utf8', timeout: 3 * 60e3 }).trim());

const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const p = b.contexts()[0].pages().find((x) => /instagram\.com|chrome-error/.test(x.url()));
const header = () => p.locator('header').first();
const btnText = async () => (await header().locator('button').allInnerTexts()).map((s) => s.trim()).find((s) => /^(팔로우|팔로잉|요청됨|맞팔로우 하기)$/.test(s)) || '';

for (let i = 0; i < handles.length; i++) {
  const h = handles[i];
  await p.goto(`https://www.instagram.com/${h}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  const before = await btnText();
  let after = before;
  if (!dry && (before === '팔로우' || before === '맞팔로우 하기')) {
    await header().getByRole('button', { name: before, exact: true }).first().click();
    await p.waitForTimeout(3000);
    after = await btnText();
  }
  const row = { at: new Date().toISOString(), h, before, after, dry };
  console.log(h, '|', before || '(버튼 못 찾음)', '→', after || '?');
  if (!dry) fs.appendFileSync(LOG, JSON.stringify(row) + '\n');
  if (!dry && before !== after && i < handles.length - 1) await p.waitForTimeout(25e3 + Math.random() * 20e3);
}
await b.close().catch(() => {});
process.exit(0);
