'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { THEMES, themeOf } from '@/lib/boardArt';
import type { DrawResult, Prize } from '@/lib/supabase';
import { Icon } from '@/lib/Icon';
import ResultView from '../board/[token]/ResultView';
import type { Tier } from '../board/[token]/grade';

/**
 * 결과 화면 미리보기 — 테마 7개 × 판 4개(막차 · 금 · 구리 · 은)를 카운터 화면 그대로 돌려 본다.
 * 데이터는 가짜다. DB 를 부르지 않으니 표가 줄지 않는다.
 * 주소: /fx?theme=light-west&tier=E  (bare=1 이면 고르는 막대를 숨긴다 — 스크린샷용)
 *       /fx?theme=classic&view=keys  버튼 재질만 모아 본다 (PIN 자판 · 취소 · 남은 시간 · 시작 띠)
 */
const TIERS: { k: Tier; label: string }[] = [
  { k: 'L', label: '막차' }, { k: 'A', label: '금 A·B' }, { k: 'C', label: '구리 C' }, { k: 'E', label: '은 D 이하' },
];
const BASE = { code: 'K7Q-2M9', expiresAt: '2026-12-31T00:00:00Z', left: 41, position: 17 };
const SAMPLE: Record<Tier, DrawResult> = {
  L: { ...BASE, grade: 'A', name: '차슈덮밥 세트 무료', useWhen: 'now', image: '/fx/prize-a.jpg', isLastOne: true, lastOneName: '차슈덮밥 세트 + 굿즈' },
  A: { ...BASE, grade: 'A', name: '차슈덮밥 세트 무료', useWhen: 'now', image: '/fx/prize-a.jpg', isLastOne: false, lastOneName: null },
  C: { ...BASE, grade: 'C', name: '교자 무료', useWhen: 'now', image: '/fx/prize-c.jpg', isLastOne: false, lastOneName: null },
  E: { ...BASE, grade: 'E', name: '1,000원 할인', useWhen: 'later', image: '/art/coupon-1000.svg', isLastOne: false, lastOneName: null },
};
const PRIZES: Prize[] = [
  { grade: 'A', name: '차슈덮밥 세트 무료', qty: 2, useWhen: 'now', image: null, left: 1 },
  { grade: 'B', name: '생맥주 한 잔', qty: 6, useWhen: 'now', image: null, left: 4 },
  { grade: 'C', name: '교자 무료', qty: 12, useWhen: 'now', image: null, left: 9 },
  { grade: 'D', name: '음료 무료', qty: 20, useWhen: 'now', image: null, left: 13 },
  { grade: 'E', name: '1,000원 할인', qty: 40, useWhen: 'later', image: null, left: 24 },
];

const noop = () => () => {};

export default function FxClient(init: { theme: string | null; tier: string | null; bare: boolean; keys: boolean }) {
  const [st, setSt] = useState(() => ({
    theme: themeOf(init.theme).key as string,
    tier: TIERS.find((t) => t.k === init.tier)?.k ?? ('A' as Tier),
  }));
  const [run, setRun] = useState(0);

  // 테마는 판(html)에 건다. 결과 화면의 3D 는 사진을 받은 뒤 바탕색을 읽으므로 이 효과가 먼저 끝나 있다
  useEffect(() => { document.documentElement.dataset.theme = st.theme; }, [st.theme]);

  // 결과 화면은 브라우저에서만 그린다(카운터 화면도 뽑은 뒤에만 그린다) — 서버 렌더에서는 빈 판
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!client) return <div className="bd" />;

  const def = themeOf(st.theme);
  const pick = (theme: string, tier: Tier) => {
    document.documentElement.dataset.theme = theme;
    history.replaceState(null, '', `?theme=${theme}&tier=${tier}`);
    setSt({ theme, tier });
    setRun((n) => n + 1);
  };

  return (
    <div className="bd" style={{
      ['--tk-ratio' as string]: String(def.art.photo?.ratio ?? 2),
      ['--surface' as string]: def.art.photo ? `url(${def.art.photo.surface})` : 'none',
    }}>
      <div className="bar">
        <button className="home" onClick={() => setRun((n) => n + 1)} aria-label="다시"><Icon name="ticket" /></button>
        <div className="nm">라멘집 · 미리보기</div>
        <div className="rt"><b>41</b><i>/80</i><small>남은 티켓</small></div>
      </div>
      {init.keys ? <Keys /> : <ResultView key={`${st.theme}-${st.tier}-${run}`}
                  r={SAMPLE[st.tier]} art={def.art} dark={def.dark}
                  campaignId="00000000-0000-0000-0000-000000000000" prizes={PRIZES}
                  lastOneImage="/fx/prize-last.jpg" lastOneLabel="막차 보너스"
                  store="라멘집 · 미리보기" title="10월 뽑기" seconds={60}
                  onDone={() => setRun((n) => n + 1)} />}
      {!init.bare && (
        <div className="fxpick">
          <select value={st.theme} onChange={(e) => pick(e.target.value, st.tier)}>
            {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {TIERS.map((t) => (
            <button key={t.k} className={t.k === st.tier ? 'on' : ''} onClick={() => pick(st.theme, t.k)}>{t.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 버튼 재질 모음 — 카운터 화면의 같은 class 를 그대로 쓴다. 눌러도 아무 일도 없다 */
function Keys() {
  return (
    <div className="page">
      <h2 className="ttl">직원 확인<small>주문하신 손님만 뽑을 수 있습니다</small></h2>
      <div className="pin">
        <div className="pindots">{[0, 1, 2, 3].map((i) => <i key={i} className={i < 2 ? 'f' : ''} />)}</div>
        <div className="keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
            <button key={k}>
              {k === 'del' ? <Icon name="backspace" /> : k === 'ok' ? <Icon name="check" strokeWidth={2.6} /> : k}
            </button>
          ))}
        </div>
      </div>
      <button className="big cd">티켓 고르기<i className="cdbar" style={{ width: '62%' }} /><em className="cdnum">19</em></button>
      <div className="rowbtn"><button className="big ghost">취소</button><button className="big" disabled>뽑는 중</button></div>
      <div className="foot" style={{ padding: '0' }}><button className="touch">화면을 눌러 뽑기 시작</button></div>
    </div>
  );
}
