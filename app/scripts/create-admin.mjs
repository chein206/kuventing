// 운영자 계정 생성 / 재설정
//   npm run admin -- scpad206@gmail.com
//
// Supabase Auth 사용자를 만들고 kuji.admins 명단에 넣는다.
// 임시 비밀번호는 화면에 찍지 않고 파일로만 내보낸다 (첫 로그인 후 바꿀 것).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(`${ROOT}.env.local`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('사용법: npm run admin -- 이메일주소');
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'kuji' },
  auth: { persistSession: false },
});

// 읽기 쉬운 임시 비번 (혼동되는 문자 제외)
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const pw = Array.from(randomBytes(16)).map((b) => CH[b % CH.length]).join('');

// 이미 있으면 비번만 재설정
const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId;
if (found) {
  const { error } = await db.auth.admin.updateUserById(found.id, { password: pw });
  if (error) { console.error('비번 재설정 실패:', error.message); process.exit(1); }
  userId = found.id;
  console.log('기존 계정의 비밀번호를 재설정했습니다.');
} else {
  const { data, error } = await db.auth.admin.createUser({
    email, password: pw, email_confirm: true,
  });
  if (error) { console.error('계정 생성 실패:', error.message); process.exit(1); }
  userId = data.user.id;
  console.log('계정을 만들었습니다.');
}

const { data: up, error: upErr } = await db.rpc('admin_upsert', {
  p_user: userId, p_email: email, p_name: null,
});
if (upErr) { console.error('운영자 등록 실패:', upErr.message); process.exit(1); }

const out = `${ROOT}admin-임시비번.txt`;
writeFileSync(out, [
  '쿠벤팅 운영자 계정',
  '',
  `이메일   : ${email}`,
  `임시 비번 : ${pw}`,
  '',
  '첫 로그인 후 어드민 화면에서 비밀번호를 바꾸세요.',
  '이 파일은 깃에 올라가지 않습니다. 확인 후 지우세요.',
].join('\n'), 'utf8');

console.log(`운영자 등록 완료: ${email}`);
console.log(`임시 비밀번호는 파일로 저장했습니다 → ${out}`);
console.log('(화면에는 찍지 않습니다. 확인 후 파일을 지우세요)');
console.log(up);
