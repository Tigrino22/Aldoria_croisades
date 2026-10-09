// Poils et cheveux en mèches (lignes fines ombrées façon Kajiya-Kay) : barbes, sourcils, chevelures, tresses.
import { THREE, smooth, clamp, lerp, V, rng, fbm, noise3 } from './lib.js';

/** Grille de collision : sommets + normales ; repousse un point hors de la surface. */
export class Collider {
  constructor(pos, nrm, keep = null, cell = 0.012) {
    this.pos = pos; this.nrm = nrm; this.cell = cell; this.map = new Map();
    const n = pos.length / 3;
    for (let i = 0; i < n; i++) {
      if (keep && !keep(i)) continue;
      const k = this.key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(i);
    }
    this.extra = [];
  }
  key(x, y, z) { const c = this.cell; return `${Math.floor(x / c)},${Math.floor(y / c)},${Math.floor(z / c)}`; }
  nearest(p) {
    const c = this.cell, X = Math.floor(p.x / c), Y = Math.floor(p.y / c), Z = Math.floor(p.z / c);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 2 && best < 0; r++)
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        const a = this.map.get(`${X + dx},${Y + dy},${Z + dz}`); if (!a) continue;
        for (const i of a) { const d = (this.pos[i * 3] - p.x) ** 2 + (this.pos[i * 3 + 1] - p.y) ** 2 + (this.pos[i * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
    return best;
  }
  /** repousse p (Vector3) à au moins `off` devant la surface la plus proche */
  push(p, off) {
    const i = this.nearest(p);
    if (i >= 0) {
      const d = (p.x - this.pos[i * 3]) * this.nrm[i * 3] + (p.y - this.pos[i * 3 + 1]) * this.nrm[i * 3 + 1] + (p.z - this.pos[i * 3 + 2]) * this.nrm[i * 3 + 2];
      if (d < off) { const k = off - d; p.x += this.nrm[i * 3] * k; p.y += this.nrm[i * 3 + 1] * k; p.z += this.nrm[i * 3 + 2] * k; }
    }
    for (const e of this.extra) e(p, off);
    return p;
  }
}

/** Tire des racines sur les triangles (indices de base) selon un poids par sommet. */
export function sampleRoots(pos, nrm, tri, weight, count, seed = 1, ref = null) {
  const r = rng(seed);
  const nt = tri.length / 3, cdf = new Float64Array(nt); let acc = 0;
  const a = V(0, 0, 0), b = V(0, 0, 0);
  for (let t = 0; t < nt; t++) {
    const i0 = tri[t * 3], i1 = tri[t * 3 + 1], i2 = tri[t * 3 + 2];
    const w = (weight[i0] + weight[i1] + weight[i2]) / 3;
    if (w > 0.001) {
      a.set(pos[i1 * 3] - pos[i0 * 3], pos[i1 * 3 + 1] - pos[i0 * 3 + 1], pos[i1 * 3 + 2] - pos[i0 * 3 + 2]);
      b.set(pos[i2 * 3] - pos[i0 * 3], pos[i2 * 3 + 1] - pos[i0 * 3 + 1], pos[i2 * 3 + 2] - pos[i0 * 3 + 2]);
      acc += a.cross(b).length() * 0.5 * w;
    }
    cdf[t] = acc;
  }
  const roots = [];
  for (let k = 0; k < count; k++) {
    const x = r() * acc; let lo = 0, hi = nt - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w0 = 1 - u - v, ids = [tri[lo * 3], tri[lo * 3 + 1], tri[lo * 3 + 2]], ws = [w0, u, v];
    const p = V(0, 0, 0), n = V(0, 0, 0), q = V(0, 0, 0); let wt = 0;
    ids.forEach((i, j) => { p.x += pos[i * 3] * ws[j]; p.y += pos[i * 3 + 1] * ws[j]; p.z += pos[i * 3 + 2] * ws[j]; n.x += nrm[i * 3] * ws[j]; n.y += nrm[i * 3 + 1] * ws[j]; n.z += nrm[i * 3 + 2] * ws[j]; wt += weight[i] * ws[j]; if (ref) { q.x += ref[i * 3] * ws[j]; q.y += ref[i * 3 + 1] * ws[j]; q.z += ref[i * 3 + 2] * ws[j]; } });
    roots.push({ p, n: n.normalize(), w: wt, ref: q, vid: ids[ws.indexOf(Math.max(...ws))], rnd: r() });
  }
  return roots;
}

/**
 * Fait pousser des mèches. opts : len(root) -> m, segs, dir(root, t, p, d) -> direction souhaitée (Vector3),
 * stiff 0..1 (inertie), collider, off(root) -> distance mini à la peau, clumps {n, amount}, frizz.
 */
export function grow(roots, { len, segs = 10, dir, stiff = 0.6, collider = null, off = () => 0.002, clumps = null, frizz = 0.15, seed = 3 }) {
  const r = rng(seed);
  const strands = [];
  const growOne = (root, L) => {
    const pts = [root.p.clone()]; let d = dir(root, 0, root.p, root.n.clone()).normalize();
    const step = L / segs; const p = root.p.clone();
    const o = off(root);
    for (let k = 1; k <= segs; k++) {
      const t = k / segs;
      const want = dir(root, t, p, d).normalize();
      d.lerp(want, 1 - stiff).normalize();
      if (frizz) d.add(V(noise3(p.x * 300 + root.rnd * 50, p.y * 300, k), noise3(p.y * 300, p.z * 300 + root.rnd * 40, k + 5), noise3(p.z * 300, p.x * 300, k + 9)).multiplyScalar(frizz)).normalize();
      p.addScaledVector(d, step);
      if (collider) collider.push(p, o * (0.6 + 0.4 * t) + 0.0005);
      pts.push(p.clone());
    }
    return pts;
  };
  for (const root of roots) strands.push(growOne(root, len(root)));
  if (clumps && clumps.n) {
    // chaque mèche est attirée vers la mèche-guide la plus proche (touffes)
    const guides = []; for (let i = 0; i < clumps.n; i++) guides.push(Math.floor(r() * roots.length));
    strands.forEach((s, i) => {
      let best = guides[0], bd = Infinity;
      for (const g of guides) { const d = roots[g].p.distanceToSquared(roots[i].p); if (d < bd) { bd = d; best = g; } }
      const G = strands[best]; if (G === s) return;
      const amt = clumps.amount * (0.6 + 0.4 * roots[i].rnd);
      for (let k = 1; k < s.length; k++) {
        const t = k / (s.length - 1); const gk = G[Math.min(k, G.length - 1)];
        const c = amt * Math.pow(t, clumps.power ?? 0.8);
        s[k].lerp(gk, c);
        if (collider) collider.push(s[k], off(roots[i]) * 0.8);
      }
    });
  }
  return strands;
}

/** Lignes -> géométrie avec tangente, paramètre t, aléa par mèche, normale de racine. */
export function strandGeo(strands, roots, { colorFn = null } = {}) {
  let n = 0; for (const s of strands) n += (s.length - 1) * 2;
  const P = new Float32Array(n * 3), T = new Float32Array(n * 3), A = new Float32Array(n * 2), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  let o = 0;
  const tg = V(0, 0, 0);
  strands.forEach((s, si) => {
    const root = roots[si]; const col = colorFn ? colorFn(root) : [1, 1, 1];
    for (let k = 0; k < s.length - 1; k++) {
      tg.subVectors(s[k + 1], s[k]).normalize();
      for (const j of [k, k + 1]) {
        P[o * 3] = s[j].x; P[o * 3 + 1] = s[j].y; P[o * 3 + 2] = s[j].z;
        T[o * 3] = tg.x; T[o * 3 + 1] = tg.y; T[o * 3 + 2] = tg.z;
        A[o * 2] = j / (s.length - 1); A[o * 2 + 1] = root.rnd;
        N[o * 3] = root.n.x; N[o * 3 + 1] = root.n.y; N[o * 3 + 2] = root.n.z;
        C[o * 3] = col[0]; C[o * 3 + 1] = col[1]; C[o * 3 + 2] = col[2];
        o++;
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('tang', new THREE.BufferAttribute(T, 3));
  g.setAttribute('ta', new THREE.BufferAttribute(A, 2));
  g.setAttribute('rootN', new THREE.BufferAttribute(N, 3));
  g.setAttribute('hcol', new THREE.BufferAttribute(C, 3));
  return g;
}

/**
 * Matériau de mèches (Kajiya-Kay) éclairé par les lumières directionnelles de la scène, avec leurs ombres portées.
 */
export function hairMaterial({ color = 0x3a2a1c, tip = null, ambient = 0.05, rootDark = 0.45, spec = 0.35, grey = 0, greyColor = 0xb0aca4, shadowSoft = 0.35, ambColor = 0x8a8078 } = {}) {
  const c = new THREE.Color(color), tc = new THREE.Color(tip ?? color), gc = new THREE.Color(greyColor);
  return new THREE.ShaderMaterial({
    lights: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      base: { value: c }, tipC: { value: tc }, greyC: { value: gc }, grey: { value: grey }, amb: { value: new THREE.Color(ambColor).multiplyScalar(ambient) }, rootDark: { value: rootDark }, specK: { value: spec }, soft: { value: shadowSoft },
    }]),
    vertexShader: `#include <common>
      #include <shadowmap_pars_vertex>
      attribute vec3 tang; attribute vec2 ta; attribute vec3 rootN; attribute vec3 hcol;
      varying vec3 vT; varying vec3 vN; varying vec2 vA; varying vec3 vViewPos; varying vec3 vC;
      void main(){
        vec3 transformedNormal = normalMatrix * rootN;
        vec4 worldPosition = modelMatrix * vec4(position, 1.);
        vec4 mvPosition = viewMatrix * worldPosition;
        vViewPos = mvPosition.xyz; vT = normalize(normalMatrix * tang); vN = normalize(transformedNormal); vA = ta; vC = hcol;
        #include <shadowmap_vertex>
        gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `#include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      uniform vec3 base, tipC, greyC, amb; uniform float grey, rootDark, specK, soft;
      varying vec3 vT; varying vec3 vN; varying vec2 vA; varying vec3 vViewPos; varying vec3 vC;
      float hh(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main(){
        vec3 T = normalize(vT); vec3 Vd = normalize(-vViewPos); vec3 N = normalize(vN);
        float t = vA.x, r = vA.y;
        vec3 alb = mix(base, tipC, t * 0.8) * vC * (0.7 + 0.6 * hh(r * 13.1));
        alb = mix(alb, greyC, step(1. - grey, hh(r * 7.7)));
        vec3 col = alb * amb;
        #if NUM_DIR_LIGHTS > 0
        DirectionalLight dl;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        DirectionalLightShadow dls;
        #endif
        #pragma unroll_loop_start
        for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) { {
          dl = directionalLights[ i ];
          float shadow = 1.0;
          #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
          dls = directionalLightShadows[ i ];
          shadow = getShadow( directionalShadowMap[ i ], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ i ] );
          #endif
          vec3 Ld = dl.direction;
          float tl = dot(T, Ld); float kd = sqrt(max(0., 1. - tl * tl));
          float sh = smoothstep(-soft, 0.6, dot(N, Ld)) * shadow;
          vec3 Hh = normalize(Ld + Vd); float th = dot(T, Hh); float ks = pow(sqrt(max(0., 1. - th * th)), 90.);
          float th2 = dot(T, normalize(Hh + 0.2 * N)); float ks2 = pow(sqrt(max(0., 1. - th2 * th2)), 18.);
          col += dl.color * sh * (alb * kd * 0.3183 * 0.85 + specK * (ks * 0.12 + ks2 * 0.06 * alb * 3.));
        } }
        #pragma unroll_loop_end
        #endif
        col *= mix(rootDark, 1., smoothstep(0., 0.6, t));
        gl_FragColor = vec4(col, 1.);
      }`,
  });
}
/** Mèches -> objet prêt à ajouter. */
export function hairMesh(strands, roots, mat, opts) {
  const l = new THREE.LineSegments(strandGeo(strands, roots, opts), mat);
  l.userData.noEdge = false; l.frustumCulled = false; l.receiveShadow = true; l.castShadow = false;
  return l;
}

/** Tresse : 3 faisceaux entrelacés le long d'un axe (liste de points). */
export function braidStrands(axis, { width = 0.022, perStrand = 140, seed = 1, twists = 6, taper = 0.5 } = {}) {
  const r = rng(seed);
  const curve = new THREE.CatmullRomCurve3(axis);
  const N = 120, frames = curve.computeFrenetFrames(N, false);
  const strands = [], roots = [];
  for (let b = 0; b < 3; b++) for (let k = 0; k < perStrand; k++) {
    const ph = b * Math.PI * 2 / 3, ox = (r() - 0.5), oy = (r() - 0.5), rr = r();
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N; const p = curve.getPointAt(t);
      const w = width * (1 - taper * Math.pow(t, 2));
      const a = t * twists * Math.PI * 2 + ph;
      // motif de tresse : sinus en x, double fréquence en y (figure en 8)
      const bx = Math.sin(a) * w * 0.5, by = Math.sin(2 * a) * w * 0.18;
      const spread = w * 0.28;
      const nn = frames.normals[i], bn = frames.binormals[i];
      pts.push(p.clone().addScaledVector(nn, bx + ox * spread).addScaledVector(bn, by + oy * spread));
    }
    strands.push(pts);
    roots.push({ p: pts[0], n: frames.binormals[0].clone(), rnd: rr, ref: V(0, 0, 0) });
  }
  return { strands, roots };
}
