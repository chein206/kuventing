import { getAdmin, resolveOwner } from '@/lib/admin';

/** 카운터 화면 PIN 조회 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { data, error } = await getAdmin()
    .from('stores').select('board_pin').eq('id', r.ctx.storeId).single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

/** 카운터 화면 PIN 변경 — 사장님 로그인 PIN과 같게 두지 못하게 막는다 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const { pin } = (await req.json()) as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) {
    return Response.json({ error: 'BAD_PIN', message: '숫자 4자리여야 합니다' }, { status: 400 });
  }

  const { data: store } = await getAdmin()
    .from('stores').select('owner_pin').eq('id', r.ctx.storeId).single();

  if (store?.owner_pin === pin) {
    return Response.json(
      { error: 'SAME_AS_OWNER', message: '사장님 로그인 PIN과 같게 둘 수 없습니다' },
      { status: 400 }
    );
  }

  const { error } = await getAdmin()
    .from('stores').update({ board_pin: pin }).eq('id', r.ctx.storeId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, pin });
}
