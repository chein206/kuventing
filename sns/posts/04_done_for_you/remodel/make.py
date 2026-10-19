# 04 「상품만 정하세요」 — 대표 OK 시안(sns/remodel-sample) 그대로 5장 (요청 03 · CARD-STYLE)
# 1~2 넘기면 열리는 표 · 3 사장님 폰 사진 → 광고판(사진은 img/s8.jpg 가 있으면 그걸, 없으면 자리만 — 대표 주말 촬영본 S8 경품 실물 10-26)
# 4 작업 의뢰서(노랑 판) · 5 손님 폰 QR 쿠폰(실제 판 쿠폰) + 「남은 한 장까지, 럭키드로우」 + CTA
# python make.py → ../out/card-1~5.png · _sheet.png
import os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CLD = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
OUT = os.path.join(HERE, "..", "out")
IMG = os.path.join(HERE, "img").replace("\\", "/")
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
    out = os.path.join(OUT if name.startswith("card") else HERE, f"{name}.png")
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
im = Image.open(p2); im.crop((0, 0, 1080, 1350)).save(os.path.join(OUT, "card-1.png")); im.crop((1080, 0, 2160, 1350)).save(os.path.join(OUT, "card-2.png"))

# ── 3장: 사장님 폰 사진 한 장 → 광고판 (실물) ──
S8 = os.path.join(IMG, "s8.jpg")
photo = (f'<img src="file:///{S8}" style="width:100%;height:440px;object-fit:cover;display:block">' if os.path.exists(S8) else
         f'<div style="height:440px;border:4px dashed #b9b2a0;display:flex;align-items:center;justify-content:center;text-align:center;color:#8a826e;font:700 26px/1.5 Pret">대표 주말 촬영본<br>S8 경품 실물<br><span style="font-size:20px">10-26 교체</span></div>')
s3 = f"""<div class="s">{top('3 / 5')}
 <div class="h" style="position:absolute;left:72px;top:200px;font-size:96px">사진이 없으면<br>폰으로 한 장</div>
 <div class="sub" style="position:absolute;left:76px;top:440px">찍어 보내 주시면 광고판으로 만들어요.</div>
 <div style="position:absolute;left:70px;top:640px;width:380px;background:{CREAM};padding:18px 18px 70px;transform:rotate(-6deg);box-shadow:0 24px 50px rgba(0,0,0,.5)">
  {photo}
  <div style="position:absolute;left:22px;bottom:20px;font:700 26px Pret;color:{NAVY}">사장님 폰 사진</div></div>
 <svg style="position:absolute;left:400px;top:820px" width="220" height="200" viewBox="0 0 220 200"><path d="M10 150 C 70 40, 150 30, 196 70" stroke="{YEL}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M200 40 L206 82 L166 78 Z" fill="{YEL}"/></svg>
 <div style="position:absolute;left:560px;top:560px;width:470px;border-radius:44px;border:12px solid #1c2540;overflow:hidden;transform:rotate(4deg);box-shadow:0 30px 60px rgba(0,0,0,.55)">
  <img src="file:///{IMG}/cafe_board.png" style="width:100%;display:block"></div>
 <div style="position:absolute;left:640px;top:500px;background:{YEL};color:{INK};font:400 40px BHS;padding:10px 26px;border-radius:99px;transform:rotate(-5deg);box-shadow:0 0 0 6px {NIGHT}">광고판이 돼요</div>
 <div style="position:absolute;left:600px;top:1250px;padding:6px 16px;border-radius:99px;background:rgba(7,11,22,.78);color:{CREAM};font:700 22px Pret;border:1px solid rgba(243,241,234,.25)">실제 판 화면 · 데모</div>
 <div class="handle">@kuventing</div></div>"""
render("card-3", s3)

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
render("card-4", s4)

# ── 5장: 손님 폰에 남는 QR 쿠폰(실제 판 쿠폰 화면 · FAQ 「손님 폰에 QR, 다시 오면 사장님 폰에서 사용 처리」) + 한 줄 + CTA ──
s5 = f"""<div class="s">{top('5 / 5')}
 <div class="h" style="position:absolute;left:72px;top:190px;font-size:100px">남은 한 장까지,<br><span style="color:{YEL}">럭키드로우</span></div>
 <div class="sub" style="position:absolute;left:76px;top:440px;width:560px">평소엔 광고판, 누르면 럭키드로우.<br>태블릿 · 스탠드형 화면 · 키오스크에<br>주소 하나 열면 시작해요.</div>
 <div style="position:absolute;left:640px;top:440px;width:360px;height:700px;border-radius:52px;background:#1c2540;padding:16px;transform:rotate(6deg);box-shadow:0 30px 60px rgba(0,0,0,.55)">
  <div style="width:100%;height:100%;border-radius:38px;background:{CREAM};overflow:hidden;padding:40px 22px;color:{NIGHT}">
   <div style="font:800 24px Pret;color:#666">손님 폰</div>
   <div style="font:400 40px/1.15 BHS;margin:10px 0 24px">QR 쿠폰이<br>남아요</div>
   <img src="file:///{PUB}/coupon.jpg" style="width:100%;border-radius:14px;display:block;box-shadow:0 6px 18px rgba(0,0,0,.18)">
   <div style="margin-top:22px;font:600 22px/1.5 Pret;color:#555">다시 오면 사장님 폰에서<br>사용 처리</div></div></div>
 <div style="position:absolute;left:600px;top:1170px;padding:6px 16px;border-radius:99px;background:rgba(7,11,22,.78);color:{CREAM};font:700 22px Pret;border:1px solid rgba(243,241,234,.25)">쿠폰 = 실제 판 화면 · 데모</div>
 <div style="position:absolute;left:72px;top:960px;width:520px;display:flex;gap:22px;align-items:center">
  <div style="width:96px;height:96px;flex:none">{MARK}</div>
  <div><div style="font:700 30px/1.4 Pret">도입 문의는 프로필 링크나 DM</div><div style="font:600 26px Pret;color:#8A93A8;margin-top:6px">데모도 거기서 직접 열어 보세요</div></div></div>
 <div class="handle">@kuventing</div></div>"""
render("card-5", s5)

W, H, G = 324, 405, 10
sheet = Image.new("RGB", (5 * (W + G) + G, H + 2 * G), "#2a2a2a")
for k in range(5):
    sheet.paste(Image.open(os.path.join(OUT, f"card-{k + 1}.png")).convert("RGB").resize((W, H), Image.LANCZOS), (G + k * (W + G), G))
sheet.save(os.path.join(OUT, "_sheet.png"))
for old in os.listdir(OUT):
    if old.startswith("card-") and int(old[5:-4]) > 5: os.remove(os.path.join(OUT, old))
print("ok")
