/**
 * 브라우저에서 사진을 화면 규격으로 만든다. 서버에 sharp 를 올리지 않기 위해서다.
 *
 * 폰 사진은 4000×3000, 5MB 가 예사다. 그대로 올리면 사장님 데이터를 태우고
 * 업로드도 느리다. 캔버스에서 잘라 줄이면 300KB 안쪽으로 떨어진다.
 *
 * 상품 사진은 화면에서 원형·정사각 카드로 나오므로 여기서 정사각으로 만든다.
 * 가운데를 그냥 자르면 접시가 반쯤 잘리는 일이 많아서,
 * npm run img 가 쓰던 피사체 추적을 그대로 옮겼다 (가장자리 밝기 = 배경).
 */

export const PRIZE_SIDE = 1000;
export const AD_LONG = 1600;

type Box = { left: number; top: number; side: number };

/** 파일을 캔버스에 그릴 수 있는 형태로 연다. EXIF 회전은 브라우저가 알아서 맞춘다 */
async function load(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('DECODE'));
      img.src = url;
    });
    if (typeof img.decode === 'function') { try { await img.decode(); } catch { /* 무시 */ } }
    return img;
  } finally {
    // 그리기 전에 풀면 사파리에서 깨진다. 다음 태스크로 미룬다.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function ctx2d(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('NO_CANVAS');
  g.imageSmoothingQuality = 'high';
  return { c, g };
}

/**
 * 피사체가 들어가는 정사각 영역을 찾는다.
 * 못 찾으면 null — 부르는 쪽이 가운데 자르기로 넘어간다.
 */
function subjectSquare(img: HTMLImageElement): Box | null {
  const W = img.naturalWidth, H = img.naturalHeight;
  const S = 120;
  const w = W >= H ? S : Math.max(1, Math.round((W / H) * S));
  const h = W >= H ? Math.max(1, Math.round((H / W) * S)) : S;

  const { g } = ctx2d(w, h);
  g.drawImage(img, 0, 0, w, h);

  let px: Uint8ClampedArray;
  try { px = g.getImageData(0, 0, w, h).data; } catch { return null; }

  // 흑백값만 뽑는다
  const lum = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    lum[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  }

  // 배경 밝기는 가장자리에서 추정한다 (어두운 배경도, 흰 배경도 대응)
  const edge: number[] = [];
  for (let x = 0; x < w; x++) { edge.push(lum[x], lum[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { edge.push(lum[y * w], lum[y * w + w - 1]); }
  edge.sort((a, b) => a - b);
  const bg = edge[edge.length >> 1];

  let varSum = 0;
  for (let i = 0; i < lum.length; i++) varSum += (lum[i] - bg) ** 2;
  const th = Math.max(12, Math.sqrt(varSum / lum.length) * 0.55);

  let x0 = w, y0 = h, x1 = 0, y1 = 0, hit = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(lum[y * w + x] - bg) > th) {
        hit++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (hit < w * h * 0.01) return null;

  const sx = W / w, sy = H / h;
  const cx = ((x0 + x1) / 2) * sx;
  const cy = ((y0 + y1) / 2) * sy;
  const side = Math.min(
    Math.max(
      Math.max((x1 - x0) * sx, (y1 - y0) * sy) * 1.18,   // 여백 18%
      Math.min(W, H) * 0.5                                // 너무 바짝 당기지 않는다
    ),
    Math.min(W, H)
  );

  return {
    left: Math.max(0, Math.min(W - side, cx - side / 2)),
    top: Math.max(0, Math.min(H - side, cy - side / 2)),
    side,
  };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('ENCODE'))), 'image/jpeg', quality);
  });
}

/** 용량이 넘치면 화질을 한 단계씩 낮춘다 */
async function encode(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  for (const q of [0.85, 0.75, 0.65, 0.55]) {
    const b = await toJpeg(canvas, q);
    if (b.size <= maxBytes) return b;
  }
  return toJpeg(canvas, 0.45);
}

/** 상품 사진 — 피사체를 찾아 정사각으로 자르고 1000×1000 JPEG */
export async function makePrizeImage(file: File): Promise<Blob> {
  const img = await load(file);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) throw new Error('DECODE');

  const box = subjectSquare(img) ?? {
    side: Math.min(W, H),
    left: (W - Math.min(W, H)) / 2,
    top: (H - Math.min(W, H)) / 2,
  };

  const side = Math.min(PRIZE_SIDE, Math.round(box.side));   // 원본보다 키우지 않는다
  const { c, g } = ctx2d(side, side);
  g.drawImage(img, box.left, box.top, box.side, box.side, 0, 0, side, side);
  return encode(c, 900 * 1024);
}

/** 광고 슬라이드 — 구도를 살려야 하므로 자르지 않고 긴 변만 1600으로 */
export async function makeAdImage(file: File): Promise<Blob> {
  const img = await load(file);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) throw new Error('DECODE');

  const scale = Math.min(1, AD_LONG / Math.max(W, H));
  const { c, g } = ctx2d(Math.round(W * scale), Math.round(H * scale));
  g.drawImage(img, 0, 0, c.width, c.height);
  return encode(c, 900 * 1024);
}

export const IMAGE_ERROR: Record<string, string> = {
  DECODE: '사진을 열지 못했습니다. 다른 파일로 해보세요.',
  ENCODE: '사진을 변환하지 못했습니다.',
  NO_CANVAS: '이 브라우저에서는 사진 편집이 안 됩니다.',
};
