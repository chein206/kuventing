# 1초 컷 시트 — 0초부터 1초마다 + 마지막 프레임, 격자 3:4 안전 구역(y 240~1680) 선 표시
import subprocess, io, sys, json
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout)
ts = [float(t) for t in range(int(dur) + 1) if t < dur - 0.4] + [dur - 0.12]
F = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
W, H, P = 216, 384, 12
cols = min(len(ts), 9); rows = (len(ts) + cols - 1) // cols
S = Image.new("RGB", (P + cols * (W + P), P + rows * (H + 40)), "#1b2233"); d = ImageDraw.Draw(S)
for i, t in enumerate(ts):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGB").resize((W, H))
    x, y = P + (i % cols) * (W + P), P + (i // cols) * (H + 40)
    S.paste(im, (x, y + 30)); d.text((x, y), f"{t:.1f}s", font=F, fill="#FFC83D")
    for yy in (240, 1680): d.line([(x, y + 30 + yy * H / 1920), (x + W, y + 30 + yy * H / 1920)], fill="#FF5A5A", width=1)
S.save(out, quality=90); print("ok", out, S.size)
