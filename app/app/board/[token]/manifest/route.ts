// 보드별 PWA manifest.
// 홈 화면에 추가하면 이 보드 주소로 전체화면 실행된다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  return Response.json(
    {
      name: '쿠벤팅',
      short_name: '쿠벤팅',
      description: '남은 한 장까지, 럭키드로우 — 카운터 화면',
      start_url: `/board/${token}`,
      scope: `/board/${token}`,
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'portrait',
      background_color: '#EFE7DA',
      theme_color: '#C4442A',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
