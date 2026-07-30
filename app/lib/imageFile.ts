import 'server-only';

/**
 * 올라온 파일이 진짜 이미지인지, 크기가 말이 되는지 서버에서 다시 본다.
 *
 * 화면에서 캔버스로 줄여 올리지만 그건 우리 화면을 쓸 때 얘기고,
 * 사장님 PIN을 아는 사람은 라우트를 직접 때릴 수 있다.
 * 이미지 라이브러리를 서버에 올리지 않고도 헤더만 읽으면
 * 형식과 가로·세로는 확인할 수 있다.
 */

export type ImageInfo = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; width: number; height: number };

/** JPEG: SOF 마커에서 크기를 읽는다 */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2; // FFD8 다음부터
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    // SOF0~SOF15 중 DHT(C4)·JPG(C8)·DAC(CC) 는 크기 정보가 없다
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/** 파일 앞부분만 보고 형식과 크기를 알아낸다. 모르면 null */
export function readImageInfo(buf: ArrayBuffer): ImageInfo | null {
  const b = new Uint8Array(buf);
  if (b.length < 24) return null;

  // JPEG — FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const s = jpegSize(b);
    return s ? { mime: 'image/jpeg', ...s } : null;
  }

  // PNG — 89 50 4E 47, IHDR 에 크기
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(buf);
    return { mime: 'image/png', width: dv.getUint32(16), height: dv.getUint32(20) };
  }

  // WebP — RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const dv = new DataView(buf);
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === 'VP8 ') {
      return { mime: 'image/webp', width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    }
    if (kind === 'VP8L') {
      const bits = dv.getUint32(21, true);
      return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
      const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
      return { mime: 'image/webp', width: w, height: h };
    }
  }

  return null;
}

export const MAX_BYTES = 3 * 1024 * 1024;
export const MAX_SIDE = 2400;

/** 통과하지 못한 이유를 사장님이 읽을 문장으로 돌려준다 */
export function imageProblem(buf: ArrayBuffer, kind: 'prize' | 'ad'): string | null {
  if (buf.byteLength > MAX_BYTES) return '사진 용량이 너무 큽니다. 다시 시도해 주세요.';

  const info = readImageInfo(buf);
  if (!info) return '사진 파일이 아닙니다. JPG·PNG 파일을 올려주세요.';
  if (info.width > MAX_SIDE || info.height > MAX_SIDE) return '사진이 너무 큽니다.';
  if (info.width < 200 || info.height < 200) return '사진이 너무 작습니다. 200픽셀 이상이어야 합니다.';

  // 상품 사진은 화면에서 원형·정사각으로 잘려 나온다. 정사각이 아니면 화면에서 또 잘린다.
  if (kind === 'prize' && Math.abs(info.width - info.height) > 2) {
    return '상품 사진은 정사각형이어야 합니다.';
  }
  return null;
}
