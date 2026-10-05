/**
 * 3D 연출 공용 — 렌더러 하나, 금속이 비출 주변, 빛줄기 · 빛 망울 · 색종이, 등급별 판 크기.
 * 개봉 화면(open3d)과 결과 화면(result3d)이 같은 렌더러를 번갈아 쓴다.
 *
 * 지키는 것
 *  1. **렌더러는 하나만 만든다.** 개봉 · 결과 화면은 하루에 수백 번 열린다. 열 때마다 WebGL
 *     컨텍스트를 새로 만들면 브라우저 한도(보통 16개)에 걸려 어느 순간 화면이 죽는다.
 *     캔버스를 붙였다 뗐다 하며 같은 렌더러를 계속 쓰고, 한 번에 한 장면만 돌린다.
 *  2. **대기 화면에는 싣지 않는다.** 이 파일들은 뽑기 흐름에 들어온 뒤에 따로 받는다(import()).
 *     광고가 1순위인 대기 화면의 첫 로딩은 그대로다.
 *  3. **느린 태블릿이면 스스로 가벼워진다.** 처음 1.5초의 프레임 시간을 재서 느리면
 *     해상도를 낮추고, 장면에 알려 색종이 · 불꽃 수를 줄이게 한다. 한 번 가벼워지면 계속 가볍다.
 *  4. **빛 번짐(블룸)은 쓰지 않는다.** 사장님이 꺼도 된다고 했고, GPU 부담이 가장 큰 효과다.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, DynamicDrawUsage,
  EquirectangularReflectionMapping, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Points, Quaternion, type Scene, ShaderMaterial, SRGBColorSpace,
  type Texture, Vector3, WebGLRenderer,
} from 'three';
import { envCanvas } from './paint';
import type { Tier } from '../grade';

export const FOV = 30;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const eOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const eIn = (x: number) => x * x * x;
export const eOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const sstep = (a: number, b: number, x: number) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------ 등급별 판 크기 */
export type TierDef = {
  ray: string; ray2: string; rayAmp: number; ray2Amp: number;
  rain: number; burst: number; power: number;
  foilRatio: number; foil: string[]; paper: string[];
  metal: string; shake: number; bokeh: string; glint: number;
};
/** 등급이 높을수록 판이 커진다 — 소리(팡파레)의 낙차와 맞춘다 */
export const TIER: Record<Tier, TierDef> = {
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

/* ------------------------------------------------------------ 이미지 */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
/** 사진을 미리 받아 둔다. Supabase 저장소는 CORS(*)를 주므로 텍스처로 쓸 수 있다 */
export function preload(src: string | null) { if (src) loadImg(src); }
export function loadImg(src: string) {
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
export const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/** 빛줄기 — 뒤에서 천천히 도는 방사형 빛 */
export function makeRays() {
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
export function makeBokeh(n: number) {
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
export class Confetti {
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
  rain(P: Piece) {
    P.mode = 1; this.look(P);
    const W = this.W, H = this.H;
    P.p.set(rnd(-W * .7, W * .7), rnd(H * .6, H * .85), rnd(-900, 380));
    P.v.set(rnd(-30, 30), rnd(-150, -50), rnd(-20, 20));
  }
  startRain(n: number) {
    let k = 0;
    for (const P of this.P) { if (k >= n) break; if (P.mode === 0) { this.rain(P); k++; } }
    this.rainTarget = n;
  }
  /**
   * 한 점에서 터진다. ring 을 주면 고리로 터진다 — 그 지름의 테두리 바로 안쪽(카드 뒤)에서 바깥을 향해
   * 화면과 나란히 쏟아진다. 뒤집혀 나온 상품을 덮지 않고 둘레를 감싼다
   */
  burst(origin: Vector3, n: number, power: number, ring = 0) {
    let k = 0;
    for (const P of this.P) {
      if (k >= n) break;
      if (P.mode !== 0) continue;
      P.mode = 2; this.look(P);
      const th = rnd(0, Math.PI * 2);
      if (ring) {
        const r = ring * rnd(.32, .5);
        P.p.copy(origin).add(this.tmp.set(Math.cos(th) * r, Math.sin(th) * r, rnd(-15, 15)));
        this.tmp.set(Math.cos(th), Math.sin(th) + rnd(.1, .45), rnd(0, .15)).normalize();
      } else {
        P.p.copy(origin).add(this.tmp.set(rnd(-50, 50), rnd(-50, 50), rnd(-20, 20)));
        this.tmp.set(Math.cos(th) * rnd(.45, 1), Math.sin(th) * rnd(.45, 1) + rnd(.2, .7), rnd(.3, 1.2)).normalize();
      }
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
          this.rain(P);
        } else { P.mode = 0; mesh.setMatrixAt(P.idx, this.zero); continue; }
      }
      this.ts.set(P.sx, P.sy, 1); this.m4.compose(P.p, P.q, this.ts);
      mesh.setMatrixAt(P.idx, this.m4);
    }
    this.foil.instanceMatrix.needsUpdate = true; this.paper.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ 렌더러 */
/** 렌더러를 빌려 쓰는 장면 — 개봉 화면과 결과 화면 */
export interface Runner {
  scene: Scene;
  cam: PerspectiveCamera;
  update(dt: number, t: number): void;
  /** 화면 크기가 바뀌었다(가벼워져 해상도가 바뀐 때도) */
  resize(): void;
  /** 느린 기기로 판정됐다 — 색종이 · 불꽃 수를 줄인다 */
  lighten?(): void;
  /** WebGL 이 죽었다 — 글자 화면으로 내려간다 */
  lost(): void;
}

export class Gl {
  ok = false;
  readonly canvas = document.createElement('canvas');
  r!: WebGLRenderer;
  /** 금속이 비출 주변(PMREM) — 두 장면이 같이 쓴다. 밝은 판은 envLight */
  env: Texture | null = null;
  envLight: Texture | null = null;
  W = 800; H = 1280; D = 2400; uScale = 1;
  pr = 1.5; lite = false;
  private host: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;
  private cur: Runner | null = null;
  private raf = 0; private last = 0; private frames = 0; private slow = 0;
  private sized = 0; private idle = 0;

  constructor() {
    this.canvas.className = 'fx3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    try {
      this.r = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { return; }
    this.r.outputColorSpace = SRGBColorSpace;
    this.pr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.ok = false;
      const c = this.cur; this.halt(); this.detach(); c?.lost();
    });
    const pm = new PMREMGenerator(this.r);
    const bake = (light: boolean) => {
      const t = new CanvasTexture(envCanvas(light));
      t.mapping = EquirectangularReflectionMapping; t.colorSpace = SRGBColorSpace;
      const out = pm.fromEquirectangular(t).texture;
      t.dispose();
      return out;
    };
    this.env = bake(false); this.envLight = bake(true);
    pm.dispose();
    this.ok = true;
  }

  get current() { return this.cur; }

  /** 캔버스를 화면에 붙인다. 바탕은 테마의 판 색 그대로 — 캔버스가 화면 전체를 덮는다 */
  attach(host: HTMLElement) {
    clearTimeout(this.idle);
    const fresh = this.canvas.parentElement !== host;
    if (fresh) host.prepend(this.canvas);
    if (this.host !== host) {
      this.ro?.disconnect();
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(host);
    }
    this.host = host;
    // body 의 배경색은 테마가 바뀔 때 0.35초 동안 번져 가므로(transition) 그 순간 값을 읽으면 이전 테마 색이 나온다.
    // 변수(--page)는 번지지 않아 바로 최종 색이다
    const page = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
    this.r.setClearColor(new Color(page || getComputedStyle(document.body).backgroundColor || '#0E0E10'), 1);
    this.fit();
    // 새로 붙일 때는 판 색으로 비운다 — 몇 분 전 장면이 잠깐 비치지 않게.
    // 붙어 있는 채로 넘겨받을 때(개봉 → 결과)는 비우지 않는다 — 앞 장면의 마지막 그림이 다음 그림까지 이어 준다
    if (fresh) this.r.clear();
  }
  detach() {
    this.ro?.disconnect(); this.ro = null; this.host = null;
    this.canvas.remove();
  }

  /** z=0 평면에서 월드 1 = CSS 1px 이 되게 거리를 잡는다 — 글자 층의 자리와 그대로 맞는다 */
  fit() {
    if (!this.host) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    // 크기가 그대로면 다시 잡지 않는다 — 캔버스 크기를 다시 넣으면 그림이 지워진다
    const same = w === this.W && h === this.H && this.sized === this.pr;
    this.W = w; this.H = h;
    if (!same) { this.r.setPixelRatio(this.pr); this.r.setSize(w, h, false); this.sized = this.pr; }
    this.D = (h / 2) / Math.tan((FOV * Math.PI) / 360);
    this.uScale = (h * this.pr) / (2 * Math.tan((FOV * Math.PI) / 360));
    this.cur?.resize();
  }
  fitCam(cam: PerspectiveCamera) {
    // 가까운 면을 너무 가깝게 두면 깊이 정밀도가 그만큼 떨어진다(16비트 깊이 버퍼 기기). 카메라 50px 앞까지는 비어 있다
    cam.aspect = this.W / this.H; cam.near = 50; cam.far = this.D * 8;
    cam.updateProjectionMatrix();
  }

  run(x: Runner) {
    cancelAnimationFrame(this.raf);
    this.cur = x; this.frames = 0; this.slow = 0;
    this.last = performance.now();
    x.resize();
    this.raf = requestAnimationFrame(this.tick);
  }
  /** 멈춘다. x 를 주면 그 장면이 돌고 있을 때만 */
  halt(x?: Runner) {
    if (x && this.cur !== x) return;
    cancelAnimationFrame(this.raf); this.raf = 0; this.cur = null;
  }
  /**
   * 이 장면이 화면을 쥐고 있으면 놓는다 — 다른 장면이 이미 넘겨받았으면 건드리지 않는다.
   * keep 이면 캔버스를 바로 떼지 않는다(개봉이 끝나 결과가 곧 이어받을 때). 아무도 안 받으면 잠시 뒤 뗀다
   */
  release(x: Runner, keep = false) {
    if (this.cur !== x) return;
    this.halt();
    clearTimeout(this.idle);
    if (!keep) { this.detach(); return; }
    this.idle = window.setTimeout(() => { if (!this.cur) this.detach(); }, 1500);
  }
  /** 셰이더를 미리 굽는다(병렬 컴파일 확장이 있으면 화면을 멈추지 않는다) */
  compile(scene: Scene, cam: PerspectiveCamera) {
    return this.r.compileAsync(scene, cam).catch(() => {});
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    const x = this.cur; if (!x) return;
    this.quality(dt);
    x.update(dt, now / 1000);
    this.r.render(x.scene, x.cam);
  };

  /** 처음 1.5초 프레임 시간을 재서 느리면 가벼워진다 */
  private quality(dt: number) {
    if (this.lite || this.frames > 90) return;
    this.frames++;
    if (this.frames > 10 && dt > .026) this.slow++;
    if (this.frames === 90 && this.slow > 35) {
      this.lite = true; this.pr = 1; this.fit();
      this.cur?.lighten?.();
    }
  }
}

let gl: Gl | null = null;
/** 렌더러는 하나만 — 몇 번을 열든 같은 것을 다시 쓴다. WebGL 이 안 되면 null */
export function getGl() {
  if (!gl) gl = new Gl();
  return gl.ok ? gl : null;
}
