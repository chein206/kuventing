'use client';

import { useEffect, useState } from 'react';
import { getCoupon } from '@/lib/supabase';

type Coupon = {
  grade?: string; name?: string; image?: string | null;
  code?: string; isLastOne?: boolean;
  expiresAt?: string; usedAt?: string | null;
  error?: string;
};

const gradeColor = (g: string) => {
  const i = 'ABCDE'.indexOf(g.toUpperCase());
  return i >= 0 ? `var(--g${'abcde'[i]})` : 'var(--ge)';
};

export default function CouponClient({ campaignId, code }: { campaignId: string; code: string }) {
  const [c, setC] = useState<Coupon | null>(null);

  useEffect(() => {
    getCoupon(code, campaignId).then((d) => setC(d as Coupon)).catch(() => setC({ error: 'NOT_FOUND' }));
  }, [campaignId, code]);

  if (!c) return <div className="app"><div className="state"><div className="spin" /></div></div>;

  if (c.error) {
    return (
      <div className="app">
        <div className="state">
          <div className="ic">🎫</div>
          <h2>쿠폰을 찾을 수 없습니다</h2>
          <p>주소를 다시 확인해주세요.</p>
        </div>
      </div>
    );
  }

  const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;

  return (
    <div className="app">
      <section className="screen">
        <div className="result">
          {c.isLastOne && <div className="lastone">LAST ONE</div>}
          <div className="congrats">내 쿠폰</div>
          <div className="rgrade" style={{ background: gradeColor(c.grade ?? 'E') }}>
            {c.image ? <img src={c.image} alt="" /> : c.grade}
          </div>
          <div className="rname">{c.name}</div>
          <div className="rsub">
            {c.usedAt
              ? `${new Date(c.usedAt).toLocaleString('ko-KR')} 사용 완료`
              : expired
                ? '기한이 지났습니다'
                : `${new Date(c.expiresAt!).toLocaleDateString('ko-KR')}까지 사용 가능`}
          </div>

          <div className="coupon" style={{ opacity: c.usedAt || expired ? 0.4 : 1 }}>
            <div className="cl">쿠폰 코드</div>
            <div className="cc">{c.code}</div>
            <div className="cx">
              {c.usedAt ? '이미 사용된 쿠폰입니다'
                : expired ? '기한이 지난 쿠폰입니다'
                : '계산 시 직원에게 보여주세요 · 1회만 사용 가능'}
            </div>
          </div>

          <p className="note">이 화면을 즐겨찾기 하거나 캡처해두세요.</p>
        </div>
      </section>
    </div>
  );
}
