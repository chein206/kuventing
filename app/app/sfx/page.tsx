import SfxClient from './SfxClient';
import './sfx.css';

// 소리 미리듣기. 매장에 나가기 전에 태블릿에서 직접 눌러 비교하는 자리다.
export const metadata = { title: '쿠벤팅 소리' };

export default function SfxPage() {
  return <SfxClient />;
}
