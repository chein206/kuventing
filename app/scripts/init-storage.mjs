// 사진 저장용 Supabase Storage 버킷을 만든다. 한 번만 돌리면 된다.
//   npm run storage
//
// 읽기는 공개(태블릿·손님 화면이 그냥 <img src>로 가져간다),
// 쓰기는 service_role 뿐이다. 사장님 업로드도 우리 서버 라우트를 거친다.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ENV = path.join(HERE, '..', '.env.local');

const env = Object.fromEntries(
  readFileSync(ENV, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BUCKET = 'kuventing';
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const opts = {
  public: true,
  fileSizeLimit: 4 * 1024 * 1024,             // 화면에서 이미 줄여 올린다. 4MB면 넉넉
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

const { data: buckets, error: listErr } = await db.storage.listBuckets();
if (listErr) { console.error('버킷 목록을 못 읽었습니다:', listErr.message); process.exit(1); }

if (buckets.some((b) => b.name === BUCKET)) {
  const { error } = await db.storage.updateBucket(BUCKET, opts);
  if (error) { console.error('설정 갱신 실패:', error.message); process.exit(1); }
  console.log(`버킷 '${BUCKET}' 이미 있습니다. 설정만 맞췄습니다.`);
} else {
  const { error } = await db.storage.createBucket(BUCKET, opts);
  if (error) { console.error('생성 실패:', error.message); process.exit(1); }
  console.log(`버킷 '${BUCKET}' 을 만들었습니다.`);
}

console.log(`공개 읽기 · 4MB 제한 · jpeg/png/webp`);
console.log(`공개 주소 예: ${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/<경로>`);
