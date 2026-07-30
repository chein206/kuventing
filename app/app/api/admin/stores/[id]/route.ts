import { getAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/adminAuth';
import { dropCampaignImages } from '@/lib/storage';

/**
 * 매장 삭제. 뽑힌 기록이 있으면 거부한다.
 * 정말 지워야 하면 ?force=1 (데모 정리용).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { id } = await params;
  const force = new URL(req.url).searchParams.get('force') === '1';

  // 사진은 캠페인 폴더에 들어 있다. 행이 지워지기 전에 어느 폴더인지 알아 둔다.
  const { data: camps } = await getAdmin().from('campaigns').select('id').eq('store_id', id);

  const { data, error } = await getAdmin()
    .rpc('admin_delete_store', { p_store: id, p_force: force });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const r = data as { ok: boolean; reason?: string; drawn?: number };
  if (!r?.ok) {
    return Response.json(
      {
        error: r.reason,
        message: r.reason === 'HAS_HISTORY'
          ? `뽑힌 기록이 ${r.drawn}장 있습니다. 정말 지우려면 강제 삭제를 쓰세요`
          : '삭제에 실패했습니다',
        ...r,
      },
      { status: 400 }
    );
  }

  // 매장이 지워졌으면 사진도 남길 이유가 없다
  let files = 0;
  for (const c of camps ?? []) files += await dropCampaignImages(c.id);

  return Response.json({ ...r, files });
}
