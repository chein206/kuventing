import { getAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/adminAuth';

/** 전 매장 미사용 쿠폰 — 기한 임박 순 */
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { data, error } = await getAdmin().rpc('admin_coupons', { p_limit: 200 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ coupons: data });
}
