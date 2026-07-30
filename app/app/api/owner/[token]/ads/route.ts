import { getAdmin, resolveOwner } from '@/lib/admin';
import { dropImage } from '@/lib/storage';

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

/**
 * 광고 슬라이드 저장. 배열을 통째로 갈아끼운다.
 *
 * 순서 바꾸기·중간 삭제가 결국 배열 재작성이라 자리별 수정보다 단순하다.
 * 화면 쪽도 추가·삭제·순서 변경 때마다 전체를 보내므로,
 * 사진 업로드가 쓰는 자리(index)가 서버와 어긋나지 않는다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const body = (await req.json()) as { ads?: AdIn[] };
  if (!Array.isArray(body.ads)) {
    return Response.json({ error: 'BAD_INPUT', message: '슬라이드 목록이 없습니다' }, { status: 400 });
  }
  if (body.ads.length > 10) {
    return Response.json({ error: 'TOO_MANY', message: REASON.TOO_MANY }, { status: 400 });
  }

  const { data, error } = await getAdmin()
    .rpc('set_ads', { p_campaign: r.ctx.campaignId, p_ads: body.ads });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok: boolean; reason?: string; at?: number; count?: number; gone?: string[] };
  if (!res?.ok) {
    const where = res?.at ? ` (${res.at}번째 슬라이드)` : '';
    return Response.json(
      { error: res?.reason, message: (REASON[res?.reason ?? ''] ?? '저장하지 못했습니다') + where, ...res },
      { status: 400 }
    );
  }

  // 슬라이드에서 빠진 사진은 스토리지에서도 치운다
  for (const url of res.gone ?? []) await dropImage(url);

  return Response.json({ ok: true, count: res.count });
}
