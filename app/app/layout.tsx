import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '쿠벤팅',
  description: '꽝 없는 동네 쿠지 — 매장 뽑기 이벤트',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#C4442A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 테마는 캠페인 설정을 읽어 클라이언트에서 교체한다. 기본값 warm.
  return (
    <html lang="ko" data-theme="warm">
      <body>{children}</body>
    </html>
  );
}
