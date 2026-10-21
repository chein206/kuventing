// @kuventing 좋아요 — 대표가 채팅으로 OK 한 게시물만 (10-21)
//   node kuventing/sns/tools/ig_like.mjs <게시물 주소...>          (cld 폴더에서)
//   node kuventing/sns/tools/ig_like.mjs --dry <게시물 주소...>    → 하트 상태만 읽기
// 규칙: 계정은 ig_post.mjs use --as=kuventing 로 맞춤, 한 번에 10개까지, 사이 20~40초, 이미 눌렀으면 건너뜀
//   기록은 sns/outreach/like-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = path.join(HERE, '..', '..', '..', 'blog-auto', 'pw');
const LOG = path.join(HERE, '..', 'outreach', 'like-log.jsonl');
const require = createRequire(PW + path.sep);
const { chromium } = require('playwright-core');

const dry = process.argv.includes('--dry');
const urls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!urls.length) throw new Error('게시물 주소를 적어 주세요');
if (urls.length > 10) throw new Error('한 번에 10개까지');
for (const u of urls) if (!/^https:\/\/www\.instagram\.com\/[^/]+\/(p|reel)\/[^/]+\/?$/.test(u)) throw new Error('인스타 게시물 주소가 아님 ' + u);

console.log(execFileSync('node', ['ig_post.mjs', 'use', '--as=kuventing'], { cwd: PW, encoding: 'utf8', timeout: 3 * 60e3 }).trim());

const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const p = b.contexts()[0].pages().find((x) => /instagram\.com|chrome-error/.test(x.url()));
// 게시물 본문 하트(댓글 하트 말고) — 첫 번째 「좋아요」/「좋아요 취소」 아이콘
const heart = async () => p.evaluate(() => [...document.querySelectorAll('svg[aria-label="좋아요"], svg[aria-label="좋아요 취소"]')].find((s) => s.getAttribute('height') === '24')?.getAttribute('aria-label') || '');

for (let i = 0; i < urls.length; i++) {
  await p.goto(urls[i], { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  const before = await heart();
  let after = before;
  if (!dry && before === '좋아요') {
    await p.locator('svg[aria-label="좋아요"][height="24"]').first().click();
    await p.waitForTimeout(2500);
    after = await heart();
  }
  console.log(urls[i], '|', before || '(하트 못 찾음)', '→', after || '?');
  if (!dry) fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), url: urls[i], before, after }) + '\n');
  if (!dry && before !== after && i < urls.length - 1) await p.waitForTimeout(20e3 + Math.random() * 20e3);
}
await b.close().catch(() => {});
process.exit(0);
