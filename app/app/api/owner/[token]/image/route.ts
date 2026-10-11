import { getAdmin, resolveOwner } from '@/lib/admin';
import { imageProblem } from '@/lib/imageFile';
import { storagePath, publicUrl, putImage, dropImage } from '@/lib/storage';

/**
 * 사장님이 올린 사진을 받는다.
 *
 * 화면에서 이미 규격에 맞게 줄여 보내지만(상품 1000×1000 정사각, 광고 긴 변 1600),
 * 여기서 다시 확인한다. 사장님 PIN을 아는 사람은 라우트를 직접 때릴 수 있다.
 *
 *   target=prize&grade=A   상품 사진
 *   target=last            피날레 보너스 사진
 *   target=slide&index=0      광고 슬라이드 사진
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

/** DB에 새 주소를 박고 옛 주소를 돌려받는다 */
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

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

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

  const path = storagePath(r.ctx.campaignId, t.slug, 'jpg');
  const { error: upErr } = await putImage(path, buf, 'image/jpeg');
  if (upErr) return Response.json({ error: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 });

  const url = publicUrl(path);
  const { data, error } = await saveUrl(r.ctx.campaignId, sp, url);

  if (error || !(data as { ok?: boolean })?.ok) {
    await dropImage(url, r.ctx.campaignId);                   // DB에 못 박았으면 파일도 남기지 않는다
    const reason = (data as { reason?: string })?.reason ?? '';
    return Response.json(
      { error: reason || 'SAVE_FAILED', message: REASON[reason] ?? error?.message ?? '저장하지 못했습니다' },
      { status: error ? 500 : 400 }
    );
  }

  await dropImage((data as { old?: string }).old, r.ctx.campaignId);   // 갈아끼운 옛 사진 정리
  return Response.json({ ok: true, url });
}

/** 사진 떼기 — 등급 글자·기본 화면으로 되돌아간다 */
export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const sp = new URL(req.url).searchParams;
  const t = parseTarget(sp);
  if ('error' in t) return Response.json({ error: 'BAD_TARGET', message: t.error }, { status: 400 });

  const { data, error } = await saveUrl(r.ctx.campaignId, sp, '');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const res = data as { ok?: boolean; reason?: string; old?: string };
  if (!res?.ok) {
    return Response.json(
      { error: res?.reason ?? 'FAILED', message: REASON[res?.reason ?? ''] ?? '지우지 못했습니다' },
      { status: 400 }
    );
  }

  await dropImage(res.old, r.ctx.campaignId);
  return Response.json({ ok: true });
}
