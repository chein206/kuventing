import 'server-only';
import { getAdmin } from './admin';

/**
 * 운영자가 매장 하나를 손볼 때 쓰는 공통 조회.
 *
 * 사장님 라우트는 주소의 토큰과 PIN 으로 캠페인을 찾지만, 운영자는 매장 id 로 온다.
 * 사장님 인증(resolveOwner)에 운영자 예외를 섞으면 그 함수가 두 가지 일을 하게 되므로
 * 진입점을 따로 두고 뒤쪽 부품(스토리지·DB 함수)만 같이 쓴다.
 *
 * 사진을 사장님이 직접 올리는 것보다 우리가 카톡으로 받아 올리는 경우가 많다.
 * 그때 매장 주소로 매번 들어가지 않아도 되게 하는 것이 이 경로의 목적이다.
 */
export async function campaignOfStore(
  storeId: string
): Promise<{ campaignId: string; store: string; branch: string | null } | { error: Response }> {
  const { data, error } = await getAdmin()
    .from('stores')
    .select('name, branch, campaigns(id, created_at)')
    .eq('id', storeId)
    .single();

  if (error) return { error: Response.json({ error: error.message }, { status: 500 }) };
  if (!data) return { error: Response.json({ error: 'NOT_FOUND' }, { status: 404 }) };

  // 매장에 캠페인이 여러 개면 가장 최근 것을 손본다
  const camps = (data.campaigns ?? []) as { id: string; created_at: string }[];
  const latest = [...camps].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!latest) {
    return { error: Response.json({ error: 'NO_CAMPAIGN', message: '이벤트가 없는 매장입니다' }, { status: 404 }) };
  }

  return { campaignId: latest.id, store: data.name, branch: data.branch };
}
