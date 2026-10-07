import { redirect } from 'next/navigation';
import { Icon } from '@/lib/Icon';

/**
 * 이 도메인(kuvt)은 서비스 전용이다. 소개는 홈페이지(kuventing.scpadlab.com)가 맡는다.
 * 운영 주소의 / 는 next.config.ts 가 홈페이지로 보내고, 홈페이지 주소의 / 는 /site 를 보여 준다.
 * 그 밖의 주소(로컬 · 배포 미리보기)에서는 NEXT_PUBLIC_SITE_URL 이 있으면 그쪽으로, 없으면 안내만 띄운다.
 */
export default function Home() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) redirect(site);

  return (
    <div className="app">
      <div className="state">
        <div className="ic"><Icon name="ticket" /></div>
        <h2>쿠벤팅</h2>
        <p>
          매장마다 주소가 다릅니다.<br />
          전달받은 링크로 들어와 주세요.
        </p>
      </div>
    </div>
  );
}
