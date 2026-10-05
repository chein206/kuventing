# 업종 데모 사진 설치 — 게이트에서 고른 Flow 후보를 화면 규격으로 줄여 app/public/demo/<업종>/ 에 넣는다
#   python assets/demo/install.py            (kuventing 폴더에서)
# 상품 = 1000×1000 JPEG(이미지규격.md §2), 광고 = 세로 3:4 그대로(긴 변 2000 이내 · 900KB 이하, §1 · 카운터화면 §2-4)
# 광고는 2000 으로 키운다 — 1K 그대로면 모션 광고 확대 구간에서 1:1 리샘플링에 걸려 떨린다.
# Flow 2K 받기(scripts/flow-2k.mjs → match2k.py)는 /u/1/ 계정 자리에서 3분 넘게 안 와서(10-05) 1K 를 Lanczos 로 키웠다
# 고른 원본은 assets/demo/pick/ 에 남긴다(_cand 는 후보 더미라 커밋하지 않는다)
import os, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '..', '..', 'app', 'public', 'demo')

# (후보 파일, 업종, 저장 이름, 종류[, 둘레 잘라낼 px]) — 후보 이름은 _cand/<prize|promo>/<S번호>-<a|b>.jpg
# Flow 가 가끔 사진 둘레에 얇은 액자(검정 · 회색 · 흰색)를 구워 낸다 — 다섯째 값만큼 사방을 잘라 낸다
PICKS = [
    # 아르벤 — 상품
    ('prize/S1-a.jpg', 'arven', 'a-golfbag.jpg', 'prize'),
    ('prize/S2-b.jpg', 'arven', 'b-umbrella.jpg', 'prize'),
    ('prize/S3-a.jpg', 'arven', 'c-tumbler.jpg', 'prize'),
    ('prize/S4-b.jpg', 'arven', 'd-charge.jpg', 'prize'),
    ('prize/S5-a.jpg', 'arven', 'e-coffee.jpg', 'prize'),
    ('prize/S6-b-fix.jpg', 'arven', 'finale.jpg', 'prize'),   # 보닛에 실제 브랜드 엠블럼 → cv2 인페인트로 지움
    # 뷰티 — 상품
    ('prize/S7-b.jpg', 'beauty', 'a-fullset.jpg', 'prize'),
    ('prize/S8-b.jpg', 'beauty', 'b-serum.jpg', 'prize'),
    ('prize/S9-a.jpg', 'beauty', 'c-minikit.jpg', 'prize'),
    ('prize/S10-a.jpg', 'beauty', 'd-sample.jpg', 'prize'),
    ('prize/S11-b.jpg', 'beauty', 'e-coupon.jpg', 'prize'),
    ('prize/S12-b.jpg', 'beauty', 'finale.jpg', 'prize'),
    # 라멘 — 비어 있던 B · D (S13-a 는 사진 둘레에 흰 액자가 구워져 나와 버림)
    ('prize/S13-b.jpg', 'food', 'b-ramen.jpg', 'prize'),
    ('prize/S14-a.jpg', 'food', 'd-soda.jpg', 'prize', 12),   # 둘레 검은 줄 8px
    # 아르벤 — 대기 화면 광고 (S1-b 는 실제 브랜드 엠블럼이 박혀 나와 버림)
    ('promo/S1-a.jpg', 'arven', 'slide-1.jpg', 'promo'),
    ('promo/S2-b.jpg', 'arven', 'slide-2.jpg', 'promo'),
    ('promo/S3-b-fix.jpg', 'arven', 'slide-3.jpg', 'promo'),   # S3-a 는 실제 엠블럼, b 도 보닛 엠블럼 → 인페인트
    ('promo/S4-b.jpg', 'arven', 'slide-4.jpg', 'promo'),
    # 뷰티 — 대기 화면 광고
    ('promo/S5-a.jpg', 'beauty', 'slide-1.jpg', 'promo'),
    ('promo/S6-b.jpg', 'beauty', 'slide-2.jpg', 'promo'),
    ('promo/S7-a.jpg', 'beauty', 'slide-3.jpg', 'promo'),   # b 는 흰 소매가 글자 자리(아래 40%)에 걸림
    ('promo/S8-a.jpg', 'beauty', 'slide-4.jpg', 'promo'),
]

def put(src, slug, name, kind, inset=0):
    im = Image.open(src).convert('RGB')
    if inset:
        im = im.crop((inset, inset, im.width - inset, im.height - inset))
    if kind == 'prize':
        side = min(im.size)
        l, t = (im.width - side) // 2, (im.height - side) // 2
        im = im.crop((l, t, l + side, t + side)).resize((1000, 1000), Image.LANCZOS)
        q = 84
    else:
        # 긴 변 2000 으로 맞춘다 — 2K 면 줄이고, 1K 밖에 없으면 Lanczos 로 키운다.
        # 키워도 디테일은 안 늘지만 화면이 0.5배 근처로 그려 1:1 리샘플링 떨림(카운터화면 §2-4)을 피한다
        k = 2000 / max(im.size)
        if abs(k - 1) > 0.01:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        q = 86
    os.makedirs(os.path.join(PUB, slug), exist_ok=True)
    dst = os.path.join(PUB, slug, name)
    im.save(dst, 'JPEG', quality=q, optimize=True, progressive=True)
    keep = os.path.join(HERE, 'pick', f'{slug}-{name}')
    os.makedirs(os.path.dirname(keep), exist_ok=True)
    shutil.copyfile(src, keep)
    print(f'{slug}/{name}  {im.size[0]}x{im.size[1]}  {os.path.getsize(dst) // 1024}KB  <- {os.path.relpath(src, HERE)}')

for cand, slug, name, kind, *rest in PICKS:
    put(os.path.join(HERE, '_cand', cand), slug, name, kind, *rest)
