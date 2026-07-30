# 쿠벤팅 (Kuventing)

꽝 없는 등급제 뽑기를 동네 매장이 카운터 태블릿으로 돌릴 수 있게 해주는 시스템.
사업·제품 전반은 [기획.md](기획.md) 를 볼 것. 이 문서는 **설치와 운영**만 다룬다.

```
kuventing/
├─ 기획.md              사업·제품 기획 (SSOT)
├─ assets/              원본 이미지를 넣는 곳 (README 있음)
├─ prototype/           초기 목업 (서버 없음, 참고용)
│  ├─ draw-proto.html     손님 화면 · 테마 3종 비교
│  └─ owner-proto.html    사장님 화면
├─ supabase/            SQL — 번호 순서대로 실행
└─ app/                 Next.js 16 + Supabase
```

---

## 1. 설치 (처음 1회)

### 1-1. DB
Supabase 대시보드 > **SQL Editor** 에서 **번호 순서대로** 실행한다.

| 파일 | 무엇 |
|---|---|
| `schema.sql` | 테이블 6개 + RLS + 함수 |
| — | **Settings > API > Exposed schemas 에 `kuji` 추가** ← 빼먹으면 API에서 안 보임 |
| `seed.sql` | 데모 매장 1 (라멘집) |
| `002_board.sql` | 카운터 보드 · 광고 · 보드 토큰 |
| `003_grants.sql` | service_role 테이블 권한 |
| `004_board_pin.sql` | 카운터 PIN 분리 |
| `005_timings.sql` | 화면 시간 4종을 DB로 |
| `006_boxes.sql` | 박스 회차 + 상품 구성 저장 |
| `007_grades.sql` | 등급 A~H + 막차 보너스 문구 |
| `008_owner_token.sql` | 매장별 사장님 주소 |
| `009_token_defaults.sql` | 토큰 자동 발급 |
| `010_rate_limit.sql` | 뽑기 빈도 제한 + PIN 대입 차단 |
| `011_rotate_tokens.sql` | 주소 재발급 |

선택
- `seed_cafe.sql` + `seed_cafe_images.sql` — 데모 매장 2 (카페)
- `dev_reset_box.sql` — 개발용 박스 되감기 (**쿠폰도 지움**)
- `dev_cleanup_duplicates.sql` — 시드 중복 정리 (삭제 블록은 주석 처리돼 있음)

> 전부 `kuji` 스키마 안에만 만든다. 같은 프로젝트의 다른 테이블(public)은 건드리지 않는다.

### 1-2. 환경변수
`app/.env.local.example` 을 `app/.env.local` 로 복사하고 채운다.
파일 위치는 **`kuventing/app/`** (package.json 옆)이다.

| 키 | 어디서 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 이미 채워져 있음 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings > API > Publishable / anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings > API > Secret / service_role (**공개 금지**) |
| `NEXT_PUBLIC_SITE_URL` | 선택. 루트(`/`)로 온 사람을 회사 홈페이지로 보낸다 |

> `NEXT_PUBLIC_CAMPAIGN_ID` 와 `OWNER_PIN` 은 더 이상 쓰지 않는다.
> 매장·PIN은 전부 DB에서 온다.

### 1-3. 실행
```bash
cd C:\Users\Nam-PC\Desktop\cld\kuventing\app
npm run dev
```

---

## 1-4. 배포 (Vercel)

저장소 루트는 `kuventing/` 이고 Next 앱은 `app/` 에 있다.
**Vercel 프로젝트의 Root Directory 를 `app` 으로 지정해야 한다.**

| 항목 | 값 |
|---|---|
| Framework | Next.js (자동 감지) |
| Root Directory | `app` |
| Build / Install | 기본값 그대로 |
| 도메인 | `kuvt.scpadlab.com` |
| 환경변수 | 위 1-2의 키 3~4개 (Production + Preview 모두) |

CLI로 할 경우
```bash
cd C:\Users\Nam-PC\Desktop\cld\kuventing\app
npx vercel        # 최초 1회 — 프로젝트 연결, Root Directory 확인
npx vercel --prod
```

배포 후 확인
- `kuvt.scpadlab.com/` → 안내(또는 홈페이지로 리다이렉트)
- `/owner` · `/board` → "주소가 필요합니다" (토큰 없이는 안 열림)
- `/robots.txt` → 전체 차단. 사장님·손님 화면이 검색에 걸리지 않는다
- `npm run stores https://kuvt.scpadlab.com` 으로 매장 주소를 다시 뽑아 전달

> 개발용 `allowedDevOrigins` 는 배포에 영향이 없다.
> Supabase는 Auth를 쓰지 않으므로 도메인 화이트리스트 설정이 필요 없다.

---

## 2. 주소 확인

```bash
npm run stores                                  # localhost 기준
npm run stores http://192.168.0.131:3000        # 태블릿에서 열 주소 기준
```

매장별로 **카운터 주소 · 사장님 주소 · PIN 2종 · 박스 상태**를 한 번에 출력한다.
두 PIN이 같으면 경고를 띄운다.

| 주소 | 누가 |
|---|---|
| `/board/<보드토큰>` | 카운터 태블릿 |
| `/owner/<사장님토큰>` | 사장님 (PIN 로그인) |
| `/c/<캠페인>/<코드>` | 손님 쿠폰 (결과 QR) |

---

## 3. 태블릿에 띄우기

1. **주소는 `localhost` 가 아니라 PC의 사설 IP**로 연다 (`ipconfig` 로 확인)
2. 크롬 메뉴 → **홈 화면에 추가** → 아이콘으로 실행하면 주소창 없이 전체화면
3. 화면 꺼짐 방지는 코드에 걸려 있다(Wake Lock). 안 되는 기기면 설정에서 자동잠금 해제

안 열릴 때 순서대로 확인
- 태블릿이 같은 공유기인지 (게스트 와이파이는 격리됨)
- 윈도우 방화벽에서 Node.js 허용했는지
- PC IP가 바뀌지 않았는지 → 바뀌었으면 `app/next.config.ts` 의 `allowedDevOrigins` 에 추가

> 개발 서버는 기본적으로 localhost 외 접속을 막는다. `allowedDevOrigins` 에
> `192.168.0.*`, `192.168.1.*` 를 넣어뒀다. 배포 후에는 필요 없다.

---

## 4. 이미지 넣기

`assets/` 에 넣고 이름 앞부분으로 용도를 구분한다. 자세한 건 [assets/README.md](assets/README.md).

```bash
npm run img
```

| 이름 | 결과 |
|---|---|
| `ad-메뉴명.jpg` | 광고 슬라이드. **자르지 않음** (긴 변 1600px 축소만) |
| `prize-a.jpg` | 상품 사진 1000×1000 (원형으로 잘리므로 피사체 중앙) |
| `prize-last.jpg` | 막차 보너스 |
| `ticket-*.jpg` | 티켓 아트 → 배경 제거 투명 PNG |
| `logo.png` | 매장 로고 512×512 |

매장이 둘 이상이면 `prize-cafe-a.jpg` 처럼 이름에 매장을 넣고,
SQL로 캠페인별 `image_url` 을 지정한다 (`seed_cafe_images.sql` 참고).

실행하면 붙여넣을 SQL도 같이 출력된다.

기타 스크립트
```bash
npm run icons     # PWA 아이콘 재생성
```

---

## 5. 운영

### 사장님이 하는 일
1. 계산할 때 "뽑기 한 번 하고 가세요" → 손님이 화면 터치 → **직원이 PIN 4자리**
2. 쿠폰 가져온 손님 → 사장님 화면 **사용처리** 탭에 코드 입력
3. 티켓 다 나가면 홈에서 **새 박스 열기**

### 사장님 화면에서 바꿀 수 있는 것
- 보드 모드: **직원 확인(PIN)** / **상시 개방**
- 화면 시간 4종: 광고 넘김 · 결과 유지 · 방치 시 자동 개봉 · 초기화면 복귀
- 카운터 PIN (사장님 PIN과 같게는 저장 안 됨)
- 상품 구성: 등급 A~H 추가·삭제, 이름·수량·사용시점 → **새 박스를 열어야 반영**
- 막차 보너스 이름표·상품명
- **분당 뽑기 허용 횟수** (기본 6 — 주소가 새더라도 티켓이 한꺼번에 소진되지 않게)
- **주소 재발급** — 카운터 / 사장님 각각. 링크가 유출됐을 때 쓴다

### 남용 방어 (자동)
- 뽑기권 발급이 분당 허용치를 넘으면 "잠시만 기다려주세요"
- PIN을 10분 내 5회 틀리면 **10분 잠금**. 남은 시도 횟수가 표시된다
- 사장님 홈에 이상 징후(PIN 실패 / 최근 10분 과다 뽑기)가 있을 때만 경고 카드가 뜬다

### 아직 SQL로만 되는 것
- 광고 슬라이드 문구·사진
- 캠페인 생성, 총 티켓 수 변경
- 상품 사진 지정

---

## 6. 설계에서 중요한 것

**안 뽑힌 티켓의 내용은 클라이언트로 안 간다.**
전 테이블 RLS + 정책 0개 = 직접 접근 전면 차단. 접근은 `security definer` 함수만.
`get_board` 는 안 뽑힌 자리를 `grade: null` 로 내린다.

**동시성은 한 줄.**
```sql
update kuji.tickets set drawn_at = now()
where campaign_id = ? and box = ? and position = ? and drawn_at is null
```
진 쪽은 `TICKET_TAKEN` → "방금 다른 분이 뽑았습니다".

**추첨은 사전 셔플.** 손님이 고르는 자리는 진짜로 미리 정해져 있다.

**박스는 지우지 않고 회차를 올린다.** 지난 회차 쿠폰이 계속 살아있어야 하므로.

**PIN 두 개.** 사장님 로그인용과 카운터용을 분리. 카운터 PIN은 손님 앞에서 매일 눌린다.

**매장 구분은 주소 토큰 + PIN.** 매 요청마다 짝을 대조해 남의 매장 접근을 막는다.

더 자세한 이유는 [기획.md](기획.md) 8절.

---

## 7. 알려진 사항

`npm audit` 이 프로덕션 의존성에서 high 3건을 보고한다. 전부 Next.js가 물고 있는
`postcss` / `sharp` 이고 우리 코드로는 해결할 수 없다(다운그레이드하면 Next 9). 업스트림 대기.
