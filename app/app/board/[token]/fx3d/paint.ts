/**
 * 3D 연출에 쓰는 그림을 캔버스로 그린다 — 상품 인화지, 등급 쪽지, 등급 메달.
 *
 * 이미지 파일로 두지 않는 이유: 쪽지에는 매장 이름·회차 제목·표 번호가 들어가고
 * 메달에는 등급 글자가 들어간다. 매장마다·뽑을 때마다 달라서 그때 그린다.
 */

export const SLIP_W = 1600;
export const SLIP_H = Math.round(SLIP_W / 1.877);
/** 등급 글자 자리 — 쪽지 오른쪽 끝. 왼쪽부터 열면 마지막에 드러난다 */
export const LETTER = { x: 1185, y: 470, size: 560 };

/** 등급별 금속 — 글자에 입히는 결 (어두운 쪽 → 밝은 쪽 → 어두운 쪽) */
export const METAL: Record<string, string[]> = {
  gold: ['#8C6A24', '#EFD79B', '#C9A24B', '#F6E7B8', '#A5822F'],
  copper: ['#7A4A2A', '#F3C9A2', '#C08A5A', '#FFE0C8', '#9C6A3E'],
  silver: ['#6E7682', '#F1F4F8', '#AEB5C0', '#FFFFFF', '#8C94A0'],
};
export const metalOf = (grade: string) =>
  grade === 'A' || grade === 'B' ? 'gold' : grade === 'C' ? 'copper' : 'silver';

const KO = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const SERIF = 'Georgia,"Times New Roman","Noto Serif",serif';

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
const size = (img: HTMLImageElement) => [img.naturalWidth || img.width, img.naturalHeight || img.height];
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const [iw, ih] = size(img), k = Math.max(w / iw, h / ih);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
  g.restore();
}
function contain(g: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const iw = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width;
  const ih = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height;
  const k = Math.min(w / iw, h / ih);
  g.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
}

export type SlipInfo = { store: string; title: string; no: number | null };

/**
 * 등급 쪽지 — 표를 찢으면 드러나는 안쪽 인쇄면.
 * revealed 가 false 면 등급 글자를 그리지 않는다(개봉 화면에서는 양각으로 따로 얹는다).
 */
export function slipCanvas(grade: string, info: SlipInfo, revealed: boolean) {
  const c = document.createElement('canvas'); c.width = SLIP_W; c.height = SLIP_H;
  const g = c.getContext('2d')!;
  const W = SLIP_W, H = SLIP_H;
  roundRect(g, 4, 4, W - 8, H - 8, 34); g.clip();
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ECE2CB'); bg.addColorStop(1, '#DCCDAE');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = 'rgba(70,52,30,' + (Math.random() * 0.06).toFixed(3) + ')';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  // 위조 방지 잔무늬 — 사인 곡선을 겹쳐 그린다
  g.lineWidth = 1.3;
  for (let k = 0; k < 28; k++) {
    g.strokeStyle = 'rgba(58,46,34,' + (k % 4 ? 0.06 : 0.1) + ')';
    g.beginPath();
    for (let x = 0; x <= W; x += 5) {
      const y = H * 0.5 + Math.sin((x / W) * Math.PI * 7 + k * 0.45) * H * 0.2
        + Math.sin((x / W) * Math.PI * 2.5 - k * 0.3) * H * 0.14;
      if (x) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
  const ink = (a: number) => 'rgba(43,33,24,' + a + ')';
  g.strokeStyle = ink(0.72); g.lineWidth = 7; g.strokeRect(44, 44, W - 88, H - 88);
  g.strokeStyle = ink(0.42); g.lineWidth = 2.2; g.strokeRect(62, 62, W - 124, H - 124);

  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const fit = (text: string, font: string, max: number) => {
    // 매장 이름이 길면 줄여서 칸 안에 넣는다
    let px = parseInt(font, 10);
    const rest = font.replace(/^\d+px/, '');
    do { g.font = font.replace(/\d+px/, px + 'px'); px -= 2; } while (g.measureText(text).width > max && px > 16);
    return rest;
  };
  g.fillStyle = ink(0.6); fit('꽝 없는 뽑기 · ' + info.title, '700 34px ' + KO, 640);
  g.fillText('꽝 없는 뽑기 · ' + info.title, 112, 178);
  g.fillStyle = ink(0.92); g.font = '900 110px ' + KO; g.fillText('축 당첨', 104, 320);
  g.fillStyle = ink(0.7); fit(info.store, '600 36px ' + KO, 640); g.fillText(info.store, 112, 408);
  g.fillStyle = ink(0.3); g.fillRect(112, 456, 600, 2);
  if (info.no !== null) {
    g.fillStyle = ink(0.82); g.font = '700 58px ' + SERIF; g.fillText('NO. ' + info.no, 112, 556);
  }
  g.fillStyle = ink(0.5); g.font = '600 28px ' + KO; g.fillText('모든 표에 상품이 들어 있습니다', 112, 648);
  g.fillStyle = ink(0.26);
  for (let y = 110; y < H - 110; y += 16) g.fillRect(820, y, 3, 8);
  g.fillStyle = ink(0.46); g.font = '700 26px ' + SERIF; g.textAlign = 'center';
  g.fillText('G  R  A  D  E', LETTER.x, H - 92);

  if (revealed) {
    const pal = METAL[metalOf(grade)];
    const lg = g.createLinearGradient(LETTER.x - 260, LETTER.y - 280, LETTER.x + 260, LETTER.y + 280);
    pal.forEach((col, i) => lg.addColorStop(i / (pal.length - 1), col));
    g.font = '700 ' + LETTER.size + 'px ' + SERIF; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(30,20,8,.45)'; g.fillText(grade, LETTER.x + 7, LETTER.y + 8);
    g.fillStyle = lg; g.fillText(grade, LETTER.x, LETTER.y);
  }
  return c;
}

/** 쪽지를 정사각 카드 뒷면에 얹는다 — 어두운 판 위에 쪽지 한 장 */
export function cardBackCanvas(grade: string, info: SlipInfo) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, '#2A241C'); bg.addColorStop(1, '#100E0B');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = 'rgba(255,230,180,' + (Math.random() * 0.035).toFixed(3) + ')';
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  g.strokeStyle = 'rgba(201,162,75,.55)'; g.lineWidth = 4; g.strokeRect(26, 26, S - 52, S - 52);
  contain(g, slipCanvas(grade, info, true), 56, 56, S - 112, S - 112);
  return c;
}

/**
 * 상품 인화지 — 사진 둘레에 종이 테두리. 그림(할인권 SVG)은 자르지 않고 통째로 얹는다.
 * 사진을 못 받았으면 등급 글자를 크게 찍어 둔다(화면이 비지 않게).
 */
export function printCanvas(img: HTMLImageElement | null, flat: boolean, grade: string) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#D8CAAE'; g.fillRect(0, 0, S, S);
  const ins = 34, iw = S - ins * 2;
  if (!img) {
    g.fillStyle = '#202024'; g.fillRect(ins, ins, iw, iw);
    const pal = METAL[metalOf(grade)], lg = g.createLinearGradient(0, ins, 0, ins + iw);
    pal.forEach((col, i) => lg.addColorStop(i / (pal.length - 1), col));
    g.fillStyle = lg; g.font = '700 620px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(grade, S / 2, S / 2 + 30);
  } else if (flat) {
    g.fillStyle = '#202024'; g.fillRect(ins, ins, iw, iw);
    contain(g, img, ins + 40, ins + 40, iw - 80, iw - 80);
  } else {
    cover(g, img, ins, ins, iw, iw);
  }
  g.strokeStyle = 'rgba(43,33,24,.38)'; g.lineWidth = 3; g.strokeRect(ins - 8, ins - 8, iw + 16, iw + 16);
  return c;
}

/**
 * 메달 앞면. 원기둥 뚜껑의 UV 는 이미지를 시계 방향으로 90도 돌려 붙이므로
 * 글자를 반대로 90도 돌려 그려 두면 화면에서 바로 선다(뒷면도 같은 그림으로 바로 선다).
 */
export function coinCanvas(letter: string) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece5d3'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#7a6a4a'; g.lineWidth = 10;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 18, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 36, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(S / 2, S / 2); g.rotate(-Math.PI / 2);
  g.fillStyle = '#4e3f24'; g.font = '700 150px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, 0, 10);
  g.restore();
  return c;
}

/** 바닥에 드리우는 그늘 — 가운데가 짙고 가장자리로 사라지는 둥근 얼룩 */
export function shadowCanvas() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(0,0,0,.85)'); rg.addColorStop(0.55, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, S, S);
  return c;
}

/** 금속이 비출 주변 — 위는 따뜻한 조명, 가운데 정면에 소프트박스, 아래는 어둠 */
export function envCanvas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#fff4dc'); gr.addColorStop(0.32, '#b08a5a'); gr.addColorStop(0.55, '#2a2118'); gr.addColorStop(1, '#07070a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (const [x, y, r] of [[80, 56, 70], [260, 40, 90], [420, 78, 50], [384, 126, 58], [128, 132, 40]]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}
