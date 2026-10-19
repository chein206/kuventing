# 쿠벤팅 로고 (요청 01 · 2026-10-19 대표 OK)

마크 = K표(양옆 반원 홈 · 표 속 빈 공간 K) + 왼쪽 위 젖힌 귀퉁이 「대」. 노랑 `#FFC83D` / 남색 두 색, 젖힌 날개는 바탕색 틈으로 구분.
판에서 표가 왼쪽부터 열리는 것과 같은 방향. 글자 = 블랙한산스 「쿠벤팅」 + Archivo 넓게 「KUVENTING」(패스로 바꿔 둠, 폰트 없이 열림).

## 파일

| 어디 | 무엇 |
|---|---|
| `svg/mark-*.svg` | 마크 — 노랑/밤 바탕, 남색/노랑 바탕, 투명 노랑, 흰 한 색, 검정 한 색 |
| `svg/wordmark-*.svg` | 글자만 — 어두운 바탕용, 밝은 바탕용 |
| `svg/lockup-*.svg` | 묶음 — 가로(밤), 세로(밤), 가로(노랑) |
| `svg/profile.svg` · `png/profile-1080/512/192.png` | 인스타 프로필 — 남색 + 노랑 마크, 원으로 잘려도 안전 |
| `svg/watermark-white-60.svg` · `png/watermark-white-60-*.png` | 릴스 구석 워터마크(흰 60%) |
| `png/lockup-*.png` · `png/mark-*.png` | 묶음 · 마크 PNG |
| `png/web/` | 파비콘(ico · 16/32/48) · 앱 아이콘 180/192/512 · maskable · webmanifest · head 스니펫 |
| `motion/kuventing-logo-9x16(.mp4/-silent.mp4)` | 모션 로고 2.5초 1080×1920 — 소리 판 / 무음 판 |
| `motion/kuventing-logo-1x1(.mp4/-silent.mp4)` | 같은 것 1080×1080 |
| `motion/cover-9x16.png` · `cover-1x1.png` | 마지막 프레임(표지 · 끝 카드 정지) |
| `motion/contact_sheet.jpg` | 0.25초 컷 시트(1초 칸 노랑) |
| `motion/kuventing-logo-sfx.wav` | 소리만 |
| `check_sheet.png` · `board-mark-2.png` | 점검 한 장(원 자르기 · 실제 크기 · 워터마크 · UI 자리) · 확정 보드 |

## 모션 로고

0~0.2초 귀퉁이 집힘(딱) → 0.2~0.6초 덮개가 오른쪽으로 젖혀 날아감(판의 밀어서 열기 소리 · 휙) → K표 드러나고 귀퉁이 접혀 로고 상태로 →
0.7~1.2초 마크가 위로 올라가고 쿠벤팅 · KUVENTING 이 왼쪽부터 열림(은 반짝 3음 · 쿵) → **1.47~2.5초 묶음 정지(1초+)**.
덮개 뒷면은 로고 남색 `#233253`(노랑 · 남색 두 색 안). 9:16 은 위 250 · 아래 420 비움(묶음 y 500~1250). 소리 -16 LUFS · 피크 -2dB(짧은 효과음이라 피크 기준으로 맞춤).
소리는 판(`app/lib/sfx.ts`)과 같은 재료로 합성: 집힘 burst · 넘김 grind · 날아감 whoosh · 은 종 · 심장 쿵.

## 다시 만들 때

```
python gen_mark.py v3        # SVG · 보드 · Remotion 도형(vidops/remotion/src/kuventing/logoGeom.ts)
python export.py             # PNG · 파비콘 세트
cd ../../../../vidops/remotion && npx remotion render KuventingLogo out.mp4 --codec=h264 --pixel-format=yuv420p
python motion/sfx.py out.wav # 소리 (프레임은 KuventingLogo.tsx 의 T 와 맞춤)
```

닮은 것: 티켓 · K 모노그램 · 접힌 귀퉁이는 각각 흔한 문법(예매 앱 티켓 아이콘, 문서 아이콘의 접힌 모서리). 셋을 한 도형에 묶은 것 + 반원 홈이 우리 것.
