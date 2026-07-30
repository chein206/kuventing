import OwnerClient from './OwnerClient';
import './owner.css';

// 매장별 사장님 화면. 주소: /owner/<사장님토큰>
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OwnerClient token={token} />;
}
