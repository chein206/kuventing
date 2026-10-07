/**
 * 끝물 데모 판 — 실제 DB 대신 메모리에서 돈다. DB 에는 아무것도 쓰지 않는다.
 * 규칙은 supabase/025 · 026 의 draw · open_new_box · endgame_apply 를 그대로 옮겼다.
 * 보드 화면(BoardClient)은 손대지 않고, rpc · channel 만 흉내 낸 가짜 클라이언트를 꽂아 쓴다.
 */
export type Mode = 'off' | 'end' | 'carry' | 'skip';
type Tk = { pos: number; grade: string; drawn: boolean; from: number | null };

export const MODES: [Mode, string][] = [
  ['off', '끝까지'],
  ['end', '피날레 넣고 새 판'],
  ['carry', '새 판 + 남은 장'],
  ['skip', '피날레 없이 새 판'],
];

/** 업종 데모 한 벌 — 판 · 글꼴 · 매장 · 회차 제목 · 뽑는 조건 · 상품 · 피날레 */
export type DemoPrize = { grade: string; name: string; qty: number; useWhen: 'now' | 'later'; image: string | null };
/** 대기 화면 광고 — 사진이 있으면 첫 장이 모션 광고가 된다(MotionAd) */
export type DemoPromo = { title: string; sub?: string; price?: string; image: string; pos?: string; kicker?: string };
export type DemoPreset = {
  theme: string;
  font: string;
  title: string;
  drawVerb: string;
  store: { name: string; branch: string | null; logo: string | null };
  prizes: DemoPrize[];
  finale: { name: string; image: string | null; label: string };
  /** 대기 화면 광고 사진 */
  promos?: DemoPromo[];
  /** 끝물 방식 — 없으면 피날레 넣고 새 판 */
  mode?: Mode;
  /** 처음부터 나간 장 — 빈 판보다 몇 장 빠진 판이 "남은 수"를 보여 준다. 상위 등급은 남긴다 */
  drawn?: number;
};

// 멘야 코바야시와 같은 구성(50장). 사진은 /fx 데모 것을 쓴다
export const FOOD_DEMO: DemoPreset = {
  theme: 'dark-west', font: 'system', title: '오픈 기념 뽑기', drawVerb: '주문',
  store: { name: '데모 매장', branch: '끝물 시험', logo: null },
  prizes: [
    { grade: 'A', name: '차슈덮밥 세트 무료', qty: 2, useWhen: 'now', image: '/fx/prize-a.jpg' },
    { grade: 'B', name: '라멘 1그릇 무료', qty: 5, useWhen: 'now', image: '/demo/food/b-ramen.jpg' },
    { grade: 'C', name: '교자 무료', qty: 5, useWhen: 'now', image: '/fx/prize-c.jpg' },
    { grade: 'D', name: '음료 무료', qty: 8, useWhen: 'later', image: '/demo/food/d-soda.jpg' },
    { grade: 'E', name: '1,000원 할인', qty: 30, useWhen: 'later', image: '/art/coupon-1000.svg' },
  ],
  finale: { name: '차슈덮밥 세트 + 굿즈', image: '/fx/prize-last.jpg', label: '피날레 보너스' },
};

const shuffle = <X,>(a: X[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from({ length: 6 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export class EndgameSim {
  mode: Mode;
  box = 1;
  t: Tk[] = [];
  given = false;      // 이 판 피날레가 나갔다
  force = false;      // 데모 — 다음 뽑기에서 숨긴 피날레가 나오게
  log: string[] = [];
  private subs = new Set<() => void>();     // 데모 조작판
  private boards = new Set<() => void>();   // 보드 화면(실시간 알림 대신)

  constructor(readonly p: DemoPreset) {
    this.mode = p.mode ?? 'end';
    this.t = this.fresh();
    // 처음부터 몇 장 빠진 판 — 아래 등급부터 고르게(상위 등급은 손님이 뽑을 몫으로 남긴다)
    if (p.drawn) {
      const low = shuffle(this.t.filter((x) => x.grade >= 'C'));
      for (const x of low.slice(0, p.drawn)) x.drawn = true;
    }
  }
  get theme() { return this.p.theme; }

  // ---------- 판 ----------
  private fresh(carried: { grade: string; from: number }[] = []): Tk[] {
    const all = [
      ...this.p.prizes.flatMap((p) => Array.from({ length: p.qty }, () => ({ grade: p.grade, from: null as number | null }))),
      ...carried,
    ];
    return shuffle(all).map((x, i) => ({ pos: i + 1, grade: x.grade, drawn: false, from: x.from }));
  }

  /** 가장 낮은 등급 · 남은 장 · 가장 낮은 등급만 남았나(판에 등급이 둘 이상일 때만) */
  state() {
    const low = this.t.reduce((m, x) => (x.grade > m ? x.grade : m), 'A');
    const grades = new Set(this.t.map((x) => x.grade)).size;
    const rest = this.t.filter((x) => !x.drawn);
    return { low, rest, left: rest.length, tail: grades >= 2 && rest.length > 0 && rest.every((x) => x.grade === low) };
  }

  /** 피날레가 남은 장 중 1장에 숨어 있다 */
  hidden() {
    return (this.mode === 'end' || this.mode === 'carry') && !this.given && this.state().tail;
  }

  /** 새 판 — 남은 장을 섞어 넣으면 그 수를 돌려준다 */
  private open(carry: boolean) {
    const rest = this.t.filter((x) => !x.drawn);
    const from = this.box;
    this.box += 1;
    this.given = false;
    this.force = false;
    this.t = this.fresh(carry ? rest.map((x) => ({ grade: x.grade, from })) : []);
    return carry ? rest.length : 0;
  }

  // ---------- 뽑기 (026 draw 와 같은 규칙) ----------
  draw(pos: number) {
    const tk = this.t.find((x) => x.pos === pos && !x.drawn);
    if (!tk) throw new Error('TICKET_TAKEN');
    const before = this.state();
    const hidden = this.hidden();
    const box = this.box;

    tk.drawn = true;
    const left = before.left - 1;
    const isLast = !this.given && (hidden ? this.force || Math.random() * before.left < 1 : left === 0);
    if (isLast) this.given = true;

    let next = false, carry = false, newBox = false, carried = 0, dropped = 0;
    if (this.mode !== 'off') {
      if (isLast || left === 0) { next = true; carry = this.mode === 'carry'; }
      else if (this.mode === 'skip') next = this.state().tail;
      if (next) { carried = this.open(carry); newBox = true; dropped = left - carried; }
    }

    const p = this.p.prizes.find((x) => x.grade === tk.grade)!;
    const F = this.p.finale;
    const c = code();
    this.say(`${box}회차 ${pos}번 ${tk.grade}${isLast ? ` + ${F.label}` : ''}`
      + (newBox ? ` → ${this.box}회차 새 판${carried ? ` (남은 ${carried}장 섞음)` : dropped ? ` (남은 ${dropped}장 정리)` : ''}` : ''));
    this.changed(hidden);
    return {
      grade: tk.grade, name: p.name, useWhen: p.useWhen, image: p.image,
      code: `${c.slice(0, 3)}-${c.slice(3)}`,
      isLastOne: isLast,
      lastOneName: isLast ? F.name : null,
      lastOneLabel: isLast ? F.label : null,
      hidden, newBox, carried, dropped,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      left, position: pos,
    };
  }

  // ---------- 서버 응답 ----------
  config() {
    return {
      campaignId: 'demo', title: this.p.title, status: 'live', theme: this.p.theme, mode: 'open', ads: this.p.promos ?? [],
      idleSeconds: 120, slideSeconds: 6, resultSeconds: 25, autoOpenSeconds: 45, sound: 'soft', motionSeconds: 6,
      font: this.p.font, drawVerb: this.p.drawVerb,
      lastOneName: this.p.finale.name, lastOneImage: this.p.finale.image, lastOneLabel: this.p.finale.label,
      store: this.p.store,
    };
  }

  board() {
    const s = this.state();
    const carried = new Map<string, number>();
    for (const x of this.t) if (x.from !== null) carried.set(x.grade, (carried.get(x.grade) ?? 0) + 1);
    return {
      campaign: {
        id: 'demo', title: this.p.title, status: 'live', theme: this.p.theme,
        total: this.t.length, endsAt: null, box: this.box,
        lastOneName: this.p.finale.name, lastOneImage: this.p.finale.image, store: this.p.store,
      },
      prizes: this.p.prizes.map((p) => ({ ...p, left: s.rest.filter((x) => x.grade === p.grade).length })),
      board: [...this.t].sort((a, b) => a.pos - b.pos).map((x) => ({ pos: x.pos, grade: x.drawn ? x.grade : null })),
      left: s.left,
      finale: {
        mode: this.mode, low: s.low, given: this.given, hidden: this.hidden(),
        carried: [...carried].sort().map(([grade, n]) => ({ grade, n })),
      },
    };
  }

  /** 보드가 부르는 supabase 클라이언트 흉내 — rpc · channel · removeChannel 만 */
  readonly client = {
    rpc: async (fn: string, a: Record<string, unknown> = {}) => {
      await new Promise((r) => setTimeout(r, 150));   // 실제 서버처럼 조금 늦게
      try {
        if (fn === 'get_board_config') return { data: this.config(), error: null };
        if (fn === 'get_board') return { data: this.board(), error: null };
        if (fn === 'open_session') return { data: { ok: true, pass: 'DEMO', left: this.state().left }, error: null };
        if (fn === 'draw') return { data: this.draw(Number(a.p_position)), error: null };
        return { data: null, error: { message: `DEMO_NO_${fn}` } };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    channel: () => {
      const ch = {
        cb: null as (() => void) | null,
        on: (_e: string, _f: unknown, cb: () => void) => { ch.cb = cb; this.boards.add(cb); return ch; },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: (ch: { cb: (() => void) | null }) => { if (ch.cb) this.boards.delete(ch.cb); },
  };

  // ---------- 데모 조작 ----------
  /** 사장님이 방식을 바꾼 직후와 같다(026 endgame_apply) */
  setMode(m: Mode) {
    const was = this.hidden();
    this.mode = m;
    const s = this.state();
    this.say(`방식: ${MODES.find(([k]) => k === m)![1]}`);
    if ((m === 'skip' && s.tail) || (m !== 'off' && s.left === 0)) {
      const from = this.box;
      this.open(false);
      this.say(`${from}회차 → ${this.box}회차 새 판${s.left ? ` (${s.low} ${s.left}장 정리)` : ''}`);
    }
    this.changed(was);
  }

  /** 사장님이 손으로 새 박스 — 남은 장은 '새 판 + 남은 장'일 때만 섞는다 */
  newBox() {
    const was = this.hidden();
    const from = this.box;
    const n = this.open(this.mode === 'carry');
    this.say(`${from}회차 → ${this.box}회차 새 판(손으로)${n ? ` (남은 ${n}장 섞음)` : ''}`);
    this.changed(was);
  }

  /** 앞에서 다 뽑혀 가장 낮은 등급만 n 장 남은 판 */
  lowOnly(n = 7) {
    const was = this.hidden();
    this.t = this.fresh();
    const low = this.state().low;
    let keep = n;
    for (const x of this.t) {
      if (x.grade === low && keep > 0) { keep--; continue; }
      x.drawn = true;
    }
    this.given = false;
    this.say(`${this.box}회차를 ${low}만 ${n}장 남은 판으로`);
    if (this.mode === 'skip') {
      const from = this.box;
      this.open(false);
      this.say(`${from}회차 → ${this.box}회차 새 판 (${low} ${n}장 정리 — 피날레 없이 새 판)`);
    }
    this.changed(was);
  }

  /** 상위 등급 1장 + 가장 낮은 등급 n 장 — 그 1장을 뽑는 순간 끝물이 시작된다 */
  oneUpper(n = 7) {
    const was = this.hidden();
    this.t = this.fresh();
    const low = this.state().low;
    let keep = n, upper = 1;
    for (const x of this.t) {
      if (x.grade === low && keep > 0) { keep--; continue; }
      if (x.grade === 'D' && upper > 0) { upper--; continue; }
      x.drawn = true;
    }
    this.given = false;
    this.say(`${this.box}회차를 D 1장 + ${low} ${n}장 남은 판으로`);
    this.changed(was);
  }

  /**
   * 빠른 열기(홈페이지 첫 화면) — 맨 윗등급이 든 칸 하나를 골라 준다. 남은 게 없으면 새 판을 열고 고른다.
   * 결과를 조작하지 않고 그 등급이 든 칸을 집어 줄 뿐이라, 판 · 남은 수 · 결과 화면은 평소 뽑기와 같다.
   */
  pickTop(): number {
    const top = this.p.prizes[0].grade;
    let tk = this.t.find((x) => !x.drawn && x.grade === top);
    if (!tk) {
      // 새 판을 열되 보드에 알리지는 않는다 — 알리면 보드가 판을 다시 받으면서 개봉 화면의 뽑기가 두 번 나가
      // 「방금 나간 티켓」이 된다. 곧 이어지는 뽑기가 알리므로 그때 새 판이 같이 들어간다
      this.open(false);
      this.say(`${this.box}회차 새 판(빠른 열기)`);
      tk = this.t.find((x) => !x.drawn && x.grade === top)!;
    }
    return tk.pos;
  }

  /** 다른 손님 한 명이 아무 칸이나 뽑는다 */
  otherDraw() {
    const rest = this.state().rest;
    if (!rest.length) { this.say('남은 장이 없습니다 — 새 판을 여세요'); this.changed(this.hidden()); return; }
    this.draw(rest[Math.floor(Math.random() * rest.length)].pos);
  }

  toggleForce() {
    this.force = !this.force;
    this.changed(this.hidden());
  }

  // ---------- 알림 ----------
  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }
  private say(line: string) {
    this.log = [line, ...this.log].slice(0, 12);
  }
  private changed(wasHidden: boolean) {
    const s = this.state();
    if (!wasHidden && this.hidden()) this.say(`${s.low}만 ${s.left}장 — 피날레가 그중 1장에 숨음`);
    this.subs.forEach((f) => f());
    this.boards.forEach((f) => f());
  }
}
