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

/** 미는 정도(0~1)에 따라 세기와 음색을 올린다 */
export function grindSet(t: number) {
  if (!grind || !ctx) return;
  const k = Math.max(0, Math.min(1, t));
  const now = ctx.currentTime;
  grind.g.gain.setTargetAtTime(0.12 + k * 0.5, now, 0.05);
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

/** 화면에서 부르는 확정음. 기본값은 아래 DEFAULT_SNAP */
let snapKind: SnapKind = 'pop';
export const setSnap = (k: SnapKind) => { snapKind = k; };
export function snap() { snapOf(snapKind); }

/* ---------- 결과: 등급에 따라 ---------- */

// 등급이 높을수록 음이 많고 길다. E 는 한 음만 짧게.
const TUNE: Record<string, number[]> = {
  A: [523, 659, 784, 1047, 1319],
  B: [523, 659, 784, 1047],
  C: [523, 659, 784],
  D: [523, 784],
  E: [659],
};

function ping(freq: number, at: number, dur: number, vol: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  // 배음을 하나 얹으면 종소리처럼 맑아진다
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2.01;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  const g2 = ctx.createGain();
  g2.gain.value = 0.3;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
  o.start(at); o.stop(at + dur + 0.02);
  o2.start(at); o2.stop(at + dur + 0.02);
}

/** 뽑은 결과가 뜰 때. 막차 보너스면 한 옥타브 위로 한 번 더 */
export function fanfare(grade: string, isLastOne = false) {
  if (!on() || !ctx) return;
  const notes = TUNE[grade.toUpperCase()] ?? TUNE.E;
  const t0 = ctx.currentTime + 0.02;
  notes.forEach((f, i) => ping(f, t0 + i * 0.085, 0.5, 0.34));

  if (isLastOne) {
    // 금색 한 방 — 위에서 아래로 쏟아지는 느낌
    const top = notes[notes.length - 1] * 2;
    [0, 1, 2, 3].forEach((i) => ping(top / (1 + i * 0.12), t0 + 0.42 + i * 0.06, 0.7, 0.26));
  }
}
