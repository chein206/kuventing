import type { Metadata } from 'next';
import BoardClient from './BoardClient';
import './board.css';

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  return {
    title: '쿠벤팅',
    manifest: `/board/${token}/manifest`,
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '쿠벤팅' },
    other: { 'mobile-web-app-capable': 'yes' },
  };
}

// 카운터 옆 상시 화면. 주소: /board/<보드토큰>
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BoardClient token={token} />;
}
