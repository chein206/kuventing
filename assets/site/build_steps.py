# 홈페이지 HOW IT WORKS(손님 4단계) 화면 — 데모 녹화(rec_hero.mjs)에서 단계마다 한 장씩 뽑는다. 업종마다 한 벌(4초마다 바뀐다)
#   python assets/site/build_steps.py <업종>:<전체 흐름 녹화>:<A 녹화> …      (kuventing 폴더에서, 녹화는 _rec/ 아래 이름)
#   예) python assets/site/build_steps.py beauty:beauty-9:beauty-8 cafe:cafe-how:cafe-win chicken:chicken-how:chicken-win
#   녹화: node assets/site/rec_hero.mjs <업종> how   ·   QUICK=1 node assets/site/rec_hero.mjs <업종> win(빠른 열기라 A)
# 1 보고(대기 화면 · 남은 수) · 2 확인하고(남은 선물 목록) · 3 고르고(표 한 장 고름) · 4 열면, 럭키!(결과 — A 녹화에서)
# → app/public/site/how/<업종>-1..4.jpg (480×768, 홈페이지 기기 틀에 맞춤)
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REC_DIR = os.path.join(HERE, '_rec')
OUT = os.path.join(HERE, '..', '..', 'app', 'public', 'site', 'how')
os.makedirs(OUT, exist_ok=True)

def timeline(rec):
    names, durs = [], []
    for line in open(os.path.join(rec, 'list.txt'), encoding='utf-8'):
        m = re.match(r"file '(.+)'", line)
        if m: names.append(m.group(1))
        m = re.match(r'duration ([\d.]+)', line)
        if m: durs.append(float(m.group(1)))
    t, ts = 0.0, []
    for d in durs:
        ts.append(t); t += d
    return names[:len(ts)], ts

def frame_at(rec, sec):
    names, ts = timeline(rec)
    i = max(j for j, x in enumerate(ts) if x <= sec)
    return Image.open(os.path.join(rec, names[i])).convert('RGB')

def marks(rec):
    m = json.load(open(os.path.join(rec, 'marks.json'), encoding='utf-8'))
    t0 = m['first']
    return {k: v - t0 for k, v in m['marks'].items()}, m['last'] - t0

for arg in sys.argv[1:]:
    slug, how, win = arg.split(':')
    REC, WIN = os.path.join(REC_DIR, how), os.path.join(REC_DIR, win)
    M, _ = marks(REC)
    _, end = marks(WIN)
    shots = [
        (REC, M['attract'] - 0.15),   # 1 보고 — 모션 광고 + 남은 티켓 띠
        (REC, M['list'] - 0.1),       # 2 확인하고 — 등급별 남은 선물
        (REC, M['grid'] - 0.1),       # 3 고르고 — 고른 표가 들려 있다
        (WIN, end - 0.6),             # 4 열면, 럭키! — 결과 카드(A)
    ]
    for i, (rec, sec) in enumerate(shots, start=1):
        p = os.path.join(OUT, f'{slug}-{i}.jpg')
        frame_at(rec, sec).resize((480, 768), Image.LANCZOS).save(p, quality=84, optimize=True, progressive=True)
        print(f'how/{slug}-{i}.jpg {os.path.getsize(p) // 1024}KB  <- {os.path.basename(rec)} {sec:.2f}s')
