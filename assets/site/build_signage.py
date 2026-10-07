# SIGNAGE 장 영상 굽기 — 업종마다 대기 화면 첫 컷(rec_signage.mjs)을 같은 길이로 잘라 순서대로 이어 붙인다.
# 홈페이지(SignageCycle.tsx)는 재생 위치 ÷ SEG 로 지금 업종을 알아 왼쪽 「올린 것」 사진 · 문구를 맞춘다 — SEG 를 바꾸면 page.tsx 도
#   python assets/site/build_signage.py cafe beauty chicken food arven      (kuventing 폴더에서, 홈페이지에 나올 순서대로)
# → app/public/site/signage.mp4 · signage.jpg(포스터), app/public/site/sig/<업종>.jpg(올린 사진, 폭 640)
import json, os, re, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '..', '..', 'app', 'public')
OUT = os.path.join(PUB, 'site')
SEG = 6.0       # 업종 하나의 길이(초) — 첫 컷 6.5초 중 앞 0.3초(판이 뜨는 중) · 끝 0.2초(글자가 사라지는 중)를 뺀다
LEAD = 0.3
# 업종별 첫 광고 사진 — app/demo/presets.ts 의 promos[0] 과 같아야 한다
PHOTO = {
    'beauty': 'demo/beauty/slide-1.jpg',
    'arven': 'demo/arven/slide-1.jpg',
    'food': 'img/menu-미소라멘.jpg',
    'cafe': 'img/menu-딸기생크림케익.jpg',
    'chicken': 'demo/chicken/slide-1.jpg',
}
SLUGS = sys.argv[1:]
os.makedirs(os.path.join(OUT, 'sig'), exist_ok=True)
tmp = os.path.join(HERE, '_rec', 'sig-cut')
os.makedirs(tmp, exist_ok=True)

def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

parts = []
for slug in SLUGS:
    rec = os.path.join(HERE, '_rec', f'sig-{slug}')
    m = json.load(open(os.path.join(rec, 'marks.json'), encoding='utf-8'))
    a = m['scene'] - m['first'] + LEAD
    part = os.path.join(tmp, f'{slug}.mp4')
    # 업종마다 같은 길이 · 같은 틀(30fps · 540×864)로 — 이어 붙일 때 다시 굽지 않게
    ff('-f', 'concat', '-safe', '0', '-i', os.path.join(rec, 'list.txt'), '-vf',
       f'fps=30,trim=start={a:.3f}:duration={SEG},setpts=PTS-STARTPTS,scale=540:864:flags=lanczos',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-an', part)
    parts.append(part)
    im = Image.open(os.path.join(PUB, PHOTO[slug])).convert('RGB')
    k = 640 / im.width
    im.resize((640, round(im.height * k)), Image.LANCZOS).save(os.path.join(OUT, 'sig', f'{slug}.jpg'), quality=82, optimize=True, progressive=True)

lst = os.path.join(tmp, 'list.txt')
with open(lst, 'w', encoding='utf-8') as f:
    for p in parts:
        f.write(f"file '{p.replace(os.sep, '/')}'\n")
ff('-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', os.path.join(OUT, 'signage.mp4'))
# 포스터 — 첫 업종 1.2초 지점(문구가 떠오른 뒤)
ff('-ss', '1.2', '-i', parts[0], '-frames:v', '1', '-q:v', '3', os.path.join(OUT, 'signage.jpg'))

dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                            os.path.join(OUT, 'signage.mp4')], capture_output=True, text=True).stdout.strip())
print(f'signage.mp4 {os.path.getsize(os.path.join(OUT, "signage.mp4")) // 1024}KB · {dur:.2f}초 = {len(SLUGS)} × {SEG}초 | 순서 {" → ".join(SLUGS)}')
