# 쿠벤팅 카드뉴스 「사장님이 하실 일은 하나예요」 리모델 시안 (10-19, 모션그래프 세션)
# AI 티 덜기: ① 넘김 = 밀어서 열기(1→2장 이어지는 표) ② 빈 상자 대신 실물 화면 · 사진 ③ 작업 의뢰서 모양
# python make.py → slide-*.png · board.png
import os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CLD = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
P = lambda *a: os.path.join(CLD, *a).replace("\\", "/")
FONT = P("kuventing", "sns", "brand", "logo", "concepts", "fonts")
PRET = P("vidops", "remotion", "public", "fonts", "PretendardVariable.woff2")
PUB = P("kuventing", "app", "public", "site")
MARK = open(P("kuventing", "sns", "brand", "logo", "svg", "mark-yellow.svg"), encoding="utf-8").read().replace('width="256" height="256"', 'width="100%" height="100%"')
SK = os.path.expanduser("~/.claude/skills/logo-design/scripts/render_png.py")
NIGHT, NAVY, YEL, INK, CREAM = "#070B16", "#233253", "#FFC83D", "#1A1300", "#F3F1EA"

CSS = f"""
@font-face{{font-family:BHS;src:url(file:///{FONT}/BlackHanSans-Regular.ttf)}}
@font-face{{font-family:Arch;src:url(file:///{FONT}/Archivo-VF.ttf);font-weight:100 900;font-stretch:62% 125%}}
@font-face{{font-family:Pret;src:url(file:///{PRET});font-weight:100 900}}
*{{box-sizing:border-box}} body{{margin:0;font-family:Pret,sans-serif;color:{CREAM}}}
.s{{position:relative;width:1080px;height:1350px;overflow:hidden;background:{NIGHT}}}
.top{{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:14px;font:800 26px Arch;font-stretch:125%;letter-spacing:.06em}}
.top i{{width:52px;height:52px;display:block}}
.pg{{position:absolute;right:72px;top:72px;font:700 24px Arch;color:#8A93A8}}
.h{{font-family:BHS;font-weight:400;line-height:1.12;letter-spacing:-.01em}}
.sub{{font-size:34px;line-height:1.55;color:#C3CAD8}}
.handle{{position:absolute;left:72px;bottom:56px;font:600 24px Pret;color:#8A93A8}}
"""


def html(body, w=1080):
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body style="width:{w}px">{body}</body></html>'


def render(name, body, w=1080, h=1350):
    p = os.path.join(HERE, f"_{name}.html")
    open(p, "w", encoding="utf-8").write(html(body, w))
    out = os.path.join(HERE, f"{name}.png")
    subprocess.run([sys.executable, SK, p, "-o", out, "--width", str(w), "--height", str(h)], check=True, capture_output=True)
    os.remove(p)
    return out


top = lambda pg: f'<div class="top"><i>{MARK}</i>KUVENTING</div><div class="pg">{pg}</div>'

# ── 1~2장: 두 장에 걸친 표. 2장에서 윗장이 오른쪽으로 젖혀져 안쪽이 드러남 ──
W2, X0, X1, Y0, Y1, R, NR = 2160, 96, 2064, 700, 1220, 44, 62
CY = (Y0 + Y1) / 2
TK = (f"M{X0+R} {Y0} H{X1-R} A{R} {R} 0 0 1 {X1} {Y0+R} V{CY-NR} A{NR} {NR} 0 0 0 {X1} {CY+NR} V{Y1-R} A{R} {R} 0 0 1 {X1-R} {Y1} "
      f"H{X0+R} A{R} {R} 0 0 1 {X0} {Y1-R} V{CY+NR} A{NR} {NR} 0 0 0 {X0} {CY-NR} V{Y0+R} A{R} {R} 0 0 1 {X0+R} {Y0} Z")
import math
# 접힌 선: 윗변 x 1580 → 아랫변 x 1380 (비스듬히 젖힌 장) — 날개가 위로 살짝 들려 「넘기는 중」으로 읽힘
A_, B_ = (1580, Y0), (1380, Y1)
ux, uy = B_[0] - A_[0], B_[1] - A_[1]; ln = math.hypot(ux, uy)
nx, ny = -uy / ln, ux / ln
if nx < 0: nx, ny = -nx, -ny
d = nx * A_[0] + ny * A_[1]
M = [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * d * nx, 2 * d * ny]
def half(far):
    L, s = 5000, (1 if far else -1)
    qx, qy, tx, ty = nx * d, ny * d, -ny, nx
    pts = [(qx + tx * L, qy + ty * L), (qx - tx * L, qy - ty * L), (qx - tx * L + s * nx * L, qy - ty * L + s * ny * L), (qx + tx * L + s * nx * L, qy + ty * L + s * ny * L)]
    return " ".join(f"{a:.1f},{b:.1f}" for a, b in pts)
perf = "".join(f'<circle cx="1080" cy="{y}" r="7" fill="{NIGHT}"/>' for y in range(Y0 + 30, Y1 - 10, 34))
pano = f"""
<div class="s" style="width:{W2}px">
 <div class="top"><i>{MARK}</i>KUVENTING</div><div style="position:absolute;left:1152px;top:64px;display:flex;gap:14px;align-items:center;font:800 26px Arch;letter-spacing:.06em"><i style="width:52px;height:52px;display:block">{MARK}</i>KUVENTING</div>
 <div class="pg" style="right:72px">2 / 5</div><div class="pg" style="right:1152px">1 / 5</div>
 <div class="h" style="position:absolute;left:72px;top:220px;font-size:112px">사장님이<br>하실 일은 <span style="color:{YEL}">하나</span></div>
 <div class="sub" style="position:absolute;left:76px;top:520px">밀어서 열어 보세요 →</div>
 <div class="h" style="position:absolute;left:1152px;top:220px;font-size:112px">나머지는<br>저희가 해요</div>
 <div class="sub" style="position:absolute;left:1156px;top:520px">판 디자인 · 사진 · 광고 문구 · 기기 설정</div>
 <svg style="position:absolute;inset:0" width="{W2}" height="1350" viewBox="0 0 {W2} 1350">
  <defs>
   <clipPath id="L"><rect x="0" y="0" width="1080" height="1350"/></clipPath>
   <clipPath id="Rr"><rect x="1080" y="0" width="1080" height="1350"/></clipPath>
   <clipPath id="far"><polygon points="{half(True)}"/></clipPath>
   <clipPath id="near"><polygon points="{half(False)}"/></clipPath>
  </defs>
  <!-- 1장: 표 앞쪽(절취선까지) -->
  <path d="{TK}" fill="{YEL}" clip-path="url(#L)"/>
  <text x="170" y="905" font-family="Arch" font-stretch="125%" font-weight="800" font-size="30" letter-spacing="6" fill="{INK}">KUVENTING · NO.01</text>
  <text x="166" y="1040" font-family="BHS" font-size="120" fill="{INK}">하실 일</text>
  <text x="170" y="1120" font-family="Pret" font-weight="700" font-size="34" fill="{INK}" opacity=".75">경품 몇 개 · 한 장 기준</text>
  <!-- 2장: 안쪽(크림) — 윗장이 젖혀져 드러난 곳 -->
  <path d="{TK}" fill="{CREAM}" clip-path="url(#Rr)"/>
  <text x="1150" y="860" font-family="Pret" font-weight="800" font-size="30" fill="{NAVY}">쿠벤팅이 하는 일</text>
  <g font-family="BHS" font-size="56" fill="{NIGHT}"><text x="1150" y="955">판 디자인</text><text x="1150" y="1027">사진</text><text x="1150" y="1099">광고 문구</text><text x="1150" y="1171">기기 설정</text></g>
  <!-- 2장: 아직 붙은 윗장 + 젖혀 넘어간 날개(뒷면 남색) -->
  <g clip-path="url(#Rr)"><path d="{TK}" fill="{YEL}" clip-path="url(#far)"/></g>
  <g transform="matrix({' '.join(f'{v:.4f}' for v in M)})"><g clip-path="url(#near)"><g clip-path="url(#Rr)">
   <path d="{TK}" fill="{NAVY}" stroke="{NIGHT}" stroke-width="14" paint-order="stroke"/></g></g></g>
  {perf}
 </svg>
 <div class="handle">@kuventing</div><div class="handle" style="left:1152px">@kuventing</div>
</div>"""
p2 = render("slide-1-2-panorama", pano, W2, 1350)
im = Image.open(p2); im.crop((0, 0, 1080, 1350)).save(os.path.join(HERE, "slide-1.png")); im.crop((1080, 0, 2160, 1350)).save(os.path.join(HERE, "slide-2.png"))

# ── 3장: 폰 사진 한 장 → 광고판 (빈 상자 대신 실물) ──
s3 = f"""<div class="s">{top('3 / 5')}
 <div class="h" style="position:absolute;left:72px;top:200px;font-size:96px">사진이 없으면<br>폰으로 한 장</div>
 <div class="sub" style="position:absolute;left:76px;top:440px">찍어 보내 주시면 광고판으로 만들어요.</div>
 <div style="position:absolute;left:70px;top:640px;width:380px;background:{CREAM};padding:18px 18px 70px;transform:rotate(-6deg);box-shadow:0 24px 50px rgba(0,0,0,.5)">
  <img src="file:///{PUB}/m/cake.jpg" style="width:100%;display:block">
  <div style="position:absolute;left:22px;bottom:20px;font:700 26px Pret;color:{NAVY}">사장님 폰 사진</div></div>
 <svg style="position:absolute;left:400px;top:820px" width="220" height="200" viewBox="0 0 220 200"><path d="M10 150 C 70 40, 150 30, 196 70" stroke="{YEL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M200 40 L206 82 L166 78 Z" fill="{YEL}"/></svg>
 <div style="position:absolute;left:560px;top:560px;width:470px;border-radius:44px;border:12px solid #1c2540;overflow:hidden;transform:rotate(4deg);box-shadow:0 30px 60px rgba(0,0,0,.55)">
  <img src="file:///{PUB}/signage.jpg" style="width:100%;display:block"></div>
 <div style="position:absolute;left:640px;top:500px;background:{YEL};color:{INK};font:400 40px BHS;padding:10px 26px;border-radius:99px;transform:rotate(-5deg);box-shadow:0 0 0 6px {NIGHT}">광고판이 돼요</div>
 <div class="handle">@kuventing</div></div>"""
render("slide-3", s3)

# ── 4장: 작업 의뢰서 (노랑 판으로 뒤집기) ──
rows = [("판 디자인", True), ("사진 · 광고 문구", True), ("기기 설정", True), ("남은 수 · 쿠폰 확인", True), ("경품은 몇 개?", False), ("한 장을 주는 기준", False)]
stamp = (f'<div style="position:absolute;right:26px;top:50%;transform:translateY(-50%) rotate({{r}}deg);border:4px solid {NAVY};color:{NAVY};'
         f'border-radius:12px;padding:4px 14px;font:400 30px BHS;opacity:.85;letter-spacing:.02em">작성 완료</div>')
rws = ""
for i, (t, done) in enumerate(rows):
    r = [-8, 5, -3, 7][i % 4]
    right = stamp.replace("{r}", str(r)) if done else f'<div style="position:absolute;left:330px;right:40px;bottom:22px;border-bottom:4px solid {YEL}"></div><div style="position:absolute;right:30px;top:20px;font:800 24px Pret;color:#C08A00">← 사장님 칸</div>'
    rws += (f'<div style="position:relative;height:94px;border-bottom:2px solid #d9d4c6;display:flex;align-items:center;padding-left:34px;'
            f'background:{"#FFF6D8" if not done else "transparent"}"><span style="font:{"800" if not done else "600"} 34px Pret;color:{NIGHT}">{t}</span>{right}</div>')
s4 = f"""<div class="s" style="background:{YEL}">
 <div class="top" style="color:{INK}"><i>{MARK.replace(YEL, NAVY).replace(YEL.lower(), NAVY)}</i>KUVENTING</div><div class="pg" style="color:#7a5d00">4 / 5</div>
 <div class="h" style="position:absolute;left:72px;top:190px;font-size:100px;color:{INK}">사장님 칸은<br>두 개뿐이에요</div>
 <div style="position:absolute;left:84px;top:450px;width:912px;background:{CREAM};transform:rotate(-2deg);box-shadow:0 30px 60px rgba(60,40,0,.35);color:{NIGHT}">
  <div style="display:flex;justify-content:space-between;align-items:baseline;padding:34px 34px 22px;border-bottom:4px solid {NIGHT}">
   <span style="font:400 48px BHS">작업 의뢰서</span><span style="font:700 24px Arch;font-stretch:125%;letter-spacing:.08em;color:#666">KUVENTING · NO.0001</span></div>
  {rws}
  <div style="padding:22px 34px 30px;font:600 24px Pret;color:#666">두 칸만 채워 DM 주세요. 나머지는 저희가 채워 둡니다.</div>
 </div>
 <div class="handle" style="color:#7a5d00">@kuventing</div></div>"""
render("slide-4", s4)

# ── 비교 보드 ──
B = Image.open(os.path.join(HERE, "before.webp")).convert("RGB")
boxes = {1: (10, 10, 335, 415), 2: (339, 10, 663, 415), 3: (668, 10, 992, 415), 6: (339, 425, 663, 830)}
cut = lambda k: B.crop(boxes[k])
F = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30); f2 = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 24)
TW, TH = 400, 500
rowsB = [("넘김 = 밀어서 열기 · 1→2장에 걸친 표", [1, 2], ["slide-1.png", "slide-2.png"], "옆으로 넘기면 절취선에서 윗장이 젖혀지며 안쪽이 드러남 — 판의 「밀어서 열기」와 같은 손맛"),
         ("빈 상자 → 실물", [3], ["slide-3.png"], "노랑 막대 빈 상자 대신 폰 사진 한 장 → 실제 광고판 화면 (실제 게시는 사장님 · 촬영 사진으로)"),
         ("카드 6칸 → 작업 의뢰서", [6], ["slide-4.png"], "도장 찍힌 칸 4개 + 비어 있는 사장님 칸 2개 — 「하실 일은 하나」가 눈으로 보임 · 노랑 판으로 뒤집어 리듬")]
H = 120 + sum(TH + 150 for _ in rowsB)
bd = Image.new("RGB", (60 + 2 * (TW + 10) + 80 + 2 * (TW + 6) + 60, H), "#1b2233"); dr = ImageDraw.Draw(bd)
dr.text((60, 40), "쿠벤팅 카드뉴스 — AI 티 덜기 시안", font=ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 44), fill=CREAM)
y = 130
xa = 60 + 2 * (TW + 10) + 80
for title, bk, ak, note in rowsB:
    dr.text((60, y), title, font=F, fill=YEL)
    dr.text((60, y + 42), note, font=f2, fill="#C3CAD8")
    dr.text((60, y + 84), "지금", font=f2, fill="#8A93A8"); dr.text((xa, y + 84), "바꾸면", font=f2, fill=YEL)
    for i, k in enumerate(bk):
        bd.paste(cut(k).resize((TW, TH), Image.LANCZOS), (60 + i * (TW + 10), y + 118))
    for i, n in enumerate(ak):
        bd.paste(Image.open(os.path.join(HERE, n)).convert("RGB").resize((TW, TH), Image.LANCZOS), (xa + i * (TW + 6), y + 118))
    y += TH + 150
bd.save(os.path.join(HERE, "board.png")); print("ok", bd.size)
