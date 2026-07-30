import AdminClient from './AdminClient';
import './admin.css';

// 운영자 화면. 주소는 /admin 하나. 이메일+비밀번호로 들어가고
// 운영자 명단(kuji.admins)에 있어야 통과한다.
export default function AdminPage() {
  return <AdminClient />;
}
