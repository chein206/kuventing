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

/**
 * 주소의 토큰으로 매장을 찾고, 헤더의 PIN을 그 매장 PIN과 대조한다.
 * 토큰만으로는 들어갈 수 없고, PIN만으로도 남의 매장에 갈 수 없다.
 */
export async function resolveOwner(
  token: string,
  req: Request
): Promise<{ ctx: OwnerCtx } | { error: Response }> {
  const pin = req.headers.get('x-owner-pin');

  const { data: store } = await getAdmin()
    .from('stores')
    .select('id, name, branch, owner_pin')
    .eq('owner_token', token)
    .maybeSingle();

  if (!store || !pin || pin !== store.owner_pin) {
    return { error: Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  }

  const { data: campaign } = await getAdmin()
    .from('campaigns')
    .select('id, title')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!campaign) {
    return { error: Response.json({ error: 'NO_CAMPAIGN' }, { status: 404 }) };
  }

  return {
    ctx: {
      storeId: store.id,
      campaignId: campaign.id,
      storeName: store.name,
      branch: store.branch,
      campaignTitle: campaign.title,
    },
  };
}
