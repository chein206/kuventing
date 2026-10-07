/**
 * 도입 문의 알림 메일 — 문의가 표(kuji.inquiries)에 쌓인 뒤 사장님 메일로 한 통 보낸다. Resend(resend.com) API 를 fetch 로 부른다.
 *
 * 환경 변수(Vercel 에 사장님이 넣는다 — 저장소가 공개라 주소 · 키를 코드에 적지 않는다)
 *   RESEND_API_KEY  Resend 키. 없으면 메일 없이 넘어간다(문의는 이미 표에 있다)
 *   INQUIRY_TO      받을 메일 주소
 *   INQUIRY_FROM    보내는 주소. 없으면 Resend 기본 주소 — 도메인 인증 전에는 이 주소로 **Resend 가입 메일에게만** 보낼 수 있다
 *                   (그래서 Resend 는 받을 메일 주소로 가입한다)
 * 메일이 실패해도 손님 화면에는 알리지 않는다 — 문의는 받았고, 사장님은 표에서 다시 볼 수 있다.
 */
export type InquiryMail = { name: string; kind: string; contact: string; message: string | null };

export async function notifyInquiry(q: InquiryMail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_TO;
  if (!key || !to) return false;
  const from = process.env.INQUIRY_FROM || '쿠벤팅 문의 <onboarding@resend.dev>';
  const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const text = [
    `업종: ${q.kind}`,
    `이름 · 상호: ${q.name}`,
    `연락처: ${q.contact}`,
    '',
    q.message ? `내용:\n${q.message}` : '내용: (없음)',
    '',
    `받은 시각: ${when}`,
    '홈페이지(kuventing.scpadlab.com) 도입 문의 폼에서 왔습니다. 모든 문의는 Supabase kuji.inquiries 표에도 남아 있습니다.',
  ].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `[쿠벤팅 도입 문의] ${q.kind} · ${q.name}`, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('inquiry mail', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('inquiry mail', (e as Error).message);
    return false;
  }
}
