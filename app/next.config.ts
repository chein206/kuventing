import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 개발 서버는 기본적으로 localhost 외 origin의 요청을 막는다.
  // 폰으로 QR을 스캔해 테스트하려면 PC의 사설 IP를 허용해야 한다.
  // IP가 바뀌면 여기에 추가할 것 (ipconfig 로 확인).
  allowedDevOrigins: ['192.168.0.131', '192.168.0.*', '192.168.1.*'],
};

export default nextConfig;
