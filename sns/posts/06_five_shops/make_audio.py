# 06 소리 시점 — KvReel06.tsx 의 조각 계산과 같게(바꾸면 같이)
import json, os
SH = [("cafe",1.49,4.63,7.79,9.46),("chicken",1.5,4.63,8.0,9.67),("food",1.49,5.54,8.9,10.62),("beauty",1.49,4.63,7.84,9.54),("arven",1.49,5.17,8.31,9.99)]
L = lambda a, b, r=1: int((((b - a) / r) * 30) + 0.5)   # Math.round
ev, at = [], 0
first_result = None
for i, (k, tap, grid, op, pu) in enumerate(SH):
    s1 = L(tap - .6, tap + .3); s2 = L(grid + .3, grid + (.8 if i else 1.1)); s3 = L(op + .3, pu + .45, 1.3 if i else 1); s4 = L(pu + 4.1, pu + (4.6 if i else 5.1))
    if i: ev.append({"f": at, "k": "tick"})
    ev.append({"f": at + 18, "k": "tap"})
    ev.append({"f": at + s1, "k": "tick"})
    ev.append({"f": at + s1 + s2, "k": "grind", "len": int((pu - op - .3) / (1.3 if i else 1) * 30)})
    ev.append({"f": at + s1 + s2 + s3 - 4, "k": "reveal"})
    if i == 0: first_result = at + s1 + s2 + s3
    at += s1 + s2 + s3 + s4
card, logo = at, at + 60; dur = (logo + 75) / 30
ev.append({"f": card, "k": "swoosh"})
spec = {"dur": round(dur, 3), "fps": 30,
        "bgm": {"file": "C:/Users/Nam-PC/Desktop/cld/music/tracks/bgm-kuventing/A_pophouse_s2701.wav", "start": 37.0 - first_result / 30, "gain_db": -7,
                "duck": [], "fade_out": [logo / 30 - 0.3, dur - 0.05]},
        "logo": {"file": "C:/Users/Nam-PC/Desktop/cld/kuventing/sns/brand/logo/motion/kuventing-logo-sfx.wav", "at_frame": logo, "gain_db": -2},
        "clips": [{"file": "C:/Users/Nam-PC/Desktop/cld/kuventing/app/public/snd/fanfare-silver.mp3", "at_frame": first_result, "gain_db": -9, "len": 1.0}],
        "events": ev}
json.dump(spec, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("card", card, "logo", logo, "dur", round(dur, 2), "first_result", first_result, "bgm start", round(spec["bgm"]["start"], 2))
