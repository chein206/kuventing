// 쿠벤팅 아이콘 생성 — assets/icon.jpg 원본에서 크기별로 뽑는다.
//   npm run icons
//
// 만드는 것
//   public/icon-192.png      PWA
//   public/icon-512.png      PWA
//   public/icon-maskable.png 안드로이드 마스커블 (잘려도 되는 여백 확보)
//   app/icon.png             Next 규약 — 파비콘·탭 아이콘으로 자동 사용됨
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = here('../../assets/icon.jpg');
const PUB = here('../public/');
const APP = here('../app/');

if (!existsSync(SRC)) {
  console.error(`원본이 없습니다: ${SRC}`);
  process.exit(1);
}
mkdirSync(PUB, { recursive: true });

// 마스커블 여백을 원본 배경색으로 채운다 (모서리 픽셀에서 색을 읽는다)
const { data: corner } = await sharp(SRC).extract({ left: 2, top: 2, width: 8, height: 8 })
  .raw().toBuffer({ resolveWithObject: true });
const bg = { r: corner[0], g: corner[1], b: corner[2] };
console.log(`배경색 rgb(${bg.r}, ${bg.g}, ${bg.b})`);

const square = (size) =>
  sharp(SRC).resize(size, size, { fit: 'cover', position: 'centre' });

for (const size of [192, 512]) {
  await square(size).png({ compressionLevel: 9 }).toFile(`${PUB}icon-${size}.png`);
  console.log(`public/icon-${size}.png`);
}

// 마스커블: 내용을 74%로 줄이고 남는 자리를 배경색으로 채운다
const inner = 380;
const pad = Math.round((512 - inner) / 2);
await sharp(SRC)
  .resize(inner, inner, { fit: 'cover', position: 'centre' })
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
  .png({ compressionLevel: 9 })
  .toFile(`${PUB}icon-maskable.png`);
console.log('public/icon-maskable.png');

// Next 규약 파일 — 파비콘으로 자동 사용
await square(256).png({ compressionLevel: 9 }).toFile(`${APP}icon.png`);
console.log('app/icon.png');
