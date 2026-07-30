import { getAdmin } from '@/lib/admin';
import { requireAdmin } from '@/lib/adminAuth';
import { campaignOfStore } from '@/lib/adminStore';
import { imageProblem } from '@/lib/imageFile';
import { storagePath, publicUrl, putImage, dropImage } from '@/lib/storage';

/**
 * 운영자가 매장 사진을 올린다.
 *
 * 사장님이 직접 올릴 수도 있지만(사장님 화면 상품·광고 탭), 실제로는
 * 카톡으로 사진을 받아 우리가 올리는 경우가 더 많다. 그때 매장 주소로
 * 매번 들어가지 않아도 되게 하는 경로다.
 *
 * 검증·저장·옛 파일 정리는 사장님 라우트와 같은 부품을 쓴다.
 * 다른 것은 진입 인증(운영자 JWT)과 대상 찾기(매장 id)뿐이다.
 *
 *   target=prize&grade=A / target=last / target=slide&index=0
 */

type Target = { kind: 'prize' | 'ad'; slug: string };

function parseTarget(sp: URLSearchParams): Target | { error: string } {
  const target = sp.get('target') ?? 'prize';
  if (target === 'prize') {
    const grade = (sp.get('grade') ?? '').toUpperCase();
    if (!/^[A-H]$/.test(grade)) return { error: '등급이 잘못됐습니다' };
    return { kind: 'prize', slug: `prize-${grade}` };
  }
  if (target === 'last') return { kind: 'prize', slug: 'last' };
  if (target === 'ad' || target === 'slide') {
    const i = Number(sp.get('index'));
    if (!Number.isInteger(i) || i < 0 || i > 19) return { error: '슬라이드 자리가 잘못됐습니다' };
    return { kind: 'ad', slug: `menu-${i}` };
  }
  return { error: '알 수 없는 요청입니다' };
}

async function saveUrl(campaignId: string, sp: URLSearchParams, url: string) {
  const db = getAdmin();
  const target = sp.get('target') ?? 'prize';
  if (target === 'last') {
    return db.rpc('set_last_one_image', { p_campaign: campaignId, p_url: url });
  }
  if (target === 'ad' || target === 'slide') {
    return db.rpc('set_ad_image', {
      p_campaign: campaignId, p_index: Number(sp.get('index')), p_url: url,
    });
  }
  return db.rpc('set_prize_image', {
    p_campaign: campaignId, p_grade: (sp.get('grade') ?? '').toUpperCase(), p_url: url,
  });
}

const REASON: Record<string, string> = {
  NOT_FOUND: '대상을 찾지 못했습니다',
  BAD_INDEX: '없는 슬라이드입니다',
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { id } = await params;
  const c = await campaignOfStore(id);
  if ('error' in c) return c.error;

  const sp = new URL(req.url).searchParams;
  const t = parseTarget(sp);
  if ('error' in t) return Response.json({ error: 'BAD_TARGET', message: t.error }, { status: 400 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return Response.json({ error: 'BAD_BODY', message: '사진을 읽지 못했습니다' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'NO_FILE', message: '사진이 없습니다' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const problem = imageProblem(buf, t.kind);
  if (problem) return Response.json({ error: 'BAD_IMAGE', message: problem }, { status: 400 });

  const path = storagePath(c.campaignId, t.slug, 'jpg');
  const { error: upErr } = await putImage(path, buf, 'image/jpeg');
  if (upErr) return Response.json({ error: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 });

  const url = publicUrl(path);
  const { data, error } = await saveUrl(c.campaignId, sp, url);

  if (error || !(data as { ok?: boolean })?.ok) {
    await dropImage(url);
    const reason = (data as { reason?: string })?.reason ?? '';
    return Response.json(
      { error: reason || 'SAVE_FAILED', message: REASON[reason] ?? error?.message ?? '저장하지 못했습니다' },
      { status: error ? 500 : 400 }
    );
  }

  await dropImage((data as { old?: string }).old);
  return Response.json({ ok: true, url });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ('error' in gate) return gate.error;

  const { id } = await params;
  const c = await campaignOfStore(id);
  if ('error' in c) return c.error;

  const sp = new URL(req.url).searchParams;
  const t = parseTarget(sp);
  if ('error' in t) return Response.json({ error: 'BAD_TARGET', message: t.error }, { status: 400 });

  const { data, error } = await saveUrl(c.campaignId, sp, '');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok?: boolean; reason?: string; old?: string };
  if (!res?.ok) {
    return Response.json(
      { error: res?.reason ?? 'FAILED', message: REASON[res?.reason ?? ''] ?? '지우지 못했습니다' },
      { status: 400 }
    );
  }

  await dropImage(res.old);
  return Response.json({ ok: true });
}
