import { getAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/adminAuth';

/** 대시보드 — 전 매장 합계 + 손봐야 할 매장 */
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { data, error } = await getAdmin().rpc('admin_overview');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ...(data as object), me: gate.ctx.email });
}
