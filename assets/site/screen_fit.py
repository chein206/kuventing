# 사진 속 태블릿의 검은 화면 네 귀퉁이를 찾아, 대기 화면 영상을 그 자리에 얹는 CSS matrix3d 를 만든다
#   python assets/site/screen_fit.py <사진> <영상 첫 화면(포스터)> <미리보기 저장>
# 출력: 귀퉁이(왼위 · 오위 · 오아래 · 왼아래)와 matrix3d — 영상 요소(540×864)를 사진 좌표계로 옮긴다
import sys, json
import cv2, numpy as np

photo, poster, out = sys.argv[1], sys.argv[2], sys.argv[3]
VW, VH = 540, 864                       # 영상 요소 크기(CSS px) — 홈페이지 시안과 같아야 한다

im = cv2.imread(photo)
H, W = im.shape[:2]
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
# 화면은 거의 검정 — 세로로 긴 어두운 덩어리 중 가장 큰 것. 볼록 껍질을 꼭짓점 넷이 될 때까지 단순하게
INSET = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0   # 몸체까지 검은 태블릿은 테두리 몫만큼 안으로(폭 비율)
mask = (g < 22).astype(np.uint8) * 255
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
cand = [i for i in range(1, n) if st[i][4] > W * H * 0.015 and 1.1 < st[i][3] / max(st[i][2], 1) < 1.9]
if not cand:
    print(json.dumps({'error': '화면 덩어리를 못 찾음'})); sys.exit(1)
i = max(cand, key=lambda k: st[k][4])
cnts, _ = cv2.findContours((lab == i).astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
best = None
for eps in np.linspace(0.005, 0.12, 60):
    ap = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
    if len(ap) == 4:
        best = ap.reshape(4, 2).astype(np.float32); break
if best is None:
    print(json.dumps({'error': '꼭짓점 넷으로 못 줄임'})); sys.exit(1)

# 왼위 · 오위 · 오아래 · 왼아래 순서로
s, d = best.sum(1), np.diff(best, axis=1).ravel()
quad = np.array([best[np.argmin(s)], best[np.argmin(d)], best[np.argmax(s)], best[np.argmax(d)]], np.float32)
# 안으로 — 기본은 1.5px(검은 가장자리가 비치지 않게), INSET 을 주면 그 비율만큼 더(검은 몸체 태블릿의 테두리)
cen = quad.mean(0)
k = 1 - 1.5 / max(np.linalg.norm(quad[2] - quad[0]), 1) * 2 - INSET * 2
quad = cen + (quad - cen) * k

src = np.array([[0, 0], [VW, 0], [VW, VH], [0, VH]], np.float32)
Hm = cv2.getPerspectiveTransform(src, quad)
Hm = Hm / Hm[2, 2]
h = Hm.ravel()
m3d = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1]
css = 'matrix3d(' + ','.join(f'{v:.8f}'.rstrip('0').rstrip('.') if v else '0' for v in m3d) + ')'

# 확인용 — 포스터를 얹어 본다
p = cv2.resize(cv2.imread(poster), (VW, VH))
warp = cv2.warpPerspective(p, Hm, (W, H))
m = cv2.warpPerspective(np.full((VH, VW), 255, np.uint8), Hm, (W, H))
comp = im.copy(); comp[m > 0] = warp[m > 0]
cv2.imwrite(out, comp)
print(json.dumps({'size': [W, H], 'quad': quad.round(1).tolist(), 'matrix3d': css}, ensure_ascii=False))
