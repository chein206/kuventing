import 'server-only';
import { getAdmin } from './admin';

export const BUCKET = 'kuventing';

const PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

/** 파일 이름이 겹치지 않게. 캠페인 폴더 아래에 둔다 */
export function storagePath(campaignId: string, slug: string, ext: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${campaignId}/${slug}-${Date.now().toString(36)}${rand}.${ext}`;
}

export function publicUrl(path: string) {
  return PUBLIC_PREFIX + path;
}

/**
 * 우리 버킷의 파일 URL이면 경로를, 아니면 null.
 * 예전에 쓰던 /img/prize-a.jpg 같은 정적 경로는 지우면 안 되므로 걸러진다.
 */
export function pathFromUrl(url: string | null | undefined) {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return null;
  return url.slice(PUBLIC_PREFIX.length);
}

export async function putImage(path: string, body: ArrayBuffer, contentType: string) {
  return getAdmin().storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: '31536000',   // 경로에 난수가 있어 갈아끼우면 새 주소가 된다
  });
}

/** 갈아끼운 뒤 옛 파일을 치운다. 실패해도 흐름은 막지 않는다 */
export async function dropImage(url: string | null | undefined) {
  const p = pathFromUrl(url);
  if (!p) return;
  await getAdmin().storage.from(BUCKET).remove([p]).catch(() => {});
}

/**
 * 캠페인 폴더를 통째로 비운다. 매장을 지울 때 쓴다.
 * DB 행만 지우면 사진은 버킷에 남아 아무도 안 보는 채로 용량을 먹는다.
 */
export async function dropCampaignImages(campaignId: string) {
  const bucket = getAdmin().storage.from(BUCKET);
  const { data, error } = await bucket.list(campaignId);
  if (error || !data?.length) return 0;
  await bucket.remove(data.map((f) => `${campaignId}/${f.name}`)).catch(() => {});
  return data.length;
}
