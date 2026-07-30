import { getAdmin, resolveOwner } from '@/lib/admin';

// 문자열 리터럴이어야 supabase-js 가 반환 타입을 추론한다
const FIELDS =
  'id, board_token, board_mode, idle_seconds, slide_seconds, result_seconds, auto_open_seconds, rate_per_min, last_one_label, last_one_name, last_one_image, ads, sound';

// 초 단위 값과 허용 범위
const RANGES: Record<string, [number, number]> = {
  slide_seconds:     [2, 60],
  result_seconds:    [10, 180],
  auto_open_seconds: [10, 300],
  idle_seconds:      [10, 900],
  // 분당 뽑기 허용 횟수. 너무 높이면 주소가 샜을 때 티켓이 순삭된다.
  rate_per_min:      [1, 60],
};

// 자유 입력 문구 — 길이만 제한한다
const TEXTS: Record<string, number> = {
  last_one_label: 20,
  last_one_name: 60,
};

/** 보드 주소와 설정 조회 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const [{ data: c, error }, { data: s }] = await Promise.all([
    getAdmin().from('campaigns').select(FIELDS).eq('id', r.ctx.campaignId).single(),
    getAdmin().from('stores').select('board_pin').eq('id', r.ctx.storeId).single(),
  ]);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ...(c as Record<string, unknown>), board_pin: s?.board_pin });
}

/** 설정 변경 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveOwner(token, req);
  if ('error' in r) return r.error;

  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  // 뽑기 소리. 기본은 꺼져 있고 사장님이 매장에서 들어 보고 켠다
  if (body.sound !== undefined) {
    if (!['off', 'soft', 'loud'].includes(String(body.sound))) {
      return Response.json({ error: 'BAD_SOUND' }, { status: 400 });
    }
    patch.sound = body.sound;
  }

  if (body.mode !== undefined) {
    if (body.mode !== 'pin' && body.mode !== 'open') {
      return Response.json({ error: 'BAD_MODE' }, { status: 400 });
    }
    patch.board_mode = body.mode;
  }

  for (const [key, [lo, hi]] of Object.entries(RANGES)) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < lo || n > hi) {
      return Response.json(
        { error: 'OUT_OF_RANGE', message: `${key} 는 ${lo}~${hi}초 사이여야 합니다` },
        { status: 400 }
      );
    }
    patch[key] = Math.round(n);
  }

  for (const [key, max] of Object.entries(TEXTS)) {
    if (body[key] === undefined) continue;
    const v = String(body[key]).trim();
    if (!v || v.length > max) {
      return Response.json(
        { error: 'BAD_TEXT', message: `${key} 는 1~${max}자여야 합니다` },
        { status: 400 }
      );
    }
    patch[key] = v;
  }

  if (!Object.keys(patch).length) {
    return Response.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
  }

  const { error } = await getAdmin().from('campaigns').update(patch).eq('id', r.ctx.campaignId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, ...patch });
}
