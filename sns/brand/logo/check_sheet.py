# 납품 점검 한 장 — 프로필 원 자르기 · 실제 크기 파비콘 · 워터마크 · 앱 아이콘 · 모션 마지막 프레임(인스타 UI 자리 표시)
import subprocess, io
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
W = Image.new("RGB", (1700, 980), "#1b2233"); d = ImageDraw.Draw(W)
def lab(x, y, t): d.text((x, y), t, font=F, fill="#C3CAD8")
p = Image.open("png/profile-1080.png").convert("RGBA").resize((300, 300))
m = Image.new("L", (300, 300), 0); ImageDraw.Draw(m).ellipse([0, 0, 299, 299], fill=255)
W.paste(p, (30, 60), m); lab(30, 20, "프로필 1080 → 원 자르기")
x = 370
for s in (110, 48, 32, 24):
    q = Image.open("png/profile-1080.png").convert("RGBA").resize((s, s), Image.LANCZOS)
    mm = Image.new("L", (s, s), 0); ImageDraw.Draw(mm).ellipse([0, 0, s - 1, s - 1], fill=255)
    W.paste(q, (x, 60 + (110 - s) // 2), mm); lab(x, 180, str(s)); x += s + 30
lab(370, 20, "실제 크기 (원)")
for i, s in enumerate((16, 32, 48)):
    f = Image.open(f"png/web/favicon-{s}.png").convert("RGBA")
    W.paste(f, (720 + i * 70, 60 + (48 - s)), f)
lab(720, 20, "파비콘 16·32·48")
a = Image.open("png/web/apple-touch-icon.png").convert("RGBA"); W.paste(a, (950, 50), a); lab(950, 20, "앱 아이콘 180")
bg = Image.linear_gradient("L").resize((420, 300)).convert("RGB")
bg = Image.merge("RGB", [c.point(lambda v, k=k: int(60 + v * k)) for c, k in zip(bg.split(), (0.5, 0.55, 0.65))])
wm = Image.open("png/watermark-white-60-128.png").convert("RGBA").resize((96, 96))
bg.paste(wm, (420 - 96 - 16, 16), wm); W.paste(bg, (1170, 60)); lab(1170, 20, "워터마크 흰 60%")
def last(path, w):
    png = subprocess.run(["ffmpeg", "-v", "error", "-sseof", "-0.05", "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGB"); return im, im.resize((w, int(im.height * w / im.width)))
full, t = last("motion/kuventing-logo-9x16.mp4", 300); k = 300 / 1080
o = Image.new("RGBA", t.size, (0, 0, 0, 0)); od = ImageDraw.Draw(o)
od.rectangle([0, 0, 300, 250 * k], fill=(255, 80, 80, 70)); od.rectangle([0, (1920 - 420) * k, 300, 1920 * k], fill=(255, 80, 80, 70))
t = Image.alpha_composite(t.convert("RGBA"), o); W.paste(t, (30, 400)); lab(30, 370, "9:16 끝 · 빨강=UI 자리")
_, s = last("motion/kuventing-logo-1x1.mp4", 400); W.paste(s, (450, 400)); lab(450, 370, "1:1 마지막 프레임")
full.save("motion/cover-9x16.png")
W.save("check_sheet.png"); print("ok")
