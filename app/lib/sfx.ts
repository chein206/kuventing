/**
 * 뽑기 소리 — Web Audio 로 합성한다. 음원 파일이 없다.
 *
 * 그라인더 소리는 녹음보다 합성이 쉽다. 화이트노이즈에 밴드패스를 걸고
 * 미는 세기에 따라 필터 주파수와 볼륨을 올리면 그 소리가 된다.
 * 파일이 없으니 로딩도 지연도 용량도 0 이다.
 *
 * 브라우저 규칙 두 가지를 그대로 받아들인다.
 *  1. 사용자가 화면을 만지기 전에는 소리를 못 낸다 → 첫 터치에서 unlock() 을 부른다.
 *     우리 흐름은 손님이 화면을 눌러 시작하므로 자연스럽다.
 *  2. 대기화면(광고)에는 소리를 넣을 수 없다 → 뽑는 순간에만 소리가 난다.
 *     카운터에서는 이게 맞다. 광고 소리가 계속 나면 사장님이 태블릿을 음소거한다.
 */

export type SoundMode = 'off' | 'soft' | 'loud';

// 매장에서 들어 보니 낮았다. 주방 소리·손님 대화를 넘어야 한다.
// 1을 넘겨도 되는 이유는 뒤에 리미터를 달았기 때문이다 (아래 unlock 참고).
const GAIN: Record<SoundMode, number> = { off: 0, soft: 0.62, loud: 1.45 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: GainNode | null = null;   // 잔향으로 보내는 입구
let mode: SoundMode = 'off';

/** 화면을 처음 만졌을 때 부른다. 이 시점에만 오디오를 깨울 수 있다 */
export function unlock(next: SoundMode) {
  mode = next;
  if (next === 'off') return;
  if (!ctx) {
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();

    // 리미터. 팡파레처럼 소리가 여럿 겹칠 때 볼륨을 올리면 찢어진다.
    // 넘치는 부분만 눌러 주면 같은 볼륨에서도 더 크게 들리고 깨지지 않는다.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 3;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.16;

    master.connect(limiter);
    limiter.connect(ctx.destination);

    // 잔향. 음원(IR) 없이 짧은 되울림으로 공간감만 만든다.
    // 이게 없으면 팡파레가 폰 알림음처럼 납작하게 들린다.
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.14;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const damp = ctx.createBiquadFilter();   // 되울릴수록 고역이 깎여 자연스러워진다
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    const send = ctx.createGain();
    send.gain.value = 0;                     // 소리마다 필요한 만큼만 보낸다

    send.connect(delay);
    delay.connect(damp); damp.connect(fb); fb.connect(delay);
    damp.connect(master);
    verb = send;
  }
  master!.gain.value = GAIN[next];
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMode(next: SoundMode) {
  mode = next;
  if (master) master.gain.value = GAIN[next];
}

const on = () => mode !== 'off' && !!ctx && !!master;

/** 1초짜리 화이트노이즈. 한 번 만들어 두고 돌려 쓴다 */
let noiseBuf: AudioBuffer | null = null;
function noise() {
  if (!ctx) return null;
  if (!noiseBuf) {
    const n = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

/* ---------- 개봉 중: 지이익- ---------- */

type Grind = { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode };
let grind: Grind | null = null;

/** 손잡이를 잡으면 시작한다 */
export function grindStart() {
  if (!on() || grind) return;
  const src = noise();
  if (!src || !ctx || !master) return;

  // 밴드패스로 좁게 깎으면 노이즈가 "쇠 갈리는" 소리로 들린다
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 1.4;

  // 고역을 조금 남겨 두면 쇳가루 튀는 잔소리가 생긴다
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 320;

  const g = ctx.createGain();
  g.gain.value = 0;

  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
  src.start();
  grind = { src, bp, g };
}

/**
 * 미는 정도(0~1)에 따라 세기와 음색을 올린다.
 * hush(0~1)는 글자 구간의 숨죽임 — 그만큼 살짝(최대 35%) 낮춰 심장 소리가 묻히지 않게 한다
 */
export function grindSet(t: number, hush = 0) {
  if (!grind || !ctx) return;
  const k = Math.max(0, Math.min(1, t));
  const now = ctx.currentTime;
  grind.g.gain.setTargetAtTime((0.12 + k * 0.5) * (1 - 0.35 * Math.max(0, Math.min(1, hush))), now, 0.05);
  grind.bp.frequency.setTargetAtTime(700 + k * 2100, now, 0.06);
  grind.bp.Q.setTargetAtTime(1.2 + k * 2.4, now, 0.08);
}

export function grindStop() {
  if (!grind || !ctx) return;
  const { src, g } = grind;
  grind = null;
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  setTimeout(() => { try { src.stop(); } catch { /* 이미 멈춤 */ } }, 220);
}

/* ---------- 개봉 중 글자 구간: 두근두근 · 숨죽임 ----------
   글자 구간에 들어서면 화면이 어두워지고 표가 두근거린다. 소리도 같은 박자로 따라간다.
   태블릿 스피커는 저음이 약하다 — "쿵"만으로는 안 들리므로 짧은 가죽 소리("딱")를 섞는다. */

/** 심장 한 번 — strength 0~1(첫 박 1, 둘째 박 0.55 를 화면이 곱해서 준다) */
export function heartbeat(strength: number) {
  if (!on() || !ctx) return;
  const s = Math.max(0, Math.min(1, strength));
  if (s < 0.04) return;
  const t = ctx.currentTime + 0.005;
  tone(t, 140, 52, 0.2, 0.6 * s, 'sine');        // 쿵 — 낮게 떨어진다
  burst(t, 1400, 450, 0.04, 0.26 * s, 1.1);      // 딱 — 작은 스피커에서도 박이 들리게
}

type Hush = { o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; g: GainNode; key: number };
let hush: Hush | null = null;

/**
 * 숨죽이는 긴장음 — 근음과 5도 위가 낮게 깔리고, 글자에 다가갈수록(p) 조금씩 올라가고
 * 숨죽임(k)만큼 커지고 밝아진다. 0 이면 들리지 않는다
 */
export function tensionSet(k: number, p: number) {
  if (!on() || !ctx || !master) return;
  const kk = Math.max(0, Math.min(1, k)), pp = Math.max(0, Math.min(1, p));
  if (!hush) {
    if (kk < 0.02) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o2.detune.value = 9;   // 살짝 어긋나 천천히 일렁인다
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.value = 350;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(); o2.start();
    hush = { o1, o2, lp, g, key: -1 };
  }
  const key = Math.round(kk * 100) * 1000 + Math.round(pp * 100);
  if (key === hush.key) return;
  hush.key = key;
  const now = ctx.currentTime, f = 196 + 60 * pp;   // G3 에서 조금씩 올라간다
  hush.o1.frequency.setTargetAtTime(f, now, 0.15);
  hush.o2.frequency.setTargetAtTime(f * 1.5, now, 0.15);
  hush.lp.frequency.setTargetAtTime(350 + 1400 * kk, now, 0.15);
  hush.g.gain.setTargetAtTime(kk * kk * 0.08, now, 0.15);
}

export function tensionStop() {
  if (!hush || !ctx) return;
  const { o1, o2, g } = hush;
  hush = null;
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  setTimeout(() => { try { o1.stop(); o2.stop(); } catch { /* 이미 멈춤 */ } }, 500);
}

/* ---------- 다 열릴 때: 확정음 ----------
   "티켓이 확정됐다"를 알리는 한 방. 성격이 다른 다섯 가지를 두고 골라 쓴다.
   여는 소리(지익-)가 노이즈라, 확정음은 그와 결이 달라야 끝이 분명해진다. */

export type SnapKind = 'thud' | 'clang' | 'latch' | 'pop' | 'shatter';

export const SNAP_LABEL: Record<SnapKind, string> = {
  thud: '뚝 — 둔탁하게 끊김',
  clang: '챠앙 — 금속 울림',
  latch: '철컥 — 자물쇠 열림',
  pop: '팡 — 코르크 터짐',
  shatter: '쨍 — 유리 깨짐',
};

/** 짧은 노이즈 한 방. 여러 확정음이 공통으로 쓴다 */
function burst(t: number, from: number, to: number, dur: number, vol: number, q = 0.9) {
  if (!ctx || !master) return;
  const src = noise();
  if (!src) return;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

/** 떨어지거나 울리는 톤 */
function tone(
  t: number, from: number, to: number, dur: number, vol: number,
  type: OscillatorType = 'triangle',
) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export function snapOf(kind: SnapKind) {
  if (!on() || !ctx) return;
  const t = ctx.currentTime + 0.01;

  switch (kind) {
    // 지금 쓰던 것. 종이가 끊기는 둔탁한 맛
    case 'thud':
      burst(t, 3200, 600, 0.24, 0.8);
      tone(t, 520, 120, 0.22, 0.34);
      break;

    // 금속을 때린 울림. 여는 소리가 그라인더라 결이 이어진다
    case 'clang':
      burst(t, 6000, 2200, 0.05, 0.5, 1.6);
      // 배음이 딱 맞지 않게 흩어 두면 쇳소리가 된다
      [1850, 2790, 4130, 5600].forEach((f, i) =>
        tone(t + i * 0.004, f, f * 0.985, 0.85 - i * 0.13, 0.2 - i * 0.035, 'sine'));
      tone(t, 320, 210, 0.3, 0.22);
      break;

    // 자물쇠가 풀리는 두 단 클릭. 기계적이고 끝이 분명하다
    case 'latch':
      burst(t, 2600, 900, 0.035, 0.65, 1.4);
      burst(t + 0.055, 4200, 1400, 0.05, 0.8, 1.2);
      tone(t + 0.055, 180, 90, 0.16, 0.34);
      break;

    // 코르크가 빠지는 소리. 축하 쪽으로 기운다
    case 'pop':
      tone(t, 700, 90, 0.09, 0.55, 'sine');
      burst(t + 0.01, 1500, 420, 0.07, 0.45, 0.7);
      burst(t + 0.06, 5200, 3000, 0.22, 0.14, 0.8);   // 뒤에 남는 공기음
      break;

    // 유리가 깨지며 조각이 튄다. 가장 화려하고 날카롭다
    case 'shatter':
      burst(t, 7000, 3000, 0.07, 0.6, 1.1);
      [3300, 4700, 5900, 7300, 2600].forEach((f, i) =>
        tone(t + 0.02 + i * 0.028, f, f * 0.94, 0.3 - i * 0.04, 0.16, 'sine'));
      tone(t, 260, 150, 0.2, 0.2);
      break;
  }
}

/* ---------- 3D 개봉이 다 열린 순간: 휙 + 반짝 ----------
   화면에서는 표가 날아가고 등급 글자에 박이 차오른다. 코르크 "팡"은 태블릿에서 "뚝"으로 들렸다(사장님).
   표가 날아가는 바람 소리 위로, 박이 차오르는 0.1~0.65초 동안 높은 종이 위로 흩뿌려진다.
   금(A·B)은 길고 화려하게, 구리(C)는 중간, 은(D 이하)은 짧게 — 등급 낙차는 결과 팡파레가 이어 받는다. */

/** 휙 — 노이즈를 높은 쪽으로 쓸어 올린다. 앞이 서서히 커져 바람처럼 들린다 */
function whoosh(t: number, from: number, to: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const src = noise();
  if (!src) return;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

/** 반짝이는 음 — 금은 8음, 구리 5음, 은 3음(5음계로 올라간다) */
const SPARK: Record<'gold' | 'copper' | 'silver', number[]> = {
  gold: [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637],
  copper: [1047, 1319, 1568, 2093, 2637],
  silver: [1319, 1760, 2637],
};

export function reveal(grade: string) {
  if (!on() || !ctx || !master) return;
  const g = grade.toUpperCase();
  const metal = g === 'A' || g === 'B' ? 'gold' : g === 'C' ? 'copper' : 'silver';
  const t = ctx.currentTime + 0.01;
  whoosh(t, 500, 4200, 0.34, 0.38);
  SPARK[metal].forEach((f, i) => bell(f, t + 0.1 + i * 0.055, 0.55, 0.16, 0.45));
  // 박 위에 남는 고역 — 쉬이
  const src = noise();
  if (src) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const sg = ctx.createGain();
    const len = metal === 'gold' ? 0.9 : metal === 'copper' ? 0.65 : 0.45;
    sg.gain.setValueAtTime(0.0001, t + 0.1);
    sg.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
    sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.1 + len);
    src.connect(hp); hp.connect(sg); sg.connect(master);
    src.start(t + 0.1); src.stop(t + 0.15 + len);
  }
}

/** 화면에서 부르는 확정음(평면 개봉 화면). 3D 개봉은 reveal() */
let snapKind: SnapKind = 'pop';
export const setSnap = (k: SnapKind) => { snapKind = k; };
export function snap() { snapOf(snapKind); }

/* ---------- 결과: 등급에 따라 ----------
   등급 낙차가 소리로 느껴져야 한다. A 는 화려하게 쏟아지고 E 는 툭 끝난다.
   길이는 줄이지 않는다 — 결과 화면이 40초쯤 떠 있으므로 서두를 이유가 없다. */

type Fan = {
  notes: number[];      // 차례로 오르는 음
  chord: number[];      // 끝에 함께 울리는 화음 (없으면 빈 배열)
  swell: boolean;       // 아래를 받치는 저음
  verb: number;         // 잔향을 보내는 양
  vol: number;
};

const FAN: Record<string, Fan> = {
  // 도-미-솔-도-미 오르고 장3화음으로 착지 + 저음 받침 + 잔향 가득
  A: { notes: [523, 659, 784, 1047, 1319], chord: [1047, 1319, 1568], swell: true,  verb: 0.5,  vol: 0.34 },
  B: { notes: [523, 659, 784, 1047],       chord: [784, 1047],        swell: true,  verb: 0.38, vol: 0.32 },
  C: { notes: [523, 659, 784],             chord: [784],              swell: false, verb: 0.26, vol: 0.3  },
  D: { notes: [523, 784],                  chord: [],                 swell: false, verb: 0.16, vol: 0.28 },
  // E 는 한 음, 잔향도 거의 없다. 툭.
  E: { notes: [659],                       chord: [],                 swell: false, verb: 0.06, vol: 0.26 },
};

/**
 * 종소리 한 음. 배음을 세 겹 쌓고 살짝 어긋나게 두면 금속 종처럼 맑아진다.
 * 사인파 하나만 쓰면 폰 알림음처럼 들린다.
 */
function bell(freq: number, at: number, dur: number, vol: number, send = 0) {
  if (!ctx || !master) return;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  g.connect(master);
  if (send > 0 && verb) {
    const sg = ctx.createGain();
    sg.gain.value = send;
    g.connect(sg); sg.connect(verb);
  }

  // 기음 + 2배음 + 3배음. 배수를 정확히 두지 않아야 종처럼 울린다
  ([[1, 1], [2.005, 0.34], [3.01, 0.13]] as const).forEach(([mul, amp]) => {
    const o = ctx!.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    const og = ctx!.createGain();
    og.gain.value = amp;
    o.connect(og); og.connect(g);
    o.start(at); o.stop(at + dur + 0.03);
  });
}

/** 뽑은 결과가 뜰 때. 피날레 보너스면 금색 한 방을 더 얹는다 */
export function fanfare(grade: string, isLastOne = false) {
  if (!on() || !ctx) return;
  const f = FAN[grade.toUpperCase()] ?? FAN.E;
  const t0 = ctx.currentTime + 0.02;
  const step = 0.09;

  // 오르는 음
  f.notes.forEach((n, i) => bell(n, t0 + i * step, 0.62, f.vol, f.verb));

  // 착지 화음 — 마지막 음 바로 뒤에 함께 울린다
  const end = t0 + f.notes.length * step;
  f.chord.forEach((n, i) => bell(n, end + i * 0.012, 1.5, f.vol * 0.62, f.verb));

  // 저음 받침. 소리에 무게를 준다
  if (f.swell) tone(end - 0.02, f.notes[0] / 2, f.notes[0] / 2, 1.1, 0.2, 'sine');

  if (isLastOne) {
    // 금색 한 방 — 위에서 아래로 쏟아진다
    const top = f.notes[f.notes.length - 1] * 2;
    [0, 1, 2, 3, 4].forEach((i) =>
      bell(top / (1 + i * 0.115), end + 0.28 + i * 0.07, 1.1, 0.24, 0.62));
    tone(end + 0.28, 130, 98, 1.6, 0.18, 'sine');
  }
}
