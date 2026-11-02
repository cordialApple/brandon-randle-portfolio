import * as THREE from "three";
import { BVHShaderGLSL } from "three-mesh-bvh";

export const traceChunk = /* glsl */ `
  uniform mat4 lightViewInv;
  uniform mat4 lightProjInv;
  uniform vec3 lightPos;

  vec3 WorldPosFromDepth(float depth, vec2 coord) {
    float z = depth * 2.0 - 1.0;
    vec4 clip = vec4(coord * 2.0 - 1.0, z, 1.0);
    vec4 view = lightProjInv * clip;
    view /= view.w;
    return (lightViewInv * view).xyz;
  }

  float planeIntersect(vec3 ro, vec3 rd, vec4 p) {
    return -(dot(ro, p.xyz) + p.w) / dot(rd, p.xyz);
  }
`;

export const bvhChunk = /* glsl */ `
  #include <common>
  precision highp isampler2D;
  precision highp usampler2D;
  ${BVHShaderGLSL.common_functions}
  ${BVHShaderGLSL.bvh_struct_definitions}
  ${BVHShaderGLSL.bvh_ray_functions}
  uniform BVH bvh;
  uniform sampler2D normalAttribute;
  uniform float bounces;
  uniform float ior;
  // gemModelMatrix: named (not modelMatrix) so vertex shaders don't collide
  // with three's built-in modelMatrix of the points/mesh being drawn.

  // stage: 0 exited, 1 reflected at entry, 2 no BVH hit, 3 TIR cap,
  // 4 degenerate normal
  bool traceThroughGem(
    vec3 worldOrigin, vec3 worldDir, vec3 entryNormal,
    out vec3 exitOrigin, out vec3 exitDir, out int stage, out vec3 dbgNormal
  ) {
    mat4 inv = inverse(gemModelMatrix);
    vec3 dir = refract(worldDir, entryNormal, 1.0 / ior);
    if (length(dir) == 0.0) { stage = 1; return false; }

    vec3 ro = (inv * vec4(worldOrigin + dir * 0.02, 1.0)).xyz;
    vec3 rd = normalize((inv * vec4(dir, 0.0)).xyz);
    bool exited = false;

    for (float i = 0.0; i < bounces; i++) {
      uvec4 faceIndices = uvec4(0u);
      vec3 faceNormal = vec3(0.0, 0.0, 1.0);
      vec3 barycoord = vec3(0.0);
      float side = 1.0;
      float dist = 0.0;
      if (!bvhIntersectFirstHit(bvh, ro, rd, faceIndices, faceNormal, barycoord, side, dist)) {
        stage = 2; return false;
      }
      faceNormal = textureSampleBarycoord(normalAttribute, barycoord, faceIndices.xyz).xyz * side;
      if (length(faceNormal) < 0.5) { stage = 4; return false; }
      dbgNormal = faceNormal;
      vec3 hitPos = ro + rd * dist;
      vec3 out_ = refract(rd, faceNormal, ior);
      if (length(out_) != 0.0) {
        ro = hitPos + out_ * 0.02;
        rd = out_;
        exited = true;
        break;
      }
      rd = reflect(rd, faceNormal);
      ro = hitPos + rd * 0.02;
    }
    if (!exited) { stage = 3; return false; }
    exitOrigin = (gemModelMatrix * vec4(ro, 1.0)).xyz;
    exitDir = normalize((gemModelMatrix * vec4(rd, 0.0)).xyz);
    stage = 0;
    return true;
  }
`;

export function makeLightNormalMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalW;
      void main() { gl_FragColor = vec4(normalize(vNormalW) * 0.5 + 0.5, 1.0); }
    `,
  });
}

export function makeSplatMaterial(): THREE.ShaderMaterial {
  const kernelExponent = 4;
  return new THREE.ShaderMaterial({
    uniforms: {
      lightViewInv: { value: new THREE.Matrix4() },
      lightProjInv: { value: new THREE.Matrix4() },
      lightPos: { value: new THREE.Vector3() },
      normalTex: { value: null },
      depthTex: { value: null },
      bvh: { value: null },
      normalAttribute: { value: null },
      gemModelMatrix: { value: new THREE.Matrix4() },
      bounces: { value: 8 },
      ior: { value: 1.5 },
      lightViewRes: { value: new THREE.Vector2(1, 1) },
      tint: { value: new THREE.Color(1, 1, 1) },
      intensity: { value: 1.0 },
      splatSizePx: { value: 2.0 },
      kernelExponent: { value: kernelExponent },
      kernelNormalization: {
        value: kernelExponent / (Math.PI * (1 - Math.exp(-kernelExponent))),
      },
      maxDist: { value: 2000.0 },
      receiverPlane: { value: new THREE.Vector4(0, 0, 1, 0) },
      debugStage: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      uniform sampler2D normalTex;
      uniform sampler2D depthTex;
      uniform vec2 lightViewRes;
      uniform vec3 tint;
      uniform float intensity;
      uniform float splatSizePx;
      uniform float maxDist;
      uniform vec4 receiverPlane;
      uniform mat4 gemModelMatrix;
      uniform int debugStage;
      ${traceChunk}
      ${bvhChunk}
      void main() {
        vColor = vec3(0.0);
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        vec2 a_uv = position.xy;
        float depth = texture2D(depthTex, a_uv).x;
        if (depth >= 1.0) return;
        vec3 pos = WorldPosFromDepth(depth, a_uv);
        vec3 normal = normalize(texture2D(normalTex, a_uv).rgb * 2.0 - 1.0);
        vec3 inDir = normalize(pos - lightPos);
        vec3 hit;
        float radius = splatSizePx * 0.5;
        if (debugStage == 1 || debugStage == 2) {
          float t1 = planeIntersect(pos, inDir, receiverPlane);
          if (!(t1 > 0.0 && t1 <= maxDist)) return;
          hit = pos + inDir * t1;
          vColor = vec3(0.0, 1.0, 0.0);
          if (debugStage == 2) {
            // color by trace outcome: green lands, yellow exits off-plane,
            // red misses the BVH, magenta TIR at entry, blue TIR cap.
            // stage-3 hits show last face normal as 0.5*n+0.5
            vec3 eo, ed, dn; int stage;
            if (!traceThroughGem(pos, inDir, normal, eo, ed, stage, dn)) {
              vColor = stage == 1 ? vec3(1.0, 0.0, 1.0)
                     : stage == 2 ? vec3(1.0, 0.0, 0.0)
                     : stage == 4 ? vec3(0.0, 1.0, 1.0)
                     : dn * 0.5 + 0.5;
            } else {
              float t2 = planeIntersect(eo, ed, receiverPlane);
              vColor = (t2 > 0.0 && t2 <= maxDist) ? vec3(0.0, 1.0, 0.0)
                                                   : vec3(1.0, 1.0, 0.0);
            }
          }
        } else {
          vec3 exitO, exitD, dn; int stage;
          if (!traceThroughGem(pos, inDir, normal, exitO, exitD, stage, dn)) return;
          float t = planeIntersect(exitO, exitD, receiverPlane);
          if (!(t > 0.0 && t <= maxDist)) return; // t NaN fails the check
          hit = exitO + exitD * t;
          // solid angle of the texel this center ray stands for, derived from
          // the four corner ray directions so resolution/frustum/near changes
          // leave total deposited flux invariant
          vec2 r = 0.5 / lightViewRes;
          vec3 d00 = normalize(WorldPosFromDepth(0.0, a_uv - r) - lightPos);
          vec3 d10 = normalize(WorldPosFromDepth(0.0, a_uv + vec2(r.x, -r.y)) - lightPos);
          vec3 d01 = normalize(WorldPosFromDepth(0.0, a_uv + vec2(-r.x, r.y)) - lightPos);
          vec3 d11 = normalize(WorldPosFromDepth(0.0, a_uv + r) - lightPos);
          float omega = 0.5 * length(cross(d10 - d00, d11 - d00))
                      + 0.5 * length(cross(d11 - d00, d01 - d00));
          float incidence = max(abs(dot(exitD, receiverPlane.xyz)), 0.25);
          float spread = sqrt(omega) * (distance(pos, lightPos) + t) / incidence;
          radius = clamp(1.8 * spread, max(splatSizePx * 0.75, 2.0), 28.0);
          vColor = tint * omega * intensity / (radius * radius);
        }
        gl_Position = projectionMatrix * viewMatrix * vec4(hit, 1.0);
        gl_PointSize = radius * 2.0;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      uniform int debugStage;
      uniform float kernelExponent;
      uniform float kernelNormalization;
      void main() {
        if (debugStage != 0) {
          gl_FragColor = vec4(vColor, 1.0);
          return;
        }
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);
        if (d > 1.0) discard;
        float weight = kernelNormalization * exp(-kernelExponent * d);
        gl_FragColor = vec4(vColor * weight, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

export function makeReceiverMaterial(gemCount = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0x0d091a) },
      causticTex: { value: null },
      receiverRes: { value: new THREE.Vector2(1, 1) },
      lightPos: { value: new THREE.Vector3() },
      lightViewMatrix: {
        value: Array.from({ length: gemCount }, () => new THREE.Matrix4()),
      },
      lightProjMatrix: {
        value: Array.from({ length: gemCount }, () => new THREE.Matrix4()),
      },
      lightDepthTex: { value: new Array<THREE.Texture | null>(gemCount).fill(null) },
      lightActive: { value: new Array<number>(gemCount).fill(0) },
      directStrength: { value: 1.0 },
      causticStrength: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      uniform vec3 baseColor;
      uniform sampler2D causticTex;
      uniform vec2 receiverRes;
      uniform vec3 lightPos;
      uniform mat4 lightViewMatrix[${gemCount}];
      uniform mat4 lightProjMatrix[${gemCount}];
      uniform sampler2D lightDepthTex[${gemCount}];
      uniform int lightActive[${gemCount}];
      uniform float directStrength;
      uniform float causticStrength;
      void main() {
        vec3 L = lightPos - vWorldPos;
        float d = length(L);
        L /= d;
        float shadow = 1.0;
        ${Array.from({ length: gemCount }, (_, i) => `
        if (lightActive[${i}] != 0) {
          vec4 lp${i} = lightProjMatrix[${i}] * lightViewMatrix[${i}] * vec4(vWorldPos, 1.0);
          if (lp${i}.w > 0.0) {
            vec3 uvd${i} = lp${i}.xyz / lp${i}.w * 0.5 + 0.5;
            if (uvd${i}.x > 0.0 && uvd${i}.x < 1.0 && uvd${i}.y > 0.0 && uvd${i}.y < 1.0 &&
                uvd${i}.z > 0.0 && uvd${i}.z < 1.0) {
              float occluder${i} = texture2D(lightDepthTex[${i}], uvd${i}.xy).x;
              if (occluder${i} < 1.0 && occluder${i} < uvd${i}.z - 0.002) shadow = 0.0;
            }
          }
        }`).join("\n")}
        float direct = directStrength * max(L.z, 0.0) * shadow / (d * d);
        vec2 uv = vWorldPos.xy / receiverRes;
        vec3 caustic = texture2D(causticTex, uv).rgb * causticStrength;
        gl_FragColor = vec4(baseColor + vec3(direct) + caustic, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function makeGemMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      envMap: { value: null },
      bvh: { value: null },
      normalAttribute: { value: null },
      gemModelMatrix: { value: new THREE.Matrix4() },
      bounces: { value: 8 },
      ior: { value: 1.5 },
      tint: { value: new THREE.Color(0.7, 0.9, 1.0) },
      lightPos: { value: new THREE.Vector3() },
      specStrength: { value: 60.0 },
      specPow: { value: 90.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      uniform sampler2D envMap;
      uniform vec3 tint;
      uniform float specStrength;
      uniform float specPow;
      uniform mat4 gemModelMatrix;
      uniform vec3 lightPos;
      ${bvhChunk}
      void main() {
        vec3 V = normalize(vWorldPos - cameraPosition);
        vec3 exitO, exitD, dn;
        vec3 body;
        int stage;
        if (traceThroughGem(vWorldPos, V, normalize(vNormalW), exitO, exitD, stage, dn)) {
          body = texture2D(envMap, equirectUv(exitD)).rgb * tint;
        } else {
          body = texture2D(envMap, equirectUv(reflect(V, normalize(vNormalW)))).rgb * tint;
        }
        vec3 Lv = lightPos - vWorldPos;
        float d = length(Lv);
        vec3 H = normalize(Lv / d - V);
        float spec = pow(max(dot(normalize(vNormalW), H), 0.0), specPow)
                   * specStrength / (d * d);
        gl_FragColor = vec4(body + vec3(spec), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

const fullscreenVertexShader = /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `;

export function makeDisplayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: null },
      mode: { value: 0 }, // 0 = rgb, 1 = depth linearized
      gain: { value: 1.0 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform int mode;
      uniform float gain;
      void main() {
        vec4 c = texture2D(tex, vUv);
        if (mode == 1) {
          float d = 1.0 - c.x; // invert so near = bright
          gl_FragColor = vec4(vec3(d * gain), 1.0);
        } else {
          gl_FragColor = vec4(c.rgb * gain, 1.0);
        }
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

export function makeOverlayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: null },
      gain: { value: 1.0 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform float gain;
      void main() {
        vec3 c = texture2D(tex, vUv).rgb * gain;
        gl_FragColor = vec4(c, 0.0);
        #include <colorspace_fragment>
      }
    `,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

export function makeBlurMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: null },
      dir: { value: new THREE.Vector2(1, 0) },
      texel: { value: new THREE.Vector2(1, 1) },
      radius: { value: 4.0 },
    },
    vertexShader: fullscreenVertexShader,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tex;
      uniform vec2 dir;
      uniform vec2 texel;
      uniform float radius;
      void main() {
        float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.0162162;
        vec3 c = texture2D(tex, vUv).rgb * w[0];
        for (int i = 1; i < 5; i++) {
          vec2 o = dir * texel * radius * float(i) / 4.0;
          c += texture2D(tex, vUv + o).rgb * w[i];
          c += texture2D(tex, vUv - o).rgb * w[i];
        }
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

export function makeEnvTexture(): THREE.DataTexture {
  const w = 64, h = 32;
  const data = new Float32Array(w * h * 4);
  const blobs = [
    { u: 0.25, v: 0.3, r: 0.08, c: [4, 4, 4] },
    { u: 0.7, v: 0.25, r: 0.05, c: [2, 2.4, 3] },
    { u: 0.55, v: 0.6, r: 0.1, c: [1.2, 0.9, 1.6] },
    { u: 0.9, v: 0.7, r: 0.04, c: [3, 1.5, 1.2] },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let r = 0.04, g = 0.04, b = 0.06;
      for (const bl of blobs) {
        const du = Math.min(Math.abs(u - bl.u), 1 - Math.abs(u - bl.u));
        const dv = v - bl.v;
        const dd = Math.exp(-(du * du + dv * dv) / (bl.r * bl.r));
        r += dd * bl.c[0]; g += dd * bl.c[1]; b += dd * bl.c[2];
      }
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
