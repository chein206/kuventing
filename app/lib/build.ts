// 지금 돌고 있는 배포 번호 — Vercel 이 배포마다 새로 준다. 로컬 개발 서버는 'dev'
// 서버에서만 읽는다(브라우저 번들에는 이 값이 없다)
export const BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || 'dev';
