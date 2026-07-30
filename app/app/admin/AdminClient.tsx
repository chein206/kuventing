'use client';

import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { PRESETS, TOTAL_DEFAULT, randomPins, type PresetPrize } from '@/lib/presets';
import { Icon } from '@/lib/Icon';
import AdminMedia from './AdminMedia';

const GRADES = 'ABCDEFGH';
const COLORS: Record<string, string> = {
  A: '#B8892F', B: '#7E8794', C: '#A2673B', D: '#4E7C8C',
  E: '#9B9184', F: '#7C8B5E', G: '#8C6A86', H: '#6F7A86',
};

type Store = {
  id: string; name: string; branch: string | null;
  owner_token: string; owner_pin: string; board_pin: string;
  campaign_id: string | null; title: string | null; status: string | null;
  board_token: string | null; board_mode: string | null;
  current_box: number | null; total_tickets: number | null; ends_at: string | null;
  left: number | null; coupons: number | null; redeemed: number | null; grades: number | null;
};

type Overview = {
  me?: string;
  stores: number; live: number; drawnToday: number;
  coupons: number; redeemed: number; pending: number; expiring: number;
  lowStock: { store: string; branch: string | null; left: number; total: number }[];
  risky: { store: string; branch: string | null; samePin: boolean; openMode: boolean; pinFails: number }[];
};

type Coupon = {
  store: string; branch: string | null; grade: string; prize: string;
  code: string; expires_at: string; created_at: string; expired: boolean;
};

type Tab = 'dash' | 'stores' | 'new' | 'coupons' | 'account' | 'media';

export default function AdminClient() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<Tab>('dash');
  const [origin, setOrigin] = useState('');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const [ov, setOv] = useState<Overview | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [open, setOpen] = useState<string | null>(null);   // 펼친 매장
  // 사진·광고를 편집하는 매장. 사장님이 카톡으로 사진을 보내면 우리가 여기서 올린다
  const [media, setMedia] = useState<{ id: string; name: string } | null>(null);

  /* ---------- 로그인 상태 ---------- */
  useEffect(() => {
    setOrigin(window.location.origin);
    setEmail(localStorage.getItem('kuji_admin_email') ?? '');
    sb().auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setReady(true);
    });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /** 로그인 토큰을 붙여 호출한다 */
  const call = useCallback(async (path: string, init?: RequestInit) => {
    const { data } = await sb().auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setSignedIn(false); throw new Error('NO_SESSION'); }

    // 사진 업로드는 FormData 다. Content-Type 을 직접 넣으면 경계값이 빠져 깨진다
    const isForm = init?.body instanceof FormData;
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401) { await sb().auth.signOut(); setSignedIn(false); throw new Error('EXPIRED'); }
    if (res.status === 403) { setMsg({ t: '운영자 권한이 없는 계정입니다', bad: true }); throw new Error('NOT_ADMIN'); }
    return res.json();
  }, []);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const [o, s] = await Promise.all([
        call('/api/admin/overview') as Promise<Overview>,
        call('/api/admin/stores') as Promise<{ stores?: Store[] }>,
      ]);
      setOv(o);
      setStores(s.stores ?? []);
    } catch { /* 위에서 처리 */ }
  }, [signedIn, call]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'coupons' || !signedIn) return;
    call('/api/admin/coupons')
      .then((r) => setCoupons((r as { coupons?: Coupon[] }).coupons ?? []))
      .catch(() => {});
  }, [tab, signedIn, call]);

  async function login() {
    setBusy(true); setLoginErr(null);
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { setLoginErr('로그인 실패\n' + error.message); return; }
    if (remember) localStorage.setItem('kuji_admin_email', email.trim());
    else localStorage.removeItem('kuji_admin_email');
    setPw('');
  }

  /* ---------- 로그인 화면 ---------- */
  if (!ready) return <div className="oc" />;

  if (!signedIn) {
    return (
      <div className="oc">
        <div className="login">
          <div className="loginbox">
            <h1>쿠벤팅 Admin</h1>
            <p>운영자 전용</p>
            <input
              type="email" value={email} placeholder="이메일" autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="remember">
              <input type="checkbox" checked={remember} style={{ width: 'auto', margin: 0 }}
                     onChange={(e) => setRemember(e.target.checked)} />
              아이디 저장
            </label>
            <input
              type="password" value={pw} placeholder="비밀번호" autoComplete="current-password"
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
            />
            <button onClick={login} disabled={busy || !email || !pw}>
              {busy ? '확인 중…' : '로그인'}
            </button>
            {loginErr && <div className="err">{loginErr}</div>}
          </div>
        </div>
      </div>
    );
  }

  const NAV: { group: string; items: { key: Tab; label: string }[] }[] = [
    { group: 'OVERVIEW', items: [{ key: 'dash', label: '대시보드' }] },
    { group: 'MANAGEMENT', items: [{ key: 'stores', label: '매장 목록' }, { key: 'new', label: '매장 추가' }] },
    { group: 'DATA', items: [{ key: 'coupons', label: '쿠폰 현황' }] },
    { group: 'ACCOUNT', items: [{ key: 'account', label: '내 계정' }] },
  ];

  return (
    <div className="oc">
      <div className="layout">
        <aside className="side">
          <div className="brand">
            <h2>쿠벤팅</h2>
            <p>ADMIN</p>
          </div>
          <nav className="nav">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="navlabel">{g.group}</div>
                {g.items.map((it) => (
                  <button key={it.key} className="navitem" aria-current={tab === it.key}
                          onClick={() => { setTab(it.key); setMsg(null); }}>
                    <i />{it.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidefoot">
            {ov?.me ?? ''}
            <br />
            <button onClick={async () => { await sb().auth.signOut(); }}>로그아웃</button>
          </div>
        </aside>

        <main className="main">
          {tab === 'dash' && <Dash ov={ov} onRefresh={load} />}
          {tab === 'stores' && (
            <Stores
              stores={stores} origin={origin} open={open} setOpen={setOpen}
              call={call} onChanged={load} setMsg={setMsg}
              onEditMedia={(st) => { setMedia(st); setTab('media'); setMsg(null); }}
            />
          )}
          {tab === 'new' && (
            <NewStore origin={origin} call={call} onCreated={() => { load(); }} setMsg={setMsg} />
          )}
          {tab === 'coupons' && <Coupons rows={coupons} />}
          {tab === 'account' && <Account me={ov?.me ?? ''} />}
          {tab === 'media' && (
            <AdminMedia
              store={media} call={call}
              onBack={() => { setTab('stores'); setMsg(null); }}
              setMsg={setMsg}
            />
          )}
          {msg && <p className={`msg ${msg.bad ? 'bad' : 'ok'}`}>{msg.t}</p>}
        </main>
      </div>
    </div>
  );
}

/* ================= 대시보드 ================= */
function Dash({ ov, onRefresh }: { ov: Overview | null; onRefresh: () => void }) {
  const rate = ov && ov.coupons ? Math.round((ov.redeemed / ov.coupons) * 100) : 0;
  return (
    <>
      <div className="head">
        <div>
          <h1>대시보드</h1>
          <p>전 매장 합계</p>
        </div>
        <div className="sp" />
        <button onClick={onRefresh}>새로고침</button>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="l">매장</div><div className="v">{ov?.stores ?? '-'}</div>
          <div className="d">진행 중 {ov?.live ?? 0}곳</div></div>
        <div className="kpi"><div className="l">오늘 뽑기</div><div className="v">{ov?.drawnToday ?? '-'}</div>
          <div className="d">전 매장 합계</div></div>
        <div className="kpi"><div className="l">쿠폰 사용률</div><div className="v">{rate}<small>%</small></div>
          <div className="d">{ov?.redeemed ?? 0} / {ov?.coupons ?? 0}장</div></div>
        <div className="kpi"><div className="l">미사용 쿠폰</div><div className="v">{ov?.pending ?? '-'}</div>
          <div className="d">3일 내 만료 {ov?.expiring ?? 0}장</div></div>
      </div>

      <div className="card">
        <h2>박스 소진 임박 <span>5장 이하</span></h2>
        {!ov?.lowStock?.length && <p className="empty">없습니다.</p>}
        {ov?.lowStock?.map((s, i) => (
          <div key={i} className="store">
            <div className="row1">
              <b>{s.store}{s.branch ? ` · ${s.branch}` : ''}</b>
              <div className="sp" />
              <div className="cnt">{s.left}<em>/{s.total}</em></div>
            </div>
            <p className="hint">사장님께 새 박스를 열라고 안내하세요.</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>확인이 필요한 매장</h2>
        {!ov?.risky?.length && <p className="empty">없습니다.</p>}
        {ov?.risky?.map((s, i) => (
          <div key={i} className="store">
            <div className="row1">
              <b>{s.store}{s.branch ? ` · ${s.branch}` : ''}</b>
              <div className="sp" />
              {s.samePin && <span className="pill warn">PIN 중복</span>}
              {s.openMode && <span className="pill warn">상시 개방</span>}
              {s.pinFails > 0 && <span className="pill warn">PIN 실패 {s.pinFails}</span>}
            </div>
            <p className="hint">
              {s.samePin && '카운터 PIN과 사장님 PIN이 같습니다. 손님이 어깨너머로 보면 사장님 화면까지 열립니다. '}
              {s.openMode && '상시 개방은 주소가 새면 원격으로 뽑힐 수 있습니다. '}
              {s.pinFails > 0 && '최근 24시간 PIN 실패가 있었습니다.'}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= 매장 목록 ================= */
type Caller = (p: string, i?: RequestInit) => Promise<unknown>;

function Stores({
  stores, origin, open, setOpen, call, onChanged, setMsg, onEditMedia,
}: {
  stores: Store[]; origin: string; open: string | null;
  setOpen: (v: string | null) => void; call: Caller; onChanged: () => void;
  setMsg: (m: { t: string; bad?: boolean } | null) => void;
  onEditMedia: (s: { id: string; name: string }) => void;
}) {
  const copy = (t: string, done: string) =>
    navigator.clipboard.writeText(t).then(() => setMsg({ t: done }))
      .catch(() => setMsg({ t: '복사 실패', bad: true }));

  return (
    <>
      <div className="head">
        <div><h1>매장 목록</h1><p>{stores.length}곳</p></div>
      </div>

      {!stores.length && <div className="card"><p className="empty">아직 없습니다.</p></div>}

      {stores.map((s) => {
        const used = (s.total_tickets ?? 0) - (s.left ?? 0);
        const pct = s.total_tickets ? (used / s.total_tickets) * 100 : 0;
        const isOpen = open === s.id;
        return (
          <div className="store" key={s.id}>
            <div className="row1">
              <b>{s.name}{s.branch ? ` · ${s.branch}` : ''}</b>
              {s.owner_pin === s.board_pin && <span className="pill warn">PIN 중복</span>}
              {s.board_mode === 'open' && <span className="pill warn">상시 개방</span>}
              {s.status === 'live' && <span className="pill ok">진행 중</span>}
              <div className="sp" />
              <div className="cnt">{s.left ?? 0}<em>/{s.total_tickets ?? 0}</em></div>
            </div>
            <div className="meta">
              {s.title ?? '캠페인 없음'} · {s.current_box ?? '-'}회차 · 등급 {s.grades ?? 0}개 ·
              쿠폰 {s.redeemed ?? 0}/{s.coupons ?? 0}
              {s.ends_at ? ` · ${new Date(s.ends_at).toLocaleDateString('ko-KR')} 종료` : ''}
            </div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>

            <div className="acts">
              <button onClick={() => setOpen(isOpen ? null : s.id)}>
                {isOpen ? '접기' : '주소·PIN 보기'}
              </button>
              {s.board_token && (
                <button onClick={() => window.open(`/board/${s.board_token}`, '_blank')}>카운터 열기</button>
              )}
              <button onClick={() => window.open(`/owner/${s.owner_token}`, '_blank')}>사장님 열기</button>
              <button onClick={() => onEditMedia({ id: s.id, name: s.name + (s.branch ? ` · ${s.branch}` : '') })}>
                사진·광고
              </button>
              <button onClick={() => copy(guideText(s, origin), '안내문을 복사했습니다')}>안내문 복사</button>
              <button className="danger" onClick={async () => {
                if (!confirm(`${s.name} 매장을 삭제할까요?\n뽑힌 기록이 있으면 거부됩니다.`)) return;
                const r = (await call(`/api/admin/stores/${s.id}`, { method: 'DELETE' })) as
                  { ok?: boolean; message?: string };
                if (r?.ok) { setMsg({ t: '삭제했습니다' }); onChanged(); return; }
                if (confirm(`${r?.message}\n\n강제로 지울까요? 되돌릴 수 없습니다.`)) {
                  const f = (await call(`/api/admin/stores/${s.id}?force=1`, { method: 'DELETE' })) as { ok?: boolean };
                  setMsg(f?.ok ? { t: '강제 삭제했습니다' } : { t: '삭제 실패', bad: true });
                  onChanged();
                }
              }}>삭제</button>
            </div>

            {isOpen && (
              <div className="detail">
                카운터 <code>{origin}/board/{s.board_token}</code> · PIN <code>{s.board_pin}</code><br />
                사장님 <code>{origin}/owner/{s.owner_token}</code> · PIN <code>{s.owner_pin}</code>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function guideText(s: Store, origin: string) {
  return [
    `[쿠벤팅] ${s.name}${s.branch ? ' ' + s.branch : ''} 설정 안내`,
    '',
    '카운터 화면 (태블릿에 띄워두세요)',
    `${origin}/board/${s.board_token}`,
    `카운터 PIN: ${s.board_pin}`,
    '',
    '사장님 화면 (즐겨찾기 해두세요)',
    `${origin}/owner/${s.owner_token}`,
    `사장님 PIN: ${s.owner_pin}`,
    '',
    '※ 카운터 PIN은 직원이 손님 앞에서 누르는 번호입니다.',
    '※ 사장님 PIN은 외부에 알려주지 마세요.',
  ].join('\n');
}

/* ================= 매장 추가 ================= */
function NewStore({
  origin, call, onCreated, setMsg,
}: {
  origin: string; call: Caller; onCreated: () => void;
  setMsg: (m: { t: string; bad?: boolean } | null) => void;
}) {
  const [preset, setPreset] = useState(PRESETS[0].key);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [title, setTitle] = useState('오픈 기념 뽑기');
  const [total, setTotal] = useState(TOTAL_DEFAULT);
  const [days, setDays] = useState(7);
  const [theme, setTheme] = useState<'warm' | 'modern' | 'neon'>(PRESETS[0].theme);
  const [mode, setMode] = useState<'pin' | 'open'>('pin');
  const [lastName, setLastName] = useState(PRESETS[0].lastOneName);
  const [pins, setPins] = useState(randomPins());
  const [rows, setRows] = useState<PresetPrize[]>(PRESETS[0].prizes.map((x) => ({ ...x })));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ board: string; owner: string; bp: string; op: string; nm: string } | null>(null);

  function applyPreset(k: string) {
    const p = PRESETS.find((x) => x.key === k) ?? PRESETS[0];
    setPreset(k);
    setRows(p.prizes.map((x) => ({ ...x })));
    setTheme(p.theme);
    setLastName(p.lastOneName);
  }

  const sum = rows.reduce((a, b) => a + (b.qty || 0), 0);
  const ok = sum === total && !!name.trim() && rows.length > 0;
  const patch = (i: number, v: Partial<PresetPrize>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));

  async function create() {
    setBusy(true); setMsg(null); setDone(null);
    try {
      const p = PRESETS.find((x) => x.key === preset);
      const r = (await call('/api/admin/stores', {
        method: 'POST',
        body: JSON.stringify({
          store: { name: name.trim(), branch: branch.trim(), owner_pin: pins.owner, board_pin: pins.board },
          campaign: {
            title, total_tickets: total, theme, days, board_mode: mode,
            rate_per_min: 6, last_one_label: '막차 보너스', last_one_name: lastName,
          },
          prizes: rows.map((x, i) => ({ ...x, sort: i + 1 })),
          ads: p?.ads ?? [],
        }),
      })) as { ok?: boolean; boardToken?: string; ownerToken?: string; message?: string; error?: string };

      if (r?.ok) {
        setDone({ board: r.boardToken!, owner: r.ownerToken!, bp: pins.board, op: pins.owner, nm: name.trim() });
        setMsg({ t: '만들었습니다. 아래 안내문을 사장님께 전달하세요.' });
        setName(''); setBranch(''); setPins(randomPins());
        onCreated();
      } else {
        setMsg({ t: r?.message ?? r?.error ?? '실패했습니다', bad: true });
      }
    } catch { setMsg({ t: '요청에 실패했습니다', bad: true }); }
    setBusy(false);
  }

  return (
    <>
      <div className="head">
        <div><h1>매장 추가</h1><p>매장 · 이벤트 · 상품 · 1회차 박스까지 한 번에 만듭니다</p></div>
      </div>

      <div className="card">
        <h2>기본 정보</h2>
        <div className="grid">
          <label className="f"><span>업종 프리셋</span>
            <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select></label>
          <label className="f"><span>매장 이름 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="멘야 코바야시" /></label>
          <label className="f"><span>지점</span>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="합정점" /></label>
          <label className="f"><span>이벤트 이름</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="f"><span>총 티켓</span>
            <input type="number" min={10} max={500} value={total}
                   onChange={(e) => setTotal(Math.max(1, parseInt(e.target.value) || 0))} /></label>
          <label className="f"><span>기간 (일)</span>
            <input type="number" min={1} max={90} value={days}
                   onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))} /></label>
          <label className="f"><span>테마</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
              <option value="warm">따뜻한 (밝은 사진)</option>
              <option value="modern">모던 (어두운 사진)</option>
              <option value="neon">네온</option>
            </select></label>
          <label className="f"><span>뽑기 방식</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="pin">직원 확인 (PIN)</option>
              <option value="open">상시 개방</option>
            </select></label>
          <label className="f"><span>막차 보너스 상품</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="세트 무료 + 굿즈" /></label>
          <label className="f"><span>카운터 PIN</span>
            <input value={pins.board} maxLength={4}
                   onChange={(e) => setPins({ ...pins, board: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="f"><span>사장님 PIN</span>
            <input value={pins.owner} maxLength={4}
                   onChange={(e) => setPins({ ...pins, owner: e.target.value.replace(/\D/g, '') })} /></label>
        </div>
        <p className="hint">PIN 두 개는 반드시 달라야 합니다. 카운터 PIN은 손님 앞에서 매일 눌리는 번호입니다.</p>
      </div>

      <div className="card">
        <h2>상품 구성 <span>수량 합계가 총 티켓 수와 같아야 합니다</span></h2>
        <table className="tbl">
          <thead><tr><th>등급</th><th>상품 이름</th><th>수량</th><th>사용 시점</th><th /></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.grade}>
                <td style={{ width: 44 }}>
                  <div className="gg" style={{ background: COLORS[p.grade] }}>{p.grade}</div>
                </td>
                <td><input value={p.name} placeholder={`${p.grade} 상품`}
                           onChange={(e) => patch(i, { name: e.target.value })} /></td>
                <td style={{ width: 104 }}>
                  <input type="number" min={0} value={p.qty}
                         onChange={(e) => patch(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                <td style={{ width: 160 }}>
                  <div className="seg">
                    {(['now', 'later'] as const).map((w) => (
                      <button key={w} aria-pressed={p.use_when === w} onClick={() => patch(i, { use_when: w })}>
                        {w === 'now' ? '그 자리' : '다음 방문'}
                      </button>
                    ))}
                  </div>
                </td>
                <td style={{ width: 44 }}>
                  <button className="del" disabled={rows.length <= 1}
                          aria-label="이 등급 지우기"
                          onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                    <Icon name="close" strokeWidth={2.4} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length < 8 && (
          <button className="add" onClick={() => {
            const used = new Set(rows.map((r) => r.grade));
            const next = [...GRADES].find((g) => !used.has(g));
            if (next) setRows((r) => [...r, { grade: next, name: '', qty: 0, use_when: 'later', valid_days: 7 }]);
          }}>+ 등급 추가 ({rows.length}/8)</button>
        )}

        <div className={`sum ${sum === total ? '' : 'err'}`}>
          <span>수량 합계</span>
          <b>{sum} / {total}장 {sum === total ? '' : `(${sum > total ? '초과' : '부족'} ${Math.abs(sum - total)})`}</b>
        </div>

        <button className="go" disabled={!ok || busy} onClick={create}>
          {busy ? '만드는 중…' : '매장 만들기'}
        </button>
      </div>

      {done && (
        <div className="card done">
          <h2>전달할 정보</h2>
          <div className="kv">
            <b>카운터 화면</b><code>{origin}/board/{done.board}</code>
            <b>사장님 화면</b><code>{origin}/owner/{done.owner}</code>
            <b>카운터 PIN</b><code>{done.bp}</code>
            <b>사장님 PIN</b><code>{done.op}</code>
          </div>
          <button className="add" onClick={() => {
            const t = [
              `[쿠벤팅] ${done.nm} 설정 안내`, '',
              '카운터 화면 (태블릿에 띄워두세요)',
              `${origin}/board/${done.board}`, `카운터 PIN: ${done.bp}`, '',
              '사장님 화면 (즐겨찾기 해두세요)',
              `${origin}/owner/${done.owner}`, `사장님 PIN: ${done.op}`, '',
              '※ 카운터 PIN은 직원이 손님 앞에서 누르는 번호입니다.',
              '※ 사장님 PIN은 외부에 알려주지 마세요.',
            ].join('\n');
            navigator.clipboard.writeText(t)
              .then(() => setMsg({ t: '안내문을 복사했습니다' }))
              .catch(() => setMsg({ t: '복사 실패', bad: true }));
          }}>사장님 전달용 안내문 복사</button>
        </div>
      )}
    </>
  );
}

/* ================= 쿠폰 현황 ================= */
function Coupons({ rows }: { rows: Coupon[] }) {
  return (
    <>
      <div className="head">
        <div><h1>쿠폰 현황</h1><p>미사용 쿠폰 {rows.length}장 · 만료 임박 순</p></div>
      </div>
      <div className="card">
        {!rows.length && <p className="empty">미사용 쿠폰이 없습니다.</p>}
        {!!rows.length && (
          <table className="tbl">
            <thead>
              <tr><th>매장</th><th>등급</th><th>상품</th><th>코드</th><th>만료</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code + c.store} className={c.expired ? 'warn' : ''}>
                  <td>{c.store}{c.branch ? ` · ${c.branch}` : ''}</td>
                  <td>{c.grade}</td>
                  <td>{c.prize}</td>
                  <td><code>{c.code}</code></td>
                  <td>
                    {new Date(c.expires_at).toLocaleDateString('ko-KR')}
                    {c.expired ? ' (만료)' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ================= 내 계정 ================= */

/** 비밀번호 규칙. 통과하지 못한 이유를 문장으로 돌려준다 */
function pwProblem(next: string, current: string, email: string): string | null {
  if (next.length < 6) return '6자 이상으로 만드세요.';
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) return '영문과 숫자를 함께 넣으세요.';
  if (next === current) return '지금 쓰는 비밀번호와 같습니다.';
  const id = email.split('@')[0];
  if (id.length >= 4 && next.toLowerCase().includes(id.toLowerCase())) {
    return '이메일 아이디가 그대로 들어가 있습니다.';
  }
  return null;
}

function Account({ me: meProp }: { me: string }) {
  // 대시보드를 아직 안 불렀으면 me 가 비어 있다. 세션에서 직접 꺼낸다.
  const [me, setMe] = useState(meProp);
  useEffect(() => {
    if (meProp) { setMe(meProp); return; }
    sb().auth.getUser().then(({ data }) => setMe(data.user?.email ?? ''));
  }, [meProp]);

  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const problem = next ? pwProblem(next, cur, me) : null;
  const mismatch = !!again && next !== again;
  const ready = !!cur && !!next && !!again && !problem && !mismatch;

  async function change() {
    setBusy(true); setMsg(null);

    // 1) 지금 비밀번호가 맞는지 먼저 확인한다.
    //    로그인된 탭을 누가 그대로 쓰는 상황에서 비밀번호만 바꿔치기하는 걸 막는다.
    const { error: authErr } = await sb().auth.signInWithPassword({ email: me, password: cur });
    if (authErr) {
      setBusy(false);
      setMsg({ t: '지금 비밀번호가 맞지 않습니다.', bad: true });
      return;
    }

    // 2) 교체
    const { error } = await sb().auth.updateUser({ password: next });
    if (error) {
      setBusy(false);
      setMsg({ t: '변경 실패 — ' + error.message, bad: true });
      return;
    }

    // 3) 다른 기기·브라우저에 남아 있던 세션은 끊는다. 이 탭은 유지.
    await sb().auth.signOut({ scope: 'others' }).catch(() => {});

    setBusy(false);
    setCur(''); setNext(''); setAgain('');
    setMsg({ t: '비밀번호를 바꿨습니다. 다른 기기의 로그인은 모두 끊었습니다.' });
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>내 계정</h1>
          <p>{me}</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <h2>비밀번호 변경</h2>

        <label className="f" style={{ display: 'block', marginBottom: 12 }}>
          <span>지금 비밀번호</span>
          <input type="password" value={cur} autoComplete="current-password"
                 onChange={(e) => setCur(e.target.value)} />
        </label>

        <label className="f" style={{ display: 'block', marginBottom: 12 }}>
          <span>새 비밀번호</span>
          <input type="password" value={next} autoComplete="new-password"
                 onChange={(e) => setNext(e.target.value)} />
        </label>

        <label className="f" style={{ display: 'block' }}>
          <span>새 비밀번호 확인</span>
          <input type="password" value={again} autoComplete="new-password"
                 onChange={(e) => setAgain(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter' && ready && !busy) change(); }} />
        </label>

        {problem && <p className="msg bad">{problem}</p>}
        {!problem && mismatch && <p className="msg bad">두 번 입력한 값이 다릅니다.</p>}

        <button className="go" onClick={change} disabled={!ready || busy}>
          {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>

        {msg && <p className={`msg ${msg.bad ? 'bad' : 'ok'}`}>{msg.t}</p>}

        <p className="hint">
          6자 이상, 영문과 숫자를 함께. 바꾸면 다른 기기에 남아 있던 로그인은 전부 끊깁니다.
          <br />
          임시 비밀번호로 처음 들어왔다면, 바꾼 뒤 <code>app/admin-임시비번.txt</code> 파일을 지우세요.
        </p>
      </div>
    </>
  );
}
