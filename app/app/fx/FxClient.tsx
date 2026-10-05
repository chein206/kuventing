'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { THEMES, themeOf } from '@/lib/boardArt';
import type { DrawResult, Prize } from '@/lib/supabase';
import { Icon } from '@/lib/Icon';
import { fontOf } from '@/lib/fonts';
import * as sfx from '@/lib/sfx';
import ResultView from '../board/[token]/ResultView';
import OpenView from '../board/[token]/OpenView';
import { gradeColor, type Tier } from '../board/[token]/grade';
import Ticket from '../board/[token]/Ticket';

/**
 * 결과 화면 미리보기 — 테마 7개 × 판 4개(피날레 · 금 · 구리 · 은)를 카운터 화면 그대로 돌려 본다.
 * 데이터는 가짜다. DB 를 부르지 않으니 표가 줄지 않는다.
 * 주소: /fx?theme=light-west&tier=E  (bare=1 이면 고르는 막대를 숨긴다 — 스크린샷용)
 *       /fx?theme=classic&view=keys  버튼 재질만 모아 본다 (PIN 자판 · 취소 · 남은 시간 · 시작 띠)
 *       /fx?theme=dark-west&tier=C&view=open  개봉 화면부터 — 다 열면 결과 화면으로 이어진다
 *       /fx?theme=photo-letterpress&view=grid  티켓 고르기 판(50칸, 나간 칸 섞어서)
 */
const TIERS: { k: Tier; label: string }[] = [
  { k: 'L', label: '피날레' }, { k: 'A', label: '금 A·B' }, { k: 'C', label: '구리 C' }, { k: 'E', label: '은 D 이하' },
];
const BASE = { code: 'K7Q-2M9', expiresAt: '2026-12-31T00:00:00Z', left: 41, position: 17 };
const SAMPLE: Record<Tier, DrawResult> = {
  // 피날레는 등급이 아니다 — 마지막 표가 D 였고 그 위에 보너스가 얹힌 경우
  L: { ...BASE, grade: 'D', name: '음료 무료', useWhen: 'now', image: null, isLastOne: true, lastOneName: '차슈덮밥 세트 + 굿즈' },
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

export default function FxClient(init: { theme: string | null; tier: string | null; bare: boolean; view: string | null }) {
  const [st, setSt] = useState(() => ({
    theme: themeOf(init.theme).key as string,
    tier: TIERS.find((t) => t.k === init.tier)?.k ?? ('A' as Tier),
  }));
  const [run, setRun] = useState(0);
  // 개봉부터 볼 때 — 다 열면 결과, 결과가 끝나면 다시 개봉
  const [phase, setPhase] = useState<'open' | 'result'>(init.view === 'open' ? 'open' : 'result');
  // 카운터 화면처럼 결과가 조금 늦게 도착한다(뽑기 요청이 서버에 다녀오는 시간)
  const [pending, setPending] = useState<DrawResult | null>(null);
  useEffect(() => {
    if (phase !== 'open') return;
    const t = setTimeout(() => setPending(SAMPLE[st.tier]), 350);
    return () => { clearTimeout(t); setPending(null); };
  }, [phase, st.tier, run]);

  // 소리 — 카운터 화면과 같은 소리를 낸다. 브라우저는 화면을 만지기 전에는 소리를 막으므로 첫 터치에 깨운다
  const [snd, setSnd] = useState<sfx.SoundMode>('soft');
  useEffect(() => { sfx.setMode(snd); }, [snd]);
  useEffect(() => { sfx.preloadFanfares(); }, []);

  // 테마는 판(html)에 건다. 결과 화면의 3D 는 사진을 받은 뒤 바탕색을 읽으므로 이 효과가 먼저 끝나 있다
  useEffect(() => { document.documentElement.dataset.theme = st.theme; }, [st.theme]);

  // 결과 화면은 브라우저에서만 그린다(카운터 화면도 뽑은 뒤에만 그린다) — 서버 렌더에서는 빈 판
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!client) return <div className="bd" />;

  const def = themeOf(st.theme);
  const pick = (theme: string, tier: Tier) => {
    document.documentElement.dataset.theme = theme;
    history.replaceState(null, '', `?theme=${theme}&tier=${tier}${init.view ? `&view=${init.view}` : ''}`);
    setSt({ theme, tier });
    setRun((n) => n + 1);
    if (init.view === 'open') setPhase('open');
  };
  const again = () => { setRun((n) => n + 1); if (init.view === 'open') setPhase('open'); };

  return (
    <div className="bd" style={{
      ['--tk-ratio' as string]: String(def.art.photo?.ratio ?? 2),
      ['--surface' as string]: def.art.photo ? `url(${def.art.photo.surface})` : 'none',
    }} onPointerDownCapture={() => sfx.unlock(snd)}>
      <div className="bar">
        <button className="home" onClick={again} aria-label="다시"><Icon name="ticket" /></button>
        <div className="nm">라멘집 · 미리보기</div>
        <div className="rt"><b>41</b><i>/80</i><small>남은 티켓</small></div>
      </div>
      {init.view === 'keys' ? <Keys /> : init.view === 'grid' ? <Grid art={def.art} /> : phase === 'open' ? (
        <OpenView key={`o-${st.theme}-${st.tier}-${run}`} sel={17} pending={pending} art={def.art} dark={def.dark}
                  title="10월 뽑기" store="라멘집 · 미리보기" font={fontOf(null).stack}
                  autoOpenSeconds={45} lastOneLabel="피날레 보너스"
                  onOpened={() => setPhase('result')} />
      ) : (
        <ResultView key={`r-${st.theme}-${st.tier}-${run}`}
                    r={SAMPLE[st.tier]} art={def.art} dark={def.dark}
                    campaignId="00000000-0000-0000-0000-000000000000" prizes={PRIZES}
                    lastOneImage="/fx/prize-last.jpg" lastOneLabel="피날레 보너스"
                    store="라멘집 · 미리보기" title="10월 뽑기" seconds={60}
                    onDone={again} />
      )}
      {!init.bare && (
        <div className="fxpick">
          <select value={st.theme} onChange={(e) => pick(e.target.value, st.tier)}>
            {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {TIERS.map((t) => (
            <button key={t.k} className={t.k === st.tier ? 'on' : ''} onClick={() => pick(st.theme, t.k)}>{t.label}</button>
          ))}
          <span className="fxsnd">
            {([['off', '소리 끔'], ['soft', '작게'], ['loud', '크게']] as const).map(([v, l]) => (
              <button key={v} className={snd === v ? 'on' : ''} onClick={() => { setSnd(v); sfx.unlock(v); }}>{l}</button>
            ))}
          </span>
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

/** 티켓 고르기 판 — 카운터 화면과 같은 class · 같은 Ticket. 나간 칸은 등급을 섞어 둔다 */
const USED: Record<number, string> = {
  1: 'D', 2: 'E', 3: 'E', 6: 'E', 7: 'E', 8: 'A', 9: 'D', 10: 'E', 13: 'B', 14: 'B', 17: 'D', 20: 'E',
  21: 'E', 22: 'E', 23: 'C', 24: 'B', 25: 'C', 27: 'E', 28: 'E', 29: 'E', 30: 'A', 31: 'C', 33: 'E', 34: 'E',
  37: 'E', 38: 'D', 39: 'B', 40: 'D', 41: 'D', 42: 'C', 43: 'D', 45: 'E', 48: 'E', 49: 'E',
};
function Grid({ art }: { art: Parameters<typeof Ticket>[0]['art'] }) {
  return (
    <div className="page">
      <h2 className="ttl">티켓을 선택하세요<small>구멍이 뚫린 칸은 이미 나간 티켓입니다</small></h2>
      <div className="tgrid">
        {Array.from({ length: 50 }, (_, i) => i + 1).map((pos) => USED[pos] ? (
          <div key={pos} className="tk2 used">
            <Ticket art={art} size="tile" used num={USED[pos]} gradeColor={gradeColor(USED[pos])} />
          </div>
        ) : (
          <div key={pos} className={`tk2 ${pos === 18 ? 'sel' : ''}`}>
            <Ticket art={art} size="tile" num={String(pos)} sel={pos === 18} />
          </div>
        ))}
      </div>
    </div>
  );
}
