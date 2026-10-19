# 쿠벤팅 모션 로고 소리 — 판(app/lib/sfx.ts)과 같은 재료로 합성
#   집힘 = burst(1400→450, 0.04s) · 넘김 = grind(밴드패스 노이즈 700→2800Hz, 세기 0.12→0.62)
#   날아감 = whoosh(500→4200, 0.34s) · 글자 = 은(silver) 반짝 종 3음 · 착지 = 심장 「쿵」(140→52Hz)
# python sfx.py out.wav   (프레임은 KuventingLogo.tsx 타임라인 T 와 맞춤, 30fps)
import sys
import numpy as np
from scipy.signal import iirpeak, lfilter, butter
import soundfile as sf

SR, DUR, FPS = 48000, 2.5, 30
rng = np.random.default_rng(7)
out = np.zeros(int(SR * DUR))
fr = lambda n: n / FPS


def put(sig, t):
    i = int(t * SR)
    n = min(len(sig), len(out) - i)
    out[i:i + n] += sig[:n]


def sweep_bandpass(x, f0, f1, q0, q1, curve="exp"):
    """주파수가 움직이는 밴드패스 — 256 샘플 조각마다 계수를 바꿔 끼운다"""
    y, zi, blk = np.zeros_like(x), None, 256
    n = len(x)
    for s in range(0, n, blk):
        k = s / max(1, n - 1)
        f = f0 * (f1 / f0) ** k if curve == "exp" else f0 + (f1 - f0) * k
        q = q0 + (q1 - q0) * k
        b, a = iirpeak(min(f, SR / 2 - 100), q, fs=SR)
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        y[s:s + blk], zi = lfilter(b, a, x[s:s + blk], zi=zi)
    return y


def burst(t, f0, f1, dur, vol, q=0.9):
    n = int(dur * SR)
    x = sweep_bandpass(rng.standard_normal(n), f0, f1, q, q)
    env = vol * np.exp(np.linspace(0, np.log(0.001), n))
    put(x * env, t)


def tone(t, f0, f1, dur, vol, kind="sine"):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (tt / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    w = np.sin(ph) if kind == "sine" else 2 / np.pi * np.arcsin(np.sin(ph))
    env = np.minimum(tt / 0.006, 1) * np.exp(np.linspace(0, np.log(0.001), n))
    put(w * env * vol, t)


def grind(t0, t1):
    n = int((t1 - t0) * SR)
    k = np.linspace(0, 1, n)
    x = rng.standard_normal(n)
    b, a = butter(2, 320, "highpass", fs=SR)
    x = lfilter(b, a, x)
    x = sweep_bandpass(x, 700, 2800, 1.2, 3.6, curve="lin")
    g = 0.12 + 0.5 * k ** 1.6
    g *= np.minimum(np.arange(n) / (0.02 * SR), 1) * np.minimum((n - np.arange(n)) / (0.05 * SR), 1)
    put(x * g, t0)


def whoosh(t, f0, f1, dur, vol):
    n = int(dur * SR)
    x = sweep_bandpass(rng.standard_normal(n), f0, f1, 0.8, 0.8)
    a = int(n * 0.35)
    env = np.concatenate([np.exp(np.linspace(np.log(1e-4), np.log(vol), a)),
                          np.exp(np.linspace(np.log(vol), np.log(0.001), n - a))])
    put(x * env, t)


def bell(freq, t, dur, vol):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    w = sum(amp * np.sin(2 * np.pi * freq * mul * tt) for mul, amp in ((1, 1), (2.005, 0.34), (3.01, 0.13)))
    env = np.minimum(tt / 0.014, 1) * vol * np.exp(np.linspace(0, np.log(0.0008), n))
    put(w * env, t)


def hiss(t, dur, vol):
    n = int(dur * SR)
    b, a = butter(2, 6500, "highpass", fs=SR)
    x = lfilter(b, a, rng.standard_normal(n))
    k = np.arange(n) / n
    env = np.where(k < 0.15, vol * k / 0.15, vol * np.exp(np.log(0.016) * (k - 0.15) / 0.85))
    put(x * env, t)


# ── 타임라인 (KuventingLogo.tsx T) ──
burst(fr(2), 1400, 450, 0.04, 0.30, 1.1)       # 집힘 — 딱
grind(fr(6), fr(19))                            # 넘김 — 판에서 밀 때 나는 그 소리
whoosh(fr(18), 500, 4200, 0.34, 0.38)           # 날아감 — 휙
burst(fr(21), 1600, 600, 0.035, 0.18, 1.2)      # K표 귀퉁이 접힘 — 작은 딱
for i, f in enumerate([1319, 1760, 2637]):      # 글자 열림 — 은 반짝 3음
    bell(f, fr(30) + i * 0.055, 0.7, 0.16)
hiss(fr(30), 0.45, 0.05)
tone(fr(35), 140, 52, 0.22, 0.6)                # 착지 — 쿵
burst(fr(35), 1400, 450, 0.04, 0.2, 1.1)

# 잔향 — 판처럼 IR 없이 짧은 되울림(감쇠 + 저역 통과)
wet = np.zeros_like(out)
b, a = butter(1, 3200, "lowpass", fs=SR)
for d, g in ((0.029, 0.32), (0.043, 0.26), (0.061, 0.2), (0.083, 0.15), (0.11, 0.1)):
    i = int(d * SR)
    wet[i:] += out[:-i] * g
out = out + lfilter(b, a, wet) * 0.6
fade = int(0.08 * SR)
out[-fade:] *= np.linspace(1, 0, fade)
out /= max(1e-9, np.abs(out).max()) / 0.8
sf.write(sys.argv[1], np.stack([out, out], 1).astype(np.float32), SR)
print("ok", sys.argv[1])
