# 2K 로 받은 파일(01.jpg …)에 1K 후보 이름을 붙인다 — Flow 2K 받기는 파일 이름이 없어서 그림으로 대조한다
#   python assets/demo/match2k.py promo          (kuventing 폴더에서)
# _cand/<kind>2k/01.jpg … 를 _cand/<kind>/<S>-<v>.jpg 들과 비교해 _cand/<kind>2k/<S>-<v>.jpg 로 복사한다
import os, sys, glob, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
kind = sys.argv[1] if len(sys.argv) > 1 else 'promo'
SRC = os.path.join(HERE, '_cand', kind)
BIG = os.path.join(HERE, '_cand', kind + '2k')

def sig(path):
    a = np.asarray(Image.open(path).convert('L').resize((48, 64), Image.BILINEAR), dtype=np.float32)
    a = a - a.mean()
    return a / (np.linalg.norm(a) + 1e-6)

small = {os.path.basename(p)[:-4]: sig(p) for p in glob.glob(os.path.join(SRC, 'S*-[ab].jpg'))}
for p in sorted(glob.glob(os.path.join(BIG, '[0-9][0-9].jpg'))):
    s = sig(p)
    score = sorted(((float((s * v).sum()), k) for k, v in small.items()), reverse=True)
    (best, name), (second, _) = score[0], score[1]
    ok = best > 0.9 and best - second > 0.05
    print(f'{os.path.basename(p)} -> {name}  {best:.3f} (다음 {second:.3f}){"" if ok else "  <-- 애매함, 눈으로 볼 것"}')
    if ok:
        shutil.copyfile(p, os.path.join(BIG, f'{name}.jpg'))
