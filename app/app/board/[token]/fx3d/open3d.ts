/**
 * 개봉 화면 3D 층 — 손잡이로 밀면 표가 왼쪽부터 말려 올라가고, 안쪽 인쇄면(바닥)이 드러난다.
 *
 * 바닥에는 상품 사진을 깔지 않는다. 사진을 깔면 조금만 열어도 뭐가 나왔는지 다 보여서
 * 쪼는 맛이 없다(사장님 지적). 대신 "축 당첨" · 매장 · 번호만 인쇄하고, 등급 글자는
 * 잉크 없이 눌러 찍은 양각으로 오른쪽 끝에 숨긴다. 찢기는 선에서 새는 빛이 양각 가장자리를
 * 비스듬히 비춰서, 열수록 글자의 왼쪽 획부터 보인다 — 사선이면 A, 세로 기둥이면 B·D·E,
 * 곡선이면 C. 다 열면 글자에 박이 차오르고, 결과 화면에서 상품이 나온다.
 *
 * 글자 구간에 들어서면 숨을 죽인다 — 주변이 어두워지고(글자 층의 .vig) 카메라가 글자 쪽으로
 * 다가가고 표가 두근거린다. 빨리 밀면 찢기는 선에서 불꽃이 많이 튀고, 천천히 쪼면 잦아든다.
 *
 * 렌더러 · 색종이 · 빛줄기는 core.ts 에서 결과 화면과 같이 쓴다.
 */
import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  DoubleSide, DynamicDrawUsage, Group, LineBasicMaterial, LineSegments, Mesh, PerspectiveCamera, PlaneGeometry,
  Points, Scene, ShaderMaterial, SRGBColorSpace, type Texture, Vector2, Vector3,
} from 'three';
import {
  c01, Confetti, eIn, eOutBack, eOutCubic, FOV, getGl, type Gl, loadImg, makeBokeh, makeRays, rnd, type Runner,
  sstep, TIER, type TierDef, VS_UV,
} from './core';
import { letterAt, letterHeight, SLIP_W, slipCanvas, ticketCanvas, type SlipInfo, type TicketInfo } from './paint';
import type { Art } from '@/lib/boardArt';
import type { Tier } from '../grade';

/** 이만큼 열면 나머지는 저절로 열린다 — 글자는 87% 쯤에서 다 드러나고, 그 뒤는 빈 여백이다 */
export const OPEN_AT = 0.93;
/** 다 열린 뒤 등급을 보여 주는 시간(초) — 그다음 결과 화면 */
const HOLD = 1.9;
/**
 * 다 열리기 전의 빛줄기 · 빛 망울 색 — 모든 등급이 같다.
 * 등급마다 금 · 구리 · 은으로 물들이면 표를 열기도 전에 무엇이 나왔는지 다 보인다(사장님 지적).
 * 다 열리는 순간에야 등급 색으로 바뀐다
 */
const PLAIN_RAY = '#FFE2B8', PLAIN_BOKEH = '#FFE4C4';
/**
 * 천천히 열기 · 방치 시 자동 개봉 — 글자 앞까지는 빨리, 글자 구간은 멈칫거리며 아주 천천히, 끝은 한 번에.
 * [밀리초, 연 정도]
 */
const SQUEEZE: [number, number][] = [[0, 0], [900, .518], [2200, .616], [3400, .723], [3900, .73], [5000, .818], [5500, .823], [5850, 1]];

export type OpenFrame = {
  /** 손잡이 자리(찢기는 선의 가운데) — 글자 층 기준 CSS px */
  x: number; y: number;
  /** 등급 글자 자리 — 어둠(.vig)이 비켜 가는 곳 */
  lx: number; ly: number;
  /** 연 정도 0~1 */
  p: number;
  /** 숨죽임 0~1 — 글자 구간에 들어서면 오른다 */
  k: number;
  done: boolean;
};

export type OpenOpts = {
  /** 캔버스를 붙일 곳 — 카운터 화면 전체(.bd) */
  host: HTMLElement;
  /** 표가 앉을 자리 — 글자 층에 비워 둔 칸. 3D 가 이 칸을 재서 맞춰 앉는다 */
  slot: HTMLElement;
  /** 손잡이 · 어둠이 얹히는 글자 층 — 손잡이 좌표의 기준 */
  layer: HTMLElement;
  art: Art;
  ticket: TicketInfo;
  /** 밝은 판이면 빛줄기를 줄이고 빛 망울은 끈다 */
  dark: boolean;
  /** 매 프레임 — 손잡이 · 화살표 · 어둠을 3D 에 맞춰 옮긴다(리액트 상태를 거치지 않는다) */
  frame: (f: OpenFrame) => void;
  /** 다 열린 순간 — 소리 · 버튼 숨김 */
  finale: () => void;
  /** 등급을 보여 준 뒤 — 결과 화면으로 */
  done: () => void;
  /** WebGL 이 도중에 죽으면 — 글자 화면으로 */
  lost?: () => void;
};

/* ------------------------------------------------------------ 셰이더 */
/**
 * 표 — 찢기는 선(uC)보다 왼쪽은 반지름 uR 의 원통을 따라 말려 올라가고, uPhi 를 넘으면 곧게 선다.
 * 길이 단위는 화면 px. uK 는 데모(표 폭 560)에 맞춰 둔 거리들을 지금 표 폭에 맞추는 배율
 */
const TICKET_VS = `
  uniform float uC; uniform float uR; uniform float uPhi; uniform float uW; uniform float uK;
  varying vec2 vUv; varying vec3 vN; varying float vShade;
  void main(){
    vUv = uv;
    vec3 p = position;
    float xl = p.x + uW * 0.5;
    float d = uC - xl;
    vec3 n = vec3(0.0, 0.0, 1.0);
    if(d > 0.0){
      float ph = d / uR; float x; float z;
      if(ph <= uPhi){ x = uC - uR * sin(ph); z = uR * (1.0 - cos(ph)); n = vec3(sin(ph), 0.0, cos(ph)); }
      else {
        float e = d - uR * uPhi;
        x = uC - uR * sin(uPhi) - e * cos(uPhi); z = uR * (1.0 - cos(uPhi)) + e * sin(uPhi);
        n = vec3(sin(uPhi), 0.0, cos(uPhi));
      }
      p.x = x - uW * 0.5; p.z = z;
    }
    // 말려 올라간 쪽이 아직 붙은 쪽에 드리우는 그늘
    float s = clamp(uC / (30.0 * uK), 0.0, 1.0);
    vShade = d < 0.0 ? 1.0 - 0.42 * s * exp(d / (60.0 * uK)) : 1.0;
    vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const TICKET_FS = `
  uniform sampler2D map; uniform vec3 uBack; uniform vec3 uL; uniform float uOpacity;
  uniform float uC; uniform float uW; uniform float uK; uniform float uSeam; uniform float uTime;
  varying vec2 vUv; varying vec3 vN; varying float vShade;
  void main(){
    vec4 tc = texture2D(map, vUv);
    if(tc.a < 0.5) discard;
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    // 뒷면은 인쇄가 없는 종이 — 앞면 그림의 밝기만 살짝 비친다
    vec3 base = gl_FrontFacing ? tc.rgb : uBack * (0.82 + 0.18 * tc.r);
    vec3 L = normalize(uL);
    float diff = max(dot(n, L), 0.0);
    vec3 h = normalize(L + vec3(0.0, 0.0, 1.0));
    // 종이는 무광이다 — 넓게 번들거리면 평평한 면 전체에 흰빛이 얹혀 잉크가 회색으로 바랜다.
    // 좁게 잡아 말려 올라간 곡면에만 광택 한 줄이 서게 한다
    float spec = pow(max(dot(n, h), 0.0), 90.0) * 0.2;
    // 찢기는 선의 얇은 빛줄기 — 종이가 들리는 주름선에서 빛이 샌다.
    // 따로 빛 판을 깔면 판의 테두리 · 깊이 다툼이 드러나서(네모 빛 · 세로 줄무늬) 종이 그림 안에 그린다.
    // 가운데 한 줄은 뜨겁게 가늘고, 둘레는 옅게 번진다. 위아래 끝은 사그라지고, 통째로만 숨 쉰다
    float dd = uC - vUv.x * uW;
    float seam = (exp(-pow(dd / (3.5 * uK), 2.0)) * 1.4 + exp(-pow(dd / (16.0 * uK), 2.0)) * 0.22)
      * uSeam * (0.55 + 0.45 * sin(vUv.y * 3.14159)) * (0.9 + 0.1 * sin(uTime * 23.0));
    gl_FragColor = vec4(base * (0.38 + 0.8 * diff) * vShade + spec + vec3(1.0, 0.86, 0.6) * seam, uOpacity);
    #include <colorspace_fragment>
  }`;
/**
 * 바닥 — 표 안쪽 인쇄면. 등급 글자는 높이(hmap)로만 있다.
 * 찢기는 선에서 새는 빛(F)이 바로 옆 바닥을 비스듬히 비춰 양각 가장자리가 그 빛에 걸린다.
 * 새는 빛의 번짐(spill)도 여기서 바닥 위에만 그린다 — 따로 빛 판을 깔았더니 판의 네모 테두리가
 * 표 위아래로 드러났다. 바닥 그림 안에서 계산하면 바닥이 보이는 곳에만 빛이 생긴다.
 * 다 열리면(uFoil) 글자 자리가 등급 금속으로 차오르고 광택이 한 줄씩 훑는다
 */
const FLOOR_FS = `
  uniform sampler2D map; uniform sampler2D hmap; uniform vec2 uTex;
  uniform float uFold; uniform float uW; uniform float uH; uniform float uLeak; uniform float uFoil; uniform float uTime;
  uniform float uK; uniform vec3 uMetal; uniform vec3 uL;
  varying vec2 vUv;
  void main(){
    vec4 tc = texture2D(map, vUv);
    if(tc.a < 0.5) discard;
    vec3 base = tc.rgb;
    float h = texture2D(hmap, vUv).r;
    float hx = texture2D(hmap, vUv + vec2(uTex.x, 0.0)).r - texture2D(hmap, vUv - vec2(uTex.x, 0.0)).r;
    float hy = texture2D(hmap, vUv + vec2(0.0, uTex.y)).r - texture2D(hmap, vUv - vec2(0.0, uTex.y)).r;
    vec3 n = normalize(vec3(-hx * 4.0, -hy * 4.0, 1.0));
    float inside = smoothstep(0.3, 0.7, h);
    vec3 L = normalize(uL);
    float diff = max(dot(n, L), 0.0);
    vec3 P = vec3(vUv.x * uW, vUv.y * uH, 0.0);
    vec3 F = vec3(uFold + 22.0 * uK, uH * 0.5, 55.0 * uK);
    vec3 ld = F - P; float dist = length(ld); ld /= dist;
    float rim = max(dot(n, ld), 0.0) * exp(-dist / (150.0 * uK)) * uLeak;
    vec3 paper = base * mix(1.0, 0.8, inside * (1.0 - uFoil));
    float sweep = exp(-pow((vUv.x - (fract(uTime * 0.32) * 1.8 - 0.4)) * 7.0, 2.0));
    float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 20.0);
    vec3 foil = uMetal * (0.45 + 0.9 * spec + 0.7 * sweep);
    vec3 surf = mix(paper, foil, inside * uFoil);
    float d = uFold - P.x;
    float sh = d > 0.0 ? 1.0 - 0.5 * exp(-d / (55.0 * uK)) : 1.0;
    // 열린 쪽 바닥으로 번지는 새는 빛 — 가운데가 밝고 위아래로 사그라진다. 통째로만 숨 쉰다
    float breathe = (0.9 + 0.1 * sin(uTime * 23.0)) * (0.35 + 0.65 * sin(vUv.y * 3.14159));
    float spill = d > 0.0 ? exp(-d / (80.0 * uK)) * uLeak * 0.09 * breathe : 0.0;
    // 찢기는 선의 빛줄기 — 말린 종이(반지름 42)의 왼쪽 끝 바로 바깥 바닥에 가늘게.
    // 접는 선 바로 위는 말린 종이가 덮어 안 보인다. 종이와 바닥 사이 틈에서 새는 빛이 보이는 자리는 여기다
    // 가운데 줄은 말린 끝에서 17px 바깥, 폭 16px(그보다 안쪽은 종이 밑이라 가려진다). 둘레로 옅은 번짐.
    // 손을 멈춰도 또렷하게 — 세기에 바닥값(+0.45)을 얹는다. 밀 때는 거기서 더 밝아진다
    float gap = d - 42.0 * uK * 1.4;
    float li = uLeak > 0.0 ? uLeak + 0.45 : 0.0;
    float seam = (exp(-gap * gap / (256.0 * uK * uK)) * 0.6 + exp(-gap * gap / (1521.0 * uK * uK)) * 0.12)
      * li * breathe;
    gl_FragColor = vec4(surf * (0.45 + 0.65 * diff) * sh + vec3(1.0, 0.8, 0.5) * rim * (0.5 + 0.9 * inside)
      + vec3(1.0, 0.82, 0.55) * spill + vec3(1.0, 0.9, 0.7) * seam, 1.0);
    #include <colorspace_fragment>
  }`;
/* ------------------------------------------------------------ 불꽃 */
/** 찢기는 선에서 튀는 불티 — 갓 튄 것은 흰빛, 식으면서 노랑 → 주황 → 빨강. 꼬리(선)로 궤적을 남긴다 */
class Sparks {
  private i = 0;
  private p: Float32Array; private v: Float32Array; private life: Float32Array; private max: Float32Array;
  private pa: BufferAttribute; private ca: BufferAttribute; private la: BufferAttribute; private lc: BufferAttribute;
  u = { uScale: { value: 1 } };
  constructor(scene: Scene, private N: number) {
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3);
    this.life = new Float32Array(N); this.max = new Float32Array(N).fill(1);
    const gp = new BufferGeometry();
    this.pa = new BufferAttribute(new Float32Array(N * 3), 3).setUsage(DynamicDrawUsage);
    this.ca = new BufferAttribute(new Float32Array(N * 3), 3).setUsage(DynamicDrawUsage);
    gp.setAttribute('position', this.pa); gp.setAttribute('aCol', this.ca);
    const pts = new Points(gp, new ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: AdditiveBlending,
      vertexShader: `attribute vec3 aCol; uniform float uScale; varying vec3 vC;
        void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(26.0, 9.0 * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q);
          if(r > 1.0) discard; float k = 1.0 - r; gl_FragColor = vec4(vC * k * k * 1.8, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    const gl = new BufferGeometry();
    this.la = new BufferAttribute(new Float32Array(N * 6), 3).setUsage(DynamicDrawUsage);
    this.lc = new BufferAttribute(new Float32Array(N * 6), 3).setUsage(DynamicDrawUsage);
    gl.setAttribute('position', this.la); gl.setAttribute('color', this.lc);
    const lines = new LineSegments(gl, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    pts.frustumCulled = false; lines.frustumCulled = false;
    scene.add(pts, lines);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    const i = this.i++ % this.N, j = i * 3;
    this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z;
    this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz;
    this.life[i] = this.max[i] = life;
  }
  clear() { this.life.fill(0); this.update(0, 1); }
  update(dt: number, s: number) {
    const P = this.pa.array as Float32Array, C = this.ca.array as Float32Array;
    const L = this.la.array as Float32Array, LC = this.lc.array as Float32Array;
    for (let i = 0; i < this.N; i++) {
      const j = i * 3, l = i * 6;
      if (this.life[i] <= 0) { C[j] = C[j + 1] = C[j + 2] = 0; LC.fill(0, l, l + 6); continue; }
      this.life[i] -= dt;
      this.v[j + 1] -= 1000 * s * dt;
      const d = Math.exp(-0.9 * dt); this.v[j] *= d; this.v[j + 1] *= d; this.v[j + 2] *= d;
      this.p[j] += this.v[j] * dt; this.p[j + 1] += this.v[j + 1] * dt; this.p[j + 2] += this.v[j + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const r = 1.6 * k, g = (0.45 + 0.55 * k) * 1.4 * k, b = (0.08 + 0.9 * k * k) * 1.2 * k;
      P[j] = this.p[j]; P[j + 1] = this.p[j + 1]; P[j + 2] = this.p[j + 2];
      C[j] = r; C[j + 1] = g; C[j + 2] = b;
      L[l] = this.p[j]; L[l + 1] = this.p[j + 1]; L[l + 2] = this.p[j + 2];
      L[l + 3] = this.p[j] - this.v[j] * .034; L[l + 4] = this.p[j + 1] - this.v[j + 1] * .034; L[l + 5] = this.p[j + 2] - this.v[j + 2] * .034;
      LC[l] = r; LC[l + 1] = g; LC[l + 2] = b; LC[l + 3] = r * .12; LC[l + 4] = g * .12; LC[l + 5] = b * .12;
    }
    this.pa.needsUpdate = this.ca.needsUpdate = this.la.needsUpdate = this.lc.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ 무대 */
class OpenScene implements Runner {
  scene = new Scene();
  cam = new PerspectiveCamera(FOV, 800 / 1280, 10, 20000);
  private rays = makeRays();
  private bok = makeBokeh(80);
  private conf: Confetti;
  private sparks: Sparks;
  private group = new Group();
  private ticket: Mesh; private floor: Mesh;
  private ph: CanvasTexture;
  private tickU = {
    map: { value: null as Texture | null }, uC: { value: 0 }, uR: { value: 42 }, uPhi: { value: 2.15 }, uW: { value: 560 }, uK: { value: 1 },
    uBack: { value: new Color('#CDBB98') }, uL: { value: new Vector3(-.35, .55, .75).normalize() }, uOpacity: { value: 1 },
    uSeam: { value: 0 }, uTime: { value: 0 },
  };
  private floorU = {
    map: { value: null as Texture | null }, hmap: { value: null as Texture | null }, uTex: { value: new Vector2(.002, .004) },
    uFold: { value: 0 }, uW: { value: 560 }, uH: { value: 298 }, uLeak: { value: 0 }, uFoil: { value: 0 }, uTime: { value: 0 },
    uK: { value: 1 }, uMetal: { value: new Color('#D9B45C') }, uL: { value: new Vector3(-.45, .5, .75).normalize() },
  };
  private tex: Texture[] = [];
  private floorTex: Texture[] = [];
  private warming: Promise<unknown> | null = null;
  private opts: OpenOpts | null = null;
  private T: TierDef = TIER.A;
  private token = 0;
  private live = false;
  /** 바닥(결과)이 준비됐다 — 그전에는 손잡이를 못 민다 */
  ready = false;
  private TW = 0; private TH = 0; private s = 1; private ratio = 2;
  private at = new Vector3();
  private off = { x: 0, y: 0 };
  /** 연 정도(0~1) — c 는 지금, target 은 가려는 곳 */
  private c = 0; private target = 0;
  private speed = 0; private acc = 0; private tension = 0; private hb = 0;
  private done = false; private ft = 0; private sent = false; private locked = false;
  private t0 = 0; private zoom = 1; private look = new Vector3(); private shake = 0; private punch = 0;
  private auto: { k: [number, number][]; t0: number; first: boolean } | null = null;
  private letterL = new Vector3(); private letterW = new Vector3(); private v = new Vector3();
  private rayK = 1; private bokK = 1;
  private plainRay = new Color(PLAIN_RAY); private plainBok = new Color(PLAIN_BOKEH);
  private tierRay = new Color(PLAIN_RAY); private tierBok = new Color(PLAIN_BOKEH);
  private reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private gl: Gl) {
    this.scene.environment = gl.env;
    this.scene.add(this.rays.mesh, this.bok.pts);
    // 조명은 색종이만 받는다(표와 바닥은 셰이더가 직접 빛을 계산한다)
    this.scene.add(new AmbientLight(0xffffff, .7));
    const dl = new DirectionalLight(0xfff0dc, 2.7); dl.position.set(-400, 600, 900); this.scene.add(dl);

    const dot = document.createElement('canvas'); dot.width = dot.height = 1;
    this.ph = new CanvasTexture(dot);
    this.tickU.map.value = this.ph; this.floorU.map.value = this.ph; this.floorU.hmap.value = this.ph;

    this.ticket = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
      uniforms: this.tickU, vertexShader: TICKET_VS, fragmentShader: TICKET_FS, side: DoubleSide, transparent: true,
    }));
    this.ticket.renderOrder = 2;
    /*
     * 바닥과 표는 깊이가 아니라 그리는 순서로 가린다(바닥 → 표).
     * 둘은 3px 차이로 겹쳐 있는데, 깊이 버퍼가 16비트인 기기(소프트웨어 렌더 · 일부 태블릿)에서는
     * 그 차이를 못 가려 픽셀마다 앞뒤가 뒤집힌다 — 표 위에 흰 세로 줄무늬가 생기던 원인.
     * 바닥은 깊이를 남기지 않는다. 새는 빛은 바닥 셰이더 안에서 그린다(FLOOR_FS 의 spill)
     */
    this.floor = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
      uniforms: this.floorU, vertexShader: VS_UV, fragmentShader: FLOOR_FS, transparent: true, depthWrite: false,
    }));
    this.floor.renderOrder = 1;
    this.group.add(this.floor, this.ticket);
    this.group.visible = false;
    this.scene.add(this.group);

    this.sparks = new Sparks(this.scene, 700);
    this.conf = new Confetti(this.scene, 560);
  }

  /** 셰이더를 미리 굽는다 — 상품 목록 · 티켓 고르기 동안 불러 둔다 */
  warm() {
    if (!this.warming) this.warming = this.gl.compile(this.scene, this.cam);
    return this.warming;
  }

  /** 개봉 화면이 열릴 때 — 표 겉면을 그려 얹고 돌기 시작한다. 바닥은 결과가 오면 setResult 로 */
  async play(o: OpenOpts) {
    if (!this.gl.ok) throw new Error('webgl');
    const my = ++this.token;
    this.gl.halt(this); this.release();
    this.opts = o;
    this.ratio = o.art.photo?.ratio ?? 2;
    this.TW = 0;
    this.gl.attach(o.host);

    const a = o.art;
    const [photo, band, ros] = await Promise.all([
      a.photo ? loadImg(a.photo.src) : null,
      a.band && a.bandSrc ? loadImg(a.bandSrc) : null,
      a.ros && a.rosSrc ? loadImg(a.rosSrc) : null,
    ]);
    if (my !== this.token) return;
    const tt = new CanvasTexture(ticketCanvas(a, o.ticket, { photo, band, ros }));
    tt.colorSpace = SRGBColorSpace; tt.anisotropy = 8;
    this.tex = [tt];
    this.tickU.map.value = tt;
    // 말려 올라간 뒷면 — 사진 판은 크라프트지, 그 밖은 종이색 그대로
    this.tickU.uBack.value.set(a.photo ? '#CDBB98' : a.pap);

    this.c = 0; this.target = 0; this.speed = 0; this.acc = 0; this.tension = 0; this.hb = 0;
    this.done = false; this.ft = 0; this.sent = false; this.locked = false; this.auto = null; this.ready = false;
    this.zoom = 1; this.look.set(0, 0, 0); this.shake = 0; this.punch = 0;
    this.ticket.position.set(0, 0, 0); this.ticket.rotation.set(0, 0, 0); this.tickU.uOpacity.value = 1;
    this.floor.position.set(0, 0, -3); this.floor.scale.setScalar(1); this.floorU.uFoil.value = 0;
    this.group.rotation.set(0, 0, 0); this.group.scale.setScalar(1);
    this.rays.u.uAmp.value = 0; this.bok.u.uAmp.value = 0;
    this.rays.u.uCol.value.set(PLAIN_RAY); this.bok.u.uCol.value.set(PLAIN_BOKEH);
    this.rayK = o.dark ? 1 : .45; this.bokK = o.dark ? 1 : 0;
    this.scene.environment = o.dark ? this.gl.env : this.gl.envLight;
    this.sparks.clear(); this.conf.parkAll();

    this.gl.r.initTexture(tt);
    await this.warm();
    if (my !== this.token) return;
    this.group.visible = true;
    this.live = true;
    this.t0 = performance.now() / 1000;
    this.gl.run(this);
  }

  /** 결과가 왔다 — 바닥에 등급 쪽지를 깔고 등급 글자를 양각으로 숨긴다 */
  setResult(grade: string, tier: Tier, slip: SlipInfo) {
    if (!this.opts) return;
    this.T = TIER[tier];
    const map = new CanvasTexture(slipCanvas(grade, slip, false, this.ratio));
    map.colorSpace = SRGBColorSpace; map.anisotropy = 8;
    const hc = letterHeight(grade, this.ratio);
    const hmap = new CanvasTexture(hc);
    this.floorTex.forEach((t) => t.dispose());
    this.floorTex = [map, hmap];
    this.floorU.map.value = map; this.floorU.hmap.value = hmap;
    this.floorU.uTex.value.set(2.2 / hc.width, 2.2 / hc.height);
    this.floorU.uMetal.value.set(this.T.metal);
    // 빛 색은 여기서 바꾸지 않는다 — 다 열리기 전에 등급이 새지 않게(fin 에서 바꾼다)
    this.conf.setTier(this.T);
    // 글자 가운데 — 쪽지 위의 비율로 들고 있다가 표 크기가 정해지면 좌표로 바꾼다
    const H = Math.round(SLIP_W / this.ratio), L = letterAt(H);
    this.letterL.set(L.x / SLIP_W, 1 - L.y / H, 0);
    this.gl.r.initTexture(map); this.gl.r.initTexture(hmap);
    this.ready = true;
  }

  /** 지금 연 정도(0~1) — 손잡이를 다시 잡을 때 여기서부터 잇는다 */
  get progress() { return this.c; }

  /** 손으로 민다 — 연 정도(0~1). OPEN_AT 을 넘으면 나머지는 저절로 열린다 */
  setTarget(p: number) {
    if (!this.live || !this.ready || this.locked || this.done) return;
    this.target = c01(p);
  }

  /** 버튼 · 방치 — slow 면 쪼듯이 천천히, 아니면 단숨에 */
  autoOpen(slow: boolean) {
    if (!this.live || !this.ready || this.done) return;
    this.locked = true;
    const cur = this.c;
    if (!slow) { this.auto = { k: [[0, cur], [Math.max(250, 550 * (1 - cur)), 1]], t0: performance.now() / 1000, first: true }; return; }
    let j = SQUEEZE.findIndex(([, v]) => v > cur + .004);
    if (j < 1) j = 1;
    this.auto = { k: [[SQUEEZE[j - 1][0], cur] as [number, number]].concat(SQUEEZE.slice(j)),
      t0: performance.now() / 1000, first: j === 1 };
  }
  private autoAt(t: number) {
    const a = this.auto!, K = a.k, last = K.length - 1;
    const e = (t - a.t0) * 1000 + K[0][0];
    let i = 0;
    while (i < last - 1 && e > K[i + 1][0]) i++;
    const [ta, va] = K[i], [tb, vb] = K[i + 1];
    let k = c01((e - ta) / (tb - ta));
    k = i === 0 && a.first ? eOutCubic(k) : i === last - 1 ? k * k * k : k;
    return va + (vb - va) * k;
  }

  /**
   * 개봉 화면을 떠날 때 — 이번 판 그림을 돌려준다. 렌더러와 재질은 남긴다.
   * 다 열고 떠나면 결과 화면이 곧 같은 캔버스를 이어받으므로 캔버스는 붙여 둔다(빈 판이 번쩍이지 않게)
   */
  stop() {
    this.token++;
    this.gl.release(this, this.done);
    this.release();
    this.opts = null;
  }
  private release() {
    this.live = false; this.ready = false;
    this.group.visible = false;
    this.tickU.map.value = this.ph; this.floorU.map.value = this.ph; this.floorU.hmap.value = this.ph;
    this.tex.forEach((t) => t.dispose()); this.tex = [];
    this.floorTex.forEach((t) => t.dispose()); this.floorTex = [];
    this.sparks.clear(); this.conf.parkAll();
  }

  resize() {
    const g = this.gl;
    g.fitCam(this.cam);
    const big = Math.max(g.W, g.H) * 3;
    this.rays.mesh.scale.set(big, big, 1);
    this.bok.u.uBox.value.set(g.W * .95, g.H * .7, 1300);
    this.conf.W = g.W; this.conf.H = g.H; this.conf.D = g.D;
    this.measure();
  }
  lighten() { this.conf.rainTarget = Math.round(this.conf.rainTarget * .6); }
  lost() { this.live = false; this.opts?.lost?.(); }

  /** 글자 층에 비워 둔 표 자리를 재서 3D 좌표로 옮긴다. 표 폭이 바뀌면 판을 다시 짠다 */
  private measure() {
    const o = this.opts; if (!o) return;
    const c = this.gl.canvas.getBoundingClientRect();
    const b = o.slot.getBoundingClientRect();
    const l = o.layer.getBoundingClientRect();
    this.at.set(b.left + b.width / 2 - c.left - c.width / 2, c.top + c.height / 2 - (b.top + b.height / 2), 0);
    this.off.x = c.left - l.left; this.off.y = c.top - l.top;
    const TW = Math.round(b.width);
    if (TW > 40 && Math.abs(TW - this.TW) > 1) this.size(TW);
    this.group.position.copy(this.at);
    this.rays.mesh.position.set(this.at.x, this.at.y, -480);
  }
  private size(TW: number) {
    this.TW = TW; this.TH = TW / this.ratio; this.s = TW / 560;
    const s = this.s, TH = this.TH;
    const swap = (m: Mesh, g: BufferGeometry) => { m.geometry.dispose(); m.geometry = g; };
    swap(this.ticket, new PlaneGeometry(TW, TH, 180, 2));
    // 바닥은 표보다 살짝 작게 — 사진 원판의 들쭉날쭉한 가장자리 밖으로 비어져 나오지 않게
    swap(this.floor, new PlaneGeometry(TW * .985, TH * .985));
    this.tickU.uW.value = TW; this.tickU.uR.value = 42 * s; this.tickU.uK.value = s;
    this.floorU.uW.value = TW * .985; this.floorU.uH.value = TH * .985; this.floorU.uK.value = s;
  }

  update(dt: number, t: number) {
    const o = this.opts;
    if (!this.live || !o || !this.TW) return;
    const T = this.T, TW = this.TW, TH = this.TH, s = this.s;
    const lt = t - this.t0;
    // 처음 몇 초는 글자 층이 자리 잡는 중일 수 있다(글꼴) — 자리를 계속 다시 잰다
    if (lt < 2.5) this.measure();
    this.rays.u.uTime.value = t; this.bok.u.uTime.value = t; this.bok.u.uScale.value = this.gl.uScale;
    this.floorU.uTime.value = t; this.sparks.u.uScale.value = this.gl.uScale;

    // 손 · 자동 열기 — 넘을 선을 넘으면 나머지는 저절로
    if (this.auto) this.target = this.autoAt(t);
    if (!this.done && this.target >= OPEN_AT) { this.locked = true; if (!this.auto) this.target = 1; }
    const prev = this.c;
    this.c += (this.target - this.c) * Math.min(1, dt * 16);
    if (Math.abs(this.target - this.c) < .0005) this.c = this.target;
    const sp = dt > 0 ? Math.abs(this.c - prev) * TW / dt : 0;
    this.speed += (sp - this.speed) * Math.min(1, dt * 8);
    const p = this.c, cx = p * TW;
    // 바닥은 표보다 0.75% 안쪽에서 시작한다 — 접히는 자리를 바닥 좌표로 옮긴다
    this.tickU.uC.value = cx; this.floorU.uFold.value = cx - TW * .0075;

    // 글자 구간에 들어서면 숨을 죽인다
    this.tension += ((this.done ? 0 : sstep(.42, .86, p)) - this.tension) * Math.min(1, dt * 5);
    const k = this.tension;

    if (!this.done) {
      // 들어올 때 — 판에서 뽑혀 나온 표가 탁자에 눕는다
      const ki = eOutCubic(c01(lt / .6));
      // 두근거림 — 글자에 가까울수록 빨라진다
      this.hb += dt * (1 + 1.9 * k);
      const ph = this.hb % 1;
      const beat = Math.exp(-Math.pow((ph - .1) * 22, 2)) + .55 * Math.exp(-Math.pow((ph - .28) * 22, 2));
      this.group.rotation.x = -.24 * ki;
      this.group.scale.setScalar((.88 + .12 * ki) * (1 + (this.reduce ? 0 : .016) * k * beat));
    } else {
      this.ft += dt;
      const k1 = c01(this.ft / .7);
      this.ticket.position.set(420 * s * eIn(k1), 140 * s * k1, 760 * s * eIn(k1));
      this.ticket.rotation.z = -.4 * k1;
      this.tickU.uOpacity.value = 1 - k1;
      // 다 열리면 글자가 등급 금속으로 차오르고 쪽지가 앞으로 나온다
      const k2 = c01((this.ft - .05) / .85);
      this.floor.position.z = -3 + 90 * s * eOutBack(k2);
      this.floor.scale.setScalar(1 + .08 * eOutBack(k2));
      this.floorU.uFoil.value = eOutCubic(c01((this.ft - .1) / .55));
      this.group.rotation.x = -.24 * (1 - eOutCubic(k2)) + (k2 >= 1 ? Math.sin(this.ft * .9) * .035 : 0);
      this.group.scale.setScalar(1);
      this.floor.position.y = k2 >= 1 ? Math.sin(this.ft * 1.3) * 5 : 0;
      this.rays.u.uAmp.value = T.rayAmp * eOutCubic(k2) * this.rayK;
      this.bok.u.uAmp.value = .6 * eOutCubic(k2) * this.bokK;
      const kc = c01(this.ft / .35);
      this.rays.u.uCol.value.copy(this.plainRay).lerp(this.tierRay, kc);
      this.bok.u.uCol.value.copy(this.plainBok).lerp(this.tierBok, kc);
      if (!this.sent && this.ft >= HOLD) { this.sent = true; o.done(); }
    }
    this.group.updateMatrixWorld(true);
    this.letterW.set((this.letterL.x - .5) * TW, (this.letterL.y - .5) * TH, 0);
    this.group.localToWorld(this.letterW);
    this.zoom = 1 + .2 * k;
    this.look.set(this.letterW.x * .8 * k, this.letterW.y * .8 * k, 0);

    const live = cx > 2 && cx < TW - 2 && !this.done;
    this.floorU.uLeak.value = live ? .7 + Math.min(1, this.speed / (500 * s)) + 1.1 * k : 0;
    // 빨리 밀수록, 글자 구간일수록 빛줄기가 밝아진다
    this.tickU.uSeam.value = live ? .5 + Math.min(1.1, this.speed / (600 * s)) + .5 * k : 0;
    this.tickU.uTime.value = t;
    if (!this.done) {
      this.rays.u.uAmp.value = (.08 + p * .3) * (1 - .85 * k) * this.rayK;
      this.bok.u.uAmp.value = (.35 + p * .3) * (1 - .7 * k) * this.bokK;
    }

    // 찢기는 선에서 불꽃 — 빨리 밀수록 많이 튀고, 천천히 쪼면 잦아든다
    if (live) {
      this.acc += dt * (22 + Math.min(700, this.speed * 1.1 / s)) * (this.gl.lite ? .6 : 1) * (this.reduce ? .4 : 1);
      while (this.acc >= 1) {
        this.acc -= 1;
        this.v.set(cx - TW / 2, rnd(-TH / 2, TH / 2), 4); this.group.localToWorld(this.v);
        const f = (.6 + Math.min(1.2, this.speed / (500 * s))) * s;
        this.sparks.emit(this.v.x, this.v.y, this.v.z, rnd(-520, 60) * f, rnd(-120, 600) * f, rnd(120, 520) * f, rnd(.3, .85));
      }
    }
    this.sparks.update(dt, s);
    this.conf.update(dt, t);
    if (!this.done && this.target >= .999 && this.c >= .995) this.fin();

    // 카메라 — 숨 쉬듯 흔들리고, 글자 구간에서는 글자 쪽으로 다가간다
    const cp = this.cam.position;
    cp.set(this.look.x + Math.sin(t * .31) * 24, this.look.y + Math.sin(t * .23) * 16, this.gl.D * (1 + this.punch * .08) / this.zoom);
    if (this.shake > 0) {
      cp.x += (Math.random() - .5) * 34 * this.shake; cp.y += (Math.random() - .5) * 34 * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    this.punch = Math.max(0, this.punch - dt * 1.7);
    this.cam.lookAt(this.look);
    this.cam.updateMatrixWorld();

    // 글자 층 — 손잡이는 찢기는 선을 따라가고, 어둠은 글자를 비켜 간다
    const g = this.gl;
    this.v.set(cx - TW / 2, 0, 1); this.group.localToWorld(this.v); this.v.project(this.cam);
    const x = (this.v.x * .5 + .5) * g.W + this.off.x, y = (-this.v.y * .5 + .5) * g.H + this.off.y;
    this.v.copy(this.letterW).project(this.cam);
    const lx = (this.v.x * .5 + .5) * g.W + this.off.x, ly = (-this.v.y * .5 + .5) * g.H + this.off.y;
    o.frame({ x, y, lx, ly, p, k, done: this.done });
  }

  /** 다 열렸다 — 표가 날아가고, 글자에 박이 차오르고, 불꽃과 색종이가 터진다 */
  private fin() {
    this.done = true; this.ft = 0; this.auto = null;
    const T = this.T, o = this.letterW, s = this.s;
    this.tierRay.set(T.ray); this.tierBok.set(T.bokeh);
    this.shake = this.reduce ? 0 : Math.max(.35, T.shake); this.punch = .6;
    const n = Math.round(260 * (this.gl.lite ? .6 : 1) * (this.reduce ? .4 : 1));
    for (let i = 0; i < n; i++) {
      const th = rnd(0, Math.PI * 2), sp = rnd(400, 1400) * s;
      this.sparks.emit(o.x + rnd(-120, 120) * s, o.y + rnd(-110, 110) * s, o.z + 20,
        Math.cos(th) * sp * .9, Math.sin(th) * sp * .9 + 250 * s, rnd(100, 600), rnd(.4, 1.1));
    }
    // 쪽지 뒤에서 고리로 터뜨린다 — 박이 차오르는 글자를 덮지 않고 둘레로 쏟아진다
    this.conf.burst(new Vector3(o.x, o.y, o.z - 40), T.burst, T.power, this.TH * 1.1);
    this.conf.startRain(Math.round(T.rain * (this.gl.lite ? .6 : 1) * (this.reduce ? .5 : 1)));
    this.opts?.finale();
  }
}

let open: OpenScene | null = null;
/** 개봉 장면은 하나만. WebGL 이 안 되면 null */
export function getOpen() {
  const gl = getGl();
  if (!gl) return null;
  if (!open) open = new OpenScene(gl);
  return open;
}
export type { OpenScene };
