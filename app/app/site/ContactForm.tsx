'use client';

import { useState } from 'react';
import { Icon } from '@/lib/Icon';
import { INQUIRY_KINDS, INQUIRY_MAX } from '@/lib/inquiry';

type State = 'idle' | 'sending' | 'done' | 'error';

/**
 * 도입 문의 — /api/inquiry 로 보내 kuji.inquiries 에 쌓는다(supabase/027_inquiries.sql).
 * 연락처를 받으므로 개인정보 수집 · 이용 동의를 받는다(필수). 봇은 숨긴 칸(website)에 걸린다.
 */
export default function ContactForm() {
  const [st, setSt] = useState<State>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const body = Object.fromEntries(new FormData(form).entries());
    setSt('sending'); setMsg('');
    try {
      const r = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || '보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setSt('done');
    } catch (x) {
      setSt('error');
      setMsg(x instanceof Error ? x.message : '보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  if (st === 'done') {
    return (
      <div className="kv-form kv-form-done" role="status">
        <span className="kv-done-ic"><Icon name="check" /></span>
        <h3>문의를 받았습니다</h3>
        <p>남겨 주신 연락처로 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form className="kv-form" onSubmit={submit} data-reveal style={{ ['--i' as string]: 2 }}>
      <div className="kv-field">
        <label htmlFor="kv-name">이름 또는 상호</label>
        <input id="kv-name" name="name" required maxLength={INQUIRY_MAX.name} autoComplete="organization" />
      </div>
      <div className="kv-field">
        <label htmlFor="kv-kind">업종</label>
        <select id="kv-kind" name="kind" defaultValue={INQUIRY_KINDS[0]}>
          {INQUIRY_KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <div className="kv-field wide">
        <label htmlFor="kv-contact">연락처</label>
        <input id="kv-contact" name="contact" required maxLength={INQUIRY_MAX.contact} placeholder="전화번호 또는 이메일" autoComplete="tel" />
        <p className="kv-help">답장 받을 곳 하나면 됩니다.</p>
      </div>
      <div className="kv-field wide">
        <label htmlFor="kv-msg">행사 내용 <span className="kv-opt">(선택)</span></label>
        <textarea id="kv-msg" name="message" rows={4} maxLength={INQUIRY_MAX.message} placeholder="행사 날짜, 예상 손님 수, 생각해 둔 상품" />
      </div>
      <input className="kv-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="kv-agree">
        <input type="checkbox" name="agree" required />
        <span>
          개인정보 수집과 이용에 동의합니다 (필수)
          <small>수집 항목: 이름 또는 상호, 업종, 연락처, 문의 내용</small>
          <small>목적: 도입 상담 회신 / 보관: 문의일로부터 1년 · <a href="/privacy" target="_blank" rel="noopener">개인정보처리방침</a></small>
        </span>
      </label>
      {st === 'error' && <p className="kv-form-err" role="alert">{msg}</p>}
      <button className="kv-btn primary" disabled={st === 'sending'}>
        {st === 'sending' ? '보내는 중' : '문의 보내기'}
      </button>
    </form>
  );
}
