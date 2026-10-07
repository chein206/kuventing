# 홈페이지(/site) 그림 · 영상 굽기 — 데모 녹화(rec_hero.mjs)에서 히어로 영상 · 3D 개봉 조각 · 단계 화면을 뽑고,
# 이미 있는 상품 사진 · 티켓 원판을 홈페이지 크기로 줄인다.
#   python assets/site/build_assets.py <녹화 폴더(B 이상 당첨 판)> <QR 쿠폰이 나온 녹화 폴더>   (kuventing 폴더에서)
# 녹화 폴더 = rec_hero.mjs 가 만든 f/*.jpg · list.txt(가변 간격) · marks.json
import json, os, re, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', '..', 'app')
PUB = os.path.join(APP, 'public')
OUT = os.path.join(PUB, 'site')
REC, REC_QR = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(OUT, 'm'), exist_ok=True)
os.makedirs(os.path.join(OUT, 't'), exist_ok=True)

def timeline(rec):
    """프레임마다 녹화 시작에서 몇 초인지 — list.txt 의 duration 을 쌓는다"""
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
    i = min(range(len(ts)), key=lambda k: abs(ts[k] - sec))
    return Image.open(os.path.join(rec, names[i])).convert('RGB')

def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

def size(p):
    return f'{os.path.getsize(p) // 1024}KB'

marks = json.load(open(os.path.join(REC, 'marks.json'), encoding='utf-8'))
t0 = marks['first']
M = {k: v - t0 for k, v in marks['marks'].items()}
end = marks['last'] - t0

# 1) 히어로 — 한 바퀴 통째(대기 → 고르기 → 열기 → 결과). 끝은 어둡게 닫고 처음은 어둠에서 열어 이음매를 숨긴다
src = os.path.join(REC, 'list.txt')
fade = f'fade=t=in:st=0:d=0.45,fade=t=out:st={end - 0.55:.2f}:d=0.55'
ff('-f', 'concat', '-safe', '0', '-i', src, '-vf', f'fps=30,scale=720:-2:flags=lanczos,{fade}',
   '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
   os.path.join(OUT, 'hero.mp4'))
# webm(VP9)은 금가루 · 색종이가 많아 mp4 보다 안 작았다 — mp4 하나만 쓴다
# 첫 화면(포스터) — 영상 첫 프레임과 같은 장면이라 재생이 시작돼도 튀지 않는다(첫 0.45초는 어둠에서 열리므로 0.5초 지점)
frame_at(REC, 0.5).resize((720, 1152), Image.LANCZOS).save(os.path.join(OUT, 'hero.jpg'), quality=82, optimize=True, progressive=True)

# 2) 3D 개봉 조각 — 표가 열리고 금빛이 터져 결과 카드가 돌아 나올 때까지. 세로 화면 그대로(기능 칸이 세로로 길다)
a, b = M['open'] - 0.2, min(end, M['pulled'] + 3.6)
ff('-f', 'concat', '-safe', '0', '-i', src, '-vf',
   f'fps=30,trim=start={a:.2f}:end={b:.2f},setpts=PTS-STARTPTS,scale=480:768:flags=lanczos,'
   f'fade=t=in:st=0:d=0.3,fade=t=out:st={b - a - 0.4:.2f}:d=0.4',
   '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
   os.path.join(OUT, 'open.mp4'))
frame_at(REC, M['open'] - 0.2).resize((480, 768), Image.LANCZOS) \
    .save(os.path.join(OUT, 'open.jpg'), quality=82, optimize=True)
# 남은 티켓 판(대기 화면 아래 띠) — 「남은 수가 보이는 판」 칸에 실제 화면으로
frame_at(REC, M['attract'] - 0.15).crop((0, 896, 800, 1226)).save(os.path.join(OUT, 'board-strip.jpg'), quality=84, optimize=True)

# 3) 단계 화면 네 장 — 누르면 시작 · 남은 표에서 한 장 · 밀어서 열기 · 결과
for i, sec in enumerate([M['attract'] - 0.15, M['grid'] - 0.1, M['pulled'] + 0.45, end - 0.6], start=1):
    frame_at(REC, sec).resize((720, 1152), Image.LANCZOS).save(os.path.join(OUT, f'step-{i}.jpg'), quality=82, optimize=True, progressive=True)

# 4) QR 쿠폰 — 나중에 쓰는 상품 결과 화면의 쿠폰 칸(하단)만
mq = json.load(open(os.path.join(REC_QR, 'marks.json'), encoding='utf-8'))
qr = frame_at(REC_QR, mq['last'] - mq['first'] - 0.6)
qr.crop((130, 680, 670, 1080)).save(os.path.join(OUT, 'coupon.jpg'), quality=85, optimize=True)

# 5) 상품 띠 — 업종이 섞이게 번갈아. 정사각 480
MARQUEE = [
    ('demo/arven/a-golfbag.jpg', 'golfbag'), ('img/prize-cafe-b.jpg', 'cake'), ('demo/beauty/a-fullset.jpg', 'fullset'),
    ('demo/food/b-ramen.jpg', 'ramen'), ('demo/arven/b-umbrella.jpg', 'umbrella'), ('img/prize-cafe-c.jpg', 'einspanner'),
    ('demo/beauty/b-serum.jpg', 'serum'), ('fx/prize-c.jpg', 'gyoza'), ('demo/arven/e-coffee.jpg', 'coffee'),
    ('demo/beauty/finale.jpg', 'giftset'), ('fx/prize-a.jpg', 'donburi'), ('demo/arven/c-tumbler.jpg', 'tumbler'),
]
for rel, name in MARQUEE:
    im = Image.open(os.path.join(PUB, rel)).convert('RGB')
    s = min(im.size); l, t = (im.width - s) // 2, (im.height - s) // 2
    im.crop((l, t, l + s, t + s)).resize((480, 480), Image.LANCZOS).save(os.path.join(OUT, 'm', f'{name}.jpg'), quality=80, optimize=True, progressive=True)

# 6) 티켓 원판 — 테마 칸에 겹쳐 놓는다(투명 PNG, 폭 640)
for name in ['letterpress', 'brass', 'arven', 'beauty']:
    im = Image.open(os.path.join(PUB, 'photo', f'ticket-{name}.png')).convert('RGBA')
    k = 640 / im.width
    im.resize((640, round(im.height * k)), Image.LANCZOS).save(os.path.join(OUT, 't', f'{name}.png'), optimize=True)

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    if os.path.isfile(p): print(f, size(p))
print('m', len(os.listdir(os.path.join(OUT, 'm'))), 't', len(os.listdir(os.path.join(OUT, 't'))))
