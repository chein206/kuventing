import 'server-only';
import { getAdmin } from './admin';

/**
 * 운영자 인증.
 *
 * 이전에는 주소에 시크릿을 박아 썼다. URL·화면 공유·히스토리에 비밀이 남고
 * 비번을 바꾸려면 환경변수를 고쳐 재배포해야 했다.
 *
 * 지금은 Supabase Auth 로그인 토큰을 검증하고, 운영자 명단(kuji.admins)에
 * 있는지 확인한다. byd-quo 어드민과 같은 방식이다.
 */
export type AdminCtx = { userId: string; email: string };

export async function requireAdmin(
  req: Request
): Promise<{ ctx: AdminCtx } | { error: Response }> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token) {
    return { error: Response.json({ error: 'NO_TOKEN' }, { status: 401 }) };
  }

  const db = getAdmin();

  // 토큰이 유효한 로그인인지 확인
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { error: Response.json({ error: 'BAD_TOKEN' }, { status: 401 }) };
  }

  const user = userData.user;

  // 로그인했더라도 운영자 명단에 없으면 거부한다
  const { data: isAdmin, error: adminErr } = await db.rpc('is_admin', { p_user: user.id });
  if (adminErr) {
    return { error: Response.json({ error: adminErr.message }, { status: 500 }) };
  }
  if (!isAdmin) {
    return { error: Response.json({ error: 'NOT_ADMIN' }, { status: 403 }) };
  }

  return { ctx: { userId: user.id, email: user.email ?? '' } };
}
