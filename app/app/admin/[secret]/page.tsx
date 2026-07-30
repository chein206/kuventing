import AdminClient from './AdminClient';
import './admin.css';

// 운영자 화면. 주소: /admin/<ADMIN_SECRET>
// 주소의 시크릿과 요청 헤더의 시크릿이 모두 환경변수와 같아야 통과한다.
export default async function Page({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  return <AdminClient secret={secret} />;
}
