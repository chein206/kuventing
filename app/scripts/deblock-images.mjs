/**
 * 광고 사진 파일 이름에서 `ad-` 를 걷어낸다.
 *
 * 광고 차단기(uBlock, AdGuard, 브레이브 방패)는 주소에 `ad-` 가 들어간 요청을
 * 통째로 막는다. 우리 광고 사진이 정확히 그 이름이었다 — `ad-0-xxxx.jpg`,
 * `/img/ad-미소라멘.jpg`. 손님 태블릿에 차단기가 하나라도 깔려 있으면
 * **사장님 광고가 안 뜬다**. 광고가 1순위인 제품에서 이건 치명적이다.
 *
 * 그래서 `menu-` 로 바꾼다. 앞으로 올리는 사진은 코드가 그렇게 붙이고,
 * 이미 올라간 사진은 이 스크립트가 옮긴다.
 *
 *   node scripts/deblock-images.mjs          무엇이 바뀔지만 보여준다
 *   node scripts/deblock-images.mjs --go     실제로 옮긴다
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'kuji' } },
);

const BUCKET = 'kuventing';
const GO = process.argv.includes('--go');

/** 주소 한 줄을 안전한 이름으로 바꾼다. 바꿀 게 없으면 그대로 돌려준다 */
const rename = (url) =>
  url.replace('/img/ad-', '/img/menu-').replace(/\/ad-(\d+)-/, '/menu-$1-');

/** 스토리지 주소에서 버킷 안쪽 경로만 뽑는다 */
function keyOf(url) {
  const m = url.match(new RegExp(`/object/public/${BUCKET}/(.+)$`));
  if (m) return m[1];
  return url.startsWith('http') ? null : url; // 이미 상대 경로로 저장된 것
}

const { data: rows, error } = await db.from('campaigns').select('id, ads');
if (error) { console.error('읽지 못했습니다:', error.message); process.exit(1); }

let moved = 0, patched = 0;

for (const c of rows) {
  const ads = c.ads ?? [];
  let touched = false;

  const next = [];
  for (const a of ads) {
    const url = a.image;
    if (!url) { next.push(a); continue; }

    const to = rename(url);
    if (to === url) { next.push(a); continue; }
    touched = true;

    // 스토리지에 실제 파일이 있으면 옮긴다. /img/ 는 저장소에 커밋된 파일이라 건드리지 않는다
    const from = keyOf(url), dest = keyOf(to);
    if (from && dest && !url.startsWith('/img/')) {
      console.log(`  파일  ${from}\n     -> ${dest}`);
      if (GO) {
        const { error: e } = await db.storage.from(BUCKET).move(from, dest);
        if (e) { console.error('    옮기지 못했습니다:', e.message); next.push(a); continue; }
      }
      moved++;
    } else {
      console.log(`  주소  ${url} -> ${to}`);
    }
    next.push({ ...a, image: to });
  }

  if (!touched) continue;
  patched++;
  if (GO) {
    const { error: e } = await db.from('campaigns').update({ ads: next }).eq('id', c.id);
    if (e) console.error('  DB 를 고치지 못했습니다:', e.message);
  }
}

console.log(`\n${GO ? '완료' : '미리보기'} — 캠페인 ${patched}개, 파일 ${moved}개`);
if (!GO) console.log('실제로 옮기려면: node scripts/deblock-images.mjs --go');
