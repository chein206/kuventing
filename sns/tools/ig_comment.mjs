// @kuventing 댓글 — 대표가 채팅으로 OK 한 문구 그대로, 한 번에 하나 (10-21)
//   node kuventing/sns/tools/ig_comment.mjs <게시물 주소> "<문구>"          (cld 폴더에서)
//   node kuventing/sns/tools/ig_comment.mjs --dry <게시물 주소> "<문구>"    → 칸에 넣기만, 「게시」 안 누름
// 규칙: 계정은 ig_post.mjs use --as=kuventing, 같은 글에 kuventing 댓글이 이미 있으면 멈춤, 기록 sns/outreach/comment-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = path.join(HERE, '..', '..', '..', 'blog-auto', 'pw');
const LOG = path.join(HERE, '..', 'outreach', 'comment-log.jsonl');
const require = createRequire(PW + path.sep);
const { chromium } = require('playwright-core');

const dry = process.argv.includes('--dry');
const [url, text] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!/^https:\/\/www\.instagram\.com\/[^/]+\/(p|reel)\/[^/]+\/?$/.test(url || '')) throw new Error('인스타 게시물 주소가 아님 ' + url);
if (!text?.trim()) throw new Error('문구가 비었음');

console.log(execFileSync('node', ['ig_post.mjs', 'use', '--as=kuventing'], { cwd: PW, encoding: 'utf8', timeout: 3 * 60e3 }).trim());

const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const p = b.contexts()[0].pages().find((x) => /instagram\.com|chrome-error/.test(x.url()));
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4500);
// 댓글 줄은 화면 글자로 「kuventing / (시각) / 문구」 순서 — 아이디 바로 뒤 60자 안에 문구가 있으면 우리 댓글 (10-21: li 로 찾다 못 찾아 「게시됨 false」 오판)
const mine = () => p.evaluate((t) => { const s = document.body.innerText; let i = s.indexOf('kuventing'); while (i >= 0) { if (s.slice(i, i + 60 + t.length).includes(t.slice(0, 12))) return true; i = s.indexOf('kuventing', i + 1); } return false; }, text);
if (await mine()) throw new Error('이미 이 글에 같은 댓글이 있음 — 다시 달지 않음');

const box = p.locator('textarea[aria-label^="댓글 달기"], textarea[placeholder^="댓글 달기"]').first();
await box.click();
await p.waitForTimeout(500);
await p.keyboard.insertText(text);
await p.waitForTimeout(800);
const typed = await box.inputValue();
console.log('칸', JSON.stringify(typed));
if (typed.trim() !== text.trim()) throw new Error('칸에 들어간 글이 다름 — 게시 안 함');
if (dry) { await p.screenshot({ path: path.join(HERE, '..', 'outreach', 'comment-dry.png') }); console.log('연습 — 게시 안 누름'); process.exit(0); }

await p.getByRole('button', { name: '게시', exact: true }).or(p.getByText('게시', { exact: true })).first().click();
let ok = false;
for (let i = 0; i < 10 && !ok; i++) { await p.waitForTimeout(1500); ok = (await box.inputValue().catch(() => '')) === '' && (await mine()); }
console.log('게시됨', ok);
fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), url, text, ok }) + '\n');
await b.close().catch(() => {});
process.exit(0);
