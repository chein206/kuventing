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
// 데모 판(/fx/endgame) — 실제 DB 대신 메모리 판이 함수 호출을 받는다. 보드 화면은 그대로 쓴다
let _demo: ReturnType<typeof makeClient> | null = null;

export function sb() {
  if (_demo) return _demo;
  if (!_sb) _sb = makeClient();
  return _sb;
}

/** 데모 판이 rpc · channel · removeChannel 만 흉내 낸 가짜 클라이언트를 꽂는다(null 이면 뺀다) */
export function setDemoServer(c: unknown) {
  _demo = c as ReturnType<typeof makeClient> | null;
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

/**
 * 끝물 방식(025 · 026) — 가장 낮은 등급(low)만 남았을 때 판을 어떻게 끝내나
 * off 끝까지 · end 피날레 넣고 새 판 · carry 새 판 + 남은 장 · skip 피날레 없이 새 판
 * hidden 피날레가 남은 장 중 1장에 숨어 있다 · given 이 판 피날레가 이미 나갔다 · carried 지난 판에서 넘어온 장
 */
export type FinaleState = {
  mode: 'off' | 'end' | 'carry' | 'skip';
  low?: string;   // 026 전에는 없다
  given: boolean;
  hidden: boolean;
  carried: { grade: string; n: number }[];
};

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
  finale?: FinaleState;   // 025 전에는 없다
};

export type DrawResult = {
  grade: string;
  name: string;
  useWhen: 'now' | 'later';
  image: string | null;
  code: string;
  isLastOne: boolean;
  lastOneName: string | null;
  hidden?: boolean;    // 숨긴 피날레 구간에서 뽑았다
  newBox?: boolean;    // 이 뽑기로 판이 끝나 새 판이 열렸다
  carried?: number;    // 새 판에 섞어 넣은 남은 장
  dropped?: number;    // 새 판을 열며 정리한 남은 장
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
