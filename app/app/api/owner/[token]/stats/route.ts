import { getAdmin, resolveOwner } from '@/lib/admin';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { data, error } = await getAdmin().rpc('owner_stats', { p_campaign: r.ctx.campaignId });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    ...(data as object),
    store: r.ctx.storeName,
    branch: r.ctx.branch,
    title: r.ctx.campaignTitle,
  });
}
