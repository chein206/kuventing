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
  // 테마는 캠페인 설정을 읽어 클라이언트에서 교체한다. 기본값은 어두운 판.
  // 홈페이지(/site)는 첫 그림 전에 html 에 kv-js 를 붙인다(움직임 준비) — 그 한 칸 차이로 하이드레이션 경고가 나지 않게
  return (
    <html lang="ko" data-theme="dark-west" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
