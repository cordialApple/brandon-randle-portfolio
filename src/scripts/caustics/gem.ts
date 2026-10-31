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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const pos = geo.getAttribute("position");
  const normals = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();
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
