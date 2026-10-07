/**
 * 주소 둘 — 서비스(매장 화면 · 사장님 화면 · 쿠폰)와 홈페이지.
 * 같은 앱 하나가 두 주소로 뜬다. 홈페이지 주소의 / 는 /site 를 보여 주고(next.config.ts),
 * 서비스 주소의 / 는 홈페이지로 보낸다. 검색은 홈페이지 주소만 허용한다(robots.ts · sitemap.ts).
 * next.config.ts 에도 같은 값이 적혀 있다(설정 파일은 앱 모듈을 가져오지 않는다).
 */
export const SITE_HOST = 'kuventing.scpadlab.com';
export const SERVICE_HOST = 'kuvt.scpadlab.com';
export const SITE_URL = `https://${SITE_HOST}`;
