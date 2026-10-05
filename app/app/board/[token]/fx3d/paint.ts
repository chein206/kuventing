/**
 * 3D 연출에 쓰는 그림을 캔버스로 그린다 — 표 겉면, 등급 쪽지(표 안쪽), 상품 인화지, 등급 메달.
 *
 * 이미지 파일로 두지 않는 이유: 쪽지에는 매장 이름·회차 제목·표 번호가 들어가고
 * 메달에는 등급 글자가 들어간다. 매장마다·뽑을 때마다 달라서 그때 그린다.
 */
import type { Art } from '@/lib/boardArt';

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

/** 등급 글자 자리 — 쪽지 높이(표 비율)에 맞춘다. 활판 1.877 · 황동 1.891 · 벡터 표 2 */
export const letterAt = (H: number) => ({ x: LETTER.x, y: Math.round(H * (LETTER.y / SLIP_H)), size: LETTER.size });

/**
 * 등급 쪽지 — 표를 찢으면 드러나는 안쪽 인쇄면.
 * revealed 가 false 면 등급 글자를 그리지 않는다(개봉 화면에서는 양각으로 따로 얹는다).
 * ratio 는 표의 가로세로 비 — 개봉 화면 바닥은 표와 같은 크기여야 한다.
 */
export function slipCanvas(grade: string, info: SlipInfo, revealed: boolean, ratio = 1.877) {
  const W = SLIP_W, H = Math.round(SLIP_W / ratio), L = letterAt(H);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.drawImage(slipPaper(H), 0, 0);
  roundRect(g, 4, 4, W - 8, H - 8, 34); g.clip();
  const ink = (a: number) => 'rgba(43,33,24,' + a + ')';

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
  g.fillStyle = ink(0.7); fit(info.store, '600 36px ' + KO, 640); g.fillText(info.store, 112, 408);
  if (info.no !== null) {
    g.fillStyle = ink(0.82); g.font = '700 58px ' + SERIF; g.fillText('NO. ' + info.no, 112, 556);
  }

  if (revealed) {
    const pal = METAL[metalOf(grade)];
    const lg = g.createLinearGradient(L.x - 260, L.y - 280, L.x + 260, L.y + 280);
    pal.forEach((col, i) => lg.addColorStop(i / (pal.length - 1), col));
    g.font = '700 ' + L.size + 'px ' + SERIF; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(30,20,8,.45)'; g.fillText(grade, L.x + 7, L.y + 8);
    g.fillStyle = lg; g.fillText(grade, L.x, L.y);
  }
  return c;
}

/**
 * 쪽지 바탕 — 종이결 · 잔무늬 · 테두리 · 늘 같은 글자. 등급 · 매장 · 표 번호와 상관없다.
 * 종이결 점 16,000개가 무거워서(태블릿에서 수백 ms) 쪽지 크기마다 한 번만 그려 두고 쪽지마다 베껴 쓴다.
 * 결과가 도착하는 순간 그리면 개봉 화면 첫머리가 멈칫한다 — 고르는 동안 primeSlips 가 미리 그린다
 */
const paper = new Map<number, HTMLCanvasElement>();
function slipPaper(H: number) {
  const hit = paper.get(H);
  if (hit) return hit;
  const W = SLIP_W, L = letterAt(H);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
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
  g.fillStyle = ink(0.92); g.font = '900 110px ' + KO; g.fillText('축 당첨', 104, 320);
  g.fillStyle = ink(0.3); g.fillRect(112, 456, 600, 2);
  g.fillStyle = ink(0.5); g.font = '600 28px ' + KO; g.fillText('모든 표에 상품이 들어 있습니다', 112, 648);
  g.fillStyle = ink(0.26);
  for (let y = 110; y < H - 110; y += 16) g.fillRect(820, y, 3, 8);
  g.fillStyle = ink(0.46); g.font = '700 26px ' + SERIF; g.textAlign = 'center';
  g.fillText('G  R  A  D  E', L.x, H - 92);
  paper.set(H, c);
  return c;
}

/** 브라우저가 한가할 때 — 없으면(옛 사파리) 조금 뒤에 */
const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 60);
};

/**
 * 티켓을 고르는 동안 미리 그려 둔다 — 쪽지 바탕, 이 판에 있는 등급의 양각 높이,
 * 그리고 이 매장 글자로 쪽지 한 장(버린다). 한글 글꼴은 캔버스에서 처음 잴 때 한 번 크게 멈춘다(measureText 수백 ms) —
 * 같은 글자를 미리 한 번 재 두면 결과가 올 때는 바로 그린다.
 * 한가할 때 하나씩 그린다(한 번에 다 그리면 고르기 화면이 멈칫한다). 이미 그린 것은 건너뛴다
 */
const primed = new Set<string>();
export function primeSlips(ratio: number, grades: string[], info: SlipInfo) {
  const H = Math.round(SLIP_W / ratio);
  const words = info.store + '|' + info.title;
  const jobs = [
    () => slipPaper(H),
    () => { if (!primed.has(words)) { slipCanvas('A', info, false, ratio); primed.add(words); } },
    ...grades.map((gr) => () => letterHeight(gr, ratio)),
  ];
  const next = () => { const j = jobs.shift(); if (!j) return; j(); idle(next); };
  idle(next);
}

/**
 * 양각 높이 — 등급 글자를 잉크 없이 눌러 찍은 자리(흰 = 솟은 곳).
 * 흐리게 그려 가장자리에 비탈을 만든다. 개봉 화면 바닥의 빛 계산이 이 비탈에서 글자 윤곽을 만든다.
 * 쪽지의 금속 글자(slipCanvas revealed)와 자리 · 크기 · 글꼴이 같아야 다 열렸을 때 박이 그 자리를 채운다.
 */
const heights = new Map<string, HTMLCanvasElement>();
export function letterHeight(grade: string, ratio = 1.877) {
  // 흐림(blur 9px)이 무겁다 — 등급 · 비율마다 한 번만. 텍스처는 매번 새로 만들어도 원본 캔버스는 같은 것을 쓴다
  const key = grade + '|' + ratio;
  const hit = heights.get(key);
  if (hit) return hit;
  const L = letterAt(Math.round(SLIP_W / ratio));
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 / ratio);
  const g = c.getContext('2d')!;
  const k = c.width / SLIP_W;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const draw = (h: CanvasRenderingContext2D, s: number) => {
    h.fillStyle = '#fff'; h.font = '700 ' + Math.round(L.size * s) + 'px ' + SERIF;
    h.textAlign = 'center'; h.textBaseline = 'middle'; h.fillText(grade, L.x * s, L.y * s);
  };
  // 타입상 늘 있지만 옛 사파리는 실제로는 흐리지 않는다 — 값이 문자열로 읽힐 때만 쓴다
  if (typeof (g as { filter?: unknown }).filter === 'string') {
    g.filter = 'blur(9px)'; draw(g, k); g.filter = 'none';
  } else {
    // 캔버스 흐림이 없는 브라우저 — 작게 그려 크게 늘리면 가장자리가 번진다
    const q = 6, sm = document.createElement('canvas');
    sm.width = Math.ceil(c.width / q); sm.height = Math.ceil(c.height / q);
    const h = sm.getContext('2d')!;
    h.fillStyle = '#000'; h.fillRect(0, 0, sm.width, sm.height); draw(h, k / q);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(sm, 0, 0, c.width, c.height);
  }
  heights.set(key, c);
  return c;
}

/* ------------------------------------------------------------ 표 겉면 */
export type TicketInfo = { no: number; title: string; store: string; font: string };
export type TicketImgs = { photo?: HTMLImageElement | null; band?: HTMLImageElement | null; ros?: HTMLImageElement | null };

/** 처음 만든 판의 표 실루엣 — 옆구리가 반원으로 파였다 (Ticket.tsx 의 마스크와 같은 길) */
function notchPath(g: CanvasRenderingContext2D, W: number, H: number) {
  const sx = W / 400, sy = H / 200, R = 18, NR = 15;
  g.save(); g.scale(sx, sy); g.beginPath();
  g.moveTo(R, 0); g.lineTo(400 - R, 0); g.arcTo(400, 0, 400, R, R);
  g.lineTo(400, 100 - NR); g.arc(400, 100, NR, -Math.PI / 2, Math.PI / 2, true);
  g.lineTo(400, 200 - R); g.arcTo(400, 200, 400 - R, 200, R);
  g.lineTo(R, 200); g.arcTo(0, 200, 0, 200 - R, R);
  g.lineTo(0, 100 + NR); g.arc(0, 100, NR, Math.PI / 2, -Math.PI / 2, true);
  g.lineTo(0, R); g.arcTo(0, 0, R, 0, R);
  g.closePath(); g.restore();
}

/** 종이결 — 카운터 화면은 feTurbulence 로 그린다. 캔버스에는 같은 결을 잔 섬유로 뿌린다 */
function fibers(g: CanvasRenderingContext2D, W: number, H: number, amt: number) {
  const n = Math.round(26000 * amt);
  for (let i = 0; i < n; i++) {
    g.fillStyle = 'rgba(74,56,34,' + (Math.random() * 0.075 * amt).toFixed(3) + ')';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2.6, 1 + Math.random());
  }
  for (let i = 0; i < n / 3; i++) {
    g.fillStyle = 'rgba(255,246,226,' + (Math.random() * 0.08 * amt).toFixed(3) + ')';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
}

/** 글자 사이 — 지원하는 브라우저만. 없으면 그냥 붙여 쓴다 */
function spacing(g: CanvasRenderingContext2D, v: string) {
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v;
}

/** 공백에서만 끊는다(word-break: keep-all). 한 단어가 길면 그대로 둔다 */
function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && g.measureText(t).width > max) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/**
 * 개봉 화면의 표 겉면 — 카운터 화면의 Ticket(big) + 개봉 카드 글자(.lbl)와 같은 그림.
 * 3D 에서 표를 말아 올리려면 그림이 텍스처여야 한다. DOM 을 찍을 수는 없으므로 같은 규칙으로 다시 그린다.
 * 치수는 카운터 화면의 큰 카드(가로 560px) 기준 — 바꿀 때는 Ticket.tsx · board.css(.peel .cover) 와 같이.
 */
export function ticketCanvas(art: Art, t: TicketInfo, im: TicketImgs) {
  const ratio = art.photo?.ratio ?? 2;
  const W = 1280, H = Math.round(W / ratio), k = W / 560;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;

  if (art.photo) {
    // 사진 원판 — 천공 구멍과 가장자리는 알파로 뚫려 있다. 번호는 천공 왼쪽 칸의 가운데
    if (im.photo) g.drawImage(im.photo, 0, 0, W, H);
    else { roundRect(g, 0, 0, W, H, art.radius * k); g.fillStyle = art.pap; g.fill(); }
    const P = (n: number) => n * (640 / 560) * k;
    const cx = (art.photo.perf >= 1 ? 1 : art.photo.perf) * W / 2;
    g.fillStyle = art.numc; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + P(78) + 'px ' + art.numFont; spacing(g, '-0.02em');
    g.fillText(String(t.no), cx, H / 2);
    g.font = '800 ' + P(19) + 'px ' + t.font;
    g.fillText(t.title, cx, H / 2 + P(52) + P(19) / 2, art.photo.perf * W * 0.9);
    spacing(g, '0px');
    return c;
  }

  if (art.notch) notchPath(g, W, H); else roundRect(g, 0, 0, W, H, Math.max(1, art.radius * k));
  g.save(); g.clip();
  g.fillStyle = art.pap; g.fillRect(0, 0, W, H);
  if (art.grain) fibers(g, W, H, art.grain);
  // 보안 잔무늬 띠 — 높이 17% 로 깔아 반복
  if (art.band && im.band) {
    const th = H * 0.17, tw = th * (im.band.naturalWidth / im.band.naturalHeight || 6);
    g.globalAlpha = art.band;
    for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tw) g.drawImage(im.band, x, y, tw, th);
    g.globalAlpha = 1;
  }
  // 스텁 로제트 — 천공 오른쪽 스텁 안에만
  if (art.ros && im.ros) {
    const rh = H * 0.48, rw = rh * (im.ros.naturalWidth / im.ros.naturalHeight || 1);
    g.globalAlpha = art.ros; g.drawImage(im.ros, W * 0.99 - rw, (H - rh) / 2, rw, rh); g.globalAlpha = 1;
  }

  // 괘선 · 천공 · 검인 자리 — Ticket.tsx 의 SVG(400×200)를 그대로 옮긴다
  g.save(); g.scale(W / 400, H / 200);
  g.strokeStyle = art.ink; g.fillStyle = art.ink;
  g.globalAlpha = 0.92; g.lineWidth = 6; roundRect(g, 21, 13, 358, 174, 2); g.stroke();
  g.globalAlpha = 0.5; g.lineWidth = 1.3; roundRect(g, 33, 25, 334, 150, 1); g.stroke();
  if (art.perf) {
    g.globalAlpha = art.perf;
    for (let y = 12; y <= 188; y += 11) { g.beginPath(); g.arc(296, y, 2.3, 0, Math.PI * 2); g.fill(); }
  }
  if (art.dash) {
    g.globalAlpha = 1; g.lineWidth = 3; g.lineCap = 'round'; g.setLineDash([4, 9]);
    g.beginPath(); g.moveTo(300, 18); g.lineTo(300, 182); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
  }
  if (art.star) {
    g.globalAlpha = 1;
    g.fill(new Path2D('M46,74 Q52,94 66,100 Q52,106 46,126 Q40,106 26,100 Q40,94 46,74 Z'));
    g.fill(new Path2D('M74,66 Q77,80 86,84 Q77,88 74,102 Q71,88 62,84 Q71,80 74,66 Z'));
  }
  if (art.bars) {
    g.globalAlpha = 0.85;
    [0, 12, 20, 34, 42, 56, 68, 76].forEach((d, i) => { roundRect(g, 300 + d, 66, i % 3 === 0 ? 7 : 4, 68, 1.5); g.fill(); });
  }
  if (art.stamp) {
    g.globalAlpha = 0.4; g.lineWidth = 1.2; g.setLineDash([3, 5]);
    if (art.east) { roundRect(g, 317, 73, 54, 54, 2); g.stroke(); }
    else { g.beginPath(); g.arc(344, 100, 27, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([]);
  }
  g.restore();
  g.globalAlpha = 1;

  // 손잡이가 미끄러지는 홈
  const gx = 24 * k, gw = 22 * k, gy = H * 0.12, gh = H * 0.76;
  const gg = g.createLinearGradient(gx, 0, gx + gw, 0);
  gg.addColorStop(0, 'rgba(0,0,0,.42)'); gg.addColorStop(0.45, 'rgba(0,0,0,.14)'); gg.addColorStop(1, 'rgba(0,0,0,.42)');
  roundRect(g, gx, gy, gw, gh, gw / 2); g.fillStyle = gg; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = k;
  g.beginPath(); g.moveTo(gx + gw * 0.3, gy + gh - k); g.lineTo(gx + gw * 0.7, gy + gh - k); g.stroke();

  // 표면 조판 — 회차 제목 · 매장 · 번호. 손잡이가 지나가는 왼쪽과 스텁은 비운다(.lbl: 왼쪽 20% · 오른쪽 30%)
  const cx = W * 0.45, max = W * 0.5;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = art.numc;
  g.font = '700 ' + 40 * k + 'px ' + t.font; spacing(g, '-0.02em');
  const lines = wrap(g, t.store, max);
  const hEv = 13 * 1.25 * k, hB = 40 * 1.15 * k, hNo = 19 * 1.25 * k, gap = 10 * k;
  let y = H / 2 - (hEv + gap + hB * lines.length + gap + hNo) / 2;
  g.globalAlpha = 0.7; g.font = '800 ' + 13 * k + 'px ' + t.font; spacing(g, '0.34em');
  g.fillText(t.title, cx, y + hEv / 2, max); y += hEv + gap;
  g.globalAlpha = 1; g.font = '700 ' + 40 * k + 'px ' + t.font; spacing(g, '-0.02em');
  for (const l of lines) { g.fillText(l, cx, y + hB / 2, max); y += hB; }
  y += gap;
  g.globalAlpha = 0.62; g.font = '700 ' + 19 * k + 'px ' + art.numFont; spacing(g, '0.12em');
  g.fillText('NO. ' + t.no, cx, y + hNo / 2, max);
  g.globalAlpha = 1; spacing(g, '0px');
  g.restore();

  // 종이 가장자리 — 판 위에서 표가 갈리도록 (Ticket 의 inset 1px 테)
  if (art.notch) notchPath(g, W, H); else roundRect(g, 0, 0, W, H, Math.max(1, art.radius * k));
  g.strokeStyle = 'rgba(0,0,0,.42)'; g.lineWidth = 2 * k; g.stroke();
  return c;
}

/**
 * 쪽지를 정사각 카드 뒷면에 얹는다 — 판 위에 쪽지 한 장.
 * 어두운 판은 짙은 바탕, 밝은 판은 크림 바탕 — 밝은 판에서 검은 네모가 날아오면 혼자 무겁다
 */
export function cardBackCanvas(grade: string, info: SlipInfo, dark = true) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, dark ? '#2A241C' : '#F4ECDD'); bg.addColorStop(1, dark ? '#100E0B' : '#D9CBB0');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = (dark ? 'rgba(255,230,180,' : 'rgba(90,70,40,') + (Math.random() * 0.035).toFixed(3) + ')';
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  g.strokeStyle = dark ? 'rgba(201,162,75,.55)' : 'rgba(156,114,38,.6)'; g.lineWidth = 4; g.strokeRect(26, 26, S - 52, S - 52);
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

/**
 * 금속이 비출 주변 — 위는 따뜻한 조명, 가운데 정면에 소프트박스, 아래는 어둠.
 * 밝은 판은 아래까지 밝게 — 아래를 비추는 금박이 까맣게 떠서 밝은 바탕 위에 먼지처럼 보였다
 */
export function envCanvas(light = false) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  if (light) { gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.32, '#eadcc2'); gr.addColorStop(0.55, '#c8b593'); gr.addColorStop(1, '#a8977a'); }
  else { gr.addColorStop(0, '#fff4dc'); gr.addColorStop(0.32, '#b08a5a'); gr.addColorStop(0.55, '#2a2118'); gr.addColorStop(1, '#07070a'); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (const [x, y, r] of [[80, 56, 70], [260, 40, 90], [420, 78, 50], [384, 126, 58], [128, 132, 40]]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}
