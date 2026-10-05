/**
 * 결과 화면 3D 층 — 등급 쪽지가 날아와 뒤집히며 상품이 되고, 금속 색종이가 내린다.
 *
 * 왜 3D 인가: 평면 색종이 · 평면 버튼은 "그림"으로 읽힌다. 색종이 한 장 한 장이
 * 실제로 돌면서 빛을 받아 번쩍여야 손님이 "터졌다"고 느낀다. 그건 빛을 계산해야 나온다.
 *
 * 렌더러 · 색종이 · 빛줄기는 core.ts 에서 개봉 화면과 같이 쓴다. 지키는 것도 거기 적었다.
 */
import {
  AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene,
  SRGBColorSpace, type Texture, Vector3,
} from 'three';
import {
  c01, Confetti, eOutBack, eOutCubic, FOV, getGl, type Gl, loadImg, makeBokeh, makeRays, type Runner, TIER,
  type TierDef,
} from './core';
import { cardBackCanvas, coinCanvas, printCanvas, shadowCanvas, type SlipInfo } from './paint';
import type { Tier } from '../grade';

export { preload } from './core';

export type PlayOpts = {
  /** 캔버스를 붙일 곳 — 카운터 화면 전체(.bd) */
  host: HTMLElement;
  /** 카드와 메달이 앉을 자리. 글자 층에서 자리를 비워 두고, 그 위치를 재서 3D 를 맞춘다 */
  cardSlot: HTMLElement;
  coinSlot: HTMLElement;
  grade: string;
  tier: Tier;
  /** 카드 앞면 사진 (상품 또는 피날레 보너스). 없으면 등급 글자를 크게 찍는다 */
  front: string | null;
  /** 그림(할인권 SVG)이면 자르지 않는다 */
  flat: boolean;
  slip: SlipInfo;
  /** 밝은 판이면 빛줄기를 줄이고 빛 망울은 끈다 — 밝은 바탕에 더한 빛은 바래 보인다 */
  dark: boolean;
  /** WebGL 이 도중에 죽으면 부른다 — 글자 화면으로 내려간다 */
  onLost?: () => void;
};

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

class Stage implements Runner {
  scene = new Scene();
  cam = new PerspectiveCamera(FOV, 800 / 1280, 10, 20000);
  private rays = makeRays();
  private rays2 = makeRays();
  private bok = makeBokeh(100);
  private conf: Confetti;
  /** 앞면을 훑는 광택 — 대각선 한 줄이 지나간다(위치 · 세기) */
  private sheen = { uSheen: { value: -1 }, uSheenA: { value: 0 } };
  private kit: Kit;
  private tex: Texture[] = [];
  private live = false;
  private warming: Promise<unknown> | null = null;
  private opts: PlayOpts | null = null;
  private T: TierDef = TIER.A;
  private t0 = 0; private token = 0;
  private cardAt = new Vector3(); private coinAt = new Vector3(); private cardSize = 440; private coinK = 1;
  private revealed = false; private shake = 0; private punch = 0;
  private rayK = 1; private bokK = 1;
  private reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private gl: Gl) {
    this.scene.environment = gl.env;
    this.rays2.u.uSpin.value = -1.3; this.rays2.u.uN.value = 6;
    this.scene.add(this.rays.mesh, this.rays2.mesh, this.bok.pts);
    // 조명 — 물리 단위라 예전 값에 π 를 곱한 크기다
    this.scene.add(new AmbientLight(0xffffff, .7));
    const dl = new DirectionalLight(0xfff0dc, 2.7); dl.position.set(-400, 600, 900); this.scene.add(dl);
    this.conf = new Confetti(this.scene, 680);
    this.kit = this.makeKit();
  }

  private makeKit(): Kit {
    const dot = document.createElement('canvas'); dot.width = dot.height = 1;
    const ph = new CanvasTexture(dot); ph.colorSpace = SRGBColorSpace;
    const edge = new MeshStandardMaterial({ color: 0xd9b45c, metalness: 1, roughness: .22, envMapIntensity: 1.4 });
    const fm = new MeshStandardMaterial({ map: ph, emissiveMap: ph, emissive: 0xffffff, emissiveIntensity: .5,
      roughness: .4, metalness: 0, envMapIntensity: .3 });
    /*
     * 앞면 광택 — 예전엔 점광원을 카드 앞으로 지나가게 했는데, 무광 인화지에서 넓고 뿌연 흰 얼룩이 됐다.
     * 사진 위에 대각선으로 가는 빛 한 줄만 얹는다(광택지가 빛을 받아 반짝 하는 정도)
     */
    fm.onBeforeCompile = (sh) => {
      sh.uniforms.uSheen = this.sheen.uSheen; sh.uniforms.uSheenA = this.sheen.uSheenA;
      sh.fragmentShader = 'uniform float uSheen; uniform float uSheenA;\n' + sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        #ifdef USE_MAP
          float sx = vMapUv.x + (1.0 - vMapUv.y) * 0.45;
          gl_FragColor.rgb += vec3(1.0, 0.96, 0.88) * exp(-pow((sx - uSheen) * 9.0, 2.0)) * uSheenA;
        #endif`);
    };
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
    const shMat = new MeshBasicMaterial({ map: new CanvasTexture(shadowCanvas()), transparent: true, depthWrite: false, opacity: .7 });
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
    if (!this.warming) this.warming = this.gl.compile(this.scene, this.cam);
    return this.warming;
  }

  /** 결과 화면이 열릴 때 */
  async play(o: PlayOpts) {
    if (!this.gl.ok) throw new Error('webgl');
    const my = ++this.token;
    this.gl.halt(this); this.release();
    this.opts = o; this.T = TIER[o.tier];
    this.gl.attach(o.host);

    const img = o.front ? await loadImg(o.front) : null;
    if (my !== this.token) return;
    const front = new CanvasTexture(printCanvas(img, o.flat, o.grade));
    const back = new CanvasTexture(cardBackCanvas(o.grade, o.slip, o.dark));
    const face = new CanvasTexture(coinCanvas(o.grade));
    for (const t of [front, back, face]) { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; }
    this.tex = [front, back, face];

    const K = this.kit, T = this.T, metal = new Color(T.metal);
    K.fm.map = front; K.fm.emissiveMap = front; K.bm.map = back;
    K.cm.map = face; K.cm.bumpMap = face;
    for (const m of [K.edge, K.cm, K.side]) m.color.copy(metal);
    K.coin.scale.setScalar(.001);

    this.rays.u.uCol.value.set(T.ray); this.rays2.u.uCol.value.set(T.ray2);
    this.rays.u.uAmp.value = 0; this.rays2.u.uAmp.value = 0;
    this.bok.u.uCol.value.set(T.bokeh); this.bok.u.uAmp.value = 0;
    // 밝은 판에 더한 빛은 바래 보인다 — 빛줄기는 줄이고 빛 망울은 끈다. 금속은 밝은 주변을 비춘다
    this.rayK = o.dark ? 1 : .45; this.bokK = o.dark ? 1 : 0;
    this.scene.environment = o.dark ? this.gl.env : this.gl.envLight;
    this.sheen.uSheenA.value = 0;
    this.conf.setTier(T);

    // 첫 프레임에서 그림을 올리느라 끊기지 않게 미리 올려 둔다. 셰이더는 보통 이미 구워져 있다
    for (const t of this.tex) this.gl.r.initTexture(t);
    await this.warm();
    if (my !== this.token) return;

    for (const x of [K.card, K.coin, K.shadow]) x.visible = true;
    this.live = true;
    this.revealed = false; this.shake = 0; this.punch = 0;
    this.t0 = performance.now() / 1000;
    this.gl.run(this);
  }

  /** 결과 화면을 떠날 때 — 캔버스를 떼고 이번 판 그림을 돌려준다. 렌더러와 재질은 남긴다 */
  stop() {
    this.token++;
    this.gl.release(this);
    this.release();
    this.opts = null;
  }

  private release() {
    this.live = false;
    const K = this.kit;
    for (const x of [K.card, K.coin, K.shadow]) x.visible = false;
    K.fm.map = K.ph; K.fm.emissiveMap = K.ph; K.bm.map = K.ph; K.cm.map = K.ph; K.cm.bumpMap = K.ph;
    this.tex.forEach((t) => t.dispose()); this.tex = [];
    this.conf.parkAll();
  }

  resize() {
    const g = this.gl;
    g.fitCam(this.cam);
    const big = Math.max(g.W, g.H) * 3;
    this.rays.mesh.scale.set(big, big, 1); this.rays2.mesh.scale.set(big, big, 1);
    this.bok.u.uBox.value.set(g.W * .95, g.H * .7, 1300);
    this.conf.W = g.W; this.conf.H = g.H; this.conf.D = g.D;
    this.measure();
  }
  lighten() { this.conf.rainTarget = Math.round(this.conf.rainTarget * .6); }
  lost() { this.live = false; this.opts?.onLost?.(); }

  /** 글자 층에 비워 둔 자리를 재서 3D 좌표로 옮긴다 */
  private measure() {
    const o = this.opts; if (!o) return;
    const c = this.gl.canvas.getBoundingClientRect();
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

  update(dt: number, t: number) {
    if (!this.live) return;
    const K = this.kit, T = this.T;
    const lt = t - this.t0;
    // 처음 몇 초는 글자 층이 자리 잡는 중일 수 있다(글꼴 · QR) — 자리를 계속 다시 잰다
    if (lt < 2.5) this.measure();
    this.rays.u.uTime.value = t; this.rays2.u.uTime.value = t;
    this.bok.u.uTime.value = t; this.bok.u.uScale.value = this.gl.uScale;
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
      // 카드 뒤 테두리 안쪽에서 고리로 터뜨린다 — 뒤집혀 나온 상품을 덮지 않고 둘레로 쏟아진다
      this.conf.burst(new Vector3(this.cardAt.x, this.cardAt.y, -30), T.burst, T.power, this.cardSize);
      this.conf.startRain(Math.round(T.rain * (this.reduce ? .5 : 1) * (this.gl.lite ? .6 : 1)));
    }

    // 등급 메달 — 튀어나와 계속 돈다
    const kc = c01((lt - 1.3) / .55);
    K.coin.scale.setScalar(Math.max(.001, eOutBack(kc)) * this.coinK);
    K.coin.rotation.y += dt * 2.5;
    K.coin.position.set(this.coinAt.x, this.coinAt.y + Math.sin(lt * 2) * 3, 0);

    // 앞면을 훑고 지나가는 광택 한 줄 — 3.2초마다
    const cyc = (lt - 1.4) % 3.2;
    if (lt > 1.4 && cyc < 1.15) {
      this.sheen.uSheen.value = -0.5 + 2.4 * (cyc / 1.15);
      this.sheen.uSheenA.value = 0.11 * T.glint;
    } else this.sheen.uSheenA.value = 0;

    // 카메라 — 천천히 숨 쉬듯 흔들리고, 터질 때 한 번 다가왔다 물러난다
    const p = this.cam.position;
    p.set(Math.sin(t * .31) * 24, Math.sin(t * .23) * 16, this.gl.D * (1 + this.punch * .08));
    if (this.shake > 0) {
      p.x += (Math.random() - .5) * 34 * this.shake; p.y += (Math.random() - .5) * 34 * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    this.punch = Math.max(0, this.punch - dt * 1.7);
    this.cam.lookAt(0, 0, 0);
  }
}

let stage: Stage | null = null;
/** 결과 장면은 하나만 — 몇 번을 열든 같은 것을 다시 쓴다. WebGL 이 안 되면 null */
export function getStage() {
  const gl = getGl();
  if (!gl) return null;
  if (!stage) stage = new Stage(gl);
  return stage;
}
export type { Stage };
