import { getAdmin } from '@/lib/admin';
import { checkAdmin } from '@/lib/adminAuth';

type PrizeIn = {
  grade: string; name?: string; qty: number;
  use_when?: 'now' | 'later'; valid_days?: number; image_url?: string;
};

/** 매장 목록 — 주소·PIN·박스 상태 */
export async function GET(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const deny = checkAdmin(secret, req);
  if (deny) return deny;

  const { data, error } = await getAdmin().rpc('admin_list_stores');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ stores: data });
}

/** 매장 생성 — 매장 → 캠페인 → 상품 → 1회차 박스까지 한 번에 */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const deny = checkAdmin(secret, req);
  if (deny) return deny;

  const body = (await req.json()) as {
    store?: { name?: string; branch?: string; owner_pin?: string; board_pin?: string };
    campaign?: Record<string, unknown>;
    prizes?: PrizeIn[];
    ads?: unknown[];
  };

  if (!body.store?.name?.trim()) {
    return Response.json({ error: 'NO_NAME', message: '매장 이름을 입력하세요' }, { status: 400 });
  }
  if (!Array.isArray(body.prizes) || !body.prizes.length) {
    return Response.json({ error: 'NO_PRIZES', message: '상품을 하나 이상 넣으세요' }, { status: 400 });
  }
  for (const p of body.prizes) {
    if (!p.grade || !Number.isInteger(p.qty) || p.qty < 0) {
      return Response.json({ error: 'BAD_PRIZE', message: '수량은 0 이상 정수여야 합니다' }, { status: 400 });
    }
  }

  const { data, error } = await getAdmin().rpc('admin_create_store', { p: body });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const r = data as { ok: boolean; reason?: string; sum?: number; total?: number; count?: number };
  if (!r?.ok) {
    const msg: Record<string, string> = {
      NO_NAME: '매장 이름을 입력하세요',
      BAD_PIN: 'PIN은 숫자 4자리여야 합니다',
      SAME_PIN: '카운터 PIN과 사장님 PIN을 다르게 설정하세요',
      BAD_TOTAL: '총 티켓 수는 10~500장 사이여야 합니다',
      GRADE_COUNT: `등급은 1~8개여야 합니다 (현재 ${r.count})`,
      QTY_MISMATCH: `수량 합계 ${r.sum}장 — 총 ${r.total}장과 맞춰주세요`,
    };
    return Response.json(
      { error: r.reason, message: msg[r.reason ?? ''] ?? '생성에 실패했습니다', ...r },
      { status: 400 }
    );
  }

  return Response.json(r);
}
