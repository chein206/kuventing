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

const GAIN: Record<SoundMode, number> = { off: 0, soft: 0.22, loud: 0.6 };

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
    master.connect(ctx.destination);
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

/* ---------- 다 열릴 때: 짜악 ---------- */

export function snap() {
  if (!on() || !ctx || !master) return;
  const t = ctx.currentTime;

  // 짧은 노이즈 버스트 — 종이가 찢어지는 순간
  const src = noise();
  if (src) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.22);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.75, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.3);
  }

  // 아래로 떨어지는 톤 — 무게를 준다
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.3, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(og); og.connect(master);
  o.start(t); o.stop(t + 0.26);
}

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
