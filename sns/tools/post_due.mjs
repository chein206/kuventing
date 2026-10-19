// @kuventing 예약 게시 — 승인된 칸 중 지금 올릴 때가 된 것만 올린다 (10-19)
//   node kuventing/sns/tools/post_due.mjs          (cld 폴더에서)  → 때가 된 칸 올리기
//   node kuventing/sns/tools/post_due.mjs --dry    → 무엇을 올릴지만 보여 주기
//
// 줄: kuventing/sns/weekly/queue.json 의 items
//   { id, type: carousel|reel, dir, files[], caption, cover?, ai?, slot(ISO +09:00), approved, approvedNote, status, url?, postedAt? }
//   status: draft(만드는 중) → ready(다 만듦) → posted / missed / failed
// 규칙
//   - approved === true && status === 'ready' 인 칸만 — approved 는 대표가 채팅으로 OK 한 칸에만 kuventing 세션이 적는다
//   - slot 이 지금보다 앞이고 90분 안쪽이면 올린다. 90분 넘게 지났으면 올리지 않고 missed 로 적는다(늦은 게시 대신 알림)
//   - 한 번에 2칸까지, 칸 사이 3분
//   - 올리기는 cld/blog-auto/pw/ig_post.mjs prep → share, 둘 다 --as=kuventing (계정이 다르면 전환, 못 하면 멈춤)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNS = path.join(HERE, '..');
const CLD = path.join(SNS, '..', '..');
const Q = path.join(SNS, 'weekly', 'queue.json');
const PW = path.join(CLD, 'blog-auto', 'pw');
const LOG = path.join(SNS, 'weekly', 'post-log');
const dry = process.argv.includes('--dry');
const LATE_MIN = 90;

const q = JSON.parse(fs.readFileSync(Q, 'utf8'));
const now = Date.now();
const save = () => fs.writeFileSync(Q, JSON.stringify(q, null, 2) + '\n');

const ready = q.items.filter((it) => it.approved === true && it.status === 'ready');
const due = [], missed = [];
for (const it of ready) {
  const t = Date.parse(it.slot);
  if (Number.isNaN(t)) continue;
  if (t > now + 5 * 60e3) continue;                 // 아직
  if (now - t > LATE_MIN * 60e3) missed.push(it); else due.push(it);
}
due.sort((a, z) => Date.parse(a.slot) - Date.parse(z.slot));

for (const it of missed) {
  console.log(`놓침 ${it.id} (예정 ${it.slot}) — 올리지 않음`);
  if (!dry) { it.status = 'missed'; it.missedAt = new Date().toISOString(); }
}
if (!dry) save();
if (!due.length) { console.log('올릴 칸 없음'); process.exit(0); }

fs.mkdirSync(LOG, { recursive: true });
let n = 0;
for (const it of due.slice(0, 2)) {
  const dir = path.join(CLD, it.dir);
  const files = it.files.map((f) => path.join(dir, f));
  const cap = path.join(dir, it.caption);
  for (const f of [cap, ...files, ...(it.cover ? [path.join(dir, it.cover)] : [])]) {
    if (!fs.existsSync(f)) { console.log(`파일 없음 ${f} — ${it.id} 건너뜀`); it.status = 'failed'; it.error = 'missing ' + f; save(); continue; }
  }
  if (it.status === 'failed') continue;
  console.log(`${dry ? '[연습] ' : ''}올림 ${it.id} · ${it.type} · ${files.length}개 · 예정 ${it.slot}`);
  if (dry) continue;
  if (n++ > 0) await new Promise((r) => setTimeout(r, 180e3));
  const env = { ...process.env, IG_SHOT: path.join(LOG, `${it.id}`) };
  const extra = ['--as=kuventing', ...(it.ai ? ['--ai'] : []), ...(it.cover ? [`--cover=${path.join(dir, it.cover)}`] : [])];
  try {
    const a = execFileSync('node', ['ig_post.mjs', 'prep', cap, ...files, ...extra], { cwd: PW, env, encoding: 'utf8', timeout: 6 * 60e3 });
    console.log(a.trim().split('\n').slice(-4).join('\n'));
    const s = execFileSync('node', ['ig_post.mjs', 'share', '--as=kuventing'], { cwd: PW, env, encoding: 'utf8', timeout: 6 * 60e3 });
    console.log(s.trim().split('\n').slice(-4).join('\n'));
    const ok = /공유됨 true/.test(s);
    const url = (s.match(/첫 게시물 (\/(?:p|reel)\/[^\s/]+\/?)/) || [])[1];
    it.status = ok ? 'posted' : 'failed';
    it.postedAt = new Date().toISOString();
    if (url) it.url = 'https://www.instagram.com' + url;
    if (!ok) it.error = 'share 완료 문구 못 봄';
  } catch (e) {
    it.status = 'failed';
    it.error = String(e.stderr || e.message).split('\n').filter(Boolean).slice(-3).join(' / ');
    console.log('실패', it.id, it.error);
  }
  save();
  console.log(`결과 ${it.id}: ${it.status}${it.url ? ' ' + it.url : ''}`);
}
