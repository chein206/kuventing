import type { MetadataRoute } from 'next';

/**
 * 이 도메인(kuvt)에는 공개할 콘텐츠가 없다.
 * 사장님 화면·카운터 화면·손님 쿠폰이 검색에 걸리면 안 되므로 전부 차단한다.
 * 마케팅용 홈페이지는 별도 도메인(kuventing)에서 따로 노출한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
