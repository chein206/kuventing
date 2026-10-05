import { BUILD } from '@/lib/build';

// 카운터 태블릿이 5분마다 묻는다 — "지금 배포 번호가 뭐냐". 자기 번호와 다르면 새 버전이 나온 것
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ v: BUILD }, { headers: { 'Cache-Control': 'no-store' } });
}
