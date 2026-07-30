'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { makePrizeImage, makeAdImage, IMAGE_ERROR } from '@/lib/clientImage';
import { Icon, type IconName } from '@/lib/Icon';

type Caller = (path: string, init?: RequestInit) => Promise<unknown>;

type IssueRes = { code: string; expiresAt: string; left: number; error?: string };
type BoardInfo = {
  id?: string;
  last_one_label?: string;
  last_one_name?: string;
  last_one_image?: string | null;
  ads?: { title?: string; sub?: string; price?: string; image?: string | null; pos?: string | null }[];
  board_token?: string;
  board_mode?: 'pin' | 'open';
  idle_seconds?: number;
  slide_seconds?: number;
  result_seconds?: number;
  auto_open_seconds?: number;
  rate_per_min?: number;
  board_pin?: string;
  error?: string;
};

// 사장님이 조절하는 시간값
const TIMINGS = [
  { key: 'slide_seconds',     label: '광고 슬라이드 넘김',   hint: '초기화면에서 사진이 바뀌는 간격', min: 2,  max: 60 },
  { key: 'result_seconds',    label: '결과 화면 유지',       hint: '뽑은 결과를 보여주는 시간',       min: 10, max: 180 },
  { key: 'auto_open_seconds', label: '방치 시 자동 개봉',    hint: '카드를 열다 말고 갔을 때',        min: 10, max: 300 },
  { key: 'idle_seconds',      label: '초기화면 복귀',        hint: '뽑는 도중 손을 놓았을 때',        min: 10, max: 900 },
] as const;

// 시간은 아니지만 같은 화면에서 조절한다
const RATE = {
  key: 'rate_per_min',
  label: '분당 뽑기 허용',
  hint: '주소가 새더라도 티켓이 한꺼번에 소진되지 않게 막는 값',
  min: 1, max: 60,
} as const;
type RedeemRes = {
  ok: boolean; reason?: string; grade?: string; name?: string;
  isLastOne?: boolean; lastOneName?: string | null;
  usedAt?: string; expiresAt?: string;
};

type Grade = {
  grade: string; name: string; qty: number; left: number;
  useWhen?: 'now' | 'later'; validDays?: number;
  image?: string | null;
};

/** 사진 업로드용. JSON 이 아니라 FormData 를 보낸다 */
type Uploader = (query: string, blob: Blob) => Promise<{ ok?: boolean; url?: string; message?: string; error?: string }>;
type Remover = (query: string) => Promise<{ ok?: boolean; message?: string; error?: string }>;
type Pending = { code: string; grade: string; name: string; at: string };
type Stats = {
  box?: number;
  store?: string; branch?: string | null; title?: string;
  total: number; left: number; drawn: number; today: number;
  coupons: number; redeemed: number;
  ratePerMin?: number;
  recent10?: number;   // 최근 10분 뽑기 수
  pinFails?: number;   // 최근 10분 PIN 실패 수
  byGrade: Grade[]; pending: Pending[];
};

const GRADES = 'ABCDEFGH';
const COLORS: Record<string, string> = {
  A: '#B8892F', B: '#7E8794', C: '#A2673B', D: '#4E7C8C',
  E: '#9B9184', F: '#7C8B5E', G: '#8C6A86', H: '#6F7A86',
};
const color = (g: string) => COLORS[g] ?? '#9B9184';

export default function OwnerClient({ token }: { token: string }) {
  const api = (p: string) => `/api/owner/${token}/${p}`;
  const pinKey = `kuji_owner_pin_${token}`;   // 매장마다 따로 기억한다
  const [pin, setPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [tab, setTab] = useState<'home' | 'use' | 'prize' | 'ad'>('home');
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bd, setBd] = useState<BoardInfo | null>(null);
  const [bpin, setBpin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [timeMsg, setTimeMsg] = useState<string | null>(null);
  const [boxMsg, setBoxMsg] = useState<string | null>(null);
  const [boxBusy, setBoxBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const copy = async (text: string, done: string) => {
    try { await navigator.clipboard.writeText(text); setBoxMsg(done); }
    catch { setBoxMsg('복사하지 못했습니다. 주소를 길게 눌러 복사하세요.'); }
  };

  useEffect(() => { setPin(localStorage.getItem(pinKey)); }, [pinKey]);

  const call = useCallback<Caller>(async (path, init) => {
    const res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-owner-pin': pin ?? '', ...(init?.headers ?? {}) },
    });
    if (res.status === 401) { localStorage.removeItem(pinKey); setPin(null); throw new Error('UNAUTHORIZED'); }
    return res.json();
  }, [pin, pinKey]);

  // 사진은 FormData 로 보낸다. Content-Type 을 직접 넣으면 경계값이 빠져 깨진다.
  const upload = useCallback<Uploader>(async (query, blob) => {
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');
    const res = await fetch(`${api('image')}?${query}`, {
      method: 'POST', body: fd, headers: { 'x-owner-pin': pin ?? '' },
    });
    if (res.status === 401) { localStorage.removeItem(pinKey); setPin(null); throw new Error('UNAUTHORIZED'); }
    return res.json();
    // api 는 token 으로만 만들어지므로 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinKey]);

  const removeImage = useCallback<Remover>(async (query) => {
    const res = await fetch(`${api('image')}?${query}`, {
      method: 'DELETE', headers: { 'x-owner-pin': pin ?? '' },
    });
    if (res.status === 401) { localStorage.removeItem(pinKey); setPin(null); throw new Error('UNAUTHORIZED'); }
    return res.json();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinKey]);

  const load = useCallback(async () => {
    if (!pin) return;
    try {
      setStats((await call(api('stats'))) as Stats);
      setBd((await call(api('board'))) as BoardInfo);
      const p = (await call(api('pin'))) as { board_pin?: string };
      if (p?.board_pin) setBpin(p.board_pin);
      setErr(null);
    } catch { /* 401은 위에서 처리 */ }
    // api 는 token 으로만 만들어지므로 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, call, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!pin) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [pin, load]);

  /* ---------- PIN 게이트 ---------- */
  if (!pin) {
    const submit = async () => {
      const v = pinInput.trim();
      if (!v) { setErr('PIN을 입력하세요'); return; }
      setErr(null);
      try {
        const res = await fetch(api('stats'), { headers: { 'x-owner-pin': v } });
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}));
          setErr(body?.left !== undefined
            ? `PIN이 맞지 않습니다 (남은 시도 ${body.left}회)`
            : 'PIN이 맞지 않거나 주소가 잘못되었습니다');
          return;
        }
        // 대입 시도 차단
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          setErr(body?.message ?? 'PIN을 여러 번 틀렸습니다. 잠시 후 다시 시도하세요');
          return;
        }
        if (!res.ok) {
          const body = await res.text();
          setErr(`서버 오류 (${res.status})\n${body.slice(0, 200)}`);
          return;
        }
        try { localStorage.setItem(pinKey, v); } catch { /* 저장 실패해도 진입은 시킨다 */ }
        setPin(v);
      } catch (e) {
        setErr(`연결 실패\n${String(e)}`);
      }
    };

    return (
      <div className="ow">
        <div className="gate">
          <h2>사장님 화면</h2>
          <p>매장 PIN을 입력하세요</p>
          <input
            className="codein" inputMode="numeric" maxLength={6} value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="••••"
            autoFocus
          />
          <button className="big" type="button" onClick={submit}>들어가기</button>
          {err && (
            <p style={{ color: '#D93025', fontSize: 13, fontWeight: 700, whiteSpace: 'pre-line' }}>
              {err}
            </p>
          )}
        </div>
      </div>
    );
  }

  const used = stats ? stats.redeemed : 0;
  const rate = stats && stats.coupons ? Math.round((used / stats.coupons) * 100) : 0;

  return (
    <div className="ow">
      <div className="top">
        <div className="logo">{(stats?.store ?? '매장').slice(0, 1)}</div>
        <div>
          <div className="t1">
            {stats?.store ?? '사장님 화면'}{stats?.branch ? ` · ${stats.branch}` : ''}
          </div>
          <div className="t2">{stats?.title ?? '뽑기 이벤트'}</div>
        </div>
        <div className="live"><i />진행 중</div>
      </div>

      {tab === 'home' && (
        <div className="pg">
          <div className="kpis">
            <div className="kpi">
              <div className="l">오늘 뽑기</div>
              <div className="v">{stats?.today ?? '-'}</div>
              <div className="d">누적 {stats?.drawn ?? 0}회</div>
            </div>
            <div className="kpi hl">
              <div className="l">쿠폰 사용률</div>
              <div className="v">{rate}<small>%</small></div>
              <div className="d">{used} / {stats?.coupons ?? 0}장</div>
            </div>
            <div className="kpi">
              <div className="l">남은 티켓</div>
              <div className="v">{stats?.left ?? '-'}</div>
              <div className="d">총 {stats?.total ?? 0}장</div>
            </div>
          </div>

          {/* 이상 징후 — 평소엔 안 뜬다 */}
          {(!!stats?.pinFails || (stats?.recent10 ?? 0) >= 12) && (
            <div className="card alert">
              <h3>확인이 필요합니다</h3>
              {!!stats?.pinFails && (
                <p className="demo">
                  최근 10분간 <b>PIN 실패 {stats.pinFails}회</b>.
                  직원이 잘못 눌렀을 수도 있지만, 계속 늘어나면 카운터 PIN을 바꾸고
                  카운터 화면 주소를 재발급하세요.
                </p>
              )}
              {(stats?.recent10 ?? 0) >= 12 && (
                <p className="demo">
                  최근 10분간 <b>{stats?.recent10}회</b> 뽑혔습니다.
                  줄이 길었다면 정상입니다. 아니라면 주소가 외부에 새어나갔을 수 있습니다.
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h3>박스 <span>{stats?.box ? `${stats.box}회차 진행 중` : ''}</span></h3>
            <p className="demo" style={{ marginBottom: 10 }}>
              티켓이 다 나가면 새 박스를 열어야 손님이 다시 뽑을 수 있습니다.
              <br />지난 회차에 나간 쿠폰은 그대로 살아있고, 사용처리도 계속 됩니다.
            </p>
            <button
              className="big"
              disabled={boxBusy}
              onClick={async () => {
                if (stats && stats.left > 0 &&
                    !confirm(`아직 ${stats.left}장이 남아 있습니다.\n새 박스를 열면 남은 티켓은 버려집니다. 진행할까요?`)) return;
                setBoxBusy(true);
                const r = (await call(api('newbox'), { method: 'POST' })) as
                  { ok?: boolean; box?: number; message?: string; error?: string };
                setBoxMsg(r?.ok ? `${r.box}회차 박스를 열었습니다` : (r?.message ?? r?.error ?? '실패했습니다'));
                setBoxBusy(false);
                load();
              }}
            >
              {boxBusy ? '여는 중…' : '새 박스 열기'}
            </button>
            {boxMsg && <p className="demo" style={{ marginTop: 8 }}><b>{boxMsg}</b></p>}
          </div>

          <div className="card">
            <h3>
              등급별 소진
              <span>
                {stats && stats.left === 0 ? '· 박스 소진 — 새 박스를 열어주세요'
                  : stats && stats.left <= 5 ? `· ${stats.left}장 남음, 곧 소진` : ''}
              </span>
            </h3>
            <div className="bars">
              {(stats?.byGrade ?? []).map((g) => (
                <div className="brow" key={g.grade}>
                  <div className="g" style={{ background: color(g.grade) }}>{g.grade}</div>
                  <div className="nm">{g.name}</div>
                  <div className="tr"><i style={{ width: `${(g.left / g.qty) * 100}%`, background: color(g.grade) }} /></div>
                  <div className="n">{g.left} / {g.qty}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>카운터 화면 <span>태블릿에 이 주소를 띄워두세요</span></h3>
            {bd?.board_token ? (
              <>
                <a className="boardlink" href={`/board/${bd.board_token}`} target="_blank" rel="noreferrer">
                  {origin}/board/{bd.board_token}
                </a>
                <div className="linkrow">
                  <button onClick={() => copy(`${origin}/board/${bd.board_token}`, '카운터 주소를 복사했습니다')}>
                    주소 복사
                  </button>
                  <button className="danger" onClick={async () => {
                    if (!confirm(
                      '카운터 화면 주소를 새로 발급합니다.\n\n' +
                      '· 지금 주소는 즉시 사용할 수 없게 됩니다\n' +
                      '· 태블릿에서 새 주소로 다시 열어야 합니다\n' +
                      '· 발급된 뽑기권도 무효화됩니다\n\n' +
                      '진행할까요?'
                    )) return;
                    const r = (await call(api('rotate'), {
                      method: 'POST', body: JSON.stringify({ target: 'board' }),
                    })) as { ok?: boolean; token?: string; error?: string };
                    setBoxMsg(r?.ok
                      ? '카운터 주소를 새로 발급했습니다. 태블릿에서 새 주소로 다시 열어주세요.'
                      : (r?.error ?? '실패했습니다'));
                    load();
                  }}>주소 재발급</button>
                </div>
                <div className="modes">
                  {(['pin', 'open'] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={bd.board_mode === m}
                      onClick={async () => {
                        await call(api('board'), { method: 'POST', body: JSON.stringify({ mode: m }) });
                        load();
                      }}
                    >
                      {m === 'pin' ? '직원 확인 (PIN)' : '상시 개방'}
                    </button>
                  ))}
                </div>
                <p className="demo" style={{ marginTop: 8 }}>
                  {bd.board_mode === 'pin'
                    ? '손님이 화면을 누르면 PIN 입력창이 뜹니다. 직원이 PIN을 눌러야 뽑을 수 있습니다.'
                    : '누구나 화면을 눌러 바로 뽑을 수 있습니다. 주문 확인 없이 뽑히니 주의하세요.'}
                </p>

                <div className="timings">
                  <label>화면 시간 (초) · 뽑기 제한</label>
                  {[...TIMINGS, RATE].map((t) => (
                    <div className="trow" key={t.key}>
                      <div className="tl">
                        <b>{t.label}</b>
                        <span>{t.hint}</span>
                      </div>
                      <input
                        type="number" min={t.min} max={t.max}
                        value={bd[t.key] ?? ''}
                        onChange={(e) => setBd({ ...bd, [t.key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                  <button className="save" onClick={async () => {
                    const patch = Object.fromEntries(
                      [...TIMINGS, RATE].map((t) => [t.key, bd[t.key]])
                    );
                    const r = (await call(api('board'), {
                      method: 'POST', body: JSON.stringify(patch),
                    })) as { ok?: boolean; message?: string; error?: string };
                    setTimeMsg(r?.ok ? '저장되었습니다. 보드를 새로고침하면 적용됩니다.'
                                     : (r?.message ?? r?.error ?? '실패했습니다'));
                    load();
                  }}>시간 저장</button>
                  {timeMsg && <p className="demo"><b>{timeMsg}</b></p>}
                </div>

                {/* 사장님 본인 주소 — 재발급하면 이 페이지 주소도 바뀐다 */}
                <div className="ownerlink">
                  <label>사장님 화면 주소 (본인용)</label>
                  <a className="boardlink" href={`/owner/${token}`}>{origin}/owner/{token}</a>
                  <div className="linkrow">
                    <button onClick={() => copy(`${origin}/owner/${token}`, '사장님 주소를 복사했습니다')}>
                      주소 복사
                    </button>
                    <button className="danger" onClick={async () => {
                      if (!confirm(
                        '사장님 화면 주소를 새로 발급합니다.\n\n' +
                        '· 지금 주소는 즉시 사용할 수 없게 됩니다\n' +
                        '· 새 주소로 자동 이동합니다 — 즐겨찾기를 다시 등록하세요\n' +
                        '· 다른 기기에 저장해둔 링크도 모두 바꿔야 합니다\n\n' +
                        '진행할까요?'
                      )) return;
                      const r = (await call(api('rotate'), {
                        method: 'POST', body: JSON.stringify({ target: 'owner' }),
                      })) as { ok?: boolean; token?: string; error?: string };
                      if (r?.ok && r.token) {
                        // PIN 기억을 새 주소 키로 옮긴 뒤 이동한다
                        try {
                          localStorage.setItem(`kuji_owner_pin_${r.token}`, pin ?? '');
                          localStorage.removeItem(pinKey);
                        } catch { /* 저장 실패해도 이동은 한다 */ }
                        window.location.replace(`/owner/${r.token}`);
                      } else {
                        setBoxMsg(r?.error ?? '실패했습니다');
                      }
                    }}>주소 재발급</button>
                  </div>
                  <p className="demo">
                    이 주소를 아는 사람은 PIN만 맞히면 들어옵니다.
                    외부로 나갔다고 판단되면 재발급하세요.
                  </p>
                </div>

                {bd.board_mode === 'pin' && (
                  <div className="pinedit">
                    <label>카운터 화면 PIN</label>
                    <div className="row">
                      <input
                        value={bpin} inputMode="numeric" maxLength={4} placeholder="0000"
                        onChange={(e) => { setBpin(e.target.value.replace(/\D/g, '')); setPinMsg(null); }}
                      />
                      <button onClick={async () => {
                        const r = (await call(api('pin'), {
                          method: 'POST', body: JSON.stringify({ pin: bpin }),
                        })) as { ok?: boolean; message?: string; error?: string };
                        setPinMsg(r?.ok ? '변경되었습니다' : (r?.message ?? r?.error ?? '실패했습니다'));
                      }}>변경</button>
                    </div>
                    <p className="demo">
                      손님 앞에서 매일 누르는 번호입니다. <b>사장님 로그인 PIN과 다르게</b> 두세요.
                      {pinMsg && <><br /><b>{pinMsg}</b></>}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="demo">
                보드 정보를 불러오지 못했습니다.
                {bd?.error ? ` (${bd.error})` : ''} — `003_grants.sql` 실행 여부를 확인하세요.
              </p>
            )}
          </div>

          <div className="card">
            <h3>미사용 쿠폰 <span>손님이 아직 안 쓴 것</span></h3>
            <div className="demo">
              {stats?.pending?.length
                ? stats.pending.slice(0, 10).map((p) => (
                    <div key={p.code}><code>{p.code}</code> — {p.grade}상 {p.name}</div>
                  ))
                : <div>아직 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'use' && (
        <UseTab call={call} api={api} onDone={load} lastLabel={bd?.last_one_label ?? '막차 보너스'} />
      )}
      {tab === 'prize' && (
        <PrizeTab
          call={call} api={api} stats={stats} board={bd} onDone={load}
          upload={upload} removeImage={removeImage}
        />
      )}

      {tab === 'ad' && (
        <AdTab
          call={call} api={api} board={bd} onDone={load}
          upload={upload} removeImage={removeImage}
        />
      )}

      <nav className="tabs"><div className="in">
        {([
          ['home', 'chart', '홈'], ['use', 'check', '사용처리'],
          ['prize', 'gift', '상품'], ['ad', 'megaphone', '광고'],
        ] as [typeof tab, IconName, string][]).map(([k, ic, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            <span className="i"><Icon name={ic} /></span>{l}
          </button>
        ))}
      </div></nav>
    </div>
  );
}

/* ================= 사진 ================= */

/**
 * 등급 동그라미가 곧 사진 버튼이다.
 * 사진이 없으면 등급 글자, 있으면 사진 — 태블릿 화면에 나오는 모습 그대로다.
 * 무엇이 어디에 뜨는지 설명할 필요가 없어진다.
 */
function PhotoDot({
  url, label, bg, query, mode, upload, removeImage, onChange,
}: {
  url?: string | null; label: React.ReactNode; bg: string; query: string;
  mode: 'prize' | 'ad';
  upload: Uploader; removeImage: Remover; onChange: (url: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true); setErr(null);
    try {
      const blob = mode === 'prize' ? await makePrizeImage(file) : await makeAdImage(file);
      const r = await upload(query, blob);
      if (r?.ok && r.url) onChange(r.url);
      else setErr(r?.message ?? r?.error ?? '올리지 못했습니다');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr(IMAGE_ERROR[code] ?? '사진을 처리하지 못했습니다');
    }
    setBusy(false);
  }

  async function drop() {
    setBusy(true); setErr(null);
    try {
      const r = await removeImage(query);
      if (r?.ok) onChange(null);
      else setErr(r?.message ?? '지우지 못했습니다');
    } catch { setErr('지우지 못했습니다'); }
    setBusy(false);
  }

  return (
    <div className="pdot">
      <button
        className="gg" style={{ background: url ? '#000' : bg }} disabled={busy}
        title={url ? '사진 바꾸기' : '사진 올리기'}
        onClick={() => ref.current?.click()}
      >
        {url ? <img src={url} alt="" /> : <span>{label}</span>}
        <i className="cam">{busy ? <span className="dots3" /> : <Icon name="camera" />}</i>
      </button>

      {url && !busy && (
        <button className="rm" title="사진 떼기" onClick={drop}><Icon name="close" strokeWidth={2.6} /></button>
      )}

      <input
        ref={ref} type="file" accept="image/*" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';         // 같은 파일을 다시 골라도 반응하도록
          if (f) pick(f);
        }}
      />
      {err && <p className="perr">{err}</p>}
    </div>
  );
}

/* ================= 상품 구성 ================= */
function PrizeTab({
  call, api, stats, board, onDone, upload, removeImage,
}: {
  call: Caller; api: (p: string) => string; stats: Stats | null;
  board: BoardInfo | null; onDone: () => void;
  upload: Uploader; removeImage: Remover;
}) {
  const [rows, setRows] = useState<Grade[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);

  useEffect(() => {
    if (!label && board?.last_one_label) setLabel(board.last_one_label);
    if (!lastName && board?.last_one_name) setLastName(board.last_one_name);
  }, [board, label, lastName]);

  // 사진은 화면에서 바꾸면 그 값을 유지한다. 서버 값은 처음 한 번만 받는다.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || board?.last_one_image === undefined) return;
    seeded.current = true;
    setLastImage(board.last_one_image ?? null);
  }, [board]);

  // 서버 값이 처음 들어올 때만 채운다 (편집 중에 폴링이 덮어쓰지 않도록)
  useEffect(() => {
    if (!rows.length && stats?.byGrade?.length) setRows(stats.byGrade);
  }, [stats, rows.length]);

  const total = stats?.total ?? 0;
  const sum = rows.reduce((a, b) => a + (b.qty || 0), 0);
  const ok = sum === total;

  const patch = (i: number, v: Partial<Grade>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));

  return (
    <div className="pg">
      <div className="card">
        <h3>상품 구성 <span>총 {total}장을 등급에 나눠 담습니다 · 최대 8등급</span></h3>

        {rows.map((p, i) => (
          <div className="prow2" key={p.grade}>
            <PhotoDot
              url={p.image} label={p.grade} bg={color(p.grade)} mode="prize"
              query={`target=prize&grade=${p.grade}`}
              upload={upload} removeImage={removeImage}
              onChange={(url) => patch(i, { image: url })}
            />
            <div className="pm">
              <input
                className="pname" value={p.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <div className="seg">
                {(['now', 'later'] as const).map((wv) => (
                  <button key={wv} aria-pressed={(p.useWhen ?? 'later') === wv}
                          onClick={() => patch(i, { useWhen: wv })}>
                    {wv === 'now' ? '그 자리' : '다음 방문'}
                  </button>
                ))}
              </div>
            </div>
            <div className="qty">
              <button aria-label="한 장 줄이기"
                      onClick={() => patch(i, { qty: Math.max(0, (p.qty || 0) - 1) })}>
                <Icon name="minus" strokeWidth={2.4} />
              </button>
              <input
                value={p.qty}
                onChange={(e) => patch(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
              />
              <button aria-label="한 장 늘리기" onClick={() => patch(i, { qty: (p.qty || 0) + 1 })}>
                <Icon name="plus" strokeWidth={2.4} />
              </button>
            </div>
            <button
              className="del"
              disabled={rows.length <= 1}
              title="이 등급 지우기"
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            ><Icon name="close" strokeWidth={2.4} /></button>
          </div>
        ))}

        {rows.length < 8 && (
          <button className="addgrade" onClick={() => {
            const used = new Set(rows.map((r) => r.grade));
            const next = [...GRADES].find((g) => !used.has(g));
            if (!next) return;
            setRows((r) => [...r, {
              grade: next, name: `${next}상 상품`, qty: 0, left: 0, useWhen: 'later', validDays: 7,
            }]);
          }}>+ 등급 추가 ({rows.length}/8)</button>
        )}

        <div className={`sum ${ok ? '' : 'err'}`}>
          <span>합계</span>
          <b>{sum}장 / {total}장 {ok ? '' : `(${sum > total ? '초과' : '부족'} ${Math.abs(sum - total)})`}</b>
        </div>

        <button className="big" style={{ marginTop: 12 }} disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            const r = (await call(api('prizes'), {
              method: 'POST',
              body: JSON.stringify({
                prizes: rows.map((p, i) => ({
                  grade: p.grade, name: p.name, qty: p.qty, sort: i + 1,
                  use_when: p.useWhen ?? 'later', valid_days: p.validDays ?? 7,
                })),
              }),
            })) as { ok?: boolean; reason?: string; grades?: string[]; message?: string; error?: string };
            setMsg(r?.ok
              ? '저장했습니다. 새 박스를 열면 이 구성으로 채워집니다.'
              : r?.reason === 'GRADE_IN_USE'
                ? `${(r.grades ?? []).join(', ')}등급은 이미 발행된 티켓이 있어 지울 수 없습니다`
                : (r?.message ?? r?.error ?? '실패했습니다'));
            setBusy(false);
            onDone();
          }}>
          {busy ? '저장 중…' : '저장'}
        </button>

        {msg && <p className="demo" style={{ marginTop: 8 }}><b>{msg}</b></p>}

        <div className="lastedit">
          <label>마지막 티켓 보상</label>
          <p className="demo">마지막 한 장을 뽑은 손님에게 등급 상품과 <b>함께</b> 주는 상품입니다.</p>
          <div className="lastphoto">
            <PhotoDot
              url={lastImage} label={<Icon name="star" />} bg="#B8892F" mode="prize"
              query="target=last"
              upload={upload} removeImage={removeImage}
              onChange={setLastImage}
            />
            <span>막차 보너스 사진</span>
          </div>
          <div className="lrow">
            <input
              className="lab" value={label} maxLength={20} placeholder="막차 보너스"
              onChange={(e) => { setLabel(e.target.value); setLastMsg(null); }}
            />
            <input
              className="nm" value={lastName} maxLength={60} placeholder="차슈덮밥 세트 무료 + 굿즈"
              onChange={(e) => { setLastName(e.target.value); setLastMsg(null); }}
            />
          </div>
          <button className="save" onClick={async () => {
            const r = (await call(api('board'), {
              method: 'POST',
              body: JSON.stringify({ last_one_label: label, last_one_name: lastName }),
            })) as { ok?: boolean; message?: string; error?: string };
            setLastMsg(r?.ok ? '저장했습니다' : (r?.message ?? r?.error ?? '실패했습니다'));
            onDone();
          }}>보상 문구 저장</button>
          {lastMsg && <p className="demo"><b>{lastMsg}</b></p>}
          <p className="demo">
            왼쪽이 화면에 뜨는 <b>이름표</b>, 오른쪽이 <b>상품명</b>입니다.
            <br />예: <code>막차 보너스</code> / <code>차슈덮밥 세트 무료 + 굿즈</code>
          </p>
        </div>

        <p className="demo" style={{ marginTop: 10 }}>
          수량과 상품명은 지금 진행 중인 박스에 반영되지 않습니다.
          홈에서 <b>새 박스 열기</b>를 눌러야 적용됩니다.
          <br /><b>사진은 바로 반영됩니다.</b> 동그라미를 눌러 올리세요 — 폰으로 찍은 사진 그대로 됩니다.
        </p>
      </div>
    </div>
  );
}

/* ================= 광고 슬라이드 ================= */

type AdPos = 'top' | 'mid' | 'bottom';
type AdRow = { title: string; sub: string; price: string; image: string | null; pos: AdPos };

// 사진마다 접시 자리가 달라서 글자를 옮길 수 있어야 한다
const POS_LABEL: [AdPos, string][] = [['top', '위'], ['mid', '가운데'], ['bottom', '아래']];

/**
 * 대기화면 슬라이드 편집.
 *
 * 사진 업로드는 자리(index)로 서버 배열을 찌른다. 그래서 추가·삭제·순서 변경은
 * 누른 즉시 저장한다 — 로컬에만 있는 슬라이드에 사진을 올리면 자리가 어긋난다.
 * 문구는 다 고친 뒤 저장 버튼으로 보낸다.
 */
function AdTab({
  call, api, board, onDone, upload, removeImage,
}: {
  call: Caller; api: (p: string) => string; board: BoardInfo | null; onDone: () => void;
  upload: Uploader; removeImage: Remover;
}) {
  const [rows, setRows] = useState<AdRow[]>([]);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // 편집 중에 폴링이 덮어쓰지 않도록 처음 한 번만 받는다
  useEffect(() => {
    if (seeded.current || !board?.ads) return;
    seeded.current = true;
    setRows(board.ads.map((a) => ({
      title: a.title ?? '', sub: a.sub ?? '', price: a.price ?? '', image: a.image ?? null,
      pos: (a.pos ?? 'bottom') as AdPos,
    })));
  }, [board]);

  const patch = (i: number, v: Partial<AdRow>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));

  /** 서버에 배열을 통째로 보낸다 */
  async function commit(next: AdRow[], done: string) {
    setBusy(true); setMsg(null);
    setRows(next);
    try {
      const r = (await call(api('ads'), {
        method: 'POST',
        body: JSON.stringify({
          ads: next.map((a) => ({
            title: a.title.trim(), sub: a.sub.trim() || null,
            price: a.price.trim() || null, image: a.image, pos: a.pos ?? 'bottom',
          })),
        }),
      })) as { ok?: boolean; message?: string; error?: string };

      if (r?.ok) setMsg({ t: done });
      else setMsg({ t: r?.message ?? r?.error ?? '저장하지 못했습니다', bad: true });
    } catch { setMsg({ t: '저장하지 못했습니다', bad: true }); }
    setBusy(false);
    onDone();
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next, '순서를 바꿨습니다');
  };

  return (
    <div className="pg">
      <div className="card">
        <h3>대기화면 광고 <span>손님이 뽑기 전에 돌아가는 화면 · 최대 10장</span></h3>

        {!rows.length && <p className="demo">슬라이드가 없습니다. 아래에서 추가하세요.</p>}

        {rows.map((a, i) => (
          <div className="adrow" key={i}>
            <div className="adhead">
              <PhotoDot
                url={a.image} label={String(i + 1)} bg="#4E7C8C" mode="ad"
                query={`target=ad&index=${i}`}
                upload={upload} removeImage={removeImage}
                onChange={(url) => patch(i, { image: url })}
              />
              <div className="adord">
                <button disabled={i === 0 || busy} onClick={() => move(i, -1)} title="위로">
                  <Icon name="up" strokeWidth={2.2} />
                </button>
                <button disabled={i === rows.length - 1 || busy} onClick={() => move(i, 1)} title="아래로">
                  <Icon name="down" strokeWidth={2.2} />
                </button>
              </div>
              <div className="sp" />
              <button
                className="del" disabled={busy} title="이 슬라이드 지우기"
                onClick={() => commit(rows.filter((_, j) => j !== i), '슬라이드를 지웠습니다')}
              ><Icon name="close" strokeWidth={2.4} /></button>
            </div>

            <input
              className="adtitle" value={a.title} maxLength={30} placeholder="메뉴 이름"
              onChange={(e) => patch(i, { title: e.target.value })}
            />
            <input
              className="adsub" value={a.sub} maxLength={60} placeholder="설명 (없어도 됩니다)"
              onChange={(e) => patch(i, { sub: e.target.value })}
            />
            <div className="adrow2">
              <input
                className="adprice" value={a.price} maxLength={20} placeholder="가격 (없어도 됩니다)"
                onChange={(e) => patch(i, { price: e.target.value })}
              />
              <div className="posseg">
                <label>글자 위치</label>
                <div className="seg">
                  {POS_LABEL.map(([v, l]) => (
                    <button key={v} aria-pressed={(a.pos ?? 'bottom') === v}
                            onClick={() => patch(i, { pos: v })}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {rows.length < 10 && (
          <button className="addgrade" disabled={busy} onClick={() =>
            commit([...rows, { title: '새 메뉴', sub: '', price: '', image: null, pos: 'bottom' }], '슬라이드를 추가했습니다')
          }>+ 슬라이드 추가 ({rows.length}/10)</button>
        )}

        {rows.length > 0 && (
          <button className="big" style={{ marginTop: 12 }} disabled={busy}
                  onClick={() => commit(rows, '저장했습니다. 카운터 화면에 바로 반영됩니다.')}>
            {busy ? '저장 중…' : '문구 저장'}
          </button>
        )}

        {msg && <p className="demo" style={{ marginTop: 8, color: msg.bad ? 'var(--bad)' : undefined }}>
          <b>{msg.t}</b>
        </p>}

        <p className="demo" style={{ marginTop: 10 }}>
          동그라미를 눌러 사진을 올립니다. <b>사진은 자르지 않습니다</b> — 가로·세로 어떤 비율이든
          화면에 통째로 얹힙니다.
          <br /><b>글자 위치</b>는 사진을 보고 고르세요 — 접시가 아래에 있으면 <b>위</b>,
          위에 있으면 <b>아래</b>입니다. 글자 쪽에 그늘이 따라갑니다.
          <br />추가·삭제·순서는 누르는 즉시 저장됩니다. 문구와 위치는 <b>문구 저장</b>을 눌러주세요.
          <br />제목이나 사진 중 하나는 있어야 합니다. 넘김 간격은 <b>홈</b>에서 조절합니다.
        </p>
      </div>
    </div>
  );
}

/* ================= 사용처리 ================= */
function UseTab({
  call, api, onDone, lastLabel,
}: { call: Caller; api: (p: string) => string; onDone: () => void; lastLabel: string }) {
  const [code, setCode] = useState('');
  const [vd, setVd] = useState<{ k: string; ic: IconName; h: string; s: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim()) { setVd({ k: 'warn', ic: 'keypad', h: '코드를 입력하세요', s: '손님 화면의 6자리 코드입니다' }); return; }
    setBusy(true);
    try {
      const r = (await call(api('redeem'), {
        method: 'POST', body: JSON.stringify({ code }),
      })) as RedeemRes;
      if (r.ok) {
        setVd({
          k: 'ok', ic: 'check',
          h: `${r.grade}상 — ${r.name}`,
          s: r.isLastOne && r.lastOneName
            // 이름표는 사장님이 정한 문구를 쓴다 (기본 "막차 보너스")
            ? `사용 처리되었습니다.\n${lastLabel} 「${r.lastOneName}」도 함께 지급해주세요.`
            : '사용 처리되었습니다. 손님에게 제공해주세요.',
        });
        setCode('');
        onDone();
      } else if (r.reason === 'ALREADY_USED') {
        setVd({ k: 'bad', ic: 'close', h: '이미 사용된 쿠폰입니다',
                s: r.usedAt ? `${new Date(r.usedAt).toLocaleString('ko-KR')}에 사용 처리됨` : '' });
      } else if (r.reason === 'EXPIRED') {
        setVd({ k: 'bad', ic: 'close', h: '기한이 지난 쿠폰입니다',
                s: r.expiresAt ? `${new Date(r.expiresAt).toLocaleDateString('ko-KR')}까지였습니다` : '' });
      } else {
        setVd({ k: 'bad', ic: 'close', h: '없는 코드입니다', s: '다시 확인해주세요' });
      }
    } catch { setVd({ k: 'bad', ic: 'close', h: '처리에 실패했습니다', s: '네트워크를 확인해주세요' }); }
    setBusy(false);
  }

  return (
    <div className="pg">
      <div className="card">
        <h3>쿠폰 사용처리 <span>손님 화면의 코드를 입력</span></h3>
        <input
          className="codein" value={code} placeholder="XXX-XXX" maxLength={7} autoComplete="off"
          onChange={(e) => {
            let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (v.length > 3) v = `${v.slice(0, 3)}-${v.slice(3, 6)}`;
            setCode(v);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button className="big" style={{ marginTop: 11 }} onClick={submit} disabled={busy}>확인</button>
        {vd && (
          <div className={`vd ${vd.k}`}>
            <div className="ic"><Icon name={vd.ic} strokeWidth={2.2} /></div>
            <div className="h">{vd.h}</div>
            <div className="s" style={{ whiteSpace: 'pre-line' }}>{vd.s}</div>
          </div>
        )}
      </div>
    </div>
  );
}
