// 개발용 — 시드를 두 번 돌려 생긴 중복 매장 정리.
//   node scripts/dev-cleanup-dupes.mjs          (계획만 출력)
//   node scripts/dev-cleanup-dupes.mjs --apply  (실제 삭제)
//
// 규칙: 같은 이름·지점끼리 뽑힌 기록이 많은 매장을 남기고,
//       기록이 0인 나머지만 지운다. 기록이 있는 매장은 절대 지우지 않는다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(`${ROOT}.env.local`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'kuji' }, auth: { persistSession: false },
});

const apply = process.argv.includes('--apply');

const { data: stores } = await db
  .from('stores').select('id, name, branch, created_at').order('created_at');
const { data: camps } = await db.from('campaigns').select('id, store_id');

for (const s of stores) {
  const ids = camps.filter((c) => c.store_id === s.id).map((c) => c.id);
  let drawn = 0;
  for (const id of ids) {
    const { count } = await db.from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id).not('drawn_at', 'is', null);
    drawn += count ?? 0;
  }
  s.drawn = drawn;
  s.key = `${s.name}|${s.branch ?? ''}`;
}

const groups = new Map();
for (const s of stores) {
  if (!groups.has(s.key)) groups.set(s.key, []);
  groups.get(s.key).push(s);
}

const doomed = [];
for (const [key, list] of groups) {
  list.sort((a, b) => b.drawn - a.drawn || new Date(a.created_at) - new Date(b.created_at));
  console.log(`\n${key.replace('|', ' · ')}`);
  list.forEach((s, i) => {
    const keep = i === 0 || s.drawn > 0;
    console.log(`  ${keep ? '남김  ' : '삭제  '} 뽑힌기록 ${String(s.drawn).padStart(3)}장  ${s.id}`);
    if (!keep) doomed.push(s);
  });
}

console.log(`\n삭제 대상 ${doomed.length}개`);

if (!doomed.length) process.exit(0);
if (!apply) { console.log('실제로 지우려면 --apply 를 붙여 다시 실행하세요.'); process.exit(0); }

const { error } = await db.from('stores').delete().in('id', doomed.map((s) => s.id));
console.log(error ? `실패: ${error.message}` : `${doomed.length}개 삭제 완료 (캠페인·티켓·쿠폰 cascade)`);
