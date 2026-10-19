# 릴스 01 글자 방식 비교 — 대표 「글씨 박스 별로」(10-19) → 박스 없는 세 방식을 같은 두 장면에
import os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
CLD = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "..")).replace("\\", "/")
FONT = f"{CLD}/kuventing/sns/brand/logo/concepts/fonts"
PRET = f"{CLD}/vidops/remotion/public/fonts/PretendardVariable.woff2"
SK = os.path.expanduser("~/.claude/skills/logo-design/scripts/render_png.py")
NIGHT, YEL, CREAM = "#070B16", "#FFC83D", "#F3F1EA"
CSS = f"""@font-face{{font-family:BHS;src:url(file:///{FONT}/BlackHanSans-Regular.ttf)}}
@font-face{{font-family:Pret;src:url(file:///{PRET});font-weight:100 900}}
body{{margin:0}} .s{{position:relative;width:1080px;height:1920px;overflow:hidden;background:{NIGHT}}}
.h{{font-family:BHS;line-height:1.1;letter-spacing:-.01em;color:{CREAM}}} .h em{{font-style:normal;color:{YEL}}}"""

SCENES = {"cafe": ("이 화면,", "평소엔 <em>광고판</em>이에요"), "grid": ("손님이 누르면,", "<em>럭키드로우</em>")}

def A(img, l1, l2):  # 위 글자 · 아래 판(조금 작게) — 글자와 판이 안 겹침
    return (f'<div class="s"><div class="h" style="position:absolute;left:80px;top:270px;font-size:58px;color:#C3CAD8">{l1}</div>'
            f'<div class="h" style="position:absolute;left:80px;top:345px;font-size:96px">{l2}</div>'
            f'<img src="file:///{HERE}/{img}.png" style="position:absolute;left:60px;top:520px;width:960px;border-radius:34px"></div>')

def B(img, l1, l2):  # 판 가득 + 위쪽 남색 그늘 위에 큰 글자(박스 없음)
    return (f'<div class="s"><img src="file:///{HERE}/{img}.png" style="position:absolute;left:0;top:96px;width:1080px">'
            f'<div style="position:absolute;left:0;right:0;top:0;height:760px;background:linear-gradient(180deg,rgba(7,11,22,.96) 0%,rgba(7,11,22,.88) 45%,rgba(7,11,22,0) 100%)"></div>'
            f'<div class="h" style="position:absolute;left:80px;top:280px;font-size:62px;color:#C3CAD8">{l1}</div>'
            f'<div class="h" style="position:absolute;left:80px;top:360px;font-size:112px">{l2}</div></div>')

def C(img, l1, l2):  # 판 가득 + 가운데 아래 자막 줄(글자만, 그림자)
    return (f'<div class="s"><img src="file:///{HERE}/{img}.png" style="position:absolute;left:0;top:96px;width:1080px">'
            f'<div style="position:absolute;left:0;right:0;top:1080px;height:420px;background:linear-gradient(180deg,rgba(7,11,22,0),rgba(7,11,22,.85) 40%,rgba(7,11,22,.85) 70%,rgba(7,11,22,0))"></div>'
            f'<div class="h" style="position:absolute;left:0;right:0;top:1190px;text-align:center;font-size:56px;color:#C3CAD8">{l1}</div>'
            f'<div class="h" style="position:absolute;left:0;right:0;top:1262px;text-align:center;font-size:96px;text-shadow:0 6px 30px rgba(0,0,0,.6)">{l2}</div></div>')

outs = []
for k, fn in (("A", A), ("B", B), ("C", C)):
    for sc, (l1, l2) in SCENES.items():
        p = f"{HERE}/_{k}_{sc}.html"
        open(p, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{fn(sc, l1, l2)}</body></html>')
        o = f"{HERE}/{k}_{sc}.png"
        subprocess.run([sys.executable, SK, p, "-o", o, "--width", "1080", "--height", "1920"], check=True, capture_output=True)
        os.remove(p); outs.append((k, sc, o))
# 비교판: 지금(스티커) · A · B · C × 두 장면
F = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30); f2 = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
w, h = 300, 533
cur = [f"{HERE}/now_cafe.png", f"{HERE}/now_grid.png"]
cols = [("지금", cur, "알약 스티커"), ("A", [o for k, s, o in outs if k == "A"], "위 글자 + 아래 판|안 겹쳐 깔끔 · 판 작아짐"),
        ("B (추천)", [o for k, s, o in outs if k == "B"], "판 가득 + 위 그늘에 큰 글자|판도 글자도 커서 첫 1초에 멈춤"),
        ("C", [o for k, s, o in outs if k == "C"], "아래 자막 줄|영화 자막 결 · 표 칸을 가림")]
S = Image.new("RGB", (40 + len(cols) * (w + 30), 170 + 2 * (h + 20)), "#1b2233"); d = ImageDraw.Draw(S)
for i, (t, ims, note) in enumerate(cols):
    x = 40 + i * (w + 30)
    d.text((x, 24), t, font=F, fill="#FFC83D" if i == 2 else "#F3F1EA")
    for li, ln in enumerate(note.split("|")): d.text((x, 66 + li * 30), ln, font=f2, fill="#C3CAD8")
    for j, p in enumerate(ims):
        if os.path.exists(p): S.paste(Image.open(p).convert("RGB").resize((w, h)), (x, 150 + j * (h + 20)))
S.save(f"{HERE}/styles.png"); print("ok", S.size)
