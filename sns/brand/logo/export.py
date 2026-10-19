# 쿠벤팅 로고 납품 PNG — gen_mark.py v3 다음에 돌린다
# python export.py → png/ (프로필 1080·512·192 · 워터마크 · 묶음) + png/web (파비콘 · 앱 아이콘 세트)
import os, subprocess, sys
sys.argv = [sys.argv[0], "v3"]
import gen_mark as g

HERE = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(HERE, "png"); os.makedirs(PNG, exist_ok=True)
SK = os.path.expanduser("~/.claude/skills/logo-design/scripts")
render = lambda svg, out, *a: subprocess.run([sys.executable, os.path.join(SK, "render_png.py"), svg, "-o", out, *a], check=True, capture_output=True)


def save(name, text):
    p = os.path.join(g.OUT, name); open(p, "w", encoding="utf-8").write(text); return p


# 프로필: 남색 정사각형 + 노랑 마크. 원으로 잘려도 표 모서리가 원 안쪽(지름의 92%)에 들도록
S = 0.92
prof = save("profile.svg", g.svg(256, 256, f'<rect width="256" height="256" fill="{g.NAVY}"/>'
                                 f'<g transform="translate({128 - 128 * S} {128 - 128 * S}) scale({S})">{g.mark_body(g.YEL)}</g>', "쿠벤팅 프로필"))
for px in (1080, 512, 192):
    render(prof, os.path.join(PNG, f"profile-{px}.png"), "--size", str(px))

# 워터마크: 흰 한 색 · 반투명(60%) — 릴스 구석
wm = save("watermark-white-60.svg", g.svg(256, 256, f'<g opacity="0.6">{g.mark_body("#FFFFFF")}</g>', "쿠벤팅 워터마크"))
for px in (256, 128):
    render(wm, os.path.join(PNG, f"watermark-white-60-{px}.png"), "--size", str(px))

# 묶음 · 마크 PNG (투명 바탕 판은 마크만, 묶음은 바탕 포함)
for name, w, h in (("lockup-h-night", 1600, 0), ("lockup-v-night", 1000, 0), ("lockup-h-yellow", 1600, 0),
                   ("mark-yellow", 1024, 1024), ("mark-white", 1024, 1024), ("mark-black", 1024, 1024)):
    src = os.path.join(g.OUT, f"{name}.svg")
    args = ["--size", str(w)] if h else ["--width", str(w), "--height", str(int(w * float(open(src, encoding="utf-8").read().split('viewBox="0 0 ')[1].split('"')[0].split()[1]) / float(open(src, encoding="utf-8").read().split('viewBox="0 0 ')[1].split('"')[0].split()[0])))]
    render(src, os.path.join(PNG, f"{name}.png"), *args)

# 파비콘 · 앱 아이콘 세트 (스킬 export_variants)
subprocess.run([sys.executable, os.path.join(SK, "export_variants.py"), os.path.join(g.OUT, "mark-yellow.svg"), "--name", "kuventing",
                "--title", "쿠벤팅", "--icon-bg", g.NAVY, "--icon-fg", g.YEL, "--mono", g.NAVY, "--web-icons",
                "--out-dir", os.path.join(PNG, "web")], check=True)
print("ok")
