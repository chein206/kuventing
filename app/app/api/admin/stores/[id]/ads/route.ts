import { getAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/adminAuth';
import { campaignOfStore } from '@/lib/adminStore';
import { dropImage } from '@/lib/storage';

/** 운영자가 광고 슬라이드를 편집한다. 검증은 사장님 라우트와 같은 DB 함수가 한다 */

type AdIn = {
  title?: string; sub?: string | null; price?: string | null;
  image?: string | null; pos?: string | null;
};

const REASON: Record<string, string> = {
  NOT_FOUND: '이벤트를 찾지 못했습니다',
  TOO_MANY: '슬라이드는 최대 10장입니다',
  EMPTY_SLIDE: '제목이나 사진 중 하나는 있어야 합니다',
  TOO_LONG: '글자 수를 줄여주세요',
  BAD_POS: '글자 위치가 잘못됐습니다',
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { id } = await params;
  const c = await campaignOfStore(id);
  if ('error' in c) return c.error;

  const body = (await req.json()) as { ads?: AdIn[] };
  if (!Array.isArray(body.ads)) {
    return Response.json({ error: 'BAD_INPUT', message: '슬라이드 목록이 없습니다' }, { status: 400 });
  }

  const { data, error } = await getAdmin()
    .rpc('set_ads', { p_campaign: c.campaignId, p_ads: body.ads });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok: boolean; reason?: string; at?: number; count?: number; gone?: string[] };
  if (!res?.ok) {
    const where = res?.at ? ` (${res.at}번째 슬라이드)` : '';
    return Response.json(
      { error: res?.reason, message: (REASON[res?.reason ?? ''] ?? '저장하지 못했습니다') + where, ...res },
      { status: 400 }
    );
  }

  for (const url of res.gone ?? []) await dropImage(url);
  return Response.json({ ok: true, count: res.count });
}
