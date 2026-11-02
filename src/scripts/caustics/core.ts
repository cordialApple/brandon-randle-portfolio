import * as THREE from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  FloatVertexAttributeTexture,
  SAH,
} from "three-mesh-bvh";
import {
  verifyGemGeometry,
  makeGemGeo,
  projectedRadius,
} from "./gem";
import {
  makeLightNormalMaterial,
  makeSplatMaterial,
  makeReceiverMaterial,
  makeGemMaterial,
  makeOverlayMaterial,
  makeBlurMaterial,
  makeEnvTexture,
} from "./shaders";

export interface GemSpec {
  cut: "brilliant" | "step" | "shard";
  center: { x: number; y: number; z: number };
  size: number;
  tint: string;
  causticGain?: number;
}

export interface CausticsParams {
  lightHeight: number;
  ior: number;
  bounces: number;
  splatSize: number;
  debugStage: number;
  blurRadius: number;
  blurEnabled: boolean;
  intensity: number;
  causticStrength: number;
  directStrength: number;
  specStrength: number;
  specPow: number;
  baseColor: string;
}

export const defaultParams = (): CausticsParams => ({
  lightHeight: 140,
  ior: 1.5,
  bounces: 8,
  splatSize: 2.0,
  debugStage: 0,
  blurRadius: 3.0,
  blurEnabled: true,
  intensity: 6000,
  causticStrength: 1.0,
  directStrength: 2.2e3,
  specStrength: 1.4e4,
  specPow: 90,
  baseColor: "#0d091a",
});

export interface CoreOptions {
  canvas: HTMLCanvasElement;
  gems: GemSpec[];
  solveRes?: number;
  pixelRatio?: number;
  transparent?: boolean;
  onUnsupported?: (reason: string) => void;
}

interface Gem {
  geo: THREE.BufferGeometry;
  bvhStruct: MeshBVHUniformStruct;
  normalAttr: FloatVertexAttributeTexture;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  lightMesh: THREE.Mesh;
  lightScene: THREE.Scene;
  lightTarget: THREE.WebGLRenderTarget;
  splatMat: THREE.ShaderMaterial;
  splatScene: THREE.Scene;
  radius: number;
  baseProj: number;
  center: THREE.Vector3;
  tint: string;
  causticGain: number;
  visible: boolean;
}

export interface CapInfo {
  renderer: string;
  targetType: THREE.TextureDataType;
  bufName: string;
  floatBlend: boolean;
}

export class CausticsScene {
  readonly params = defaultParams();
  readonly lightPos = new THREE.Vector3();
  readonly gems: Gem[] = [];
  renderer!: THREE.WebGLRenderer;
  glRenderer = "";
  targetType: THREE.TextureDataType = THREE.FloatType;
  solveRes: number;
  transparent: boolean;
  W = 1;
  H = 1;
  dirty = true;

  private cam: THREE.OrthographicCamera;
  private bufferCam: THREE.OrthographicCamera;
  private lightCam = new THREE.PerspectiveCamera(50, 1, 1, 100);
  private recvMat?: THREE.ShaderMaterial;
  private receiver?: THREE.Mesh;
  private scene = new THREE.Scene();
  private splatGeo = new THREE.BufferGeometry();
  private splatCap = 0;
  private causticRaw!: THREE.WebGLRenderTarget;
  private causticPing!: THREE.WebGLRenderTarget;
  private causticFinal!: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blurMat = makeBlurMaterial();
  private overlayMat?: THREE.ShaderMaterial;
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  private envTex = makeEnvTexture();
  private disposed = false;

  static create(opts: CoreOptions): CausticsScene | null {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: opts.canvas,
        antialias: false,
        alpha: !!opts.transparent,
        powerPreference: "high-performance",
      });
    } catch (err) {
      opts.onUnsupported?.(String(err));
      return null;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const gl2 = renderer.getContext() as WebGL2RenderingContext;
    if (!renderer.capabilities.isWebGL2) {
      opts.onUnsupported?.("WebGL2 unavailable");
      renderer.dispose();
      return null;
    }
    const extColorFloat = !!gl2.getExtension("EXT_color_buffer_float");
    const extFloatBlend = !!gl2.getExtension("EXT_float_blend");
    const extColorHalfFloat = !!gl2.getExtension(
      "EXT_color_buffer_half_float",
    );
    const extFloatLinear = !!gl2.getExtension("OES_texture_float_linear");
    const extHalfLinear = !!gl2.getExtension("OES_texture_half_float_linear");
    // EXT_color_buffer_float covers 16F renderability too; 16F blending needs
    // no extra ext, only 32F does. byte targets would quantize deposits.
    const canFloat = extColorFloat && extFloatBlend;
    const canHalf = extColorFloat || extColorHalfFloat;
    if (!canFloat && !canHalf) {
      opts.onUnsupported?.("float render target unsupported");
      renderer.dispose();
      return null;
    }
    const scene = new CausticsScene(opts, renderer, {
      targetType: canFloat ? THREE.FloatType : THREE.HalfFloatType,
      targetFilter:
        (canFloat && extFloatLinear) || (!canFloat && extHalfLinear)
          ? THREE.LinearFilter
          : THREE.NearestFilter,
      glRenderer: gl2.getExtension("WEBGL_debug_renderer_info")
        ? gl2.getParameter(
            gl2.getExtension("WEBGL_debug_renderer_info")!
              .UNMASKED_RENDERER_WEBGL,
          )
        : "webgl2 (masked)",
      floatBlend: extFloatBlend,
    });
    return scene;
  }

  private constructor(
    opts: CoreOptions,
    renderer: THREE.WebGLRenderer,
    caps: {
      targetType: THREE.TextureDataType;
      targetFilter: THREE.MagnificationTextureFilter;
      glRenderer: string;
      floatBlend: boolean;
    },
  ) {
    this.renderer = renderer;
    this.glRenderer = caps.glRenderer;
    this.targetType = caps.targetType;
    this.transparent = !!opts.transparent;
    this.solveRes = Math.min(
      Math.max(Math.floor(opts.solveRes ?? 256) || 256, 16),
      2048,
    );
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    renderer.setSize(this.W, this.H);
    renderer.setPixelRatio(opts.pixelRatio ?? 1);
    renderer.autoClear = false;

    this.cam = new THREE.OrthographicCamera(0, this.W, this.H, 0, 1, 4000);
    this.cam.position.set(0, 0, 1000);
    this.bufferCam = new THREE.OrthographicCamera(0, this.W, this.H, 0, 1, 4000);
    this.bufferCam.position.set(0, 0, 1000);

    const splatGeo = this.splatGeo;
    this.splatCap = Math.max(this.solveRes, 512);
    const uvs = new Float32Array(this.splatCap * this.splatCap * 3);
    this.fillSplatUvs(uvs, this.solveRes);
    splatGeo.setAttribute("position", new THREE.BufferAttribute(uvs, 3));
    splatGeo.setDrawRange(0, this.solveRes * this.solveRes);
    splatGeo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0.5, 0.5, 0),
      1,
    );

    const lightNormalMat = makeLightNormalMaterial();
    for (const spec of opts.gems) {
      const geo = makeGemGeo(spec.cut);
      const projR = projectedRadius(geo);
      const scale = spec.size / Math.max(projR, 1e-6);
      const check = verifyGemGeometry(geo);
      if (check.invertedFaces || check.openEdges) {
        console.error("[caustics] gem geometry check failed", spec.cut, check);
      }
      const bvh = new MeshBVH(geo, { strategy: SAH });
      const bvhStruct = new MeshBVHUniformStruct();
      bvhStruct.updateFrom(bvh);
      const normalAttr = new FloatVertexAttributeTexture();
      normalAttr.updateFrom(
        geo.getAttribute("normal") as THREE.BufferAttribute,
      );
      const mat = makeGemMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(scale);
      const center = new THREE.Vector3(
        spec.center.x,
        spec.center.y,
        spec.center.z,
      );
      mesh.position.copy(center);
      const lightTarget = new THREE.WebGLRenderTarget(
        this.solveRes,
        this.solveRes,
        {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          depthTexture: new THREE.DepthTexture(
            this.solveRes,
            this.solveRes,
            THREE.FloatType,
          ),
        },
      );
      const lightMesh = new THREE.Mesh(geo, lightNormalMat);
      lightMesh.scale.setScalar(scale);
      lightMesh.position.copy(center);
      const lightScene = new THREE.Scene();
      lightScene.add(lightMesh);
      const splatMat = makeSplatMaterial();
      const splats = new THREE.Points(splatGeo, splatMat);
      splats.frustumCulled = false;
      const splatScene = new THREE.Scene();
      splatScene.add(splats);
      this.gems.push({
        geo,
        bvhStruct,
        normalAttr,
        mesh,
        mat,
        lightMesh,
        lightScene,
        lightTarget,
        splatMat,
        splatScene,
        radius: (geo.boundingSphere?.radius ?? projR) * scale,
        baseProj: projR,
        center,
        tint: spec.tint,
        causticGain: spec.causticGain ?? 1,
        visible: true,
      });
      this.scene.add(mesh);
    }
    this.lightNormalMat = lightNormalMat;

    if (!this.transparent) {
      this.recvMat = makeReceiverMaterial(this.gems.length);
      this.receiver = new THREE.Mesh(
        new THREE.PlaneGeometry(this.W, this.H),
        this.recvMat,
      );
      this.receiver.position.set(this.W / 2, this.H / 2, 0);
      this.scene.add(this.receiver);
    }

    const mkTarget = () =>
      new THREE.WebGLRenderTarget(this.W, this.H, {
        minFilter: caps.targetFilter,
        magFilter: caps.targetFilter,
        type: caps.targetType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
      });
    this.causticRaw = mkTarget();
    this.causticPing = mkTarget();
    this.causticFinal = mkTarget();

    if (this.transparent) {
      this.overlayMat = makeOverlayMaterial();
      this.quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        this.overlayMat,
      );
    } else {
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    }
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private lightNormalMat!: THREE.ShaderMaterial;

  get bufName() {
    return this.targetType === THREE.FloatType ? "float" : "half";
  }

  setLight(x: number, y: number, z?: number) {
    this.lightPos.set(x, y, z ?? this.params.lightHeight);
    this.dirty = true;
  }

  setGemVisible(i: number, v: boolean) {
    const g = this.gems[i];
    if (!g || g.visible === v) return;
    g.visible = v;
    g.mesh.visible = v;
    this.dirty = true;
  }

  setGemCenter(i: number, x: number, y: number, z?: number) {
    const g = this.gems[i];
    if (!g) return;
    g.center.set(x, y, z ?? g.center.z);
    g.mesh.position.copy(g.center);
    g.lightMesh.position.copy(g.center);
    this.dirty = true;
  }

  gemRadius(i: number) {
    return this.gems[i]?.radius ?? 0;
  }

  private fitLightCamera(gem: Gem) {
    const { lightPos, lightCam } = this;
    const dist = lightPos.distanceTo(gem.center);
    lightCam.position.copy(lightPos);
    lightCam.up.set(0, 1, 0);
    lightCam.lookAt(gem.center);
    lightCam.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.asin(Math.min((gem.radius * 1.15) / Math.max(dist, 1e-3), 0.999)),
    );
    lightCam.near = Math.max(dist - gem.radius * 1.5, 1);
    const receiverFar = Math.hypot(
      Math.max(Math.abs(lightPos.x), Math.abs(this.W - lightPos.x)),
      Math.max(Math.abs(lightPos.y), Math.abs(this.H - lightPos.y)),
      lightPos.z,
    );
    lightCam.far = Math.max(dist + gem.radius * 2.5, receiverFar);
    lightCam.aspect = 1;
    lightCam.updateProjectionMatrix();
    lightCam.updateMatrixWorld();
  }

  private renderLightView(gem: Gem) {
    this.renderer.setRenderTarget(gem.lightTarget);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.clear();
    this.renderer.render(gem.lightScene, this.lightCam);
  }

  solve() {
    const { params, renderer } = this;
    renderer.setRenderTarget(this.causticRaw);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    for (const gem of this.gems) {
      if (!gem.visible) continue;
      gem.mesh.updateMatrixWorld(true);
      this.fitLightCamera(gem);
      this.renderLightView(gem);
      const sm = gem.splatMat.uniforms;
      sm.debugStage.value = params.debugStage;
      sm.lightViewInv.value.copy(this.lightCam.matrixWorld);
      sm.lightProjInv.value.copy(this.lightCam.projectionMatrixInverse);
      sm.lightPos.value.copy(this.lightPos);
      sm.lightViewRes.value.set(this.solveRes, this.solveRes);
      sm.normalTex.value = gem.lightTarget.texture;
      sm.depthTex.value = gem.lightTarget.depthTexture;
      (sm.bvh as { value: unknown }).value = gem.bvhStruct;
      (sm.normalAttribute as { value: unknown }).value = gem.normalAttr;
      sm.gemModelMatrix.value.copy(gem.mesh.matrixWorld);
      sm.bounces.value = params.bounces;
      sm.ior.value = params.ior;
      sm.intensity.value = params.intensity * gem.causticGain;
      sm.splatSizePx.value = params.splatSize;
      sm.maxDist.value = 4000;
      sm.tint.value.set(gem.tint);
      renderer.setRenderTarget(this.causticRaw);
      renderer.render(gem.splatScene, this.bufferCam);
    }
    if (params.blurEnabled) {
      const b = this.blurMat.uniforms;
      b.texel.value.set(1 / this.causticRaw.width, 1 / this.causticRaw.height);
      b.radius.value = params.blurRadius;
      this.quad.material = this.blurMat;
      b.dir.value.set(1, 0);
      b.tex.value = this.causticRaw.texture;
      renderer.setRenderTarget(this.causticPing);
      renderer.render(this.quadScene, this.quadCam);
      b.dir.value.set(0, 1);
      b.tex.value = this.causticPing.texture;
      renderer.setRenderTarget(this.causticFinal);
      renderer.render(this.quadScene, this.quadCam);
    }
  }

  activeCaustic() {
    return this.params.blurEnabled ? this.causticFinal : this.causticRaw;
  }

  rawCaustic() {
    return this.causticRaw;
  }

  composite() {
    const { params, renderer, lightPos } = this;
    if (this.transparent) {
      for (const gem of this.gems) this.applyGemUniforms(gem);
      const om = this.overlayMat!.uniforms;
      om.tex.value = this.activeCaustic().texture;
      om.gain.value = params.causticStrength;
      this.quad.material = this.overlayMat!;
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(this.quadScene, this.quadCam);
      renderer.render(this.scene, this.cam);
      return;
    }
    const rm = this.recvMat!.uniforms;
    rm.baseColor.value.set(params.baseColor);
    rm.causticTex.value = this.activeCaustic().texture;
    rm.receiverRes.value.set(this.W, this.H);
    rm.lightPos.value.copy(lightPos);
    rm.directStrength.value = params.directStrength;
    rm.causticStrength.value = params.causticStrength;
    for (let i = 0; i < this.gems.length; i++) {
      const gem = this.gems[i];
      this.fitLightCamera(gem);
      (rm.lightViewMatrix.value as THREE.Matrix4[])[i].copy(
        this.lightCam.matrixWorldInverse,
      );
      (rm.lightProjMatrix.value as THREE.Matrix4[])[i].copy(
        this.lightCam.projectionMatrix,
      );
      (rm.lightDepthTex.value as THREE.Texture[])[i] =
        gem.lightTarget.depthTexture!;
      (rm.lightActive.value as number[])[i] = gem.visible ? 1 : 0;
    }
    for (const gem of this.gems) this.applyGemUniforms(gem);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(this.scene, this.cam);
  }

  private applyGemUniforms(gem: Gem) {
    const { params, lightPos } = this;
    gem.mesh.updateMatrixWorld(true);
    const gm = gem.mat.uniforms;
    gm.envMap.value = this.envTex;
    (gm.bvh as { value: unknown }).value = gem.bvhStruct;
    (gm.normalAttribute as { value: unknown }).value = gem.normalAttr;
    gm.gemModelMatrix.value.copy(gem.mesh.matrixWorld);
    gm.bounces.value = params.bounces;
    gm.ior.value = params.ior;
    gm.tint.value.set(gem.tint);
    gm.lightPos.value.copy(lightPos);
    gm.specStrength.value = params.specStrength;
    gm.specPow.value = params.specPow;
  }

  private fillSplatUvs(arr: Float32Array, res: number) {
    for (let j = 0, p = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        arr[p++] = (i + 0.5) / res;
        arr[p++] = (j + 0.5) / res;
        arr[p++] = 0;
      }
    }
  }

  setGemSize(i: number, size: number) {
    const g = this.gems[i];
    if (!g) return;
    const s = size / Math.max(g.baseProj, 1e-6);
    g.mesh.scale.setScalar(s);
    g.lightMesh.scale.setScalar(s);
    g.radius = (g.geo.boundingSphere?.radius ?? g.baseProj) * s;
    this.dirty = true;
  }

  setSolveRes(res: number) {
    const r = Math.min(Math.max(Math.floor(res) || 256, 16), 2048);
    if (r === this.solveRes) return;
    this.solveRes = r;
    if (r > this.splatCap) {
      this.splatGeo.dispose();
      this.splatCap = r;
      const uvs = new Float32Array(r * r * 3);
      this.fillSplatUvs(uvs, r);
      this.splatGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(uvs, 3),
      );
    } else {
      const attr = this.splatGeo.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      this.fillSplatUvs(attr.array as Float32Array, r);
      attr.needsUpdate = true;
    }
    this.splatGeo.setDrawRange(0, r * r);
    for (const gem of this.gems) {
      gem.lightTarget.setSize(r, r);
    }
    this.dirty = true;
  }

  setGemTint(i: number, tint: string) {
    const g = this.gems[i];
    if (!g) return;
    g.tint = tint;
    g.splatMat.uniforms.tint.value.set(tint);
    g.mat.uniforms.tint.value.set(tint);
    this.dirty = true;
  }

  resize(w: number, h: number) {
    this.W = w;
    this.H = h;
    this.renderer.setSize(w, h);
    this.cam.right = w;
    this.cam.top = h;
    this.cam.updateProjectionMatrix();
    this.bufferCam.right = w;
    this.bufferCam.top = h;
    this.bufferCam.updateProjectionMatrix();
    this.causticRaw.setSize(w, h);
    this.causticPing.setSize(w, h);
    this.causticFinal.setSize(w, h);
    if (this.receiver) {
      this.receiver.geometry.dispose();
      this.receiver.geometry = new THREE.PlaneGeometry(w, h);
      this.receiver.position.set(w / 2, h / 2, 0);
    }
    this.dirty = true;
  }

  measureCaustic(x: number, y: number, w: number, h: number) {
    const t = this.activeCaustic();
    let sum = 0;
    if (this.targetType === THREE.FloatType) {
      const px = new Float32Array(w * h * 4);
      this.renderer.readRenderTargetPixels(t, x, this.H - y - h, w, h, px);
      for (let i = 0; i < px.length; i += 4) {
        sum += px[i] + px[i + 1] + px[i + 2];
      }
    } else {
      const px = new Uint16Array(w * h * 4);
      this.renderer.readRenderTargetPixels(t, x, this.H - y - h, w, h, px);
      for (let i = 0; i < px.length; i += 4) {
        sum +=
          halfToFloat(px[i]) + halfToFloat(px[i + 1]) + halfToFloat(px[i + 2]);
      }
    }
    return sum / (w * h * 3);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of [this.causticRaw, this.causticPing, this.causticFinal]) {
      t.dispose();
    }
    for (const gem of this.gems) {
      gem.lightTarget.dispose();
      gem.geo.dispose();
      gem.mat.dispose();
      gem.splatMat.dispose();
      gem.normalAttr.dispose();
      gem.bvhStruct.dispose();
    }
    this.splatGeo.dispose();
    this.receiver?.geometry.dispose();
    this.recvMat?.dispose();
    this.lightNormalMat?.dispose();
    this.quad.geometry.dispose();
    this.blurMat.dispose();
    this.overlayMat?.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
  }
}

const halfToFloat = (h: number) => {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 31) {
    if (f) return NaN;
    return (s ? -1 : 1) * Infinity;
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
};
