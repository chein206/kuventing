'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/lib/Icon';
import PhotoDot, { type Uploader, type Remover } from '@/lib/PhotoDot';

/**
 * 운영자가 매장 사진·광고를 대신 손보는 화면.
 *
 * 사장님이 직접 올릴 수도 있지만(사장님 화면 상품·광고 탭), 실제로는
 * 카톡으로 사진을 받아 우리가 올리는 경우가 더 많다.
 * 그때 매장 주소(토큰+PIN)로 들어가지 않아도 되게 하는 것이 이 화면의 목적이다.
 *
 * 부품은 사장님 화면과 같은 것을 쓴다 — 브라우저에서 규격을 맞추고(lib/clientImage),
 * 서버가 다시 검사하고, 갈아끼운 옛 파일은 스토리지에서 지운다.
 * 다른 것은 진입 인증(운영자 JWT)과 대상 찾기(매장 id)뿐이다.
 */

type Caller = (p: string, i?: RequestInit) => Promise<unknown>;
type AdPos = 'tl' | 'tr' | 'ml' | 'mr' | 'bl' | 'br';

type MPrize = { grade: string; name: string; qty: number; image_url: string | null };
type MAd = { title: string; sub: string; price: string; image: string | null; pos: AdPos };
type MediaData = {
  campaignId: string; store: string; branch: string | null; title: string;
  last_one_label: string | null; last_one_name: string | null; last_one_image: string | null;
  prizes: MPrize[];
  ads?: { title?: string; sub?: string; price?: string; image?: string | null; pos?: string }[];
};

const POS_GRID: [AdPos, string][] = [
  ['tl', '상좌'], ['tr', '상우'],
  ['ml', '중좌'], ['mr', '중우'],
  ['bl', '하좌'], ['br', '하우'],
];
const normPos = (v?: string | null): AdPos => {
  const m: Record<string, AdPos> = { top: 'tl', mid: 'ml', bottom: 'bl' };
  const k = (v ?? '').toLowerCase();
  if (k in m) return m[k];
  return (['tl','tr','ml','mr','bl','br'] as string[]).includes(k) ? (k as AdPos) : 'bl';
};

const COLORS: Record<string, string> = {
  A: '#B8892F', B: '#7E8794', C: '#A2673B', D: '#4E7C8C',
  E: '#9B9184', F: '#7C8B5E', G: '#8C6A86', H: '#6F7A86',
};

export default function AdminMedia({
  store, call, onBack, setMsg,
}: {
  store: { id: string; name: string } | null;
  call: Caller;
  onBack: () => void;
  setMsg: (m: { t: string; bad?: boolean } | null) => void;
}) {
  const [d, setD] = useState<MediaData | null>(null);
  const [ads, setAds] = useState<MAd[]>([]);
  const [busy, setBusy] = useState(false);
  const id = store?.id;

  const load = useCallback(async () => {
    if (!id) return;
    const r = (await call(`/api/admin/stores/${id}`)) as MediaData;
    setD(r);
    setAds((r.ads ?? []).map((a) => ({
      title: a.title ?? '', sub: a.sub ?? '', price: a.price ?? '',
      image: a.image ?? null, pos: normPos(a.pos),
    })));
  }, [id, call]);

  useEffect(() => { load(); }, [load]);

  /** 사진은 FormData 로 보낸다. Content-Type 을 직접 넣으면 경계값이 빠져 깨진다 */
  const upload = useCallback<Uploader>(async (query, blob) => {
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');
    return (await call(`/api/admin/stores/${id}/image?${query}`, {
      method: 'POST', body: fd,
    })) as Awaited<ReturnType<Uploader>>;
  }, [id, call]);

  const removeImage = useCallback<Remover>(async (query) => (
    (await call(`/api/admin/stores/${id}/image?${query}`, { method: 'DELETE' })) as Awaited<ReturnType<Remover>>
  ), [id, call]);

  async function saveAds(next: MAd[], done: string) {
    setBusy(true);
    setAds(next);
    const r = (await call(`/api/admin/stores/${id}/ads`, {
      method: 'POST',
      body: JSON.stringify({
        ads: next.map((a) => ({
          title: a.title.trim(), sub: a.sub.trim() || null,
          price: a.price.trim() || null, image: a.image, pos: a.pos,
        })),
      }),
    })) as { ok?: boolean; message?: string; error?: string };
    setBusy(false);
    setMsg(r?.ok ? { t: done } : { t: r?.message ?? r?.error ?? '저장하지 못했습니다', bad: true });
    if (r?.ok) load();
  }

  const patch = (i: number, v: Partial<MAd>) =>
    setAds((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ads.length) return;
    const next = [...ads];
    [next[i], next[j]] = [next[j], next[i]];
    saveAds(next, '순서를 바꿨습니다');
  };

  if (!store) {
    return (
      <>
        <div className="head"><div><h1>사진·광고</h1><p>매장을 먼저 고르세요</p></div></div>
        <div className="card"><button onClick={onBack}>매장 목록으로</button></div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>사진·광고</h1>
          <p>{store.name}{d?.title ? ` · ${d.title}` : ''}</p>
        </div>
        <div className="sp" />
        <button onClick={onBack}>매장 목록으로</button>
      </div>

      <div className="card">
        <h2>상품 사진 <span>동그라미를 누르면 사진을 올립니다</span></h2>
        {!d && <p className="empty">불러오는 중…</p>}
        <div className="mgrid">
          {(d?.prizes ?? []).map((p) => (
            <div className="mcell" key={p.grade}>
              <PhotoDot
                url={p.image_url} label={p.grade} bg={COLORS[p.grade] ?? '#9B9184'}
                mode="prize" query={`target=prize&grade=${p.grade}`}
                upload={upload} removeImage={removeImage} onChange={() => load()}
              />
              <div className="mlbl"><b>{p.name}</b><span>{p.qty}장</span></div>
            </div>
          ))}
          {d?.last_one_name && (
            <div className="mcell">
              <PhotoDot
                url={d.last_one_image} label={<Icon name="star" />} bg="#B8892F"
                mode="prize" query="target=last"
                upload={upload} removeImage={removeImage} onChange={() => load()}
              />
              <div className="mlbl">
                <b>{d.last_one_name}</b><span>{d.last_one_label ?? '막차 보너스'}</span>
              </div>
            </div>
          )}
        </div>
        <p className="hint">
          상품 사진은 브라우저가 피사체를 찾아 정사각으로 자릅니다. 폰으로 찍은 사진도 됩니다.
        </p>
      </div>

      <div className="card">
        <h2>광고 슬라이드 <span>대기화면 · 최대 10장</span></h2>
        {!ads.length && <p className="empty">슬라이드가 없습니다.</p>}

        {ads.map((a, i) => (
          <div className="adminad" key={i}>
            <PhotoDot
              url={a.image} label={String(i + 1)} bg="#4E7C8C" mode="ad"
              query={`target=ad&index=${i}`}
              upload={upload} removeImage={removeImage} onChange={() => load()}
            />
            <div className="fields">
              <input value={a.title} maxLength={30} placeholder="메뉴 이름"
                     onChange={(e) => patch(i, { title: e.target.value })} />
              <input value={a.sub} maxLength={60} placeholder="설명 (없어도 됩니다)"
                     onChange={(e) => patch(i, { sub: e.target.value })} />
              <div className="line">
                <input value={a.price} maxLength={20} placeholder="가격"
                       onChange={(e) => patch(i, { price: e.target.value })} />
                <div className="posgrid">
                  {POS_GRID.map(([v, l]) => (
                    <button key={v} aria-pressed={normPos(a.pos) === v}
                            onClick={() => patch(i, { pos: v })}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ord">
              <button disabled={i === 0 || busy} onClick={() => move(i, -1)} title="위로">
                <Icon name="up" strokeWidth={2.2} />
              </button>
              <button disabled={i === ads.length - 1 || busy} onClick={() => move(i, 1)} title="아래로">
                <Icon name="down" strokeWidth={2.2} />
              </button>
            </div>
            <button className="del" disabled={busy} title="이 슬라이드 지우기"
                    onClick={() => saveAds(ads.filter((_, j) => j !== i), '슬라이드를 지웠습니다')}>
              <Icon name="close" strokeWidth={2.4} />
            </button>
          </div>
        ))}

        {ads.length < 10 && (
          <button className="add" disabled={busy} onClick={() =>
            saveAds([...ads, { title: '새 메뉴', sub: '', price: '', image: null, pos: 'bl' }],
                    '슬라이드를 추가했습니다')
          }>+ 슬라이드 추가 ({ads.length}/10)</button>
        )}

        {!!ads.length && (
          <button className="go" disabled={busy}
                  onClick={() => saveAds(ads, '저장했습니다. 카운터 화면에 바로 반영됩니다.')}>
            {busy ? '저장 중…' : '문구·위치 저장'}
          </button>
        )}

        <p className="hint">
          광고 사진은 자르지 않습니다. <b>글자 위치</b>는 사진을 보고 고르세요 —
          접시가 아래에 있으면 <b>위</b>, 위에 있으면 <b>아래</b>입니다.
          <br />추가·삭제·순서는 누르는 즉시 저장됩니다.
        </p>
      </div>
    </>
  );
}
