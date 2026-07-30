import { getAdmin, resolveOwner } from '@/lib/admin';

type PrizeIn = {
  grade: string;
  name?: string;
  qty: number;
  sort?: number;
  use_when?: 'now' | 'later';
  valid_days?: number;
};

/** 상품 구성 저장. 합계가 총 티켓 수와 같아야 한다. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const body = (await req.json()) as { prizes?: PrizeIn[] };
  const prizes = body.prizes;

  if (!Array.isArray(prizes) || !prizes.length) {
    return Response.json({ error: 'EMPTY' }, { status: 400 });
  }
  if (prizes.length > 8) {
    return Response.json({ error: 'TOO_MANY', message: '등급은 최대 8개입니다' }, { status: 400 });
  }
  for (const p of prizes) {
    if (!p.grade || !Number.isInteger(p.qty) || p.qty < 0) {
      return Response.json({ error: 'BAD_INPUT', message: '수량은 0 이상 정수여야 합니다' }, { status: 400 });
    }
  }

  const { data, error } = await getAdmin()
    .rpc('set_prizes', { p_campaign: r.ctx.campaignId, p_prizes: prizes });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok: boolean; reason?: string; sum?: number; total?: number };
  if (!res.ok && res.reason === 'QTY_MISMATCH') {
    return Response.json(
      { ...res, message: `합계 ${res.sum}장 — 총 ${res.total}장과 맞춰주세요` },
      { status: 400 }
    );
  }
  return Response.json(res);
}
