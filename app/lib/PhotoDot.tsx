'use client';

import { useRef, useState } from 'react';
import { makePrizeImage, makeAdImage, IMAGE_ERROR } from '@/lib/clientImage';
import { Icon } from '@/lib/Icon';

/**
 * 사진 올리는 동그라미.
 *
 * 사진이 없으면 등급 글자, 있으면 사진 — 태블릿 화면에 나오는 모습 그대로다.
 * 무엇이 어디에 뜨는지 설명할 필요가 없어진다.
 *
 * 사장님 화면과 운영자 화면이 같이 쓴다. 사장님이 직접 올릴 수도 있지만
 * 실제로는 카톡으로 사진을 받아 우리가 올리는 경우가 더 많다 —
 * 그래서 부품을 한 곳에 두고 호출자만 다르게 한다.
 */

export type Uploader = (
  query: string, blob: Blob
) => Promise<{ ok?: boolean; url?: string; message?: string; error?: string }>;

export type Remover = (
  query: string
) => Promise<{ ok?: boolean; message?: string; error?: string }>;

export default function PhotoDot({
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
        <button className="rm" title="사진 떼기" onClick={drop}>
          <Icon name="close" strokeWidth={2.6} />
        </button>
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
