import 'server-only';

/**
 * 운영자 화면 인증.
 * 매장별 PIN(4자리)과 달리 여기는 긴 시크릿 하나로 막는다.
 * 주소의 시크릿과 헤더의 시크릿이 모두 환경변수와 같아야 통과한다.
 */
export function checkAdmin(secretFromUrl: string, req: Request): Response | null {
  const expected = process.env.ADMIN_SECRET;

  if (!expected || expected.length < 16) {
    return Response.json(
      { error: 'ADMIN_NOT_CONFIGURED', message: 'ADMIN_SECRET 환경변수가 없습니다' },
      { status: 503 }
    );
  }

  const header = req.headers.get('x-admin-secret') ?? '';

  // 주소만 알아도, 헤더만 알아도 통과하지 못한다
  if (!safeEqual(secretFromUrl, expected) || !safeEqual(header, expected)) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return null;
}

/** 길이·내용 비교 시간 차이로 값을 유추하지 못하게 한다 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
