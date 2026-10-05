/**
 * 결과 화면 3D 층 — 등급 쪽지가 날아와 뒤집히며 상품이 되고, 금속 색종이가 내린다.
 *
 * 왜 3D 인가: 평면 색종이·평면 버튼은 "그림"으로 읽힌다. 색종이 한 장 한 장이
 * 실제로 돌면서 빛을 받아 번쩍여야 손님이 "터졌다"고 느낀다. 그건 빛을 계산해야 나온다.
 *
 * 지키는 것
 *  1. **렌더러는 하나만 만든다.** 결과 화면은 하루에 수백 번 열린다. 열 때마다 WebGL
 *     컨텍스트를 새로 만들면 브라우저 한도(보통 16개)에 걸려 어느 순간 화면이 죽는다.
 *     캔버스를 붙였다 뗐다 하며 같은 렌더러를 계속 쓴다.
 *  2. **대기 화면에는 싣지 않는다.** 이 파일은 뽑기를 시작할 때 따로 받는다(import()).
 *     광고가 1순위인 대기 화면의 첫 로딩은 그대로다.
 *  3. **느린 태블릿이면 스스로 가벼워진다.** 처음 1.5초의 프레임 시간을 재서 느리면
 *     해상도와 색종이 수를 줄인다.
 *  4. **빛 번짐(블룸)은 쓰지 않는다.** 사장님이 꺼도 된다고 했고, GPU 부담이 가장 큰 효과다.
 */
import {
  AdditiveBlending, AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  CylinderGeometry, DirectionalLight, DoubleSide, DynamicDrawUsage, EquirectangularReflectionMapping,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, PointLight, Points, Quaternion, Scene, ShaderMaterial, SRGBColorSpace,
  type Texture, Vector3, WebGLRenderer,
} from 'three';
import { cardBackCanvas, coinCanvas, envCanvas, printCanvas, shadowCanvas, type SlipInfo } from './paint';
import type { Tier } from '../grade';


type TierDef = {
  ray: string; ray2: string; rayAmp: number; ray2Amp: number;
  rain: number; burst: number; power: number;
  foilRatio: number; foil: string[]; paper: string[];
  metal: string; shake: number; bokeh: string; glint: number;
};
/** 등급이 높을수록 판이 커진다 — 소리(팡파레)의 낙차와 맞춘다 */
const TIER: Record<Tier, TierDef> = {
  L: { ray: '#FFC864', ray2: '#FF6A3D', rayAmp: .6, ray2Amp: .38, rain: 380, burst: 260, power: 1.15, foilRatio: .75,
       foil: ['#E8C060', '#F5DC8C', '#C9A24B', '#FFF1C8', '#C9562E'], paper: ['#F2E6C8', '#D3C1A1', '#B23A2B'],
       metal: '#E3B95A', shake: 1, bokeh: '#FFD9A0', glint: 2.4 },
  A: { ray: '#FFD27A', ray2: '#FFD27A', rayAmp: .5, ray2Amp: 0, rain: 300, burst: 210, power: 1, foilRatio: .72,
       foil: ['#E8C060', '#F5DC8C', '#C9A24B', '#FFF1C8'], paper: ['#F2E6C8', '#D3C1A1'],
       metal: '#D9B45C', shake: .55, bokeh: '#FFD9A0', glint: 2 },
  C: { ray: '#F0A878', ray2: '#F0A878', rayAmp: .42, ray2Amp: 0, rain: 220, burst: 130, power: .85, foilRatio: .58,
       foil: ['#C08A5A', '#E2A57A', '#9C6A3E', '#F3C9A2'], paper: ['#E9DCC4', '#D3C1A1'],
       metal: '#C98E5E', shake: 0, bokeh: '#F6C7A0', glint: 1.7 },
  E: { ray: '#C8D6F0', ray2: '#C8D6F0', rayAmp: .34, ray2Amp: 0, rain: 150, burst: 80, power: .75, foilRatio: .52,
       foil: ['#C9CED6', '#E8ECF2', '#9FA6B2', '#FFFFFF'], paper: ['#EEF1F5', '#D6DAE0'],
       metal: '#B4BBC6', shake: 0, bokeh: '#DCE6FF', glint: 1.5 },
};

export type PlayOpts = {
  /** 캔버스를 붙일 곳 — 카운터 화면 전체(.bd) */
  host: HTMLElement;
  /** 카드와 메달이 앉을 자리. 글자 층에서 자리를 비워 두고, 그 위치를 재서 3D 를 맞춘다 */
  cardSlot: HTMLElement;
  coinSlot: HTMLElement;
  grade: string;
  tier: Tier;
  /** 카드 앞면 사진 (상품 또는 막차 보너스). 없으면 등급 글자를 크게 찍는다 */
  front: string | null;
  /** 그림(할인권 SVG)이면 자르지 않는다 */
  flat: boolean;
  slip: SlipInfo;
  /** 밝은 판이면 빛줄기를 줄이고 빛 망울은 끈다 — 밝은 바탕에 더한 빛은 바래 보인다 */
  dark: boolean;
  /** WebGL 이 도중에 죽으면 부른다 — 글자 화면으로 내려간다 */
  onLost?: () => void;
};

const FOV = 30;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const eOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const eOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/* ------------------------------------------------------------ 이미지 */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
/** 사진을 미리 받아 둔다. Supabase 저장소는 CORS(*)를 주므로 텍스처로 쓸 수 있다 */
export function preload(src: string | null) { if (src) loadImg(src); }
function loadImg(src: string) {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((ok) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.decoding = 'async';
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = src;
    });
    imgCache.set(src, p);
    if (imgCache.size > 32) imgCache.delete(imgCache.keys().next().value as string);
  }
  return p;
}

/* ------------------------------------------------------------ 셰이더 */
const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/** 빛줄기 — 뒤에서 천천히 도는 방사형 빛 */
function makeRays() {
  const u = { uTime: { value: 0 }, uAmp: { value: 0 }, uN: { value: 9 }, uCol: { value: new Color('#FFD27A') }, uSpin: { value: 1 } };
  const m = new ShaderMaterial({
    uniforms: u, vertexShader: VS_UV, transparent: true, depthWrite: false, blending: AdditiveBlending,
    fragmentShader: `
      uniform float uTime; uniform float uAmp; uniform float uN; uniform vec3 uCol; uniform float uSpin;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float s1 = pow(max(0.0, sin(a * uN + uTime * 0.35 * uSpin)), 16.0);
        float s2 = pow(max(0.0, sin(a * (uN * 0.5 + 3.0) - uTime * 0.21 * uSpin + 1.3)), 24.0);
        float fall = smoothstep(0.9, 0.02, r);
        float core = exp(-r * r * 34.0) * 0.7;
        gl_FragColor = vec4(uCol * ((s1 * 0.8 + s2 * 0.6) * fall * fall * 0.75 + core) * uAmp, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), m);
  mesh.renderOrder = -2;
  return { mesh, u };
}

/** 떠다니는 빛 망울 — 초점이 안 맞은 먼 불빛처럼 부드럽게 */
function makeBokeh(n: number) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd(-1, 1); pos[i * 3 + 1] = rnd(-1, 1); pos[i * 3 + 2] = rnd(-1, 1);
    size[i] = rnd(6, 30); seed[i] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  g.setAttribute('aSeed', new BufferAttribute(seed, 1));
  const u = { uTime: { value: 0 }, uScale: { value: 1 }, uCol: { value: new Color('#FFD9A0') }, uAmp: { value: 0 },
    uBox: { value: new Vector3(760, 900, 1300) } };
  const m = new ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform float uScale; uniform vec3 uBox;
      varying float vA;
      void main(){
        vec3 p = position * uBox;
        p.z -= uBox.z * 0.25;
        p.y = mod(p.y + uTime * (16.0 + aSeed * 38.0) + uBox.y, uBox.y * 2.0) - uBox.y;
        p.x += sin(uTime * 0.5 + aSeed * 30.0) * 22.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(150.0, aSize * uScale / -mv.z);
        vA = 0.3 + 0.7 * abs(sin(uTime * (0.7 + aSeed) + aSeed * 20.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uCol; uniform float uAmp; varying float vA;
      void main(){
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
        if(r > 1.0) discard;
        float glow = exp(-r * r * 3.2) * smoothstep(1.0, 0.8, r);
        gl_FragColor = vec4(uCol * glow * 0.22 * vA * uAmp, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = -1;
  return { pts, u };
}

/* ------------------------------------------------------------ 색종이 */
type Piece = { p: Vector3; v: Vector3; q: Quaternion; ax: Vector3; w: number; sx: number; sy: number;
  mode: 0 | 1 | 2; f: number; ph: number; kind: 0 | 1; idx: number };
/** 금박은 빛을 받는 각도에 따라 번쩍인다. 한 장 한 장이 실제로 돈다 */
class Confetti {
  foil: InstancedMesh; paper: InstancedMesh; P: Piece[] = [];
  m4 = new Matrix4(); tq = new Quaternion(); ts = new Vector3(); tmp = new Vector3();
  zero = new Matrix4().makeScale(0, 0, 0);
  rainTarget = 0; W = 800; H = 1280; D = 2400;
  constructor(scene: Scene, N: number) {
    const geo = new PlaneGeometry(1, 1);
    this.foil = new InstancedMesh(geo, new MeshStandardMaterial({ metalness: .95, roughness: .24, side: DoubleSide, envMapIntensity: 1.6 }), N);
    this.paper = new InstancedMesh(geo, new MeshStandardMaterial({ metalness: 0, roughness: .7, side: DoubleSide }), N);
    for (const m of [this.foil, this.paper]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      scene.add(m);
    }
    for (let i = 0; i < N; i++) this.P.push({ p: new Vector3(), v: new Vector3(), q: new Quaternion(),
      ax: new Vector3(1, 0, 0), w: 0, sx: 1, sy: 1, mode: 0, f: 1, ph: 0, kind: 0, idx: 0 });
  }
  setTier(T: TierDef) {
    let fi = 0, pi = 0; const c = new Color();
    for (const P of this.P) {
      P.kind = Math.random() < T.foilRatio ? 0 : 1;
      P.idx = P.kind === 0 ? fi++ : pi++;
      const pal = P.kind === 0 ? T.foil : T.paper;
      c.set(pal[(Math.random() * pal.length) | 0]);
      (P.kind === 0 ? this.foil : this.paper).setColorAt(P.idx, c);
      P.mode = 0;
    }
    this.foil.count = fi; this.paper.count = pi;
    if (this.foil.instanceColor) this.foil.instanceColor.needsUpdate = true;
    if (this.paper.instanceColor) this.paper.instanceColor.needsUpdate = true;
    this.rainTarget = 0;
  }
  look(P: Piece) {
    P.sx = rnd(9, 15); P.sy = rnd(15, 27);
    P.ax.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
    P.w = rnd(4, 12); P.f = rnd(1.1, 3.2); P.ph = rnd(0, 6.28);
    P.q.setFromAxisAngle(P.ax, rnd(0, 6.28));
  }
  rain(P: Piece, prefill: boolean) {
    P.mode = 1; this.look(P);
    const W = this.W, H = this.H;
    P.p.set(rnd(-W * .7, W * .7), prefill ? rnd(-H * .55, H * .74) : rnd(H * .6, H * .85), rnd(-900, 380));
    P.v.set(rnd(-30, 30), rnd(-150, -50), rnd(-20, 20));
  }
  startRain(n: number) {
    let k = 0;
    for (const P of this.P) { if (k >= n) break; if (P.mode === 0) { this.rain(P, false); k++; } }
    this.rainTarget = n;
  }
  burst(origin: Vector3, n: number, power: number) {
    let k = 0;
    for (const P of this.P) {
      if (k >= n) break;
      if (P.mode !== 0) continue;
      P.mode = 2; this.look(P);
      P.p.copy(origin).add(this.tmp.set(rnd(-50, 50), rnd(-50, 50), rnd(-20, 20)));
      const th = rnd(0, Math.PI * 2);
      this.tmp.set(Math.cos(th) * rnd(.45, 1), Math.sin(th) * rnd(.45, 1) + rnd(.2, .7), rnd(.3, 1.2)).normalize();
      P.v.copy(this.tmp).multiplyScalar(rnd(520, 1350) * power);
      k++;
    }
  }
  parkAll() { for (const P of this.P) P.mode = 0; this.rainTarget = 0; }
  update(dt: number, t: number) {
    let raining = 0;
    for (const P of this.P) if (P.mode === 1) raining++;
    const floor = -this.H * .64;
    for (const P of this.P) {
      const mesh = P.kind === 0 ? this.foil : this.paper;
      if (P.mode === 0) { mesh.setMatrixAt(P.idx, this.zero); continue; }
      P.v.y -= 540 * dt;
      P.v.multiplyScalar(Math.exp(-1.6 * dt));
      P.v.x += Math.sin(t * P.f + P.ph) * 170 * dt;
      P.p.addScaledVector(P.v, dt);
      this.tq.setFromAxisAngle(P.ax, P.w * dt); P.q.multiply(this.tq);
      if (P.p.y < floor || P.p.z > this.D - 240) {
        if (P.mode === 1 || (P.mode === 2 && raining < this.rainTarget)) {
          if (P.mode === 2) raining++;
          this.rain(P, false);
        } else { P.mode = 0; mesh.setMatrixAt(P.idx, this.zero); continue; }
      }
      this.ts.set(P.sx, P.sy, 1); this.m4.compose(P.p, P.q, this.ts);
      mesh.setMatrixAt(P.idx, this.m4);
    }
    this.foil.instanceMatrix.needsUpdate = true; this.paper.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ 무대 */
/**
 * 카드 · 메달 · 그늘은 한 번만 만들어 두고 판마다 그림(텍스처)만 갈아 끼운다.
 * 재질을 판마다 새로 만들고 버리면 셰이더도 같이 버려져, 결과가 뜰 때마다 다시 굽느라 멈칫한다.
 */
type Kit = {
  card: Group; box: Mesh; coin: Group; shadow: Mesh;
  edge: MeshStandardMaterial; fm: MeshStandardMaterial; bm: MeshStandardMaterial;
  cm: MeshStandardMaterial; side: MeshStandardMaterial; shMat: MeshBasicMaterial;
  /** 그림이 없을 때 끼워 두는 1px 자리 — 재질이 "그림 있음" 셰이더를 계속 쓰게 한다 */
  ph: CanvasTexture;
};

class Stage {
  ok = false;
  canvas = document.createElement('canvas');
  private r!: WebGLRenderer;
  private scene = new Scene();
  private cam = new PerspectiveCamera(FOV, 800 / 1280, 10, 20000);
  private rays = makeRays();
  private rays2 = makeRays();
  private bok = makeBokeh(100);
  private conf!: Confetti;
  private glint = new PointLight(0xfff2d8, 0, 1800, 2);
  private shadowTex!: CanvasTexture;
  private kit!: Kit;
  private tex: Texture[] = [];
  private live = false;
  private warming: Promise<unknown> | null = null;
  private host: HTMLElement | null = null;
  private opts: PlayOpts | null = null;
  private T: TierDef = TIER.A;
  private raf = 0; private last = 0; private t0 = 0; private token = 0;
  private W = 800; private H = 1280; private D = 2400; private uScale = 1;
  private pr = 1.5; private slow = 0; private frames = 0; private lite = false;
  private cardAt = new Vector3(); private coinAt = new Vector3(); private cardSize = 440; private coinK = 1;
  private revealed = false; private shake = 0; private punch = 0;
  private rayK = 1; private bokK = 1;
  private ro: ResizeObserver | null = null;
  private reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    this.canvas.className = 'fx3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    try {
      this.r = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { return; }
    this.r.outputColorSpace = SRGBColorSpace;
    this.pr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.ok = false; this.opts?.onLost?.(); this.stop();
    });

    // 금속이 비출 주변 — 한 번만 만든다
    const envTex = new CanvasTexture(envCanvas());
    envTex.mapping = EquirectangularReflectionMapping; envTex.colorSpace = SRGBColorSpace;
    const pm = new PMREMGenerator(this.r);
    this.scene.environment = pm.fromEquirectangular(envTex).texture;
    envTex.dispose(); pm.dispose();

    this.rays2.u.uSpin.value = -1.3; this.rays2.u.uN.value = 6;
    this.scene.add(this.rays.mesh, this.rays2.mesh, this.bok.pts);
    // 조명 — 물리 단위라 예전 값에 π 를 곱한 크기다
    this.scene.add(new AmbientLight(0xffffff, .7));
    const dl = new DirectionalLight(0xfff0dc, 2.7); dl.position.set(-400, 600, 900); this.scene.add(dl);
    this.scene.add(this.glint);
    this.conf = new Confetti(this.scene, 680);
    this.shadowTex = new CanvasTexture(shadowCanvas());
    this.kit = this.makeKit();
    this.ok = true;
  }

  private makeKit(): Kit {
    const dot = document.createElement('canvas'); dot.width = dot.height = 1;
    const ph = new CanvasTexture(dot); ph.colorSpace = SRGBColorSpace;
    const edge = new MeshStandardMaterial({ color: 0xd9b45c, metalness: 1, roughness: .22, envMapIntensity: 1.4 });
    const fm = new MeshStandardMaterial({ map: ph, emissiveMap: ph, emissive: 0xffffff, emissiveIntensity: .5,
      roughness: .4, metalness: 0, envMapIntensity: .3 });
    const bm = new MeshStandardMaterial({ map: ph, roughness: .75, metalness: 0 });
    // 상자는 1 크기로 만들고 칸 크기만큼 늘린다 — 화면마다 칸 크기가 달라도 같은 상자를 쓴다
    const box = new Mesh(new BoxGeometry(1, 1, 1), [edge, edge, edge, edge, fm, bm]);
    const card = new Group(); card.add(box);

    const cm = new MeshStandardMaterial({ color: 0xd9b45c, metalness: 1, roughness: .3, map: ph, bumpMap: ph, bumpScale: 3, envMapIntensity: 1.5 });
    const side = new MeshStandardMaterial({ color: 0xd9b45c, metalness: 1, roughness: .2, envMapIntensity: 1.5 });
    const coinMesh = new Mesh(new CylinderGeometry(52, 52, 11, 64), [side, cm, cm]);
    coinMesh.rotation.x = Math.PI / 2;
    const coin = new Group(); coin.add(coinMesh);

    // 카드 아래 그늘 — 밝은 판에서 카드가 떠 보이게 한다
    const shMat = new MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: .7 });
    const shadow = new Mesh(new PlaneGeometry(1, 1), shMat);
    shadow.renderOrder = -1;

    for (const o of [card, coin, shadow]) { o.visible = false; this.scene.add(o); }
    return { card, box, coin, shadow, edge, fm, bm, cm, side, shMat, ph };
  }

  /**
   * 셰이더를 미리 굽는다. 티켓을 고르는 동안 불러 두면 결과가 뜰 때 멈칫하지 않는다.
   * 한 번 구운 것은 재질이 살아 있는 한 다시 굽지 않는다.
   */
  warm() {
    if (!this.ok) return Promise.resolve();
    if (!this.warming) this.warming = this.r.compileAsync(this.scene, this.cam).catch(() => {});
    return this.warming;
  }

  /** 결과 화면이 열릴 때 */
  async play(o: PlayOpts) {
    if (!this.ok) throw new Error('webgl');
    const my = ++this.token;
    this.stopLoop(); this.release();
    this.opts = o; this.host = o.host; this.T = TIER[o.tier];
    if (this.canvas.parentElement !== o.host) o.host.prepend(this.canvas);
    this.fit();
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => { this.fit(); this.measure(); });
    this.ro.observe(o.host);

    // 바탕은 테마의 판 색 그대로 — 캔버스가 화면 전체를 덮는다.
    // body 의 배경색은 테마가 바뀔 때 0.35초 동안 번져 가므로(transition) 그 순간 값을 읽으면 이전 테마 색이 나온다.
    // 변수(--page)는 번지지 않아 바로 최종 색이다
    const page = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
    this.r.setClearColor(new Color(page || getComputedStyle(document.body).backgroundColor || '#0E0E10'), 1);

    const img = o.front ? await loadImg(o.front) : null;
    if (my !== this.token) return;
    const front = new CanvasTexture(printCanvas(img, o.flat, o.grade));
    const back = new CanvasTexture(cardBackCanvas(o.grade, o.slip));
    const face = new CanvasTexture(coinCanvas(o.grade));
    for (const t of [front, back, face]) { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; }
    this.tex = [front, back, face];

    const K = this.kit, T = this.T, metal = new Color(T.metal);
    K.fm.map = front; K.fm.emissiveMap = front; K.bm.map = back;
    K.cm.map = face; K.cm.bumpMap = face;
    for (const m of [K.edge, K.cm, K.side]) m.color.copy(metal);
    K.coin.scale.setScalar(.001);
    this.measure();

    this.rays.u.uCol.value.set(T.ray); this.rays2.u.uCol.value.set(T.ray2);
    this.rays.u.uAmp.value = 0; this.rays2.u.uAmp.value = 0;
    this.bok.u.uCol.value.set(T.bokeh); this.bok.u.uAmp.value = 0;
    // 밝은 판에 더한 빛은 바래 보인다 — 빛줄기는 줄이고 빛 망울은 끈다
    this.rayK = o.dark ? 1 : .45; this.bokK = o.dark ? 1 : 0;
    this.conf.setTier(T);

    // 첫 프레임에서 그림을 올리느라 끊기지 않게 미리 올려 둔다. 셰이더는 보통 이미 구워져 있다
    for (const t of this.tex) this.r.initTexture(t);
    await this.warm();
    if (my !== this.token) return;

    for (const x of [K.card, K.coin, K.shadow]) x.visible = true;
    this.live = true;
    this.revealed = false; this.shake = 0; this.punch = 0;
    this.frames = 0; this.slow = 0;
    this.t0 = performance.now() / 1000;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** 결과 화면을 떠날 때 — 캔버스를 떼고 이번 판 그림을 돌려준다. 렌더러와 재질은 남긴다 */
  stop() {
    this.token++;
    this.stopLoop(); this.release();
    this.ro?.disconnect(); this.ro = null;
    this.canvas.remove();
    this.host = null; this.opts = null;
  }

  private stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  private release() {
    this.live = false;
    const K = this.kit; if (!K) return;
    for (const x of [K.card, K.coin, K.shadow]) x.visible = false;
    K.fm.map = K.ph; K.fm.emissiveMap = K.ph; K.bm.map = K.ph; K.cm.map = K.ph; K.cm.bumpMap = K.ph;
    this.tex.forEach((t) => t.dispose()); this.tex = [];
    this.conf?.parkAll();
  }

  private fit() {
    if (!this.host) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.W = w; this.H = h;
    this.r.setPixelRatio(this.pr);
    this.r.setSize(w, h, false);
    // z=0 평면에서 월드 1 = CSS 1px 이 되게 거리를 잡는다 — 글자 층의 자리와 그대로 맞는다
    this.D = (h / 2) / Math.tan((FOV * Math.PI) / 360);
    this.cam.aspect = w / h; this.cam.near = 10; this.cam.far = this.D * 8;
    this.cam.updateProjectionMatrix();
    this.uScale = (h * this.pr) / (2 * Math.tan((FOV * Math.PI) / 360));
    const big = Math.max(w, h) * 3;
    this.rays.mesh.scale.set(big, big, 1); this.rays2.mesh.scale.set(big, big, 1);
    this.bok.u.uBox.value.set(w * .95, h * .7, 1300);
    this.conf.W = w; this.conf.H = h; this.conf.D = this.D;
  }

  /** 글자 층에 비워 둔 자리를 재서 3D 좌표로 옮긴다 */
  private measure() {
    const o = this.opts; if (!o) return;
    const c = this.canvas.getBoundingClientRect();
    const at = (el: HTMLElement, v: Vector3) => {
      const b = el.getBoundingClientRect();
      v.set(b.left + b.width / 2 - c.left - c.width / 2, c.top + c.height / 2 - (b.top + b.height / 2), 0);
      return b;
    };
    const cb = at(o.cardSlot, this.cardAt);
    const nb = at(o.coinSlot, this.coinAt);
    // 칸이 정사각형이 아닐 수 있다(남는 높이를 받아 늘어난다) — 들어가는 가장 큰 정사각형
    this.cardSize = Math.max(120, Math.min(cb.width, cb.height));
    this.coinK = nb.height ? Math.min(1.2, nb.height / 104) : 1;
    this.kit.box.scale.set(this.cardSize, this.cardSize, 10);
    for (const R of [this.rays, this.rays2]) R.mesh.position.set(this.cardAt.x, this.cardAt.y, -560);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    this.quality(dt);
    this.update(dt, now / 1000);
    this.r.render(this.scene, this.cam);
  };

  /** 처음 1.5초 프레임 시간을 재서 느리면 가벼워진다 */
  private quality(dt: number) {
    if (this.lite || this.frames > 90) return;
    this.frames++;
    if (this.frames > 10 && dt > .026) this.slow++;
    if (this.frames === 90 && this.slow > 35) {
      this.lite = true; this.pr = 1; this.fit();
      this.conf.rainTarget = Math.round(this.conf.rainTarget * .6);
    }
  }

  private update(dt: number, t: number) {
    if (!this.live) return;
    const K = this.kit, T = this.T;
    const lt = t - this.t0;
    // 처음 몇 초는 글자 층이 자리 잡는 중일 수 있다(글꼴 · QR) — 자리를 계속 다시 잰다
    if (lt < 2.5) this.measure();
    this.rays.u.uTime.value = t; this.rays2.u.uTime.value = t;
    this.bok.u.uTime.value = t; this.bok.u.uScale.value = this.uScale;
    this.conf.update(dt, t);

    const fade = eOutCubic(c01(lt / 1.2));
    this.rays.u.uAmp.value = T.rayAmp * fade * this.rayK;
    this.rays2.u.uAmp.value = T.ray2Amp * fade * this.rayK;
    this.bok.u.uAmp.value = fade * this.bokK;

    // 쪽지가 멀리서 돌며 날아오고, 도착 직전에 뒤집혀 앞면(상품)이 나온다
    const k = c01(lt / 1.25), c = K.card, settle = Math.max(0, lt - 1.25);
    c.position.set(this.cardAt.x, this.cardAt.y - 100 * (1 - eOutCubic(k)), -1300 * (1 - eOutCubic(k)));
    c.rotation.y = Math.pow(1 - k, 1.3) * Math.PI * 3 + (k >= 1 ? Math.sin(settle * 1.1) * .075 : 0);
    c.rotation.x = -(1 - eOutCubic(k)) + (k >= 1 ? Math.sin(settle * .9) * .045 : 0);
    if (k >= 1) c.position.y += Math.sin(settle * 1.3) * 7;
    c.scale.setScalar(.5 + .5 * eOutBack(k));
    K.shadow.position.set(this.cardAt.x + 10, this.cardAt.y - 26, -60);
    K.shadow.scale.set(this.cardSize * 1.5, this.cardSize * 1.5, 1);
    K.shMat.opacity = (this.opts?.dark ? .7 : .42) * eOutCubic(k);

    if (!this.revealed && lt >= 1.12) {
      this.revealed = true;
      this.punch = 1; this.shake = this.reduce ? 0 : T.shake;
      this.conf.burst(new Vector3(this.cardAt.x, this.cardAt.y, 40), T.burst, T.power);
      this.conf.startRain(Math.round(T.rain * (this.reduce ? .5 : 1) * (this.lite ? .6 : 1)));
    }

    // 등급 메달 — 튀어나와 계속 돈다
    const kc = c01((lt - 1.3) / .55);
    K.coin.scale.setScalar(Math.max(.001, eOutBack(kc)) * this.coinK);
    K.coin.rotation.y += dt * 2.5;
    K.coin.position.set(this.coinAt.x, this.coinAt.y + Math.sin(lt * 2) * 3, 0);

    // 앞면을 훑고 지나가는 빛
    const cyc = (lt - 1.4) % 3.2;
    if (lt > 1.4 && cyc < 1.15) {
      const q = cyc / 1.15;
      this.glint.position.set(this.cardAt.x - 700 + 1400 * q, this.cardAt.y + 260, 380);
      this.glint.intensity = 3e5 * T.glint * Math.sin(Math.PI * q);
    } else this.glint.intensity = 0;

    // 카메라 — 천천히 숨 쉬듯 흔들리고, 터질 때 한 번 다가왔다 물러난다
    const p = this.cam.position;
    p.set(Math.sin(t * .31) * 24, Math.sin(t * .23) * 16, this.D * (1 + this.punch * .08));
    if (this.shake > 0) {
      p.x += (Math.random() - .5) * 34 * this.shake; p.y += (Math.random() - .5) * 34 * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    this.punch = Math.max(0, this.punch - dt * 1.7);
    this.cam.lookAt(0, 0, 0);
  }
}

let stage: Stage | null = null;
/** 렌더러는 하나만 — 결과 화면을 몇 번 열든 같은 것을 다시 쓴다. WebGL 이 안 되면 null */
export function getStage() {
  if (!stage) stage = new Stage();
  return stage.ok ? stage : null;
}
export type { Stage };
