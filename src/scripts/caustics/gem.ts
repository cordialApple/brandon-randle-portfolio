import * as THREE from "three";

export function makeGemGeometry(
  sides = 8,
  radius = 1,
  crownHeight = 0.32,
  pavilionDepth = 1.05,
  tableRatio = 0.55,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const tableY = crownHeight;
  const tableR = radius * tableRatio;

  const ring = (r: number, y: number, offset = 0) =>
    Array.from({ length: sides }, (_, i) => {
      const a = ((i + offset) / sides) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });

  const tableRing = ring(tableR, tableY);
  const girdleRing = ring(radius, 0, 0.5); // offset half-step -> kite crown facets
  const top = new THREE.Vector3(0, tableY, 0);
  const culet = new THREE.Vector3(0, -pavilionDepth, 0);

  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  for (let i = 0; i < sides; i++) {
    const i1 = i % sides;
    const i2 = (i + 1) % sides;
    tri(top, tableRing[i2], tableRing[i1]);
    tri(tableRing[i1], girdleRing[i2], girdleRing[i1]);
    tri(tableRing[i1], tableRing[i2], girdleRing[i2]);
    tri(girdleRing[i1], girdleRing[i2], culet);
  }

  return makeFlatGeometry(positions);
}

export function makeStepGeometry(
  halfW = 1.2,
  halfD = 0.85,
  crownH = 0.38,
  pavilionH = 1.0,
  crownSteps = 2,
  pavilionSteps = 3,
): THREE.BufferGeometry {
  const rings: Array<[number, number, number]> = [];
  const addRing = (y: number, w: number, d: number) => {
    rings.push([y, w, d]);
  };
  const tableW = halfW * 0.62;
  const tableD = halfD * 0.62;
  // keel: near-zero-height rectangle keeps the pavilion closed
  addRing(-pavilionH, 0.001, 0.001);
  for (let s = pavilionSteps; s >= 1; s--) {
    const f = s / (pavilionSteps + 1);
    addRing(-pavilionH * f, halfW * (1 - f), halfD * (1 - f));
  }
  addRing(0, halfW, halfD);
  for (let s = 1; s <= crownSteps; s++) {
    const f = s / (crownSteps + 1);
    addRing(crownH * f, halfW, halfD);
  }
  addRing(crownH, tableW, tableD);

  const ringVerts = ([y, w, d]: [number, number, number]) => [
    new THREE.Vector3(-w, y, -d),
    new THREE.Vector3(w, y, -d),
    new THREE.Vector3(w, y, d),
    new THREE.Vector3(-w, y, d),
  ];

  const positions: number[] = [];
  const tri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
  ) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  const table = ringVerts(rings[rings.length - 1]);
  tri(table[0], table[2], table[1]);
  tri(table[0], table[3], table[2]);
  const keel = ringVerts(rings[0]);
  tri(keel[0], keel[1], keel[2]);
  tri(keel[0], keel[2], keel[3]);

  for (let r = 0; r < rings.length - 1; r++) {
    const lo = ringVerts(rings[r]);
    const hi = ringVerts(rings[r + 1]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      tri(lo[i], hi[j], lo[j]);
      tri(lo[i], hi[i], hi[j]);
    }
  }

  return makeFlatGeometry(positions);
}

export function makeShardGeometry(
  sides = 5,
  radius = 0.8,
  height = 2.3,
): THREE.BufferGeometry {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + ((i * 7) % 3) * 0.21;
    const r = radius * (0.62 + ((i * 31) % 10) / 10 * 0.55);
    ring.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const top = new THREE.Vector3(radius * 0.28, height, -radius * 0.22);
  const bottom = new THREE.Vector3(-radius * 0.3, -height * 0.55, radius * 0.18);

  const positions: number[] = [];
  const tri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
  ) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    tri(ring[j], ring[i], top);
    tri(ring[i], ring[j], bottom);
  }

  return makeFlatGeometry(positions);
}

function makeFlatGeometry(positions: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const pos = geo.getAttribute("position");
  const normals = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    e1 = new THREE.Vector3(),
    e2 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    n.crossVectors(e1, e2).normalize();
    for (let k = 0; k < 3; k++) {
      normals[(i + k) * 3] = n.x;
      normals[(i + k) * 3 + 1] = n.y;
      normals[(i + k) * 3 + 2] = n.z;
    }
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  return geo;
}

export function verifyGemGeometry(geo: THREE.BufferGeometry): {
  invertedFaces: number;
  openEdges: number;
} {
  const pos = geo.getAttribute("position");
  const centroid = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    centroid.x += pos.getX(i);
    centroid.y += pos.getY(i);
    centroid.z += pos.getZ(i);
  }
  centroid.multiplyScalar(1 / pos.count);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const fc = new THREE.Vector3();
  let invertedFaces = 0;
  const edgeCounts = new Map<string, number>();
  const key = (v: THREE.Vector3) =>
    `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.copy(b).sub(a).cross(ab.copy(c).sub(a));
    fc.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(centroid);
    if (n.dot(fc) <= 0) invertedFaces++;
    const ks = [key(a), key(b), key(c)];
    const pairs = [
      [ks[0], ks[1]],
      [ks[1], ks[2]],
      [ks[2], ks[0]],
    ];
    for (const [p, q] of pairs) {
      const e = p < q ? `${p}|${q}` : `${q}|${p}`;
      edgeCounts.set(e, (edgeCounts.get(e) ?? 0) + 1);
    }
  }

  let openEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count !== 2) openEdges++;
  }
  return { invertedFaces, openEdges };
}

export function projectedRadius(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  let r = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const d = Math.hypot(x, y);
    if (d > r) r = d;
  }
  return r;
}

export function makeGemGeo(cut: "brilliant" | "step" | "shard"): THREE.BufferGeometry {
  if (cut === "step") {
    const geo = makeStepGeometry(1.2, 0.85, 0.38, 1.0, 2, 3);
    geo.rotateX(Math.PI / 3);
    geo.rotateZ(-0.22);
    return geo;
  }
  if (cut === "shard") {
    const geo = makeShardGeometry(5, 0.8, 2.3);
    geo.rotateX(Math.PI / 4);
    geo.rotateZ(0.3);
    return geo;
  }
  const geo = makeGemGeometry(8, 1, 0.35, 1.05, 0.55);
  geo.rotateX(Math.PI / 2);
  return geo;
}
