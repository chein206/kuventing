# 쿠벤팅 로고 — B(K표) + 왼쪽 위 젖힌 귀퉁이 (대표 10-19 선택)
# python gen_mark.py → svg/*.svg + board-mark.html (render_png.py 로 board-mark.png)
# 두 색만: 표 = 노랑, K · 잘린 귀퉁이 · 날개 둘레 틈 = 바탕. 표 윤곽 하나 + 날개 하나라 한 색(투명 바탕)도 같은 모양
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "svg")
os.makedirs(OUT, exist_ok=True)
FONTS = os.path.join(HERE, "concepts", "fonts")
NIGHT, NAVY, YEL, INK, CREAM = "#070B16", "#233253", "#FFC83D", "#1A1300", "#F3F1EA"

# ── 마크 (256 캔버스) ─────────────────────────────
X0, Y0, W, H, R, N = 24, 64, 208, 128, 18, 20
X1, Y1, CY = X0 + W, Y0 + H, Y0 + H / 2
LEG = 32     # 잘린 귀퉁이 다리 — 왼쪽 홈(y 108) 위에서 끝나게
DEPTH = 0.62 # 날개가 접혀 넘어온 정도 (1 = 완전히 접혀 붙음)
GAP = 5      # 날개 둘레 틈

c1, c2 = (X0 + LEG, Y0), (X0, Y0 + LEG)          # 접힌 선(대각선) 양 끝
mirror = (X0 + LEG, Y0 + LEG)                     # 귀퉁이 꼭짓점을 접은 선에 비춘 자리
mid = ((c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2)
P = (mid[0] + DEPTH * (mirror[0] - mid[0]), mid[1] + DEPTH * (mirror[1] - mid[1]))  # 날개 끝


def offset_line(a, b, d, away_from):
    """a-b 선을 away_from 반대쪽으로 d 만큼 민 선 (점, 방향)"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = (dx * dx + dy * dy) ** 0.5
    nx, ny = -dy / L, dx / L
    if (away_from[0] - a[0]) * nx + (away_from[1] - a[1]) * ny > 0:
        nx, ny = -nx, -ny
    return (a[0] + nx * d, a[1] + ny * d), (dx, dy)


def cross(p, u, q, v):
    """p + t·u 와 q + s·v 의 교점"""
    den = u[0] * v[1] - u[1] * v[0]
    t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den
    return (p[0] + t * u[0], p[1] + t * u[1])


cen = ((c1[0] + c2[0] + P[0]) / 3, (c1[1] + c2[1] + P[1]) / 3)
la = offset_line(c1, P, GAP, cen)   # 날개 오른쪽 다리 바깥 틈선
lb = offset_line(P, c2, GAP, cen)   # 날개 아래 다리 바깥 틈선
A1 = cross(*la, (0, Y0), (1, 0))    # 윗변과 만나는 점
P2 = cross(*la, *lb)                # 틈선 꼭짓점
B1 = cross(*lb, (X0, 0), (0, 1))    # 왼변과 만나는 점
assert B1[1] < CY - N - 3, f"틈이 홈에 닿음 {B1}"

f = lambda p: f"{p[0]:.2f} {p[1]:.2f}"
# 표 윤곽: 왼쪽 위에 날개 자리만큼 V 홈이 파인 모양 (시계 방향)
TICKET = (f"M{f(A1)} H{X1-R} A{R} {R} 0 0 1 {X1} {Y0+R} V{CY-N} A{N} {N} 0 0 0 {X1} {CY+N} "
          f"V{Y1-R} A{R} {R} 0 0 1 {X1-R} {Y1} H{X0+R} A{R} {R} 0 0 1 {X0} {Y1-R} V{CY+N} "
          f"A{N} {N} 0 0 0 {X0} {CY-N} L{f(B1)} L{f(P2)} Z")
FLAP = f"M{f(c1)} L{f(P)} L{f(c2)} Z"
# K (표 속 빈 공간) — 기둥 24, 팔 둘
K = ["M88 92 H112 V121 L145 92 H179 L137 128 L180 164 H146 L112 136 V164 H88 Z"]  # 한 덩어리 윤곽(팔 겹침 없음)


def mark_body(fg):
    return f'<path fill="{fg}" fill-rule="evenodd" d="{TICKET} {" ".join(K)}"/><path fill="{fg}" d="{FLAP}"/>'


def svg(w, h, body, title, size=True, bg=None):
    wh = f' width="{w}" height="{h}"' if size else ""
    back = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"{wh} role="img"><title>{title}</title>{back}{body}</svg>'


def mark(fg, bg=None, size=True):
    return svg(256, 256, mark_body(fg), "쿠벤팅 마크", size, bg)


# ── 글자를 패스로 (블랙한산스 · Archivo 넓게) ─────
def text_path(font_file, text, px, tracking=0.0, axes=None):
    ft = TTFont(font_file)
    if axes:
        from fontTools.varLib.instancer import instantiateVariableFont
        ft = instantiateVariableFont(ft, axes)
    gs, cmap, upm = ft.getGlyphSet(), ft.getBestCmap(), ft["head"].unitsPerEm
    k = px / upm
    x, parts = 0.0, []
    for ch in text:
        pen = SVGPathPen(gs)
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        parts.append(pen.getCommands())
        x += gs[g].width * k + tracking
    return " ".join(parts), x - tracking


KO, KO_W = text_path(os.path.join(FONTS, "BlackHanSans-Regular.ttf"), "쿠벤팅", 100, tracking=-2)
EN, EN_W = text_path(os.path.join(FONTS, "Archivo-VF.ttf"), "KUVENTING", 25, tracking=6.2, axes={"wdth": 125, "wght": 800})
# 영문 줄 길이를 한글 줄에 맞춘다
EN_S = KO_W / EN_W


def lockup_h(mfg, ko, en, bg=None, size=True):
    tx = 262
    w = int(tx + KO_W + 40)
    body = (f'<g transform="translate(0,0)">{mark_body(mfg)}</g>'
            f'<path fill="{ko}" transform="translate({tx},146)" d="{KO}"/>'
            f'<path fill="{en}" transform="translate({tx+2},190) scale({EN_S:.4f})" d="{EN}"/>')
    return svg(w, 256, body, "쿠벤팅 가로 묶음", size, bg)


def lockup_v(mfg, ko, en, bg=None, size=True):
    w = int(max(KO_W, 256) + 80)
    h = 370
    body = (f'<g transform="translate({(w-256)/2},-34)">{mark_body(mfg)}</g>'
            f'<path fill="{ko}" transform="translate({(w-KO_W)/2},274)" d="{KO}"/>'
            f'<path fill="{en}" transform="translate({(w-KO_W)/2+1},318) scale({EN_S:.4f})" d="{EN}"/>')
    return svg(w, h, body, "쿠벤팅 세로 묶음", size, bg)


def wordmark(ko, en, size=True):
    w, h = int(KO_W + 8), 140
    body = (f'<path fill="{ko}" transform="translate(4,88)" d="{KO}"/>'
            f'<path fill="{en}" transform="translate(5,132) scale({EN_S:.4f})" d="{EN}"/>')
    return svg(w, h, body, "쿠벤팅 글자")


files = {
    "mark-yellow-on-night.svg": mark(YEL, NIGHT),
    "mark-navy-on-yellow.svg": mark(NAVY, YEL),
    "mark-yellow.svg": mark(YEL),            # 투명 바탕
    "mark-white.svg": mark("#FFFFFF"),       # 워터마크 · 한 색
    "mark-black.svg": mark(NIGHT),           # 밝은 바탕 한 색
    "wordmark-night.svg": wordmark(CREAM, YEL),
    "wordmark-on-light.svg": wordmark(NIGHT, NAVY),
    "lockup-h-night.svg": lockup_h(YEL, CREAM, YEL, NIGHT),
    "lockup-v-night.svg": lockup_v(YEL, CREAM, YEL, NIGHT),
    "lockup-h-yellow.svg": lockup_h(NAVY, NIGHT, NAVY, YEL),
}
for n, s_ in files.items():
    open(os.path.join(OUT, n), "w", encoding="utf-8").write(s_)


# ── 보드 ─────────────────────────────────────────
def circ(px, fg=YEL, bg=NAVY, scale=0.96):
    return (f'<div class="c" style="width:{px}px;height:{px}px;background:{bg}">'
            f'<div style="width:{px*scale}px;height:{px*scale}px">{mark(fg, size=False)}</div></div>')


html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:'BHS';src:url(concepts/fonts/BlackHanSans-Regular.ttf)}}
body{{margin:0;background:#0D1426;color:{CREAM};font-family:'Malgun Gothic',sans-serif;width:1600px}}
.pad{{padding:48px 64px 56px}} h1{{margin:0;font:400 50px BHS}} .sub{{color:#8A93A8;font-size:21px;margin-top:8px;line-height:1.5}}
.row{{display:flex;gap:22px;margin-top:22px;align-items:flex-end}}
.t{{width:300px;height:300px;border-radius:22px;display:flex;align-items:center;justify-content:center}} .t svg{{width:270px;height:270px}}
.c{{border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}} .c svg{{width:100%;height:100%;display:block}}
.lab{{font-size:16px;color:#8A93A8;margin-top:8px}}
.cell{{display:flex;flex-direction:column;align-items:center}}
.lk{{border-radius:22px;overflow:hidden}} .lk svg{{display:block;width:100%;height:auto}}
h3{{font:400 28px BHS;color:{YEL};margin:34px 0 0}}
</style></head><body><div class="pad">
<h1>쿠벤팅 로고 — K표 + 왼쪽 위 젖힌 귀퉁이</h1>
<div class="sub">대표 선택(10-19): B K표에 C처럼 떼는 귀퉁이를 왼쪽 위로 — 판에서 표가 왼쪽부터 열리니까 · 노랑 #FFC83D / 남색 두 색만, 젖힌 날개는 틈(바탕색)으로 구분 · K 획은 안 건드림 · 글자는 패스</div>
<h3>마크</h3>
<div class="row">
  <div class="cell"><div class="t" style="background:{NIGHT}">{mark(YEL, size=False)}</div><div class="lab">노랑 · 밤 남색</div></div>
  <div class="cell"><div class="t" style="background:{YEL}">{mark(NAVY, size=False)}</div><div class="lab">반전 · 남색</div></div>
  <div class="cell"><div class="t" style="background:linear-gradient(135deg,#2c3a5a,#8d9ab4)">{mark('#FFFFFF', size=False)}</div><div class="lab">한 색(흰) · 워터마크</div></div>
  <div class="cell"><div class="t" style="background:{CREAM}">{mark(NIGHT, size=False)}</div><div class="lab">한 색(검정) · 밝은 바탕</div></div>
</div>
<h3>프로필 원 · 작은 크기 — K 가 먼저, 귀퉁이는 덤</h3>
<div class="row">
  <div class="cell">{circ(220)}<div class="lab">원 220</div></div>
  <div class="cell">{circ(110)}<div class="lab">110 (인스타)</div></div>
  <div class="cell">{circ(48)}<div class="lab">48</div></div>
  <div class="cell">{circ(32)}<div class="lab">32</div></div>
  <div class="cell">{circ(24)}<div class="lab">24</div></div>
  <div class="cell">{circ(16, scale=0.96)}<div class="lab">16</div></div>
  <div class="cell">{circ(110, NAVY, YEL)}<div class="lab">110 반전</div></div>
  <div class="cell">{circ(110, YEL, NIGHT)}<div class="lab">110 밤</div></div>
</div>
<h3>묶음 · 글자</h3>
<div class="row">
  <div class="lk" style="width:760px">{lockup_h(YEL, CREAM, YEL, NIGHT, size=False)}</div>
  <div class="lk" style="width:380px">{lockup_v(YEL, CREAM, YEL, NIGHT, size=False)}</div>
</div>
<div class="row">
  <div class="lk" style="width:760px">{lockup_h(NAVY, NIGHT, NAVY, YEL, size=False)}</div>
  <div class="lk" style="width:380px;background:{CREAM};padding:20px 30px;box-sizing:border-box">{wordmark(NIGHT, NAVY, size=False)}</div>
</div>
</div></body></html>'''
open(os.path.join(HERE, "board-mark.html"), "w", encoding="utf-8").write(html)
print("ok P", f(P), "A1", f(A1), "P2", f(P2), "B1", f(B1), "KO", round(KO_W), "EN", round(EN_W), "s", round(EN_S, 3))
