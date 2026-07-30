import { getAdmin, resolveOwner } from '@/lib/admin';

/** 새 박스 열기. 지난 회차 티켓·쿠폰은 지우지 않는다. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { data, error } = await getAdmin().rpc('open_new_box', { p_campaign: r.ctx.campaignId });
  if (error) {
    const mismatch = error.message.includes('QTY_MISMATCH');
    return Response.json(
      {
        error: mismatch ? 'QTY_MISMATCH' : error.message,
        message: mismatch ? '등급별 수량 합이 총 티켓 수와 다릅니다' : undefined,
      },
      { status: 400 }
    );
  }
  return Response.json(data);
}
