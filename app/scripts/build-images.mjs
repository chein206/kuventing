// assets/ 의 원본을 화면 규격에 맞게 잘라 public/img/ 로 내보낸다.
//   npm run img
import sharp from 'sharp';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.resolve(ROOT, '..', 'assets');
const OUT = path.join(ROOT, 'public', 'img');

if (!existsSync(SRC)) {
  console.error(`원본 폴더가 없습니다: ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// 이름 앞부분 → 출력 규격
// position: 광고는 구도를 살리려 중앙 기준, 상품은 원형으로 잘리므로 피사체 추적
const RULES = [
  // 광고는 자르지 않는다. 화면에서 흐린 배경 위에 통째로 얹는다.
  { prefix: 'ad-',    w: 1600, h: 1600, pos: 'centre', fit: 'inside', label: '광고 (원본 비율 유지)' },
  { prefix: 'prize-', w: 1000, h: 1000, pos: 'attention', label: '상품 1:1'      },
  { prefix: 'logo',   w: 512,  h: 512,  pos: 'centre',    label: '로고 1:1'      },
  { prefix: 'ticket', w: 0,    h: 0,    pos: 'centre',    label: '티켓 아트(투명 PNG)' },
];

const files = readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) {
  console.log(`${SRC} 에 이미지가 없습니다.`);
  process.exit(0);
}

const made = { ad: [], prize: [], logo: [], ticket: [] };

/**
 * 티켓 아트에서 배경을 지워 투명 PNG로 만든다.
 * AI 이미지가 "투명"을 회색 체크무늬로 그려 넣는 경우가 많은데,
 * 배경은 무채색(R=G=B)이고 티켓은 유채색(네이비·골드)이라 이걸로 가른다.
 * 어두운 픽셀도 티켓으로 본다.
 */
async function cutoutTicket(file, outPath) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: C } = info;
  const out = Buffer.from(data);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;

  for (let i = 0; i < W * H; i++) {
    const p = i * C;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const chroma = max - min;            // 무채색이면 0에 가깝다
    const lum = (r * 299 + g * 587 + b * 114) / 1000;

    // 유채색이거나 충분히 어두우면 티켓
    const keep = chroma > 18 || lum < 140;
    out[p + 3] = keep ? 255 : 0;

    if (keep) {
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }

  const box = {
    left: Math.max(0, x0 - 2), top: Math.max(0, y0 - 2),
    width: Math.min(W - x0, x1 - x0 + 5), height: Math.min(H - y0, y1 - y0 + 5),
  };

  await sharp(out, { raw: { width: W, height: H, channels: C } })
    .extract(box)
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  return box;
}

/**
 * 어두운 배경 위의 피사체 위치를 찾아 정사각으로 잘라낸다.
 * 상품 사진은 원형으로 표시되므로 피사체가 중앙에 와야 한다.
 * 축소본의 밝기로 대략적인 경계상자를 구한 뒤 원본 좌표로 되돌린다.
 */
async function subjectSquare(file) {
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const S = 120;
  const { data, info } = await img
    .clone().greyscale().resize(S, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;

  // 배경 밝기는 가장자리에서 추정한다 (어두운 배경도, 흰 배경도 대응)
  const edge = [];
  for (let x = 0; x < w; x++) { edge.push(data[x], data[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { edge.push(data[y * w], data[y * w + w - 1]); }
  edge.sort((a, b) => a - b);
  const bgLum = edge[edge.length >> 1];               // 가장자리 중앙값 = 배경색

  let varSum = 0;
  for (let i = 0; i < data.length; i++) varSum += (data[i] - bgLum) ** 2;
  const spread = Math.sqrt(varSum / data.length);
  const th = Math.max(12, spread * 0.55);            // 배경에서 이만큼 벗어나면 피사체

  let x0 = w, y0 = h, x1 = 0, y1 = 0, hit = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(data[y * w + x] - bgLum) > th) {   // 밝든 어둡든 차이나면 피사체
        hit++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (hit < w * h * 0.01) return null;   // 피사체를 못 찾으면 기본 크롭에 맡긴다

  const sx = W / w, sy = H / h;
  const cx = ((x0 + x1) / 2) * sx;
  const cy = ((y0 + y1) / 2) * sy;
  const side = Math.min(
    Math.max(
      Math.max((x1 - x0) * sx, (y1 - y0) * sy) * 1.18,  // 여백 18%
      Math.min(W, H) * 0.5                              // 너무 바짝 당기지 않는다
    ),
    Math.min(W, H)
  );
  const half = side / 2;

  return {
    left: Math.round(Math.max(0, Math.min(W - side, cx - half))),
    top: Math.round(Math.max(0, Math.min(H - side, cy - half))),
    width: Math.round(side),
    height: Math.round(side),
  };
}

for (const f of files) {
  const base = path.parse(f).name;
  const rule = RULES.find((r) => base.toLowerCase().startsWith(r.prefix));
  if (!rule) {
    console.log(`건너뜀 (이름 규칙 없음): ${f}`);
    continue;
  }
  const src = path.join(SRC, f);

  // 티켓 아트는 자르지 않고 배경만 지워 투명 PNG로 내보낸다
  if (rule.prefix === 'ticket') {
    const outName = `${base}.png`;
    const box = await cutoutTicket(src, path.join(OUT, outName));
    console.log(`${rule.label}  ${f}  ->  /img/${outName}  (${box.width}x${box.height})`);
    made.ticket.push({ base, url: `/img/${outName}` });
    continue;
  }

  const outName = `${base}.jpg`;
  let pipe = sharp(src);

  // 정사각(원형 표시)은 피사체를 찾아 중앙에 맞춘다. 자르지 않는 규칙은 건너뛴다.
  if (rule.w === rule.h && rule.fit !== 'inside') {
    const box = await subjectSquare(src);
    if (box) pipe = pipe.extract(box);
  }

  await pipe
    .resize(rule.w, rule.h, { fit: rule.fit ?? 'cover', position: rule.pos, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT, outName));

  const url = `/img/${outName}`;
  console.log(`${rule.label}  ${f}  ->  ${url}`);
  if (rule.prefix === 'ad-') made.ad.push({ base, url });
  else if (rule.prefix === 'prize-') made.prize.push({ base, url });
  else made.logo.push({ base, url });
}

/* ---------- 붙여넣을 SQL 출력 ---------- */
console.log('\n----- Supabase SQL Editor 에 붙여넣기 -----\n');

if (made.ad.length) {
  const ads = made.ad.map((a) => {
    const title = a.base.replace(/^ad-/i, '');
    return `  {"title":"${title}","sub":"","price":"","image":"${a.url}"}`;
  });
  console.log(`update kuji.campaigns set ads = '[\n${ads.join(',\n')}\n]'::jsonb;\n`);
  console.log('-- title / sub / price 는 위 JSON에서 직접 고치세요.\n');
}

for (const p of made.prize) {
  const key = p.base.replace(/^prize-/i, '').toUpperCase();
  if (key === 'LAST') {
    console.log(`update kuji.campaigns set last_one_image = '${p.url}';`);
  } else {
    console.log(`update kuji.prizes set image_url = '${p.url}' where grade = '${key}';`);
  }
}

for (const l of made.logo) {
  console.log(`update kuji.stores set logo_url = '${l.url}';`);
}

console.log('\n-------------------------------------------');
