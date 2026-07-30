'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * 손님용 클라이언트 (anon).
 * kuji 스키마의 함수만 실행할 수 있다. 테이블 직접 접근은 RLS로 전부 막혀 있다.
 * 빌드 시점에 평가되지 않도록 지연 생성한다.
 */
const makeClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'kuji' } }
  );

let _sb: ReturnType<typeof makeClient> | null = null;

export function sb() {
  if (!_sb) _sb = makeClient();
  return _sb;
}

export const campaignId = () => process.env.NEXT_PUBLIC_CAMPAIGN_ID!;

export type Prize = {
  grade: string;
  name: string;
  qty: number;
  useWhen: 'now' | 'later';
  image: string | null;
  left: number;
};

export type BoardSlot = { pos: number; grade: string | null };

export type Board = {
  campaign: {
    id: string;
    title: string;
    status: string;
    theme: string;
    total: number;
    endsAt: string | null;
    lastOneName: string | null;
    lastOneImage: string | null;
    store: { name: string; branch: string | null; logo: string | null };
  } | null;
  prizes: Prize[];
  board: BoardSlot[];
  left: number;
};

export type DrawResult = {
  grade: string;
  name: string;
  useWhen: 'now' | 'later';
  image: string | null;
  code: string;
  isLastOne: boolean;
  lastOneName: string | null;
  expiresAt: string;
  left: number;
  position: number;
};

export async function getBoard(id = campaignId()): Promise<Board> {
  const { data, error } = await sb().rpc('get_board', { p_campaign: id });
  if (error) throw error;
  return data as Board;
}

export async function checkPass(code: string) {
  const { data, error } = await sb().rpc('check_pass', { p_code: code });
  if (error) throw error;
  return data as { ok: boolean; reason?: string; campaignId?: string };
}

export async function draw(pass: string, position: number): Promise<DrawResult> {
  const { data, error } = await sb().rpc('draw', { p_pass: pass, p_position: position });
  if (error) throw error;
  return data as DrawResult;
}

export async function getCoupon(code: string, id = campaignId()) {
  const { data, error } = await sb().rpc('get_coupon', { p_campaign: id, p_code: code });
  if (error) throw error;
  return data;
}
