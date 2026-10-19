# 쿠벤팅 로고 방향 셋 — 마크 SVG + 보드(board.html → board.png)
# python gen_board.py  →  a/b/c-mark.svg, board.html  (그다음 render_png.py 로 board.png)
import os

HERE = os.path.dirname(os.path.abspath(__file__))
NAVY, NIGHT, YEL, YEL_INK, CREAM = "#233253", "#070B16", "#FFC83D", "#1A1300", "#F3F1EA"

# 표(티켓) 윤곽 — 양옆 반원 홈. 256 캔버스, 가로 208 · 세로 128
def ticket(x0=24, y0=64, w=208, h=128, r=18, n=20):
    x1, y1, cy = x0 + w, y0 + h, y0 + h / 2
    return (f"M{x0+r} {y0} H{x1-r} A{r} {r} 0 0 1 {x1} {y0+r} V{cy-n} A{n} {n} 0 0 0 {x1} {cy+n} "
            f"V{y1-r} A{r} {r} 0 0 1 {x1-r} {y1} H{x0+r} A{r} {r} 0 0 1 {x0} {y1-r} V{cy+n} "
            f"A{n} {n} 0 0 0 {x0} {cy-n} V{y0+r} A{r} {r} 0 0 1 {x0+r} {y0} Z")


def svg(body, title, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img">'
            f'<title>{title}</title><defs>{defs}</defs>{body}</svg>')


T = ticket()
# A · 밀어서 열기 — 표를 가로로 반 갈라 윗장을 오른쪽으로 민 순간
A_defs = ('<clipPath id="top"><rect x="0" y="0" width="256" height="128"/></clipPath>'
          '<clipPath id="bot"><rect x="0" y="128" width="256" height="128"/></clipPath>')
def A(fg, bg):
    return svg(f'<g transform="translate(-14,0)"><path fill="{fg}" d="{T}" clip-path="url(#bot)"/>'
               f'<path fill="{fg}" d="{T}" clip-path="url(#top)" transform="translate(30,-6)"/>'
               + "".join(f'<circle cx="{168-14+30}" cy="{80 + i*11}" r="3.2" fill="{bg}"/>' for i in range(4))
               + "".join(f'<circle cx="{168-14}" cy="{140 + i*11}" r="3.2" fill="{bg}"/>' for i in range(4))
               + '</g>', "kuventing A slide", A_defs)

# B · K 표 — 표 안 빈 공간이 K (홈 하나가 K 의 허리)
def B(fg, bg):
    K = (f'<path fill="{bg}" d="M88 92 H112 V164 H88 Z"/>'
         f'<path fill="{bg}" d="M112 128 L150 92 H180 L136 133 Z"/>'
         f'<path fill="{bg}" d="M128 124 L180 164 H150 L114 136 Z"/>')
    return svg(f'<path fill="{fg}" d="{T}"/>{K}', "kuventing B K-ticket")

# C · 떼는 스티커 표 — 오른쪽 위 귀퉁이가 젖혀져 뒷면(크림)이 보인다 = 열어 보는 순간
def C(fg, bg):
    return svg(f'<path fill="{fg}" d="{T}"/>'
               f'<path fill="{bg}" d="M176 64 H232 V120 Z"/>'
               f'<path fill="{CREAM}" d="M176 64 L232 120 L190 106 Z"/>'
               f'<path fill="none" stroke="{bg}" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round" d="M100 76 V180"/>',
               "kuventing C peel")

MARKS = {"a": A, "b": B, "c": C}
for k, fn in MARKS.items():
    open(os.path.join(HERE, f"{k}-mark.svg"), "w", encoding="utf-8").write(fn(YEL, NAVY))

INFO = {
    "a": ("A · 밀어서 열기", "판에서 표를 밀어 여는 그 순간을 멈춘 모양. 쿠벤팅만의 동작이 곧 로고.",
          "티켓 모양 로고는 흔함(예매 앱들) — 어긋난 두 장으로 차별. 모션은 이 어긋남이 0→열림."),
    "b": ("B · K 표", "표 속 빈 공간이 K. 이름 첫 글자 + 표, 작은 크기에서 가장 또렷.",
          "글자 K 티켓은 다른 업종에도 있을 수 있음 — 홈(반원)이 K 허리에 닿는 점이 우리 것."),
    "c": ("C · 떼는 스티커", "귀퉁이를 젖힌 경품 스티커. 홈페이지 스티커 · 말풍선 결, 젊고 가벼움.",
          "젖힌 귀퉁이는 흔한 아이콘 문법 — 표 홈 + 점선 절취선과 같이 써야 우리 것."),
}

def circle(k, fg, bg, size):
    return (f'<div class="circ" style="width:{size}px;height:{size}px;background:{bg}">'
            f'<div style="width:{size*0.86}px;height:{size*0.86}px">{MARKS[k](fg, bg)}</div></div>')

rows = []
for k in "abc":
    t, idea, sim = INFO[k]
    rows.append(f'''
<section class="row">
  <div class="head"><h2>{t}</h2><p>{idea}</p><p class="sim">닮은 것: {sim}</p></div>
  <div class="tiles">
    <div class="tile" style="background:{NIGHT}">{MARKS[k](YEL, NIGHT)}</div>
    <div class="tile" style="background:{YEL}">{MARKS[k](NAVY, YEL)}</div>
    <div class="circs">
      {circle(k, YEL, NAVY, 110)}{circle(k, YEL, NAVY, 48)}{circle(k, YEL, NAVY, 24)}
      <span class="lbl">원 110 · 48 · 24px</span>
    </div>
    <div class="lock" style="background:{NIGHT}">
      <div class="lm">{MARKS[k](YEL, NIGHT)}</div>
      <div class="lw"><div class="ko">쿠벤팅</div><div class="en">KUVENTING</div></div>
    </div>
  </div>
</section>''')

html = f'''<!doctype html><html><head><meta charset="utf-8">
<style>@font-face{{font-family:'Black Han Sans';src:url(fonts/BlackHanSans-Regular.ttf)}}@font-face{{font-family:'Archivo';src:url(fonts/Archivo-VF.ttf);font-weight:100 900;font-stretch:62% 125%}}</style>
<style>
body{{margin:0;background:#0D1426;color:{CREAM};font-family:'Malgun Gothic',sans-serif;width:1600px}}
.top{{padding:56px 64px 20px}} .top h1{{margin:0;font:400 54px 'Black Han Sans'}} .top p{{margin:8px 0 0;color:#8A93A8;font-size:22px}}
.row{{padding:26px 64px;border-top:1px solid rgba(190,205,255,.12)}}
.head h2{{margin:0;font:400 38px 'Black Han Sans';color:{YEL}}} .head p{{margin:6px 0 0;font-size:21px;color:#C3CAD8}} .head .sim{{font-size:17px;color:#8A93A8}}
.tiles{{display:flex;gap:22px;margin-top:18px;align-items:center}}
.tile{{width:230px;height:230px;border-radius:22px;display:flex;align-items:center;justify-content:center}} .tile svg{{width:200px;height:200px}}
.circs{{display:flex;align-items:center;gap:18px;width:260px;flex-wrap:wrap}} .circ{{border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden}} .circ svg{{width:100%;height:100%}}
.lbl{{font-size:15px;color:#8A93A8;width:100%}}
.lock{{flex:1;height:230px;border-radius:22px;display:flex;align-items:center;gap:22px;padding:0 34px}} .lm svg{{width:150px;height:150px}}
.ko{{font:400 92px/1 'Black Han Sans';color:{CREAM};letter-spacing:-1px}} .en{{font:800 30px 'Archivo';font-variation-settings:'wdth' 125;letter-spacing:6px;color:{YEL};margin-top:10px}}
</style></head><body>
<div class="top"><h1>쿠벤팅 로고 — 방향 셋</h1><p>남색 #070B16·#233253 + 노랑 #FFC83D 하나 · 표(티켓) + 양옆 반원 홈 · ✦·금빛·도박 기호 없음 · 벡터 · 글자는 블랙한산스 / Archivo(넓게) 임시</p></div>
{"".join(rows)}
</body></html>'''
open(os.path.join(HERE, "board.html"), "w", encoding="utf-8").write(html)
print("ok")
