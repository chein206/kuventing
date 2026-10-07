# 공식 홈페이지 그림 · 영상 (`/site`)

홈페이지(`app/app/site`)에 쓰는 움직이는 그림은 **전부 실제 화면**이다. 데모 판을 손님처럼 한 바퀴 돌며 녹화했다.
판 화면이 바뀌면(테마 · 3D · 결과 화면) 아래 순서로 다시 굽는다.

| 파일 | 무엇 |
|---|---|
| `rec_hero.mjs` | 데모 판(`/demo/food` 등) 한 바퀴 녹화 — 대기 → 상품 목록 → 고르기 → 밀어서 열기 → 결과. 헤드리스 크롬(그래픽카드) + CDP 스크린캐스트, 누른 자리에 고리 · 끄는 동안 점 |
| `build_assets.py` | 녹화에서 히어로 영상 · 3D 개봉 조각 · 단계 화면 넷 · 남은 티켓 띠 · QR 쿠폰을 뽑고, 상품 사진 · 티켓 원판을 홈페이지 크기로 → `app/public/site/` |
| `og.mjs` | 링크 미리보기 그림(1200×630) → `app/public/site/og.jpg` |
| `_rec/` | 녹화 프레임(수천 장) — 커밋 안 함 |

```bash
# kuventing 폴더에서
node assets/site/rec_hero.mjs food 1        # 결과 등급이 매번 다르다 — B 이상(사진 상품)이 나올 때까지 번호를 바꿔 몇 번
node assets/site/rec_hero.mjs food 2
python assets/site/build_assets.py assets/site/_rec/food-<B 이상 나온 번호> assets/site/_rec/food-<E(QR 쿠폰) 나온 번호>
node assets/site/og.mjs
```

- 2026-10-07 판: 라멘 데모 9번째 녹화(B 라멘 1그릇 · 금빛 연출)가 히어로, 1번째(E 1,000원 쿠폰)에서 QR 칸
- 히어로는 mp4 하나(약 1.8MB). webm(VP9)은 금가루 · 색종이 때문에 오히려 안 작았다
- 녹화 전에 상품 사진을 미리 받아 둔다(안 그러면 상품 목록이 빈 카드로 한 박자 보인다) — `rec_hero.mjs` 가 한다
