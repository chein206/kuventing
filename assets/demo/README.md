# 업종 데모 사진 (Flow)

공개 데모(`/demo/arven` · `/demo/beauty` · `/demo/food`)의 상품 · 대기 화면 광고 사진.
**규격은 [이미지규격.md](../../이미지규격.md)** — 상품 1:1 · 아래 1/5 비움, 광고는 피사체 위 15~60% · 아래 40% 비운 어두운 바탕 · 사진 안 글자 없음.

| 파일 | 무엇 |
|---|---|
| `SHEET-prize.md` | 상품 사진 프롬프트 (정사각) — 아르벤 S1~S6 · 뷰티 S7~S12 · 라멘 S13~S14 |
| `SHEET-promo.md` | 광고 사진 프롬프트 (세로 3:4) — 아르벤 S1~S4 · 뷰티 S5~S8 |
| `_cand/` | Flow 후보 더미(판마다 2안) — 커밋 안 함 |
| `pick/` | 고른 원본 — 다시 줄일 때 쓴다 |
| `install.py` | 고른 것 → `app/public/demo/<업종>/` (상품 1000×1000 · 광고 3:4) |

## 뽑는 법 — 전용 엣지 + Flow (이미지 0크레딧)

전용 엣지(CDP 9333, `cld/blog-auto/EDGE.md`)에 붙는다. 다른 작업 탭은 건드리지 않게 **새 탭**에 프로젝트를 만든다.

```bash
# 1) 새 프로젝트 (kuventing/app 에서) — 마지막 줄 PROJECT=<id>
node scripts/flow-newproj.mjs "쿠벤팅 데모 · 상품"
# 2) 시트 뽑기 (shorts-lab 에서) — 판마다 2안, 1K
node tools/pw/flow_still.mjs kv all --sheet ../kuventing/assets/demo/SHEET-prize.md --out ../kuventing/assets/demo/_cand/prize --project <id> --ratio 1:1 --n 2
node tools/pw/flow_still.mjs kv all --sheet ../kuventing/assets/demo/SHEET-promo.md --out ../kuventing/assets/demo/_cand/promo --project <id2> --ratio 3:4 --n 2
# 3) 고른 것을 install.py 의 PICKS 에 적고 (kuventing 에서)
python assets/demo/install.py
```

- 시트를 다시 뽑을 때는 **새 프로젝트에서** — 같은 프로젝트면 옛 그림을 새것으로 세어 받기가 꼬인다(shorts-lab 메모)
- 게이트: 상품은 상품 카드가 보여 주는 가운데 띠(보통 1.5:1, 피날레 3.4:1)에 피사체가 들어오나, 광고는 아래 40% 가 비었나
- 실제 브랜드 로고 금지. 아르벤 굿즈의 `ARVEN` 글자는 가상 브랜드라 넣었다(뭉개진 안은 버린다)
- **차는 "배지 없음"이라 써도 실제 엠블럼이 박혀 나온다**(10-05: 테슬라 T · NIO · 벤츠 별 비슷한 것) — 보닛 · 앞판을 확대해 보고,
  안이 좋으면 cv2 인페인트로 지운다(`S6-b-fix` · `S3-b-fix`, 마스크는 엠블럼만 · 아래 이음선은 피한다)
- **사진 둘레에 얇은 액자가 구워져 나오기도 한다**(흰 · 검정 · 회색) — 가장자리 밝기를 재 보고, 쓸 거면 install.py 다섯째 값으로 잘라 낸다
- 광고 사진은 긴 변 2000 으로 넣는다. Flow 2K 받기(`scripts/flow-2k.mjs`)는 /u/1/ 자리에서 3분 넘게 안 와서 1K 를 Lanczos 로 키웠다
