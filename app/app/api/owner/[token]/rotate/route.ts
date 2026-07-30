import { getAdmin, resolveOwner } from '@/lib/admin';

/**
 * 주소 재발급. { target: 'board' | 'owner' }
 *
 * board — 카운터 화면 주소를 바꾼다. 태블릿에서 주소를 다시 열어야 한다.
 *         발급돼 있던 뽑기권도 같이 무효화한다.
 * owner — 사장님 주소를 바꾼다. 이 요청에 쓴 주소는 즉시 죽으므로
 *         응답의 새 토큰으로 이동해야 한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { target } = (await req.json()) as { target?: string };

  if (target !== 'board' && target !== 'owner') {
    return Response.json({ error: 'BAD_TARGET' }, { status: 400 });
  }

  const rpc = target === 'board' ? 'rotate_board_token' : 'rotate_owner_token';
  const arg = target === 'board'
    ? { p_campaign: r.ctx.campaignId }
    : { p_store: r.ctx.storeId };

  const { data, error } = await getAdmin().rpc(rpc, arg);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok: boolean; token?: string; reason?: string };
  if (!res?.ok) return Response.json(res, { status: 400 });

  return Response.json({ ok: true, target, token: res.token });
}
