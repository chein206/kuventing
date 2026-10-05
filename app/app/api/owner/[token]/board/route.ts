import { getAdmin, resolveOwner } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { THEMES } from '@/lib/boardArt';

const FONT_KEYS: string[] = FONTS.map((f) => f.key);
const THEME_KEYS: string[] = THEMES.map((t) => t.key);

// 문자열 리터럴이어야 supabase-js 가 반환 타입을 추론한다
const FIELDS =
  'id, board_token, board_mode, idle_seconds, slide_seconds, result_seconds, auto_open_seconds, rate_per_min, motion_seconds, last_one_label, last_one_name, last_one_image, ads, sound, font, theme, endgame';

// 초 단위 값과 허용 범위
const RANGES: Record<string, [number, number]> = {
  // 모션 광고 컷 하나의 길이. 첫 컷은 +0.5, 사인 컷은 -0.5 로 파생된다
  motion_seconds:    [1.5, 10],
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

  // 화면 글꼴. 기본(system)은 내려받지 않는다
  if (body.font !== undefined) {
    if (!FONT_KEYS.includes(String(body.font))) {
      return Response.json({ error: 'BAD_FONT' }, { status: 400 });
    }
    patch.font = body.font;
  }

  // 화면 테마 — 판 밝기 × 문양. 밝기는 매장 조명이, 문양은 업종이 정한다
  if (body.theme !== undefined) {
    if (!THEME_KEYS.includes(String(body.theme))) {
      return Response.json({ error: 'BAD_THEME' }, { status: 400 });
    }
    patch.theme = body.theme;
  }

  // 뽑기 소리. 기본은 꺼져 있고 사장님이 매장에서 들어 보고 켠다
  if (body.sound !== undefined) {
    if (!['off', 'soft', 'loud'].includes(String(body.sound))) {
      return Response.json({ error: 'BAD_SOUND' }, { status: 400 });
    }
    patch.sound = body.sound;
  }

  // 끝물 방식 — 가장 낮은 등급만 남았을 때 판을 어떻게 끝낼지(026)
  if (body.endgame !== undefined) {
    if (!['off', 'end', 'carry', 'skip'].includes(String(body.endgame))) {
      return Response.json({ error: 'BAD_ENDGAME' }, { status: 400 });
    }
    patch.endgame = body.endgame;
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

  // 끝물 방식을 바꾸면 지금 박스에 바로 적용할 게 있는지 본다
  // (가장 낮은 등급만 남았는데 '피날레 없이 새 판' · 다 뽑힌 박스인데 자동 방식)
  if (patch.endgame !== undefined) {
    const { data: applied } = await getAdmin().rpc('endgame_apply', { p_campaign: r.ctx.campaignId });
    return Response.json({ ok: true, ...patch, applied });
  }
  return Response.json({ ok: true, ...patch });
}
