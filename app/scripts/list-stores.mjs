// 매장별 접속 주소와 PIN을 뽑아본다.
//   npm run stores
// .env.local 을 직접 읽으므로 키를 따로 넘길 필요가 없다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(`${ROOT}.env.local`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'kuji' },
  auth: { persistSession: false },
});

const { data: stores, error } = await db
  .from('stores')
  .select('id, name, branch, owner_token, owner_pin, board_pin')
  .order('created_at');

if (error) { console.error(error.message); process.exit(1); }

const { data: camps } = await db
  .from('campaigns')
  .select('id, store_id, title, board_token, current_box, total_tickets, status');

const base = process.argv[2] ?? 'http://localhost:3000';

for (const s of stores) {
  const c = camps.find((x) => x.store_id === s.id);
  console.log('');
  console.log('━'.repeat(64));
  console.log(`  ${s.name}${s.branch ? ' · ' + s.branch : ''}`);
  console.log('━'.repeat(64));
  console.log(`  카운터 화면 : ${base}/board/${c?.board_token ?? '(캠페인 없음)'}`);
  console.log(`  사장님 화면 : ${base}/owner/${s.owner_token}`);
  console.log('');
  console.log(`  카운터 PIN  : ${s.board_pin}   (손님 앞에서 직원이 누름)`);
  console.log(`  사장님 PIN  : ${s.owner_pin}   (외부 노출 금지)`);
  if (s.board_pin === s.owner_pin) {
    console.log('  ⚠ 두 PIN이 같습니다. 카운터 PIN을 바꾸세요.');
  }
  if (c) {
    const { count } = await db
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', c.id).eq('box', c.current_box).is('drawn_at', null);
    console.log('');
    console.log(`  이벤트      : ${c.title} (${c.status})`);
    console.log(`  박스        : ${c.current_box}회차 · 남은 티켓 ${count}/${c.total_tickets}`);
  }
}
console.log('');
