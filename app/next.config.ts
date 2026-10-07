import type { NextConfig } from 'next';

// 홈페이지 · 서비스 주소 — lib/site.ts 와 같아야 한다
const SITE_HOST = 'kuventing.scpadlab.com';
const SERVICE_HOST = 'kuvt.scpadlab.com';

const nextConfig: NextConfig = {
  // 개발 서버는 기본적으로 localhost 외 origin의 요청을 막는다.
  // 폰으로 QR을 스캔해 테스트하려면 PC의 사설 IP를 허용해야 한다.
  // IP가 바뀌면 여기에 추가할 것 (ipconfig 로 확인).
  allowedDevOrigins: ['192.168.0.131', '192.168.0.*', '192.168.1.*'],

  // 서비스 주소의 첫 화면은 비어 있다 — 홈페이지로 보낸다(매장 · 사장님 · 쿠폰 주소는 그대로)
  async redirects() {
    return [
      { source: '/', has: [{ type: 'host', value: SERVICE_HOST }], destination: `https://${SITE_HOST}/`, permanent: false },
    ];
  },

  // 홈페이지 주소의 / 는 /site — 앱의 / (app/page.tsx)보다 먼저 봐야 하므로 beforeFiles
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: SITE_HOST }], destination: '/site' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
