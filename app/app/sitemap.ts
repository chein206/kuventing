import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SITE_HOST, SITE_URL } from '@/lib/site';

/** 홈페이지 주소에서만 첫 화면 하나를 알린다. 서비스 주소(kuvt)는 빈 목록 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host') ?? '';
  if (host !== SITE_HOST) return [];
  return [{ url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 }];
}
