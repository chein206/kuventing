import { after } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { INQUIRY_KINDS, INQUIRY_MAX } from '@/lib/inquiry';
import { notifyInquiry } from '@/lib/notify';

/**
 * 홈페이지 도입 문의 받기 — kuji.inquiries 에 한 줄 쌓는다(supabase/027_inquiries.sql, 서버 service_role 만 쓴다).
 * 이름 · 연락처 · 개인정보 동의는 필수. 숨긴 칸(website)을 채운 요청은 봇이라 받은 척만 한다.
 * 쌓은 뒤 사장님 메일로 알림(lib/notify.ts, 환경 변수가 있을 때만) — 응답을 보낸 다음에 보내서 손님을 기다리게 하지 않는다.
 */
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return Response.json({ message: '보낸 내용을 읽지 못했습니다' }, { status: 400 });
  }

  if (text(b.website, 200)) return Response.json({ ok: true });

  const name = text(b.name, INQUIRY_MAX.name);
  const contact = text(b.contact, INQUIRY_MAX.contact);
  const message = text(b.message, INQUIRY_MAX.message);
  const kind = (INQUIRY_KINDS as readonly string[]).includes(String(b.kind)) ? String(b.kind) : '기타';

  if (!name || !contact) return Response.json({ message: '이름과 연락처를 적어 주세요' }, { status: 400 });
  if (b.agree !== 'on' && b.agree !== true) {
    return Response.json({ message: '개인정보 수집과 이용에 동의해 주세요' }, { status: 400 });
  }

  const { error } = await getAdmin().from('inquiries').insert({
    name, kind, contact,
    message: message || null,
    source: 'site',
    referer: (req.headers.get('referer') ?? '').slice(0, 200) || null,
  });
  if (error) return Response.json({ message: '보내지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  after(() => notifyInquiry({ name, kind, contact, message: message || null }));
  return Response.json({ ok: true });
}
