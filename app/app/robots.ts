import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SITE_HOST, SITE_URL } from '@/lib/site';

/**
 * 서비스 주소(kuvt)에는 공개할 콘텐츠가 없다.
 * 사장님 화면·카운터 화면·손님 쿠폰이 검색에 걸리면 안 되므로 전부 차단한다.
 * 홈페이지 주소(kuventing)는 첫 화면만 연다 — 같은 앱이라 매장 · 사장님 · 쿠폰 주소도 그 주소로 열리므로 그쪽은 막는다.
 * 주소마다 답이 달라 요청 때마다 만든다(headers).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? '';
  if (host === SITE_HOST) {
    return {
      rules: [{
        userAgent: '*',
        allow: '/',
        disallow: ['/site', '/demo/', '/board/', '/owner/', '/admin', '/c/', '/api/', '/fx', '/sfx', '/_d'],
      }],
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
