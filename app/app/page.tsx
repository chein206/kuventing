import { redirect } from 'next/navigation';
import { Icon } from '@/lib/Icon';

/**
 * 이 도메인(kuvt)은 서비스 전용이다. 소개는 회사 홈페이지가 맡는다.
 * NEXT_PUBLIC_SITE_URL 이 있으면 그쪽으로 보내고, 없으면(로컬) 안내만 띄운다.
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
