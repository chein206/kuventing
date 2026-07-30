import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * 사장님용 클라이언트 (service_role).
 * 절대 클라이언트 번들에 들어가면 안 된다 — Route Handler에서만 import 할 것.
 * 빌드 시점에 환경변수가 없어도 실패하지 않도록 지연 생성한다.
 */
const makeAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'kuji' }, auth: { persistSession: false } }
  );

let _admin: ReturnType<typeof makeAdmin> | null = null;

export function getAdmin() {
  if (!_admin) _admin = makeAdmin();
  return _admin;
}

export type OwnerCtx = {
  storeId: string;
  campaignId: string;
  storeName: string;
  branch: string | null;
  campaignTitle: string;
};

type Gate =
  | {
      ok: true; storeId: string; campaignId: string;
      storeName: string; branch: string | null; campaignTitle: string;
    }
  | { ok: false; reason: 'UNAUTHORIZED' | 'LOCKED' | 'NO_CAMPAIGN'; left?: number; minutes?: number };

/**
 * 주소의 토큰으로 매장을 찾고, 헤더의 PIN을 그 매장 PIN과 대조한다.
 * 대조·실패기록·잠금 판단을 DB 함수(owner_gate)에 한 번에 맡긴다.
 * PIN이 4자리라 대입이 가능하므로 10분 내 5회 실패하면 10분간 잠근다.
 */
export async function resolveOwner(
  token: string,
  req: Request
): Promise<{ ctx: OwnerCtx } | { error: Response }> {
  const pin = req.headers.get('x-owner-pin') ?? '';

  const { data, error } = await getAdmin().rpc('owner_gate', { p_token: token, p_pin: pin });
  if (error) return { error: Response.json({ error: error.message }, { status: 500 }) };

  const g = data as Gate;

  if (!g?.ok) {
    if (g?.reason === 'LOCKED') {
      const min = g.minutes ?? 10;
      return {
        error: Response.json(
          { error: 'LOCKED', message: `PIN을 여러 번 틀렸습니다. ${min}분 후 다시 시도하세요` },
          { status: 429, headers: { 'Retry-After': String(min * 60) } }
        ),
      };
    }
    if (g?.reason === 'NO_CAMPAIGN') {
      return { error: Response.json({ error: 'NO_CAMPAIGN' }, { status: 404 }) };
    }
    return { error: Response.json({ error: 'UNAUTHORIZED', left: g?.left }, { status: 401 }) };
  }

  return {
    ctx: {
      storeId: g.storeId,
      campaignId: g.campaignId,
      storeName: g.storeName,
      branch: g.branch,
      campaignTitle: g.campaignTitle,
    },
  };
}
