import { getAdmin } from '@/lib/admin';
import { checkAdmin } from '@/lib/adminAuth';

/**
 * 매장 삭제. 뽑힌 기록이 있으면 거부한다.
 * 정말 지워야 하면 ?force=1 을 붙인다 (데모 정리용).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ secret: string; id: string }> }
) {
  const { secret, id } = await params;
  const deny = checkAdmin(secret, req);
  if (deny) return deny;

  const force = new URL(req.url).searchParams.get('force') === '1';

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

  return Response.json(r);
}
