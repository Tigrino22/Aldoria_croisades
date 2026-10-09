// Portraits réalistes (buste 3/4) : humain MakeHuman + équipement ajusté + mèches, rendu puis peint (paint.py).
import { THREE, MAT, mesh, fbm, smooth, clamp, lerp, V, deg, rng, sun, capture, studioEnv, envFromScene } from './lib.js';
import * as H from './human.js';
import * as Hair from './hair.js';
import * as Gr from './gear.js';
import { sweep, lathe, tubeAlong } from './lib.js';

const REF = H.REF, NB = H.NB;
const rx = (i) => REF[i * 3], ry = (i) => REF[i * 3 + 1], rz = (i) => REF[i * 3 + 2];
const headW = (i) => smooth(1.37, 1.46, ry(i)) * (1 - smooth(0.085, 0.12, Math.abs(rx(i))));

// ------------------------------------------------------------------ rotation de la tête appliquée après coup
function turnGeo(geo, weights, q, piv) {
  const P = geo.attributes.position, N = geo.attributes.normal;
  const v = V(0, 0, 0), qi = new THREE.Quaternion();
  for (let k = 0; k < P.count; k++) {
    const w = weights(k); if (w <= 0) continue;
    qi.identity().slerp(q, w);
    v.fromBufferAttribute(P, k).sub(piv).applyQuaternion(qi).add(piv); P.setXYZ(k, v.x, v.y, v.z);
    if (N) { v.fromBufferAttribute(N, k).applyQuaternion(qi); N.setXYZ(k, v.x, v.y, v.z); }
    if (geo.attributes.tang) { v.fromBufferAttribute(geo.attributes.tang, k).applyQuaternion(qi); geo.attributes.tang.setXYZ(k, v.x, v.y, v.z); }
    if (geo.attributes.rootN) { v.fromBufferAttribute(geo.attributes.rootN, k).applyQuaternion(qi); geo.attributes.rootN.setXYZ(k, v.x, v.y, v.z); }
  }
  P.needsUpdate = true;
}

// ------------------------------------------------------------------ poils
function beardStrands(B, o) {
  const { pos, nrm } = B;
  const w = new Float32Array(NB); for (let i = 0; i < NB; i++) w[i] = H.REG[i].beard * (o.mask ? o.mask(i) : 1) * (o.hole ? (Gr.faceHole(i, { ...o.hole, rx: (o.hole.rx ?? 0.058) - 0.006, ry: (o.hole.ry ?? 0.074) - 0.006 }) ? 1 : 0) : 1);
  const roots = Hair.sampleRoots(pos, nrm, H.BTRI, w, o.count ?? 26000, o.seed ?? 1, REF);
  const len = o.len ?? 0.05;
  const strands = Hair.grow(roots, {
    len: (r) => {
      const R = r.ref, ax = Math.abs(R.x);
      const chin = smooth(1.475, 1.43, R.y) * smooth(0.055, 0.0, ax);
      const mous = smooth(1.5, 1.49, R.y) * smooth(1.483, 1.49, R.y) * smooth(0.035, 0.02, ax);
      const side = smooth(1.47, 1.53, R.y) * smooth(0.03, 0.06, ax);
      const neck = smooth(1.43, 1.40, R.y);
      return len * (0.5 + (o.chinLen ?? 0.7) * chin + 0.2 * r.rnd) * (1 - (o.sideCut ?? 0.55) * side) * (1 - 0.5 * neck) * lerp(1, o.mousLen ?? 0.5, mous) + (o.minLen ?? 0.003);
    },
    segs: o.segs ?? 10,
    dir: (r, t) => {
      const R = r.ref, s = Math.sign(R.x);
      const mous = R.y > 1.483 && Math.abs(R.x) < 0.035;
      const down = mous ? V(s * 0.6, -1, 0.2) : V(s * 0.05 * (o.flare ?? 1), -1, 0.4 - 0.25 * t + (o.forward ?? 0));
      return r.n.clone().multiplyScalar((o.lift ?? 0.6) * (1 - t)).add(down.multiplyScalar(0.6 + t));
    },
    stiff: 0.55, collider: B.collider, off: () => 0.0025, clumps: { n: o.clumps ?? 700, amount: o.clump ?? 0.5 }, frizz: o.frizz ?? 0.2, seed: o.seed ?? 1,
  });
  return { strands, roots };
}
function browStrands(B, o) {
  const { pos, nrm } = B;
  const w = new Float32Array(NB); for (let i = 0; i < NB; i++) w[i] = H.REG[i].brow;
  const roots = Hair.sampleRoots(pos, nrm, H.BTRI, w, o.count ?? 1700, o.seed ?? 5, REF);
  const L = o.len ?? 0.009;
  const strands = Hair.grow(roots, {
    len: (r) => L * (0.6 + 0.6 * r.rnd), segs: 4,
    dir: (r) => { const s = Math.sign(r.ref.x); const inner = smooth(0.026, 0.012, Math.abs(r.ref.x)); const tg = V(s, 0.12 + 1.2 * inner, 0); return tg.addScaledVector(r.n, -tg.dot(r.n) + 0.1); },
    stiff: 0.3, collider: B.collider, off: () => 0.0007, frizz: 0.12, seed: o.seed ?? 5,
  });
  return { strands, roots };
}
function lashStrands(B, { count = 45, len = 0.0065, lower = false } = {}) {
  const strands = [], roots = []; const r = rng(77);
  for (const L of H.LIDS) {
    const ids = lower ? L.lower : L.upper;
    const pts = ids.map((i) => V(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]));
    const cv = new THREE.CatmullRomCurve3(pts);
    let E = V(0, 0, 0); ids.forEach((i) => E.add(V(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]))); E.multiplyScalar(1 / ids.length);
    const n = lower ? count * 0.4 : count;
    for (let k = 0; k < n; k++) {
      const t = (k + r()) / n; const p = cv.getPointAt(t);
      const out = V(p.x - E.x, 0, 0).multiplyScalar(lower ? 30 : 40); const up = lower ? -0.6 : 1;
      const d0 = V(out.x * 0.3, up * 0.25, 1).normalize();
      const ll = len * (lower ? 0.45 : 1) * (0.6 + 0.4 * Math.sin(Math.PI * t)) * (0.8 + 0.4 * r());
      const pts2 = [p.clone()]; const q = p.clone(); const d = d0.clone();
      for (let j = 1; j <= 5; j++) { d.y += up * 0.28; d.normalize(); q.addScaledVector(d, ll / 5); pts2.push(q.clone()); }
      strands.push(pts2); roots.push({ p, n: V(0, 0.3, 1).normalize(), rnd: r(), vid: ids[0], ref: V(0, 0, 0) });
    }
  }
  return { strands, roots };
}
/** Cheveux du crâne : coiffés vers l'arrière puis retombant ; masque de racines optionnel (ex. sous un casque). */
function scalpStrands(B, o) {
  const { pos, nrm } = B;
  const w = new Float32Array(NB); for (let i = 0; i < NB; i++) w[i] = H.REG[i].scalp * (o.mask ? o.mask(i) : 1);
  const roots = Hair.sampleRoots(pos, nrm, H.BTRI, w, o.count ?? 40000, o.seed ?? 9, REF);
  const len = o.len ?? 0.25;
  const anchors = o.braids ? [-1, 1].map((s) => atRef(B, s * 0.068, 1.5, -0.03, 0.01)) : null;
  const strands = Hair.grow(roots, {
    len: (r) => {
      if (anchors) { const A = anchors[r.ref.x < 0 ? 0 : 1]; return r.p.distanceTo(A) * (1.1 + 0.15 * r.rnd); }
      const R = r.ref; const front = smooth(-0.02, 0.09, R.z); return len * (0.75 + 0.3 * r.rnd) * (1 - (o.frontCut ?? 0.3) * front);
    },
    segs: o.segs ?? 24,
    dir: (r, t, p) => {
      const R = r.ref, s = Math.sign(R.x) || 1;
      if (anchors) { const A = anchors[R.x < 0 ? 0 : 1]; const d = A.clone().sub(p); const n = r.n; return d.addScaledVector(n, -d.dot(n) * 0.7).normalize(); }
      const comb = V(s * 0.45 * smooth(0.0, 0.03, Math.abs(R.x)), 0.15, -1).normalize();
      const grav = V(0, -1, -0.15);
      const g = smooth(0.0, 0.45, t);
      const tg = comb.addScaledVector(r.n, -comb.dot(r.n) + 0.05);
      return tg.multiplyScalar(1 - g).add(grav.multiplyScalar(g));
    },
    stiff: anchors ? 0.3 : 0.65, collider: B.collider, off: () => 0.004, clumps: { n: o.clumps ?? 500, amount: o.clump ?? (anchors ? 0.25 : 0.45) }, frizz: o.frizz ?? 0.12, seed: o.seed ?? 9,
  });
  return { strands, roots };
}

// ------------------------------------------------------------------ personnage
function buildBody(spec) {
  const pos = H.morph(spec.body);
  H.lowerArms(pos, spec.arms ?? 40);
  const nrm = H.baseNormals(pos);
  const collider = new Hair.Collider(pos, nrm, (i) => ry(i) > 1.0);
  return { pos, nrm, collider };
}

const STEEL = (c = 0x8e8c88, r = 0.32) => { const m = MAT.metal({ color: new THREE.Color(c).multiplyScalar(1.25), rough: r + 0.14, normal: 0.06 }); m.envMapIntensity = 3; return m; };

function character(spec, lightsW) {
  const B = buildBody(spec);
  const root = new THREE.Group();
  const parts = [];
  const add = (obj, weights) => { root.add(obj); parts.push({ obj, weights }); return obj; };
  const skinGeo = H.buildGeo(B.pos, { colors: H.skinColors(spec.look, H.cavity(B.pos, B.nrm, { strength: spec.look.ao ?? 1 })), nrm: B.nrm, extra: { skinRough: H.skinRoughness(spec.look) } });
  add(mesh(skinGeo, H.skinMaterial(spec.skinMat || {})), (k) => headW(H.SRC[k]));
  const eyes = H.eyeGeo(B.pos);
  add(mesh(eyes.geo, H.eyeMaterial(spec.iris ?? 0x5a3a20)), () => 1);
  add(mesh(eyes.cornea, H.corneaMaterial(), { cast: false }), () => 1);
  const strandObj = (S, mat) => {
    const obj = Hair.hairMesh(S.strands, S.roots, mat);
    const W = []; S.strands.forEach((s, i) => { const w = S.roots[i].hw ?? (S.roots[i].vid != null ? headW(S.roots[i].vid) : 1); for (let k = 0; k < (s.length - 1) * 2; k++) W.push(w); });
    add(obj, (k) => W[k]);
  };
  const hm = (o) => Hair.hairMaterial({ ambColor: spec.ambColor ?? (spec.cold ? 0x7080a0 : 0x907868), ...o, ambient: (o.ambient ?? 0.06) * 3.5 });
  strandObj(browStrands(B, spec.brows || {}), hm({ color: spec.brows?.color ?? 0x2a1c12, ambient: 0.05, rootDark: 0.8, spec: 0.15, grey: spec.brows?.grey ?? 0 }));
  strandObj(lashStrands(B, {}), hm({ color: 0x1a120c, ambient: 0.03, rootDark: 1, spec: 0.1 }));
  if (spec.beard) strandObj(beardStrands(B, spec.beard), hm({ color: spec.beard.color, tip: new THREE.Color(spec.beard.color).multiplyScalar(1.2), grey: spec.beard.grey ?? 0, ambient: 0.06, spec: spec.beard.spec ?? 0.3 }));
  if (spec.hair) strandObj(scalpStrands(B, spec.hair), hm({ color: spec.hair.color, tip: new THREE.Color(spec.hair.color).multiplyScalar(1.25), grey: spec.hair.grey ?? 0, ambient: 0.06, spec: 0.35 }));
  if (spec.gear) spec.gear(B, add, { strandObj, hm, root, eyes, add });
  // rotation de la tête (déformation pondérée du cou)
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(spec.pose?.pitch ?? 0), deg(spec.pose?.yaw ?? 0), deg(spec.pose?.roll ?? 0), 'YXZ'));
  const piv = V(0, 1.44, -0.005);
  for (const { obj, weights } of parts) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.geometry) return;
      if (o !== obj) { o.geometry.applyMatrix4(o.matrixWorld); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); }
      turnGeo(o.geometry, o === obj ? weights : () => 1, q, piv);
    });
    if (obj.isGroup) { const kids = []; obj.traverse((o) => { if (o !== obj && o.geometry) kids.push(o); }); kids.forEach((o) => { o.parent.remove(o); root.add(o); }); }
  }
  const eyeC = eyes.left.clone().add(eyes.right).multiplyScalar(0.5).sub(piv).applyQuaternion(q).add(piv);
  return { root, eyeC, B };
}

// ------------------------------------------------------------------ équipements
function finishShell(sh, add, mat, { tile = 0.13, uv = null, rims = [], weights = null, wrinkle = 0, seed = 1 } = {}) {
  if (wrinkle) {
    const nn = Gr.shellNormals(sh);
    for (let i = 0; i < NB; i++) if (sh.inc[i]) {
      const x = sh.pos[i * 3], y = sh.pos[i * 3 + 1], z = sh.pos[i * 3 + 2];
      const d = wrinkle * (fbm(x * 22 + seed, y * 9, z * 22, 3) + 0.6 * Math.abs(fbm(x * 40, y * 14 + seed, z * 40, 2)));
      for (let c = 0; c < 3; c++) sh.pos[i * 3 + c] += nn[i * 3 + c] * d;
    }
  }
  const loops = Gr.boundaryLoops(sh.tri);
  for (const L of loops) Gr.smoothLoop(sh.pos, L, 30);
  const g = Gr.shellGeo(sh, { tile, uv: uv || Gr.cylUV(0, 0, 0.15) });
  const W = weights || ((i) => headW(i));
  add(mesh(g, mat), (k) => W(g.userData.ids[k]));
  // ourlets : rims = [{ pick(loopCentroidRef) -> bool, r, mat }]
  for (const L of loops) {
    const c = V(0, 0, 0); L.forEach((i) => c.add(V(rx(i), ry(i), rz(i)))); c.multiplyScalar(1 / L.length);
    for (const rm of rims) if (rm.pick(c)) {
      const pts = Gr.loopPoints(sh.pos, L);
      const tube = Gr.rimTube(pts, rm.r, rm.mat);
      // poids de rotation de la tête : celui du sommet de la boucle le plus proche
      const P = tube.geometry.attributes.position; const ww = new Float32Array(P.count);
      for (let k = 0; k < P.count; k++) { let best = 0, bd = 1e9; for (let j = 0; j < pts.length; j += 2) { const d = pts[j].distanceToSquared(V(P.getX(k), P.getY(k), P.getZ(k))); if (d < bd) { bd = d; best = j; } } ww[k] = W(L[best]); }
      add(tube, (k) => ww[k]);
      break;
    }
  }
  return g;
}
function coif(B, add, { mat, rimMat, open = {}, capeY = 1.335, headOff = 0.011 } = {}) {
  const sh = Gr.shell(B, {
    include: (i) => ry(i) > capeY + 0.45 * Math.max(0, Math.abs(rx(i)) - 0.1) && !Gr.faceHole(i, open) && !(Math.abs(rx(i)) > 0.165 && ry(i) < 1.38),
    offset: (i) => { const neck = smooth(1.36, 1.41, ry(i)) * smooth(1.5, 1.44, ry(i)); const ear = smooth(0.05, 0.07, Math.abs(rx(i))) * smooth(1.47, 1.5, ry(i)); return headOff + 0.024 * neck * smooth(-0.04, 0.06, rz(i)) + 0.012 * ear + 0.02 * smooth(1.42, 1.36, ry(i)); },
    iters: 30, k: 0.5, minOff: 0.007,
  });
  return finishShell(sh, add, mat, { wrinkle: 0.005, rims: [{ pick: (c) => c.z > 0.05 && c.y > 1.45, r: 0.0045, mat: rimMat || mat }, { pick: () => true, r: 0.004, mat }] });
}
function torsoShell(B, add, { mat, off = 0.008, sleeves = true, top = 1.43, bottom = 0.9, tile = 0.13, uv = null, rimMat = null, rimR = 0.004 }) {
  const sh = Gr.shell(B, {
    include: (i) => ry(i) < top && ry(i) > bottom && (sleeves || !(Math.abs(rx(i)) > 0.168 && ry(i) < 1.385)),
    offset: () => off, iters: 6, k: 0.4, minOff: off * 0.7,
  });
  return finishShell(sh, add, mat, { tile, uv, rims: rimMat ? [{ pick: () => true, r: rimR, mat: rimMat }] : [] });
}
const surcoatUV = (i) => [Math.atan2(rx(i), rz(i)) * 0.15 + 0.5, (ry(i) - 0.99) / 0.5];
const nearestRef = (x, y, z) => { let best = 0, bd = 1e9; for (let i = 0; i < NB; i++) { const d = (rx(i) - x) ** 2 + (ry(i) - y) ** 2 + (rz(i) - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
const atRef = (B, x, y, z, off = 0) => { const i = nearestRef(x, y, z); return V(B.pos[i * 3] + B.nrm[i * 3] * off, B.pos[i * 3 + 1] + B.nrm[i * 3 + 1] * off, B.pos[i * 3 + 2] + B.nrm[i * 3 + 2] * off); };

/** Cuir, tissus courants */
const leather = (c) => MAT.leather({ color: c, rep: [3, 3] });
const silk = (c, o = {}) => Gr.clothMat(c, { sheen: 0.9, roughness: 0.75, ...o });
const wool = (c, o = {}) => Gr.clothMat(c, { roughness: 0.95, ...o });

/** Mantelet de fourrure : coque sur les épaules + poils en mèches. */
function furMantle(B, add, X, { color = 0x6a5a48, tip = null, len = 0.04, count = 70000, top = 1.44, bottom = 1.2, off = 0.03, seed = 3 } = {}) {
  const sh = Gr.shell(B, {
    include: (i) => ry(i) < top && ry(i) > bottom + 0.6 * Math.max(0, 0.16 - Math.abs(rx(i))) * smooth(-0.02, 0.06, rz(i)) && !(Math.abs(rx(i)) > 0.168 && ry(i) < 1.3),
    offset: (i) => off * (1 + 0.6 * smooth(1.40, 1.44, ry(i))), iters: 10, k: 0.5, minOff: off * 0.8,
  });
  finishShell(sh, add, MAT.plain(new THREE.Color(color).multiplyScalar(0.7), 1), { wrinkle: 0.006 });
  const nn = Gr.shellNormals(sh);
  const w = new Float32Array(NB); for (let i = 0; i < NB; i++) w[i] = sh.inc[i] ? 1 : 0;
  const roots = Hair.sampleRoots(sh.pos, nn, sh.tri, w, count, seed, REF);
  const strands = Hair.grow(roots, {
    len: (r) => len * (0.55 + 0.7 * r.rnd) * (1 + 0.5 * smooth(1.38, 1.44, r.ref.y)), segs: 7,
    dir: (r, t) => r.n.clone().multiplyScalar(0.9 - 0.5 * t).add(V(0, -0.8 - t, 0.1)),
    stiff: 0.5, collider: B.collider, off: () => off * 0.7, clumps: { n: 2500, amount: 0.45 }, frizz: 0.3, seed,
  });
  X.strandObj({ strands, roots }, Object.assign(X.hm({ color, tip: tip ?? new THREE.Color(color).multiplyScalar(1.3), ambient: 0.1, rootDark: 0.55, spec: 0.1, shadowSoft: 1.0 })));
}
/** Cape dans le dos, tombant des épaules. */
function cloak(B, add, { mat, off = 0.04 } = {}) {
  const sh = Gr.shell(B, {
    include: (i) => ry(i) < 1.43 && ry(i) > 0.9 && (rz(i) < -0.01 + 0.5 * Math.max(0, ry(i) - 1.33) || (ry(i) > 1.33 && Math.abs(rx(i)) > 0.1)) && !(Math.abs(rx(i)) > 0.168 && ry(i) < 1.3 && rz(i) > -0.02),
    offset: () => off, iters: 16, k: 0.5, minOff: off * 0.8,
  });
  finishShell(sh, add, mat, { wrinkle: 0.01 });
}
/** Baudrier / courroie en travers de la poitrine. */
function strap(B, add, { from = [0.13, 1.38, 0.0], to = [-0.12, 1.0, 0.1], w = 0.024, off = 0.03, mat, buckle = null } = {}) {
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(atRef(B, lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t) + 0.08 * Math.sin(Math.PI * t), off)); }
  const cv = new THREE.CatmullRomCurve3(pts); const pp = cv.getPoints(60);
  // orientation : côté = normale de la peau
  const g = sweep(pp, () => 0.0025, () => w / 2, { side: V(0, 0, 1), steps: 80, n: 8 });
  add(mesh(g, mat), () => 0);
  if (buckle) { const b = mesh(new THREE.TorusGeometry(w * 0.55, 0.003, 8, 4), buckle); b.position.copy(cv.getPointAt(0.45)); b.rotation.z = Math.PI / 4; add(b, () => 0); }
}
/** Tresse(s) de cheveux. */
function braid(X, axis, color, o = {}) {
  const S = Hair.braidStrands(axis, { width: o.width ?? 0.026, perStrand: o.per ?? 220, seed: o.seed ?? 1, twists: o.twists ?? 7, taper: o.taper ?? 0.45 });
  S.roots.forEach((r) => { r.hw = o.hw ?? 0.4; });
  X.strandObj(S, X.hm({ color, tip: new THREE.Color(color).multiplyScalar(1.2), ambient: 0.07, rootDark: 0.8, spec: 0.35 }));
  if (o.tie) { const tie = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16), o.tie); const c = new THREE.CatmullRomCurve3(axis); tie.position.copy(c.getPointAt(0.88)); tie.lookAt(c.getPointAt(0.95)); tie.rotateX(Math.PI / 2); X.add(tie, () => 0); }
}
/** Arc porté sur l'épaule (branche visible derrière l'épaule). */
function bowOnBack(B, add, { side = 1 } = {}) {
  const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20; const a = lerp(-0.9, 1.0, t); pts.push(atRef(B, side * (0.06 + 0.12 * t), 1.0 + t * 0.7, -0.1, 0).add(V(0, 0, -0.07 - 0.04 * Math.sin(Math.PI * t)))); }
  add(mesh(tubeAlongR(pts, (t) => 0.009 * (1 - 0.5 * Math.abs(t - 0.5))), MAT.wood({ color: 0x4a2a14, rep: [1, 4] })), () => 0);
}
function tubeAlongR(pts, rf) { const c = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(c, 64, 1, 10, false); const P = g.attributes.position, N = g.attributes.normal; for (let k = 0; k < P.count; k++) { const seg = Math.floor(k / 11) / 64; const p = c.getPointAt(Math.min(1, seg)); const n = V(N.getX(k), N.getY(k), N.getZ(k)); P.setXYZ(k, p.x + n.x * rf(seg), p.y + n.y * rf(seg), p.z + n.z * rf(seg)); } return g; }

// ------------------------------------------------------------------ fiches des personnages
const SURCOAT = (field, emblemColor, trim = null) => new THREE.MeshPhysicalMaterial({ map: Gr.surcoatTex({ field, emblem: 'sun', emblemColor, trim }), roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
function aubeKit(B, add, X, { helmC = 0x8a8884, field = '#e6e0cc', sun = '#c9962a', helmH = 0.035, shape = 'cone', mailC = 0x5a5c60, rim = 0.028 } = {}) {
  torsoShell(B, add, { mat: Gr.mailMat(mailC), off: 0.006, top: 1.41 });
  torsoShell(B, add, { mat: SURCOAT(field, sun), off: 0.018, sleeves: false, top: 1.36, tile: 1, uv: surcoatUV });
  coif(B, add, { mat: Gr.mailMat(mailC + 0x060606), rimMat: leather(0x4a2c18) });
  add(Gr.helmCap(B, { pad: 0.021, height: helmH, shape, rim, mat: STEEL(helmC, 0.26), bandMat: STEEL(helmC - 0x101010, 0.35), rivets: 20, nasal: 0.045, nasalW: 0.013 }), () => 1);
}
function sablesKit(B, add, X, { kaftan = 0x2f5a3a, turban = 0xe8dcc0, lam = '#6a5038', helmC = 0x8a8478, wraps = 6, gilt = false, mailC = 0x5e5c58, open = { cy: 1.5, ry: 0.088, rx: 0.064 } } = {}) {
  torsoShell(B, add, { mat: silk(kaftan), off: 0.005, top: 1.42 });
  torsoShell(B, add, { mat: Gr.mailMat(mailC), off: 0.011, sleeves: false, top: 1.40 });
  const lm = new THREE.MeshPhysicalMaterial({ map: Gr.lamellarTex(lam, '#4a1a10'), roughness: 0.5, metalness: 0.35, envMapIntensity: 1.6 });
  torsoShell(B, add, { mat: lm, off: 0.02, sleeves: false, top: 1.34, tile: 1, uv: (i) => [Math.atan2(rx(i), rz(i)) * 0.15 / 0.16, ry(i) / 0.12], rimMat: leather(0x3a1a10), rimR: 0.005 });
  coif(B, add, { mat: Gr.mailMat(mailC + 0x080808), open, capeY: 1.34, headOff: 0.008 });
  const helm = Gr.helmCap(B, { pad: 0.019, height: 0.07, shape: 'onion', rim: 0.03, back: 0.02, mat: gilt ? MAT.gold({ rough: 0.3 }) : STEEL(helmC, 0.3), bandMat: gilt ? MAT.gold({ rough: 0.35 }) : STEEL(0x9a8a6a, 0.3), rivets: 0 });
  add(helm, () => 1);
  // pointe
  const { toWorld, Hh } = helm.userData;
  const sp = mesh(lathe([[0.0005, 0], [0.007, 0], [0.005, 0.012], [0.0025, 0.04], [0.0004, 0.055]], 24), gilt ? MAT.gold({ rough: 0.3 }) : MAT.gold({ rough: 0.35 }));
  sp.geometry.translate(0, Hh * 0.97, 0); sp.geometry.applyMatrix4(toWorld); add(sp, () => 1);
  if (wraps) {
    add(Gr.turbanWraps(helm, { cloth: silk(turban, { roughness: 0.85 }), wraps, seed: wraps }), () => 1);
    // joyau à l'étoile sur le devant du turban
    const j = Gr.brooch({ emblem: 'star', color: '#e8c060', field: '#1f4a2c', r: 0.014, metal: MAT.gold({ rough: 0.3 }) });
    const { ax, az } = helm.userData; const p = V(0, 0.03, az * 1.2).applyMatrix4(toWorld);
    j.position.copy(p); j.lookAt(p.clone().add(helm.userData.ez)); add(j, () => 1);
  }
}
function givreKit(B, add, X, { tunic = 0x3a5a8a, mail = true, fur = 0x6a5a48, furTip = null, cloakC = 0x2a3a5a, furLen = 0.04, broochAt = [0.09, 1.33, 0.1] } = {}) {
  torsoShell(B, add, { mat: wool(tunic), off: 0.005, top: 1.42 });
  if (mail) torsoShell(B, add, { mat: Gr.mailMat(0x5a5c62), off: 0.012, sleeves: false, top: 1.39 });
  if (cloakC) cloak(B, add, { mat: wool(cloakC), off: 0.022 });
  furMantle(B, add, X, { color: fur, tip: furTip, len: furLen, off: 0.04 });
  const br = Gr.brooch({ emblem: 'raven', color: '#d8dce4', field: '#2a3a5a', r: 0.02, metal: MAT.metal({ color: 0xb8bcc4, rough: 0.25 }) });
  const p = atRef(B, ...broochAt, 0.075); br.position.copy(p); br.lookAt(p.clone().add(V(0.15, 0.1, 1))); add(br, () => 0);
}

const SPECS = {
  'aube-1': { // jeune chevalier imberbe
    body: { gender: 1, age: 25, race: { caucasian: 1 }, muscle: 0.6, face: { 'chin-prominent': 0.3, 'nose-scale-vert': 0.2, 'head-square': 0.3, 'cheek-bones': 0.3 } },
    look: { skin: 0xdcae90, stubble: 0.25, stubbleColor: 0x5a4030, seed: 3 },
    iris: 0x6a90b8, brows: { color: 0x4a3020 },
    pose: { yaw: 8, pitch: 2 }, bodyYaw: -24,
    gear: (B, add, X) => aubeKit(B, add, X, {}),
  },
  'aube-2': { // vétéran grisonnant, barbe grise, balafre
    body: { gender: 1, age: 58, race: { caucasian: 1 }, muscle: 0.65, weight: 0.55, face: { 'nose-hump': 0.6, 'nose-scale-horiz': 0.2, 'nose-volume': 0.3, 'chin-width': 0.3, 'head-square': 0.5, 'eyebrows-trans-down': 0.4, 'mouth-angles-down': 0.4, 'head-age': 0.6, 'eye-bag': 0.6, 'cheek-volume': -0.3 } },
    look: { skin: 0xd09a80, weather: 0.6, scar: [0.034, 1.58, 0.052, 1.515], stubble: 0.9, stubbleColor: 0x6a6460, seed: 7, ao: 1.2 },
    iris: 0x6a7a68, brows: { color: 0x8a8278, grey: 0.5, count: 2400, len: 0.012 },
    beard: { hole: {}, color: 0x5a5048, grey: 0.6, len: 0.035, count: 30000, chinLen: 0.6, frizz: 0.28, seed: 4 },
    pose: { yaw: -10, pitch: -2, roll: 2 }, bodyYaw: 22,
    gear: (B, add, X) => aubeKit(B, add, X, { helmC: 0x6e6a64, field: '#d8cfb8', sun: '#b8862a', mailC: 0x55534f }),
  },
  'aube-3': { // chevalière
    body: { gender: 0, age: 27, race: { caucasian: 1 }, muscle: 0.55, face: { 'nose-scale-horiz': -0.25, 'nose-point-width': -0.2, 'chin-width': -0.1, 'cheek-bones': 0.4, 'mouth-upperlip-volume': 0.3, 'mouth-lowerlip-volume': 0.2, 'eyebrows-angle': 0.2 } },
    look: { skin: 0xecc0a6, lips: 0xb05a52, lipAmt: 0.95, blushAmt: 1.3, seed: 11, liner: 1.0 },
    iris: 0x5a8a5a, brows: { color: 0x6a4a2a, count: 1100, len: 0.0075 },
    pose: { yaw: 10, pitch: 3, roll: -3 }, bodyYaw: -20,
    gear: (B, add, X) => aubeKit(B, add, X, { helmC: 0x9a9690, field: '#efe8d4', sun: '#d8a830', helmH: 0.028 }),
  },
  'aube-4': { // sergent à barbe brune
    body: { gender: 1, age: 38, race: { caucasian: 1 }, muscle: 0.7, weight: 0.65, face: { 'nose-volume': 0.4, 'nose-flaring': 0.4, 'head-round': 0.3, 'chin-prominent': -0.2, 'head-fat': 0.3, 'mouth-scale-horiz': 0.2 } },
    look: { skin: 0xd4a086, weather: 0.35, stubble: 1, stubbleColor: 0x4a3020, seed: 5 },
    iris: 0x5a4028, brows: { color: 0x4a2e1a, count: 2000 },
    beard: { hole: {}, color: 0x4a2e1a, len: 0.02, count: 32000, chinLen: 0.5, sideCut: 0.3, frizz: 0.25, seed: 8 },
    pose: { yaw: -6, pitch: 0 }, bodyYaw: 26,
    gear: (B, add, X) => aubeKit(B, add, X, { helmC: 0x7a7670, field: '#cfa94a', sun: '#f2ead6', helmH: 0.02, shape: 'cone' }),
  },
  'sables-1': { // guerrier à barbe noire, turban blanc
    body: { gender: 1, age: 32, race: { caucasian: 0.75, african: 0.1, asian: 0.15 }, muscle: 0.65, face: { 'nose-hump': 0.7, 'nose-scale-vert': 0.3, 'nose-curve': 0.3, 'eyebrows-trans-down': 0.2, 'cheek-bones': 0.3, 'head-oval': 0.3 } },
    look: { skin: 0xb07c5c, stubble: 1, stubbleColor: 0x1a120c, seed: 13, blushAmt: 0.6 },
    iris: 0x3a2414, brows: { color: 0x120c08, count: 2200, len: 0.01 },
    beard: { color: 0x120c08, len: 0.04, count: 34000, chinLen: 0.7, sideCut: 0.4, frizz: 0.3, seed: 2 },
    pose: { yaw: 8, pitch: 1 }, bodyYaw: -22,
    gear: (B, add, X) => sablesKit(B, add, X, {}),
  },
  'sables-2': { // ancien, peau sombre, barbe poivre et sel, turban vert, casque doré
    body: { gender: 1, age: 54, race: { african: 0.45, caucasian: 0.55 }, muscle: 0.55, weight: 0.6, face: { 'nose-scale-horiz': 0.3, 'nose-flaring': 0.3, 'head-age': 0.5, 'mouth-lowerlip-volume': 0.3, 'eye-bag': 0.4, 'chin-width': 0.2 } },
    look: { skin: 0x8a5a40, stubble: 1, stubbleColor: 0x2a2420, seed: 17, ao: 1.1, blushAmt: 0.4 },
    iris: 0x2a1a10, brows: { color: 0x2a2420, grey: 0.3, count: 2200 },
    beard: { color: 0x1a1612, grey: 0.35, len: 0.06, count: 34000, chinLen: 0.8, frizz: 0.3, seed: 6 },
    pose: { yaw: -8, pitch: -3 }, bodyYaw: 24,
    gear: (B, add, X) => sablesKit(B, add, X, { kaftan: 0x6a5838, turban: 0x2f6a40, lam: '#8a6a30', gilt: true, wraps: 7 }),
  },
  'sables-3': { // archère au foulard
    body: { gender: 0, age: 24, race: { caucasian: 0.7, asian: 0.15, african: 0.15 }, muscle: 0.5, face: { 'nose-hump': 0.3, 'nose-scale-horiz': -0.15, 'cheek-bones': 0.4, 'mouth-upperlip-volume': 0.3, 'eye-epicanthus': -0.2 } },
    look: { skin: 0xc48c6a, lips: 0x9a5444, lipAmt: 0.95, liner: 1.6, seed: 19, blushAmt: 0.7 },
    iris: 0x2a1a0e, brows: { color: 0x140e0a, count: 1200, len: 0.0085 },
    pose: { yaw: -12, pitch: 2, roll: 2 }, bodyYaw: 20,
    gear(B, add, X) {
      torsoShell(B, add, { mat: silk(0x3f8f5a), off: 0.005, top: 1.42 });
      const lm = new THREE.MeshPhysicalMaterial({ map: Gr.lamellarTex('#7a5a3a', '#2a4a2a'), roughness: 0.6, metalness: 0.1 });
      torsoShell(B, add, { mat: lm, off: 0.014, sleeves: false, top: 1.33, tile: 1, uv: (i) => [Math.atan2(rx(i), rz(i)) * 0.15 / 0.16, ry(i) / 0.12], rimMat: leather(0x3a1a10), rimR: 0.005 });
      coif(B, add, { mat: wool(0xc8b48a, { sheen: 0.7 }), rimMat: silk(0xb09a70), open: { cy: 1.505, ry: 0.083, rx: 0.062 }, capeY: 1.28, headOff: 0.016 });
      strap(B, add, { mat: leather(0x3a2010), from: [-0.12, 1.39, 0.0], to: [0.12, 1.0, 0.1], off: 0.05, buckle: MAT.metal({ color: 0xb08a4a, rough: 0.3 }) });
      bowOnBack(B, add, { side: 1 });
      const j = Gr.brooch({ emblem: 'star', color: '#e8c060', field: '#1f4a2c', r: 0.016, metal: MAT.gold({ rough: 0.3 }) });
      const p = atRef(B, 0.0, 1.36, 0.1, 0.05); j.position.copy(p); j.lookAt(p.clone().add(V(0, 0.2, 1))); add(j, () => 0);
    },
  },
  'sables-4': { // jeune guerrier, barbe courte
    body: { gender: 1, age: 24, race: { caucasian: 0.55, asian: 0.3, african: 0.15 }, muscle: 0.6, weight: 0.4, face: { 'nose-scale-vert': 0.2, 'nose-hump': 0.3, 'chin-prominent': 0.2, 'head-invertedtriangular': 0.4, 'cheek-volume': -0.3 } },
    look: { skin: 0xa87656, stubble: 1, stubbleColor: 0x1a120c, seed: 23 },
    iris: 0x3a2a18, brows: { color: 0x100a08, count: 1900 },
    beard: { color: 0x120c08, len: 0.012, count: 30000, chinLen: 0.5, sideCut: 0.2, mousLen: 0.8, frizz: 0.2, seed: 12 },
    pose: { yaw: 6, pitch: -2 }, bodyYaw: -26,
    gear: (B, add, X) => sablesKit(B, add, X, { kaftan: 0x8a3020, turban: 0xd8c8a0, lam: '#5a4a3a', wraps: 3, helmC: 0x9a968e }),
  },
  'givre-1': { // jarl roux, tête nue, cheveux longs et barbe tressée
    body: { gender: 1, age: 44, race: { caucasian: 1 }, muscle: 0.75, weight: 0.6, face: { 'head-square': 0.5, 'chin-width': 0.3, 'nose-scale-horiz': 0.2, 'nose-hump': 0.2, 'eyebrows-trans-down': 0.3, 'forehead-trans': 0.2 } },
    look: { skin: 0xe2ac92, freckles: 0.25, weather: 0.4, stubble: 1, stubbleColor: 0x8a4a22, seed: 29 },
    iris: 0x5a80a8, brows: { color: 0x8a4a22, count: 2100 },
    beard: { color: 0x8a4220, len: 0.07, count: 34000, chinLen: 0.9, frizz: 0.28, seed: 21 },
    hair: { color: 0x8a4220, len: 0.24, count: 42000, seed: 31 },
    pose: { yaw: 10, pitch: 2 }, bodyYaw: -22,
    gear(B, add, X) {
      givreKit(B, add, X, { fur: 0x5a4a3a, tunic: 0x3a5a8a });
      const c = atRef(B, 0, 1.43, 0.15, 0.02);
      braid(X, [c.clone().add(V(0, 0.01, 0.01)), c.clone().add(V(0, -0.06, 0.03)), c.clone().add(V(0.005, -0.14, 0.05))], 0x8a4220, { width: 0.02, per: 160, seed: 5, hw: 0.8, tie: MAT.metal({ color: 0xb8bcc4, rough: 0.3 }) });
    },
  },
  'givre-2': { // guerrier au casque à lunettes, barbe blonde
    body: { gender: 1, age: 34, race: { caucasian: 1 }, muscle: 0.7, face: { 'head-rectangular': 0.4, 'chin-prominent': 0.3, 'nose-scale-vert': 0.3, 'nose-greek': 0.3 } },
    look: { skin: 0xdca88c, weather: 0.35, stubble: 1, stubbleColor: 0xa08050, seed: 31 },
    iris: 0x7aa0c0, brows: { color: 0x9a7a48 },
    beard: { color: 0xa88450, len: 0.055, count: 34000, chinLen: 0.8, frizz: 0.25, seed: 27 },
    hair: { color: 0xa88450, len: 0.2, count: 26000, seed: 33, mask: (i) => smooth(1.6, 1.57, ry(i)) * smooth(0.02, -0.04, rz(i)) },
    pose: { yaw: -8, pitch: -1 }, bodyYaw: 24,
    gear(B, add, X, eyes) {
      givreKit(B, add, X, { fur: 0x3a2e24, tunic: 0x2a4a7a, cloakC: 0x2a3a5a, furLen: 0.03 });
      coif(B, add, { mat: Gr.mailMat(0x5c5e64), open: { cy: 1.49, ry: 0.1, rx: 0.068, zmin: -0.01 }, capeY: 1.36, headOff: 0.012 });
      const helm = Gr.helmCap(B, { pad: 0.022, height: 0.012, shape: 'round', rim: 0.026, back: 0.02, mat: STEEL(0x7a7c80, 0.3), bandMat: STEEL(0x6a6c70, 0.35), rivets: 14 });
      add(helm, () => 1);
      add(Gr.spectacles(B, X.eyes, { mat: STEEL(0x6a6c70, 0.32), pad: 0.02 }), () => 1);
      const c = atRef(B, 0, 1.42, 0.15, 0.03);
      braid(X, [c.clone().add(V(0, 0.01, 0.0)), c.clone().add(V(0, -0.05, 0.03)), c.clone().add(V(0, -0.12, 0.05))], 0xa88450, { width: 0.018, per: 150, seed: 9, hw: 0.8, tie: leather(0x3a2010) });
    },
  },
  'givre-3': { // guerrière blonde aux tresses
    body: { gender: 0, age: 26, race: { caucasian: 1 }, muscle: 0.6, face: { 'cheek-bones': 0.5, 'chin-width': -0.1, 'nose-scale-horiz': -0.2, 'nose-point-up': 0.2, 'mouth-upperlip-volume': 0.05, 'mouth-lowerlip-volume': -0.2, 'head-oval': 0.3 } },
    look: { skin: 0xe6b49a, freckles: 0.3, lips: 0xb8665e, lipAmt: 0.9, blushAmt: 1.4, seed: 37, liner: 0.9 },
    iris: 0x7aa8d0, brows: { color: 0x9a7a4a, count: 1100, len: 0.0075 },
    hair: { color: 0xc8a060, len: 0.12, count: 40000, seed: 41, braids: true },
    pose: { yaw: 10, pitch: 3, roll: -3 }, bodyYaw: -20,
    gear(B, add, X) {
      givreKit(B, add, X, { fur: 0xc8c0b4, furTip: 0xf0ece4, tunic: 0x4a6a9a, cloakC: 0x2a3a5a, furLen: 0.035 });
      for (const s of [-1, 1]) {
        const a = atRef(B, s * 0.068, 1.5, -0.03, 0.012), b = atRef(B, s * 0.1, 1.4, 0.0, 0.05), c = atRef(B, s * 0.12, 1.28, 0.07, 0.06), d = atRef(B, s * 0.11, 1.12, 0.1, 0.06);
        braid(X, [a, b, c, d], 0xc8a060, { width: 0.03, per: 260, seed: 3 + s, hw: 0.3, tie: leather(0x5a3018) });
      }
    },
  },
  'givre-4': { // vieux guerrier chauve, longue barbe blanche
    body: { gender: 1, age: 66, race: { caucasian: 1 }, muscle: 0.5, weight: 0.5, face: { 'head-age': 0.8, 'nose-hump': 0.4, 'nose-scale-vert': 0.3, 'nose-point-down': 0.3, 'eye-bag': 0.8, 'eyebrows-trans-down': 0.5, 'cheek-volume': -0.5, 'mouth-angles-down': 0.3 } },
    look: { skin: 0xd8a088, weather: 0.6, stubble: 0.8, stubbleColor: 0xb0aca4, seed: 43, ao: 1.3, scalpShade: 0 },
    iris: 0x8aa0b0, brows: { color: 0xc8c4bc, count: 1600, len: 0.012 },
    beard: { color: 0xd0ccc4, len: 0.11, count: 36000, chinLen: 1.0, frizz: 0.3, seed: 45, spec: 0.4 },
    hair: { color: 0xd0ccc4, len: 0.14, count: 20000, seed: 47, mask: (i) => smooth(1.585, 1.565, ry(i)) * smooth(0.02, -0.03, rz(i)) },
    pose: { yaw: -8, pitch: -3 }, bodyYaw: 22,
    gear(B, add, X) {
      givreKit(B, add, X, { fur: 0x2e2620, tunic: 0x34445e, cloakC: 0x3a3a44, furLen: 0.045, mail: true });
      const c = atRef(B, 0, 1.42, 0.15, 0.05);
      braid(X, [c.clone().add(V(0, -0.03, 0.01)), c.clone().add(V(0, -0.1, 0.03)), c.clone().add(V(0, -0.2, 0.05))], 0xd0ccc4, { width: 0.022, per: 170, seed: 13, hw: 0.6, tie: MAT.metal({ color: 0xb08a4a, rough: 0.3 }) });
    },
  },
};

// ------------------------------------------------------------------ scène
function portraitEnv(faction, side) {
  const sc = new THREE.Scene();
  const warm = faction !== 'givre';
  sc.background = new THREE.Color(warm ? 0x16120f : 0x0e1218);
  const panel = (color, k, pos, size) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); sc.add(m); };
  panel(warm ? 0xfff0e0 : 0xe0e8ff, 6, V(side * 3, 3, 3), [3, 3]);          // clé
  panel(warm ? 0xff9a50 : 0x8ab0ff, 5, V(-side * 4, 2, -3), [1.5, 4]);     // contre-jour
  panel(0x4a5a7a, 1.2, V(-side * 4, 0.5, 3), [3, 2]);                      // débouchage froid
  panel(warm ? 0x6a3a1a : 0x283040, 1, V(0, -3, 0), [8, 8]);               // sol
  panel(warm ? 0x8a7a6a : 0x6a7080, 0.9, V(0.4 * side, 0.6, 4), [5, 3]);     // réflecteur côté caméra
  panel(warm ? 0x9a8a78 : 0x7a8498, 0.8, V(0, 4.5, 1.5), [6, 4]);            // plafond diffus
  return envFromScene(sc, 0.04);
}
function lightRig(scene, faction, side) {
  const warm = faction !== 'givre';
  const keyP = V(side * 1.3, 2.5, 1.7), rimP = V(-side * 1.6, 2.1, -1.4), fillP = V(-side * 1.8, 1.3, 1.6);
  const keyC = warm ? 0xffd8b0 : 0xfff0e2, rimC = warm ? 0xffb070 : 0x9ab8ff, fillC = warm ? 0x6070a0 : 0x504860;
  const k = sun(scene, { intensity: 2.4, color: keyC, pos: keyP, target: V(0, 1.45, 0), size: 0.5, radius: 5, mapSize: 2048, bias: -0.0004 });
  k.shadow.normalBias = 0.004;
  const r = new THREE.DirectionalLight(rimC, 3.2); r.position.copy(rimP); scene.add(r);
  const f = new THREE.DirectionalLight(fillC, 0.5); f.position.copy(fillP); scene.add(f);
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x302018, 0.15));
  return [{ dir: keyP.clone().normalize(), color: keyC, intensity: 2.4 }, { dir: rimP.clone().normalize(), color: rimC, intensity: 3.2 }, { dir: fillP.clone().normalize(), color: fillC, intensity: 0.5 }];
}

export function renderPortrait(id, { close = false } = {}) {
  const spec = SPECS[id];
  const [faction, vs] = id.split('-'); const variant = +vs - 1;
  const scene = new THREE.Scene();
  const side = spec.bodyYaw < 0 ? 1 : -1;
  const lightsW = lightRig(scene, faction, side);
  spec.cold = faction === 'givre';
  const { root, eyeC } = character(spec, lightsW);
  const holder = new THREE.Group(); holder.add(root); holder.rotation.y = deg(spec.bodyYaw); scene.add(holder);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.25), new THREE.MeshBasicMaterial({ map: Gr.backdrop(faction, variant), toneMapped: false }));
  bg.position.set(0, 1.4, -2.5); bg.userData.noEdge = true; scene.add(bg);
  scene.environment = portraitEnv(faction, side); scene.environmentIntensity = 0.35;
  const e = eyeC.clone().applyAxisAngle(V(0, 1, 0), deg(spec.bodyYaw));
  const cam = new THREE.PerspectiveCamera(21, 0.8, 0.05, 20);
  if (close) { cam.position.set(e.x, e.y - 0.03, e.z + 0.75); cam.lookAt(e.x, e.y - 0.03, e.z); }
  else { cam.position.set(e.x * 0.6, e.y + 0.03, 1.28); cam.lookAt(e.x * 0.6, e.y - 0.04, 0); }
  return capture({ scene, camera: cam, w: 512, h: 640, grade: { vignette: 0.45, contrast: 1.04, sat: 0.95 }, exposure: 0.95 });
}

export function register(job) {
  for (const id of Object.keys(SPECS)) {
    job(`portraits/${id}.jpg`, 512, 640, () => renderPortrait(id), { div: 1, ss: 2, post: 'paint' });
    job(`_close/${id}.png`, 512, 640, () => renderPortrait(id, { close: true }), { div: 1, ss: 2, post: 'raw' });
  }
}
export { SPECS };
