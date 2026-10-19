# 컷 시트 — 0.25초마다(1초 칸은 노랑 표시) 9:16 · 1:1 두 줄
import subprocess, sys, io
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
def grab(path, t, w):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGB"); return im.resize((w, int(im.height * w / im.width)))
ts = [i * 0.25 for i in range(10)] + [2.466]
rows = [("kuventing-logo-9x16-silent.mp4", 150), ("kuventing-logo-1x1-silent.mp4", 150)]
cw, pad = 150, 14
H = pad + sum(int(w * (1920 if "9x16" in p else 1080) / 1080) + 40 for p, w in rows) + pad
sheet = Image.new("RGB", (pad + len(ts) * (cw + pad), H), "#1b2233"); d = ImageDraw.Draw(sheet); y = pad
for p, w in rows:
    for i, t in enumerate(ts):
        im = grab(p, t, w); x = pad + i * (cw + pad)
        sheet.paste(im, (x, y + 30))
        whole = abs(t - round(t)) < 1e-6
        d.text((x, y), f"{t:.2f}s", font=F, fill="#FFC83D" if whole else "#8A93A8")
        if whole: d.rectangle([x - 3, y + 27, x + w + 2, y + 30 + im.height + 2], outline="#FFC83D", width=3)
    y += im.height + 40
sheet.save("contact_sheet.jpg", quality=92); print(sheet.size)
