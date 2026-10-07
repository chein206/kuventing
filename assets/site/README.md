# 공식 홈페이지 그림 · 영상 (`/site`)

홈페이지(`app/app/site`)에 쓰는 움직이는 그림은 **전부 실제 화면**이다. 데모 판을 손님처럼 한 바퀴 돌며 녹화했다.
판 화면이 바뀌면(테마 · 3D · 결과 화면) 아래 순서로 다시 굽는다.

| 파일 | 무엇 |
|---|---|
| `rec_hero.mjs` | 데모 판(`/demo/food` 등) 한 바퀴 녹화 — 대기 → 상품 목록 → 고르기 → 밀어서 열기 → 결과. 헤드리스 크롬(그래픽카드) + CDP 스크린캐스트, 누른 자리에 고리 · 끄는 동안 점 |
| `build_assets.py` | 녹화에서 히어로 영상 · 3D 개봉 조각 · 단계 화면 넷 · 남은 티켓 띠 · QR 쿠폰을 뽑고, 상품 사진 · 티켓 원판을 홈페이지 크기로 → `app/public/site/` |
| `og.mjs` | 링크 미리보기 그림(1200×630) — 팝업 입구 장면 + 실제 대기 화면 + 제목 → `app/public/site/og.jpg` |
| `rec_screen.mjs` | 대기 화면(광고판)만 녹화 — 손대지 않은 판에서 모션 광고가 도는 몇 초 → `screen-<업종>.mp4 · .jpg` |
| `screen_fit.py` | 장면 사진 속 검은 화면의 네 귀퉁이를 찾아 영상을 얹는 CSS `matrix3d` — `page.tsx` 의 `M` 에 넣는다 |
| `SHEET-scene.md` | 장면 사진(Flow) 프롬프트 — 팝업 입구 스탠드형 스크린 · 시승 행사장 키오스크. 화면은 까맣게 뽑는다 |
| `SHEET-lab.md` | 시안(`/lab`)용 장면 사진 프롬프트 — 카운터 위 태블릿(2판 첫 화면의 매장 카운터 장면도 여기서) |
| `_rec/` | 녹화 프레임(수천 장) — 커밋 안 함 |

```bash
# kuventing 폴더에서
node assets/site/rec_hero.mjs food 1        # 결과 등급이 매번 다르다 — B 이상(사진 상품)이 나올 때까지 번호를 바꿔 몇 번
node assets/site/rec_hero.mjs food 2
python assets/site/build_assets.py assets/site/_rec/food-<B 이상 나온 번호> assets/site/_rec/food-<E(QR 쿠폰) 나온 번호>
node assets/site/og.mjs
```

- 2026-10-07 판: 라멘 데모 9번째 녹화(B 라멘 1그릇 · 금빛 연출)가 히어로, 1번째(E 1,000원 쿠폰)에서 QR 칸
- **2판(10-07 저녁, 남색 리모델)**: 어두운 판에 금빛 연출이 카지노처럼 읽혀서 개봉 조각 · 쿠폰을 **뷰티 팝업 판**(흰 · 분홍)으로 바꿨다.
  `rec_hero.mjs beauty 1~4` 중 1번(B 본품 택1) → `open.mp4`, 4번(E 온라인 15% 할인) → `coupon.jpg`.
  2판은 히어로 · 단계 화면을 안 쓰므로 `--draw` 로 그 둘만 굽는다

```bash
# 2판 — 개봉 조각 · QR 쿠폰만
python assets/site/build_assets.py assets/site/_rec/beauty-1 assets/site/_rec/beauty-4 --draw

# 대기 화면(광고판) — 업종마다. 540×864 · 30fps
node assets/site/rec_screen.mjs beauty 14
ffmpeg -f concat -safe 0 -i assets/site/_rec/screen-beauty/list.txt -vf fps=30,scale=540:864:flags=lanczos -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -an app/public/site/screen-beauty.mp4

# 장면 사진 속 화면 자리 — 문턱은 화면이 숯색이면 40(팝업 사진), 보통 22
python assets/site/screen_fit.py app/public/site/scene-popup.jpg app/public/site/screen-beauty.jpg _rec/fit-popup.jpg 0.0 40
```
- 히어로는 mp4 하나(약 1.8MB). webm(VP9)은 금가루 · 색종이 때문에 오히려 안 작았다
- 녹화 전에 상품 사진을 미리 받아 둔다(안 그러면 상품 목록이 빈 카드로 한 박자 보인다) — `rec_hero.mjs` 가 한다
