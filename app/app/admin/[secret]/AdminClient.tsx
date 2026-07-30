'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRESETS, TOTAL_DEFAULT, randomPins, type PresetPrize } from '@/lib/presets';

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

type Created = {
  ok: true; storeId: string; campaignId: string; ownerToken: string; boardToken: string;
};

export default function AdminClient({ secret }: { secret: string }) {
  const key = 'kuji_admin_secret';
  const [auth, setAuth] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [gateErr, setGateErr] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [origin, setOrigin] = useState('');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);

  // 입력값
  const [preset, setPreset] = useState(PRESETS[0].key);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [title, setTitle] = useState('오픈 기념 뽑기');
  const [total, setTotal] = useState(TOTAL_DEFAULT);
  const [days, setDays] = useState(7);
  const [theme, setTheme] = useState<'warm' | 'modern' | 'neon'>('warm');
  const [mode, setMode] = useState<'pin' | 'open'>('pin');
  const [lastName, setLastName] = useState('');
  const [pins, setPins] = useState(randomPins());
  const [rows, setRows] = useState<PresetPrize[]>(PRESETS[0].prizes);

  useEffect(() => {
    setOrigin(window.location.origin);
    setAuth(localStorage.getItem(key));
  }, []);

  const api = (p = '') => `/api/admin/${secret}/stores${p}`;

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': auth ?? '', ...(init?.headers ?? {}) },
    });
    if (res.status === 401) { localStorage.removeItem(key); setAuth(null); throw new Error('UNAUTHORIZED'); }
    return res.json();
  }, [auth, secret]);

  const load = useCallback(async () => {
    if (!auth) return;
    try {
      const r = (await call(api())) as { stores?: Store[] };
      setStores(r.stores ?? []);
    } catch { /* 401은 위에서 처리 */ }
  }, [auth, call, secret]);

  useEffect(() => { load(); }, [load]);

  // 프리셋 바꾸면 상품·테마·막차 상품을 갈아끼운다
  function applyPreset(k: string) {
    const p = PRESETS.find((x) => x.key === k) ?? PRESETS[0];
    setPreset(k);
    setRows(p.prizes.map((x) => ({ ...x })));
    setTheme(p.theme);
    setLastName(p.lastOneName);
  }

  /* ---------- 시크릿 게이트 ---------- */
  if (!auth) {
    return (
      <div className="ad">
        <div className="gate">
          <h2>운영자 화면</h2>
          <p>주소의 시크릿과 같은 값을 입력하세요.<br />둘 다 맞아야 들어갑니다.</p>
          <input
            value={input} type="password" placeholder="ADMIN_SECRET"
            onChange={(e) => { setInput(e.target.value); setGateErr(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') gate(); }}
          />
          <button onClick={gate}>들어가기</button>
          {gateErr && <p className="msg bad">{gateErr}</p>}
        </div>
      </div>
    );

    async function gate() {
      const v = input.trim();
      if (!v) { setGateErr('값을 입력하세요'); return; }
      const res = await fetch(api(), { headers: { 'x-admin-secret': v } });
      if (res.ok) { localStorage.setItem(key, v); setAuth(v); return; }
      if (res.status === 503) { setGateErr('서버에 ADMIN_SECRET 환경변수가 없습니다'); return; }
      setGateErr('시크릿이 맞지 않습니다');
    }
  }

  const sum = rows.reduce((a, b) => a + (b.qty || 0), 0);
  const ok = sum === total && !!name.trim() && rows.length > 0;

  const patch = (i: number, v: Partial<PresetPrize>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));

  async function create() {
    setBusy(true); setMsg(null); setCreated(null);
    try {
      const p = PRESETS.find((x) => x.key === preset);
      const r = (await call(api(), {
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
      })) as Created & { error?: string; message?: string };

      if (r?.ok) {
        setCreated(r);
        setMsg({ t: '만들었습니다. 아래 주소를 사장님께 전달하세요.' });
        setName(''); setBranch(''); setPins(randomPins());
        load();
      } else {
        setMsg({ t: r?.message ?? r?.error ?? '실패했습니다', bad: true });
      }
    } catch {
      setMsg({ t: '요청에 실패했습니다', bad: true });
    }
    setBusy(false);
  }

  return (
    <div className="ad">
      <div className="top">
        <div>
          <h1>쿠벤팅 운영자</h1>
          <div className="sub">매장 {stores.filter((s) => s.campaign_id).length}곳</div>
        </div>
        <div className="sp" />
        <button onClick={() => { localStorage.removeItem(key); setAuth(null); }}>나가기</button>
      </div>

      {/* ---------- 생성 ---------- */}
      <div className="card">
        <h2>매장 추가 <span>매장 → 이벤트 → 상품 → 1회차 박스까지 한 번에 만듭니다</span></h2>

        <div className="grid">
          <label className="f">
            <span>업종 프리셋</span>
            <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="f">
            <span>매장 이름 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="멘야 코바야시" />
          </label>
          <label className="f">
            <span>지점</span>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="합정점" />
          </label>
          <label className="f">
            <span>이벤트 이름</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="f">
            <span>총 티켓</span>
            <input type="number" min={10} max={500} value={total}
                   onChange={(e) => setTotal(Math.max(1, parseInt(e.target.value) || 0))} />
          </label>
          <label className="f">
            <span>기간 (일)</span>
            <input type="number" min={1} max={90} value={days}
                   onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))} />
          </label>
          <label className="f">
            <span>테마</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
              <option value="warm">따뜻한 (밝은 사진)</option>
              <option value="modern">모던 (어두운 사진)</option>
              <option value="neon">네온</option>
            </select>
          </label>
          <label className="f">
            <span>뽑기 방식</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="pin">직원 확인 (PIN)</option>
              <option value="open">상시 개방</option>
            </select>
          </label>
          <label className="f">
            <span>막차 보너스 상품</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                   placeholder="세트 무료 + 굿즈" />
          </label>
          <label className="f">
            <span>카운터 PIN</span>
            <input value={pins.board} maxLength={4}
                   onChange={(e) => setPins({ ...pins, board: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="f">
            <span>사장님 PIN</span>
            <input value={pins.owner} maxLength={4}
                   onChange={(e) => setPins({ ...pins, owner: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
        <p className="hint">
          PIN 두 개는 반드시 달라야 합니다. 카운터 PIN은 손님 앞에서 매일 눌리는 번호입니다.
        </p>

        <table>
          <thead>
            <tr><th>등급</th><th>상품 이름</th><th>수량</th><th>사용 시점</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.grade}>
                <td className="g"><div className="gg" style={{ background: COLORS[p.grade] }}>{p.grade}</div></td>
                <td><input value={p.name} placeholder={`${p.grade}상 상품`}
                           onChange={(e) => patch(i, { name: e.target.value })} /></td>
                <td className="q"><input type="number" min={0} value={p.qty}
                           onChange={(e) => patch(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                <td className="w">
                  <div className="seg">
                    {(['now', 'later'] as const).map((w) => (
                      <button key={w} aria-pressed={p.use_when === w}
                              onClick={() => patch(i, { use_when: w })}>
                        {w === 'now' ? '그 자리' : '다음 방문'}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="x">
                  <button className="del" disabled={rows.length <= 1}
                          onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>✕</button>
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

        {msg && <p className={`msg ${msg.bad ? 'bad' : 'ok'}`}>{msg.t}</p>}
      </div>

      {/* ---------- 생성 결과 ---------- */}
      {created && (
        <div className="card done">
          <h2>전달할 정보</h2>
          <div className="kv">
            <b>카운터 화면</b><code>{origin}/board/{created.boardToken}</code>
            <b>사장님 화면</b><code>{origin}/owner/{created.ownerToken}</code>
            <b>카운터 PIN</b><code>{pins.board}</code>
            <b>사장님 PIN</b><code>{pins.owner}</code>
          </div>
          <button className="add" onClick={() => {
            const t = [
              `[쿠벤팅] ${name || '매장'} 설정 안내`,
              '',
              `카운터 화면 (태블릿에 띄워두세요)`,
              `${origin}/board/${created.boardToken}`,
              `카운터 PIN: ${pins.board}`,
              '',
              `사장님 화면 (즐겨찾기 해두세요)`,
              `${origin}/owner/${created.ownerToken}`,
              `사장님 PIN: ${pins.owner}`,
              '',
              '※ 카운터 PIN은 직원이 손님 앞에서 누르는 번호입니다.',
              '※ 사장님 PIN은 외부에 알려주지 마세요.',
            ].join('\n');
            navigator.clipboard.writeText(t)
              .then(() => setMsg({ t: '안내문을 복사했습니다' }))
              .catch(() => setMsg({ t: '복사에 실패했습니다', bad: true }));
          }}>사장님 전달용 안내문 복사</button>
        </div>
      )}

      {/* ---------- 목록 ---------- */}
      <div className="card">
        <h2>매장 목록</h2>
        {!stores.length && <p className="hint">아직 없습니다.</p>}
        {stores.map((s) => (
          <div className="store" key={s.id}>
            <div className="nm">
              <b>{s.name}{s.branch ? ` · ${s.branch}` : ''}</b>
              {s.board_mode === 'open' && <span className="pill warn">상시 개방</span>}
              {s.owner_pin === s.board_pin && <span className="pill warn">PIN 중복</span>}
              <div className="meta">
                {s.title ?? '캠페인 없음'} · {s.current_box ?? '-'}회차 · 등급 {s.grades ?? 0}개
                {s.ends_at ? ` · ${new Date(s.ends_at).toLocaleDateString('ko-KR')} 종료` : ''}
              </div>
              <div className="links">
                {s.board_token && <>보드 <code>{origin}/board/{s.board_token}</code><br /></>}
                사장님 <code>{origin}/owner/{s.owner_token}</code><br />
                PIN 카운터 <code>{s.board_pin}</code> · 사장님 <code>{s.owner_pin}</code>
              </div>
            </div>
            <div className="rt">
              <b>{s.left ?? 0}/{s.total_tickets ?? 0}</b>
              남은 티켓
              <div style={{ marginTop: 6 }}>쿠폰 {s.redeemed ?? 0}/{s.coupons ?? 0}</div>
              <button className="del" style={{ marginTop: 8 }} onClick={async () => {
                if (!confirm(`${s.name} 매장을 삭제할까요?\n뽑힌 기록이 있으면 거부됩니다.`)) return;
                const r = (await call(api(`/${s.id}`), { method: 'DELETE' })) as
                  { ok?: boolean; message?: string };
                if (r?.ok) { setMsg({ t: '삭제했습니다' }); load(); return; }
                if (confirm(`${r?.message}\n\n강제로 지울까요? 되돌릴 수 없습니다.`)) {
                  const f = (await call(api(`/${s.id}?force=1`), { method: 'DELETE' })) as { ok?: boolean };
                  setMsg(f?.ok ? { t: '강제 삭제했습니다' } : { t: '삭제 실패', bad: true });
                  load();
                }
              }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
