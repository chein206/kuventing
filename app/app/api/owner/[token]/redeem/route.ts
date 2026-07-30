import { getAdmin, resolveOwner } from '@/lib/admin';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { code } = (await req.json()) as { code?: string };
  if (!code) return Response.json({ ok: false, reason: 'NOT_FOUND' });

  const { data, error } = await getAdmin()
    .rpc('redeem', { p_campaign: r.ctx.campaignId, p_code: code });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
