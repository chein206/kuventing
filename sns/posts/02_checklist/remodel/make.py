# 02 「럭키드로우 열기 전에 확인할 7가지」 리모델 (요청 03 · CARD-STYLE 결)
# 표지 = 빈 점검표 클립보드 · 끝 장 = 7칸 다 체크된 같은 클립보드(앞뒤 짝)
# 가운데 일곱 장은 장마다 다른 실물: 포스터 + 메모지 · 실제 판 화면 · 영수증(노랑 판) · 서식 + 도장 · 판 표 고르기 · 배치도 · 판 여는 순간
# python make.py → ../out/card-1~9.png · _sheet.png
import os, sys, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")
CLD = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
P = lambda *a: os.path.join(CLD, *a).replace("\\", "/")
FONT = P("kuventing", "sns", "brand", "logo", "concepts", "fonts")
PRET = P("vidops", "remotion", "public", "fonts", "PretendardVariable.woff2")
IMG = os.path.join(HERE, "img").replace("\\", "/")
MARK = open(P("kuventing", "sns", "brand", "logo", "svg", "mark-yellow.svg"), encoding="utf-8").read().replace('width="256" height="256"', 'width="100%" height="100%"')
MARK_NAVY = MARK.replace("#FFC83D", "#233253")
SK = os.path.expanduser("~/.claude/skills/logo-design/scripts/render_png.py")
NIGHT, NAVY, YEL, INK, CREAM, DIM = "#070B16", "#233253", "#FFC83D", "#1A1300", "#F3F1EA", "#8A93A8"
N = 9

CSS = f"""
@font-face{{font-family:BHS;src:url(file:///{FONT}/BlackHanSans-Regular.ttf)}}
@font-face{{font-family:Arch;src:url(file:///{FONT}/Archivo-VF.ttf);font-weight:100 900;font-stretch:62% 125%}}
@font-face{{font-family:Pret;src:url(file:///{PRET});font-weight:100 900}}
*{{box-sizing:border-box}} body{{margin:0;font-family:Pret,sans-serif;color:{CREAM}}}
.s{{position:relative;width:1080px;height:1350px;overflow:hidden;background:{NIGHT}}}
.top{{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:14px;font:800 26px Arch;font-stretch:125%;letter-spacing:.06em}}
.top i{{width:52px;height:52px;display:block}}
.pg{{position:absolute;right:72px;top:72px;font:700 24px Arch;color:{DIM}}}
.h{{font-family:BHS;font-weight:400;line-height:1.12;letter-spacing:-.01em}}
.b{{font-size:34px;line-height:1.55;color:#C3CAD8}} .b b{{color:{CREAM};font-weight:700}}
.handle{{position:absolute;left:72px;bottom:56px;font:600 24px Pret;color:{DIM}}}
.paper{{background:{CREAM};color:{NIGHT};box-shadow:0 30px 60px rgba(0,0,0,.45)}}
.demo{{display:inline-block;padding:6px 16px;border-radius:99px;background:rgba(7,11,22,.78);color:{CREAM};font:700 22px Pret;border:1px solid rgba(243,241,234,.25)}}
"""
ITEMS = ["「모두 받아 가요」 문구 = 실제 구성", "남은 수는 실제와 같게", "5만 원 넘는 경품은 세금부터",
         "개인정보는 필요한 만큼만", "줄은 고르는 시간에서", "찍히는 자리를 미리", "마지막 한 장 보여 주기"]


def chrome(i, dark=True, ink=None):
    c = ink or (CREAM if dark else INK)
    m = MARK if dark else MARK_NAVY
    return (f'<div class="top" style="color:{c}"><i>{m}</i>KUVENTING</div><div class="pg" style="color:{DIM if dark else "#7a6a3a"}">{i} / {N}</div>'
            f'<div class="handle" style="color:{DIM if dark else "#7a6a3a"}">@kuventing</div>')


def clipboard(checked, x, y, w, rot, sc=1):
    rows = "".join(
        f'<div style="display:flex;align-items:center;gap:22px;padding:20px 0;border-bottom:2px solid #d9d4c6">'
        f'<div style="width:46px;height:46px;border:4px solid {NIGHT};border-radius:8px;position:relative;flex:none">'
        + (f'<svg viewBox="0 0 46 46" style="position:absolute;left:-4px;top:-10px;width:62px;height:62px"><path d="M8 24 L19 35 L42 6" stroke="{YEL}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 24 L19 35 L42 6" stroke="{NIGHT}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".25"/></svg>' if checked else "")
        + f'</div><span style="font:{"700" if checked else "600"} 30px Pret;color:{NIGHT};opacity:{.55 if checked else 1}">{i + 1}. {t}</span></div>'
        for i, t in enumerate(ITEMS))
    return (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;transform:rotate({rot}deg) scale({sc});transform-origin:0 0">'
            f'<div style="position:absolute;left:50%;top:-34px;transform:translateX(-50%);width:220px;height:70px;border-radius:18px;background:#3a4258;box-shadow:0 8px 20px rgba(0,0,0,.4)"></div>'
            f'<div class="paper" style="padding:64px 44px 30px;border-radius:10px">'
            f'<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:4px solid {NIGHT};padding-bottom:16px">'
            f'<span style="font:400 44px BHS">행사 전날 점검표</span><span style="font:700 20px Arch;font-stretch:125%;letter-spacing:.08em;color:#666">LUCKY DRAW</span></div>'
            f'{rows}</div></div>')


cards = {}
# 1 표지 — 빈 점검표
cards[1] = f"""<div class="s">{chrome(1)}
 <div class="h" style="position:absolute;left:72px;top:190px;font-size:104px">럭키드로우<br>열기 전에<br>확인할 <span style="color:{YEL}">7가지</span></div>
 <div class="b" style="position:absolute;left:76px;top:560px">저장해 두고<br>행사 전날 한 번 보세요</div>
 {clipboard(False, 470, 700, 720, 7)}</div>"""

# 2 「모두 받아 가요」 — 포스터 + 메모지
cards[2] = f"""<div class="s">{chrome(2)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:78px">「모두 받아 가요」<br>라고 적었다면</div>
 <div class="paper" style="position:absolute;left:150px;top:470px;width:600px;height:560px;transform:rotate(-4deg);border-radius:6px;padding:56px 50px">
  <div style="font:700 26px Arch;font-stretch:125%;letter-spacing:.14em;color:#8a7a50">LUCKY DRAW · 50</div>
  <div style="font:400 96px/1.08 BHS;margin-top:22px;color:{NAVY}">모두<br>받아 가요!</div>
  <div style="font:600 28px Pret;margin-top:28px;color:#555">체험하신 분 누구나 한 장씩</div></div>
 <div style="position:absolute;left:600px;top:840px;width:330px;height:300px;background:{YEL};transform:rotate(6deg);box-shadow:0 18px 40px rgba(0,0,0,.4);padding:40px 34px;color:{INK}">
  <div style="font:800 36px/1.4 Pret">마지막 한 장까지<br>경품 있나?</div><div style="font:600 24px Pret;margin-top:16px;opacity:.7">포스터 문구 = 실제 구성</div></div>
 <div class="b" style="position:absolute;left:76px;top:1150px;width:900px;font-size:30px">행사 전에 한 번 더 세어 보세요.</div></div>"""

# 3 남은 수 — 실제 판 화면(표 고르기, 34/50)
cards[3] = f"""<div class="s">{chrome(3)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:92px">남은 수는<br>실제와 같게</div>
 <div class="b" style="position:absolute;left:76px;top:420px;width:640px">1등이 이미 나갔는데 「1등 남음」이 붙어 있으면 <b>거짓 광고</b>가 될 수 있어요.</div>
 <div style="position:absolute;left:400px;top:600px;width:700px;padding:18px;border-radius:44px;background:#1c2540;transform:rotate(-5deg);box-shadow:0 30px 60px rgba(0,0,0,.55)">
  <div style="position:relative;border-radius:26px;overflow:hidden;height:820px"><img src="file:///{IMG}/beauty_4.9.png" style="width:664px;display:block"></div>
  <div style="position:absolute;left:{18 + 664 * 0.855 - 80}px;top:{18 + 664 * 0.026 - 34}px;width:170px;height:96px;border:7px solid {YEL};border-radius:60px"></div></div>
 <div style="position:absolute;left:470px;top:1250px"><span class="demo">실제 판 화면 · 데모</span></div></div>"""

# 4 세금 — 노랑 판 + 영수증
zig = "".join(f"L{x} {1 if (x // 30) % 2 else 18}" for x in range(30, 661, 30))
cards[4] = f"""<div class="s" style="background:{YEL}">{chrome(4, dark=False)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:92px;color:{INK}">5만 원 넘는<br>경품은 세금부터</div>
 <div style="position:absolute;left:210px;top:480px;width:660px;transform:rotate(-3deg);filter:drop-shadow(0 26px 40px rgba(80,55,0,.35))">
  <div style="background:#FFFDF7;color:{NIGHT};padding:46px 50px 30px;font-family:Pret">
   <div style="font:400 40px BHS;text-align:center">경품 지급 메모</div>
   <div style="text-align:center;font:600 20px Arch;font-stretch:125%;letter-spacing:.12em;color:#888;margin:6px 0 24px">EXAMPLE · 예시</div>
   <div style="border-top:3px dashed #bbb;padding-top:22px;display:flex;justify-content:space-between;font:600 32px Pret"><span>경품 가격</span><span>60,000원</span></div>
   <div style="display:flex;justify-content:space-between;font:800 32px Pret;margin-top:16px"><span>제세공과금 22%</span><span>13,200원</span></div>
   <div style="font:500 22px Pret;color:#777;margin-top:6px">소득세 20% + 지방소득세 2% · 건당 5만 원 이하는 과세 안 함</div>
   <div style="border-top:3px dashed #bbb;margin-top:24px;padding-top:22px;font:800 32px Pret">누가 내나요?</div>
   <div style="display:flex;gap:30px;margin-top:14px;font:600 30px Pret"><span>☐ 받는 분</span><span>☐ 우리 가게</span></div></div>
  <svg width="660" height="20" viewBox="0 0 660 20" style="display:block"><path d="M0 0 L0 18 {zig} L660 0 Z" fill="#FFFDF7"/></svg></div>
 <div class="b" style="position:absolute;left:76px;top:1150px;width:930px;color:{INK};font-size:30px">받는 분 정보를 어디까지 받을지도 <b style="color:{INK}">미리 정해서 같이 공지</b>하세요.</div></div>"""

# 5 개인정보 — 서식 + 파기 도장
row = lambda k, v, st="": f'<div style="display:flex;gap:20px;align-items:center;padding:22px 0;border-bottom:2px solid #d9d4c6;font:600 32px Pret"><span style="width:150px;color:#666">{k}</span><span style="{st}">{v}</span></div>'
cards[5] = f"""<div class="s">{chrome(5)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:92px">개인정보는<br>필요한 만큼만</div>
 <div class="paper" style="position:absolute;left:130px;top:470px;width:780px;padding:40px 50px 34px;border-radius:8px;transform:rotate(2deg)">
  <div style="font:400 40px BHS;margin-bottom:10px">경품 받는 분</div>
  {row("연락처", "010 - ···· - ····")}{row("주소", "택배일 때만", "color:#999")}{row("생일", "안 받아요", "text-decoration:line-through;color:#aaa")}{row("직업", "안 받아요", "text-decoration:line-through;color:#aaa")}
  <div style="position:absolute;right:46px;bottom:40px;transform:rotate(-12deg);border:5px solid {NAVY};color:{NAVY};border-radius:14px;padding:8px 20px;text-align:center;opacity:.9">
   <div style="font:400 34px BHS">파기</div><div style="font:700 22px Pret">날짜 ○○. ○○</div></div></div>
 <div class="b" style="position:absolute;left:76px;top:1060px;width:930px;font-size:31px">모바일 쿠폰이면 연락처까지, 택배면 주소까지.<br><b>지우는 날짜도</b> 같이 정해 두세요.</div></div>"""

# 6 줄은 고르는 시간에서 — 판 표 고르기 화면 크게
cards[6] = f"""<div class="s">{chrome(6)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:84px">줄은 고르는<br>시간에서 길어져요</div>
 <div class="b" style="position:absolute;left:76px;top:410px;width:900px">여는 건 금방인데 「뭘 고르지」에서 멈춰요.<br><b>남은 경품이 한눈에</b> 보이면 고르는 시간이 줄어요.</div>
 <div style="position:absolute;left:60px;top:620px;width:1000px;height:640px;border-radius:36px;overflow:hidden;border:12px solid #1c2540;box-shadow:0 30px 60px rgba(0,0,0,.55);transform:rotate(2deg)">
  <img src="file:///{IMG}/beauty_4.9.png" style="width:1000px;display:block;margin-top:-180px"></div>
 <div style="position:absolute;right:90px;top:640px"><span class="demo">실제 판 화면 · 데모</span></div></div>"""

# 7 찍히는 자리 — 크림 판 + 위에서 본 배치도
cards[7] = f"""<div class="s" style="background:{CREAM}">{chrome(7, dark=False, ink=NIGHT)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:92px;color:{NIGHT}">찍히는 자리를<br>미리 보세요</div>
 <svg style="position:absolute;left:90px;top:470px" width="900" height="560" viewBox="0 0 900 560">
  <rect x="20" y="20" width="860" height="520" rx="26" fill="none" stroke="#b9b2a0" stroke-width="3" stroke-dasharray="10 10"/>
  <text x="44" y="64" font-family="Pret" font-weight="700" font-size="24" fill="#8a826e">위에서 본 자리 (예시)</text>
  <rect x="380" y="40" width="140" height="34" rx="8" fill="{NIGHT}"/><text x="450" y="110" text-anchor="middle" font-family="BHS" font-size="30" fill="{NIGHT}">화면 · 벽 쪽</text>
  <path d="M450 330 L300 150 L600 150 Z" fill="{YEL}" opacity=".55"/>
  <circle cx="450" cy="330" r="30" fill="{NAVY}"/><text x="450" y="390" text-anchor="middle" font-family="Pret" font-weight="800" font-size="26" fill="{NIGHT}">찍는 손님</text>
  <text x="640" y="190" font-family="Pret" font-weight="700" font-size="24" fill="#6b6350">카메라에 담기는 쪽 = 벽</text>
  {''.join(f'<circle cx="{130 + i * 70}" cy="470" r="22" fill="#c9c2b0"/>' for i in range(10))}
  <text x="130" y="530" font-family="Pret" font-weight="700" font-size="24" fill="#6b6350">줄 선 손님들 — 카메라 뒤쪽으로</text></svg>
 <div class="b" style="position:absolute;left:76px;top:1080px;width:930px;color:#3a3a3a;font-size:31px">손님은 여는 순간을 찍어요. 그 뒤로 <b style="color:{NIGHT}">다른 손님 얼굴이 걸리지 않는 방향</b>으로 놓아 주세요.</div></div>"""

# 8 마지막 한 장 — 판 여는 순간
cards[8] = f"""<div class="s">{chrome(8)}
 <div class="h" style="position:absolute;left:72px;top:180px;font-size:92px">마지막 한 장을<br>준비하세요</div>
 <div class="b" style="position:absolute;left:76px;top:420px;width:900px">남은 한 장이 나가는 순간에 사람이 모여요.<br><b>그 순간을 어떻게 보여 줄지</b> 정해 두면 끝까지 줄이 이어져요.</div>
 <div style="position:absolute;left:-40px;top:660px;width:1160px;height:560px;overflow:hidden;border-radius:36px;transform:rotate(-3deg);box-shadow:0 30px 60px rgba(0,0,0,.55)">
  <img src="file:///{IMG}/beauty_10.1.png" style="width:1160px;display:block;margin-top:-470px"></div>
 <div style="position:absolute;left:80px;top:1230px"><span class="demo">실제 판 화면 · 데모</span></div></div>"""

# 9 끝 — 다 체크된 점검표 + 로고 + CTA
cards[9] = f"""<div class="s">{chrome(9)}
 <div class="h" style="position:absolute;left:72px;top:170px;font-size:70px">남은 수, 등급, 마지막 한 장까지<br><span style="color:{YEL}">화면이 보여 줘요</span></div>
 {clipboard(True, 150, 420, 760, -3, 0.82)}
 <div style="position:absolute;left:72px;top:1110px;right:72px;display:flex;gap:26px;align-items:center">
  <div style="width:110px;height:110px;flex:none">{MARK}</div>
  <div><div style="font:700 34px Pret">데모는 프로필 링크에서 직접 열어 보세요</div>
   <div style="font:600 28px Pret;color:{DIM};margin-top:8px">도입 문의는 DM · <span style="color:{YEL}">kuventing.scpadlab.com</span></div></div></div></div>"""


def render(i, body):
    p = os.path.join(HERE, f"_c{i}.html")
    open(p, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body style="width:1080px">{body}</body></html>')
    out = os.path.join(OUT, f"card-{i}.png")
    subprocess.run([sys.executable, SK, p, "-o", out, "--width", "1080", "--height", "1350"], check=True, capture_output=True)
    os.remove(p)
    return out


os.makedirs(OUT, exist_ok=True)
for old in os.listdir(OUT):
    if old.startswith("card-") and int(old[5:-4]) > N: os.remove(os.path.join(OUT, old))
paths = [render(i, cards[i]) for i in range(1, N + 1)]
W, H, G = 324, 405, 10
sheet = Image.new("RGB", (5 * (W + G) + G, 2 * (H + G) + G), "#2a2a2a")
for k, p in enumerate(paths):
    sheet.paste(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), (G + (k % 5) * (W + G), G + (k // 5) * (H + G)))
sheet.save(os.path.join(OUT, "_sheet.png"))
print("ok", len(paths))
