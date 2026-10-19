# 쿠벤팅 릴스 소리 — 판(app/lib/sfx.ts)과 같은 재료로 효과음을 합성하고 BGM · 모션 로고 소리와 섞는다
#   python reel_sfx.py spec.json out.wav
# spec: {"dur":15.5, "fps":30,
#        "bgm":{"file":..., "start":14.0, "gain_db":-6, "fade_out":[13.0,15.5], "duck":[[13.0,15.5,-6]]},
#        "logo":{"file":..., "at_frame":390},
#        "events":[{"f":147,"k":"tap"}, {"f":267,"k":"grind","len":36}, {"f":303,"k":"reveal"}, ...]}
# k: tap(누름 딱) · tick(작은 딱) · grind(밀어서 열기, len 프레임) · reveal(휙 + 은 종 3음) · thump(쿵) · swoosh(넘김 휙)
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import iirpeak, lfilter, butter, resample_poly

SR = 48000
rng = np.random.default_rng(11)
spec = json.load(open(sys.argv[1], encoding="utf-8"))
FPS = spec.get("fps", 30)
out = np.zeros(int(SR * spec["dur"]))


def put(sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(out): return
    n = min(len(sig), len(out) - i)
    out[i:i + n] += sig[:n] * gain


def sweep_bp(x, f0, f1, q0, q1, lin=False):
    y, zi, blk, n = np.zeros_like(x), None, 256, len(x)
    for s in range(0, n, blk):
        k = s / max(1, n - 1)
        f = f0 + (f1 - f0) * k if lin else f0 * (f1 / f0) ** k
        b, a = iirpeak(min(f, SR / 2 - 100), q0 + (q1 - q0) * k, fs=SR)
        if zi is None: zi = np.zeros(max(len(a), len(b)) - 1)
        y[s:s + blk], zi = lfilter(b, a, x[s:s + blk], zi=zi)
    return y


def burst(t, f0, f1, dur, vol, q=0.9):
    n = int(dur * SR)
    put(sweep_bp(rng.standard_normal(n), f0, f1, q, q) * vol * np.exp(np.linspace(0, np.log(0.001), n)), t)


def tone(t, f0, f1, dur, vol):
    n = int(dur * SR); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (tt / dur)) / SR
    put(np.sin(ph) * np.minimum(tt / 0.006, 1) * np.exp(np.linspace(0, np.log(0.001), n)) * vol, t)


def grind(t, dur):
    n = int(dur * SR); k = np.linspace(0, 1, n)
    b, a = butter(2, 320, "highpass", fs=SR)
    x = sweep_bp(lfilter(b, a, rng.standard_normal(n)), 700, 2800, 1.2, 3.6, lin=True)
    g = (0.12 + 0.5 * k ** 1.6) * np.minimum(np.arange(n) / (0.02 * SR), 1) * np.minimum((n - np.arange(n)) / (0.05 * SR), 1)
    put(x * g, t)


def whoosh(t, f0, f1, dur, vol):
    n = int(dur * SR); a = int(n * 0.35)
    env = np.concatenate([np.exp(np.linspace(np.log(1e-4), np.log(vol), a)), np.exp(np.linspace(np.log(vol), np.log(0.001), n - a))])
    put(sweep_bp(rng.standard_normal(n), f0, f1, 0.8, 0.8) * env, t)


def bell(freq, t, dur, vol):
    n = int(dur * SR); tt = np.arange(n) / SR
    w = sum(amp * np.sin(2 * np.pi * freq * m * tt) for m, amp in ((1, 1), (2.005, 0.34), (3.01, 0.13)))
    put(w * np.minimum(tt / 0.014, 1) * vol * np.exp(np.linspace(0, np.log(0.0008), n)), t)


for e in spec["events"]:
    t, k = e["f"] / FPS, e["k"]
    if k == "tap": burst(t, 1400, 450, 0.04, 0.30, 1.1); tone(t, 900, 600, 0.05, 0.08)
    elif k == "tick": burst(t, 1800, 700, 0.03, 0.16, 1.2)
    elif k == "grind": grind(t, e["len"] / FPS)
    elif k == "reveal":
        whoosh(t, 500, 4200, 0.34, 0.38)
        for i, f in enumerate([1319, 1760, 2637]): bell(f, t + 0.1 + i * 0.055, 0.6, 0.16)
    elif k == "thump": tone(t, 140, 52, 0.22, 0.6); burst(t, 1400, 450, 0.04, 0.2, 1.1)
    elif k == "swoosh": whoosh(t, 400, 2600, 0.26, 0.22)

# 잔향
wet = np.zeros_like(out); b, a = butter(1, 3200, "lowpass", fs=SR)
for d, g in ((0.029, 0.32), (0.043, 0.26), (0.061, 0.2), (0.083, 0.15)):
    i = int(d * SR); wet[i:] += out[:-i] * g
fx = out + lfilter(b, a, wet) * 0.6
fx = np.stack([fx, fx], 1)


def load(path):
    x, sr = sf.read(path, always_2d=True)
    if sr != SR: x = resample_poly(x, SR, sr, axis=0)
    return x[:, :2] if x.shape[1] >= 2 else np.repeat(x, 2, 1)


mix = fx * 10 ** (spec.get("fx_db", 0) / 20)
if "bgm" in spec:
    bg = spec["bgm"]; x = load(bg["file"])
    s = int(bg["start"] * SR); seg = x[s:s + len(out)]
    seg = np.pad(seg, ((0, len(out) - len(seg)), (0, 0)))
    env = np.ones(len(out)) * 10 ** (bg.get("gain_db", 0) / 20)
    tt = np.arange(len(out)) / SR
    for a0, a1, db in bg.get("duck", []):
        env *= np.where((tt >= a0) & (tt < a1), 10 ** (db / 20), 1.0)
    if "fade_out" in bg:
        f0, f1 = bg["fade_out"]; env *= np.clip((f1 - tt) / (f1 - f0), 0, 1) ** 1.5
    fi = int(0.03 * SR); env[:fi] *= np.linspace(0, 1, fi)
    mix = mix + seg * env[:, None]
if "logo" in spec:
    lg = load(spec["logo"]["file"]); put_at = int(spec["logo"]["at_frame"] / FPS * SR)
    n = min(len(lg), len(out) - put_at); mix[put_at:put_at + n] += lg[:n] * 10 ** (spec["logo"].get("gain_db", 0) / 20)
for c in spec.get("clips", []):   # 판에서 실제로 나는 녹음 소리(팡파레 등) — len 초에서 잘라 0.15초 페이드
    x = load(c["file"]); i0 = int(c["at_frame"] / FPS * SR)
    if "len" in c:
        x = x[:int(c["len"] * SR)].copy(); fo = min(len(x), int(0.15 * SR)); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
    n = min(len(x), len(out) - i0); mix[i0:i0 + n] += x[:n] * 10 ** (c.get("gain_db", 0) / 20)
mix /= max(1e-9, np.abs(mix).max()) / 0.85
sf.write(sys.argv[2], mix.astype(np.float32), SR)
print("ok", sys.argv[2], round(len(out) / SR, 2))
