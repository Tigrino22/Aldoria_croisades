// Humain réaliste pour les portraits : maillage de base MakeHuman (CC0), cibles de morphose,
// pose des bras, yeux ajustés, peau peinte par régions, coques de vêtements, poils en mèches.
import { THREE, fbm, noise3, smooth, clamp, lerp, V, deg, rng, tex } from './lib.js';

const meta = await (await fetch('/assets/mh/mh.json')).json();
const BUF = await (await fetch('/assets/mh/mh.bin')).arrayBuffer();
const part = (n) => { const [o, len, t] = meta.parts[n]; const C = { float32: Float32Array, uint16: Uint16Array, uint32: Uint32Array }[t]; return new C(BUF, o, len); };
const BASE = part('base'), SRC = part('src'), UV = part('uv'), INDEX = part('index');
const EYE_SRC = part('eyeSrc'), EYE_UV = part('eyeUv'), EYE_INDEX = part('eyeIndex'), CORNEA_INDEX = part('corneaIndex');
const NB = meta.nBase, NV = meta.nVerts;
const TARGETS = {};
for (const t of meta.targets) if (t.n) TARGETS[t.name] = { idx: new Uint16Array(BUF, t.offset, t.n), d: new Int16Array(BUF, t.offset + t.n * 2, t.n * 3), t };
const LIFT = 0.817; // pieds à y=0

// faces du maillage de base (indices « src ») pour normales lisses sans coutures
const BTRI = new Uint32Array(INDEX.length);
for (let i = 0; i < INDEX.length; i++) BTRI[i] = SRC[INDEX[i]];
// voisinage (lissage)
const NEI = Array.from({ length: NB }, () => new Set());
for (let i = 0; i < BTRI.length; i += 3) for (let k = 0; k < 3; k++) { const a = BTRI[i + k], b = BTRI[i + (k + 1) % 3]; NEI[a].add(b); NEI[b].add(a); }
const NEIA = NEI.map((s) => Int32Array.from(s));

/** Coordonnées de base (non déformées), en mètres, pieds à 0 : servent à définir les régions du visage. */
export const REF = new Float32Array(NB * 3);
for (let i = 0; i < NB; i++) { REF[i * 3] = BASE[i * 3]; REF[i * 3 + 1] = BASE[i * 3 + 1] + LIFT; REF[i * 3 + 2] = BASE[i * 3 + 2]; }

function addTarget(pos, name, w) {
  const T = TARGETS[name]; if (!T || !w) return;
  const s = T.t.scale * w, idx = T.idx, d = T.d;
  for (let k = 0; k < idx.length; k++) { const i = idx[k] * 3; pos[i] += d[k * 3] * s; pos[i + 1] += d[k * 3 + 1] * s; pos[i + 2] += d[k * 3 + 2] * s; }
}

/**
 * Morphose. p = { gender 0..1 (1 = homme), age en années (25..90), muscle 0..1, weight 0..1,
 *   race: {african, asian, caucasian}, face: { 'nose-hump': 0.4, 'chin-width': -0.3, 'head-square': 0.5, ... } }
 */
export function morph(p) {
  const pos = new Float32Array(BASE);
  const male = p.gender ?? 1, female = 1 - male;
  const a = clamp(((p.age ?? 25) - 25) / 65);
  const old = a, young = 1 - a;
  const r = p.race || { caucasian: 1 }; const rs = (r.african || 0) + (r.asian || 0) + (r.caucasian || 0) || 1;
  for (const race of ['african', 'asian', 'caucasian']) for (const [g, gw] of [['male', male], ['female', female]]) for (const [ag, aw] of [['young', young], ['old', old]])
    addTarget(pos, `${race}-${g}-${ag}`, (r[race] || 0) / rs * gw * aw);
  const m = p.muscle ?? 0.5, wt = p.weight ?? 0.5;
  const mW = { maxmuscle: Math.max(0, m - 0.5) * 2, minmuscle: Math.max(0, 0.5 - m) * 2 }, wW = { maxweight: Math.max(0, wt - 0.5) * 2, minweight: Math.max(0, 0.5 - wt) * 2 };
  for (const [g, gw] of [['male', male], ['female', female]]) for (const [ag, aw] of [['young', young], ['old', old]]) {
    for (const k in mW) addTarget(pos, `universal-${g}-${ag}-${k}-averageweight`, gw * aw * mW[k] * (1 - wW.maxweight - wW.minweight));
    for (const k in wW) addTarget(pos, `universal-${g}-${ag}-averagemuscle-${k}`, gw * aw * wW[k] * (1 - mW.maxmuscle - mW.minmuscle));
  }
  for (const [k, v] of Object.entries(p.face || {})) {
    const names = TARGETS[k] ? [k] : [];
    const pick = (suf) => [`${k}-${suf}`, `l-${k}-${suf}`, `r-${k}-${suf}`].filter((n) => TARGETS[n]);
    if (!names.length) {
      const pairs = [['incr', 'decr'], ['up', 'down'], ['in', 'out'], ['forward', 'backward'], ['convex', 'concave'], ['compress', 'uncompress']];
      for (const [pp, nn] of pairs) { const a1 = pick(pp), a2 = pick(nn); if (a1.length || a2.length) { (v > 0 ? a1 : a2).forEach((n) => addTarget(pos, n, Math.abs(v))); break; } }
      if (!pairs.some(([pp, nn]) => pick(pp).length || pick(nn).length)) { const l = [`l-${k}`, `r-${k}`].filter((n) => TARGETS[n]); l.forEach((n) => addTarget(pos, n, v)); }
    } else addTarget(pos, k, v);
  }
  for (let i = 0; i < NB; i++) pos[i * 3 + 1] += LIFT;
  return pos;
}

/** Abaisse les bras (pose A -> bras le long du corps) par rotation autour de l'épaule, pondérée. */
export function lowerArms(pos, angle = 40) {
  for (const s of [-1, 1]) {
    // pivot : centre de l'articulation de l'épaule, mesuré sur le maillage déformé
    const S = V(0, 0, 0); let n = 0;
    for (let i = 0; i < NB; i++) { const x = REF[i * 3] * s, y = REF[i * 3 + 1]; if (x > 0.15 && x < 0.2 && y > 1.33 && y < 1.41) { S.x += pos[i * 3]; S.y += pos[i * 3 + 1]; S.z += pos[i * 3 + 2]; n++; } }
    S.multiplyScalar(1 / n);
    const RS = V(s * 0.172, 1.37, -0.01);
    const dir = V(s * 0.64, -0.77, 0).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -s * deg(angle));
    const v = V(0, 0, 0), r = V(0, 0, 0), qi = new THREE.Quaternion();
    for (let i = 0; i < NB; i++) {
      const rx = REF[i * 3], ry = REF[i * 3 + 1], rz = REF[i * 3 + 2];
      if (s * rx < 0.09 || ry > 1.5) continue;
      r.set(rx, ry, rz).sub(RS);
      const t = r.dot(dir);
      const w = smooth(-0.06, 0.06, t) * smooth(0.1, 0.17, s * rx);
      if (w <= 0) continue;
      qi.identity().slerp(q, w);
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(S).applyQuaternion(qi).add(S);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
  }
  return pos;
}

/** Lissage laplacien de positions (Float32Array NB*3), restreint à des poids 0..1. */
export function relax(pos, weights, iters = 10, k = 0.5) {
  const tmp = new Float32Array(pos.length);
  for (let it = 0; it < iters; it++) {
    tmp.set(pos);
    for (let i = 0; i < NB; i++) {
      const w = weights ? weights[i] : 1; if (!w) continue;
      const n = NEIA[i]; if (!n.length) continue;
      let ax = 0, ay = 0, az = 0;
      for (const j of n) { ax += tmp[j * 3]; ay += tmp[j * 3 + 1]; az += tmp[j * 3 + 2]; }
      const f = k * w / n.length;
      pos[i * 3] += (ax - n.length * tmp[i * 3]) * f; pos[i * 3 + 1] += (ay - n.length * tmp[i * 3 + 1]) * f; pos[i * 3 + 2] += (az - n.length * tmp[i * 3 + 2]) * f;
    }
  }
  return pos;
}

export function baseNormals(pos) {
  const nrm = new Float32Array(NB * 3);
  const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
  for (let i = 0; i < BTRI.length; i += 3) {
    const i0 = BTRI[i] * 3, i1 = BTRI[i + 1] * 3, i2 = BTRI[i + 2] * 3;
    a.set(pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]);
    b.set(pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]);
    c.crossVectors(a, b);
    for (const j of [i0, i1, i2]) { nrm[j] += c.x; nrm[j + 1] += c.y; nrm[j + 2] += c.z; }
  }
  for (let i = 0; i < NB; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
  return nrm;
}

/** Géométrie rendue (sommets dédoublés aux coutures UV) à partir de positions de base. faceFilter(triIndexBase) -> bool */
export function buildGeo(pos, { colors = null, filter = null, nrm = null, extra = {} } = {}) {
  nrm = nrm || baseNormals(pos);
  const P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), C = colors ? new Float32Array(NV * 3) : null;
  for (let i = 0; i < NV; i++) {
    const s = SRC[i] * 3;
    P[i * 3] = pos[s]; P[i * 3 + 1] = pos[s + 1]; P[i * 3 + 2] = pos[s + 2];
    N[i * 3] = nrm[s]; N[i * 3 + 1] = nrm[s + 1]; N[i * 3 + 2] = nrm[s + 2];
    if (C) { C[i * 3] = colors[s]; C[i * 3 + 1] = colors[s + 1]; C[i * 3 + 2] = colors[s + 2]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UV), 2));
  if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  for (const [k, arr] of Object.entries(extra)) { const A = new Float32Array(NV); for (let i = 0; i < NV; i++) A[i] = arr[SRC[i]]; g.setAttribute(k, new THREE.BufferAttribute(A, 1)); }
  let idx = INDEX;
  if (filter) { const out = []; for (let i = 0; i < INDEX.length; i += 3) if (filter(BTRI[i], BTRI[i + 1], BTRI[i + 2])) out.push(INDEX[i], INDEX[i + 1], INDEX[i + 2]); idx = new Uint32Array(out); }
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  return g;
}

/** Yeux (proxy MakeHuman) ajustés sur les positions déformées. */
export function eyeGeo(pos) {
  const E = meta.eyes; const sc = {};
  for (const k of ['x', 'y', 'z']) { const [a, b, den] = E.scales[k]; const ax = { x: 0, y: 1, z: 2 }[k]; sc[k] = Math.abs(pos[a * 3 + ax] - pos[b * 3 + ax]) / den; }
  const ev = E.refs.map(([a, b, c, wa, wb, wc, dx, dy, dz]) => [
    wa * pos[a * 3] + wb * pos[b * 3] + wc * pos[c * 3] + dx * 0.1 * sc.x,
    wa * pos[a * 3 + 1] + wb * pos[b * 3 + 1] + wc * pos[c * 3 + 1] + dy * 0.1 * sc.y,
    wa * pos[a * 3 + 2] + wb * pos[b * 3 + 2] + wc * pos[c * 3 + 2] + dz * 0.1 * sc.z]);
  const P = new Float32Array(EYE_SRC.length * 3);
  EYE_SRC.forEach((s, i) => { P[i * 3] = ev[s][0]; P[i * 3 + 1] = ev[s][1]; P[i * 3 + 2] = ev[s][2]; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(EYE_UV), 2));
  const cg = g.clone();
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(EYE_INDEX), 1));
  g.computeVertexNormals();
  cg.setIndex(new THREE.BufferAttribute(new Uint32Array(CORNEA_INDEX), 1));
  cg.computeVertexNormals();
  // centres des deux yeux
  const L = V(0, 0, 0), R = V(0, 0, 0); let nl = 0, nr = 0;
  for (const p of ev) { if (p[0] > 0) { L.x += p[0]; L.y += p[1]; L.z += p[2]; nl++; } else { R.x += p[0]; R.y += p[1]; R.z += p[2]; nr++; } }
  L.multiplyScalar(1 / nl); R.multiplyScalar(1 / nr);
  return { geo: g, cornea: cg, left: L, right: R };
}

export { NB, NV, NEIA, BTRI, SRC };

// ------------------------------------------------------------------ repères anatomiques (coordonnées de base)
const REYE = eyeGeo(REF); REYE.geo.dispose(); REYE.cornea.dispose();
export const LM = { eyeL: REYE.left, eyeR: REYE.right, eyeY: (REYE.left.y + REYE.right.y) / 2, noseTip: V(0, 1.511, 0.168), mouth: V(0, 1.479, 0.152), chin: V(0, 1.44, 0.15), top: 1.666 };
const g2 = (d2, s) => Math.exp(-d2 / (2 * s * s));
/** Poids de régions du visage pour le sommet de base i (coordonnées REF). */
export function region(i) {
  const x = REF[i * 3], y = REF[i * 3 + 1], z = REF[i * 3 + 2], ax = Math.abs(x);
  const front = smooth(0.0, 0.07, z);
  const head = smooth(1.40, 1.45, y);
  const lipY = y - 1.4785;
  const lips = smooth(1, 0.7, Math.hypot(x / 0.026, lipY / (0.0125 * (1 - 0.6 * (ax / 0.026) ** 2) + 1e-4))) * smooth(0.125, 0.14, z) * (ax < 0.027 ? 1 : 0);
  const eyeD = Math.hypot(ax - Math.abs(LM.eyeL.x), (y - LM.eyeY) * 1.2);
  const socket = g2(eyeD * eyeD, 0.017) * front * head;
  const lid = g2(eyeD * eyeD, 0.011) * front;
  const cheek = g2((ax - 0.048) ** 2 + (y - 1.515) ** 2, 0.016) * front;
  const nose = g2(x * x + (y - 1.51) ** 2 + (z - 0.165) ** 2, 0.012);
  const ear = smooth(0.06, 0.07, ax) * smooth(1.49, 1.51, y) * smooth(1.6, 1.58, y) * smooth(-0.03, 0.0, z) * smooth(0.06, 0.03, z);
  // zone de barbe : sous le nez, joues basses, mâchoire, haut du cou
  const jawFrontY = lerp(1.499, 1.548, smooth(0.028, 0.07, ax)); // remonte en diagonale vers les favoris
  let beard = smooth(jawFrontY + 0.003, jawFrontY - 0.005, y) * smooth(1.385, 1.415, y) * smooth(-0.035, 0.0, z) * (1 - lips * 0.97) * smooth(0.082, 0.072, ax);
  beard *= 1 - smooth(0.5, 1, lips);
  const mous = smooth(1.5, 1.493, y) * smooth(1.484, 1.489, y) * smooth(0.035, 0.022, ax) * smooth(0.12, 0.14, z);
  const chin = smooth(1.47, 1.455, y) * smooth(1.40, 1.43, y) * smooth(0.04, 0.0, ax) * front;
  const by = LM.eyeY + 0.027 + 0.008 * Math.sin(clamp((ax - 0.01) / 0.055) * Math.PI * 0.9) - 0.004 * smooth(0.02, 0.01, ax);
  const bh = lerp(0.0055, 0.003, clamp((ax - 0.01) / 0.055));
  const brow = smooth(bh, bh * 0.4, Math.abs(y - by)) * smooth(0.008, 0.014, ax) * smooth(0.066, 0.058, ax) * smooth(0.06, 0.1, z);
  const scalp = smooth(1.585, 1.62, y + 0.25 * smooth(0.02, -0.09, z) - 0.03 * smooth(0.05, 0.075, ax)) ;
  return { x, y, z, ax, lips, socket, lid, cheek, nose, ear, beard: clamp(beard), mous, chin, brow, scalp, front, head };
}
const REG = Array.from({ length: NB }, (_, i) => region(i));
export { REG };

/** Tourne la tête (lacet, tangage, roulis en degrés) autour de la base du cou. */
export function turnHead(pos, yaw = 0, pitch = 0, roll = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(pitch), deg(yaw), deg(roll), 'YXZ'));
  const piv = V(0, 1.44, -0.005), v = V(0, 0, 0), qi = new THREE.Quaternion();
  for (let i = 0; i < NB; i++) {
    const w = smooth(1.37, 1.46, REF[i * 3 + 1]) * (1 - smooth(0.085, 0.12, Math.abs(REF[i * 3])));
    if (w <= 0) continue;
    qi.identity().slerp(q, w);
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(piv).applyQuaternion(qi).add(piv);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  return pos;
}

// ------------------------------------------------------------------ peau
const lin = (hex) => new THREE.Color(hex); // Color() convertit sRGB -> linéaire
/** Couleurs de peau par sommet (linéaires). look = { skin, lips, blush, stubble (0..1), stubbleColor, age 0..1, seed, brows } */
export function skinColors(look, cav = null) {
  const C = new Float32Array(NB * 3);
  const base = lin(look.skin), lipC = lin(look.lips ?? 0xa05a50), red = lin(look.blush ?? 0xc06050), dark = base.clone().multiplyScalar(0.55).lerp(lin(0x6a4a50), 0.3);
  const stub = lin(look.stubbleColor ?? 0x3a3530);
  const c = new THREE.Color();
  const sd = look.seed || 1;
  for (let i = 0; i < NB; i++) {
    const R = REG[i];
    c.copy(base);
    const n = fbm(R.x * 40 + sd, R.y * 40, R.z * 40, 4), n2 = fbm(R.x * 140, R.y * 140 + sd, R.z * 140, 3);
    c.multiplyScalar(1 + 0.07 * n + 0.04 * n2);
    c.lerp(red, clamp(0.28 * R.cheek * (look.blushAmt ?? 1) + 0.3 * R.nose + 0.35 * R.ear + 0.12 * R.lid + 0.08 * Math.max(0, n)));
    c.lerp(dark, clamp(0.35 * R.socket * (look.socket ?? 1)));
    c.lerp(lipC, clamp(R.lips * (look.lipAmt ?? 0.85)));
    if (look.stubble) c.lerp(stub, clamp(R.beard * look.stubble * (0.75 + 0.25 * n2)));
    if (look.scalpShade) c.lerp(stub, clamp(R.scalp * look.scalpShade));
    c.lerp(lin(0x201410), clamp(LASHLINE[i] * (look.liner ?? 0.7)));
    if (look.scar) { const [x0, y0, x1, y1] = look.scar; const vx = x1 - x0, vy = y1 - y0; const t = clamp(((R.x - x0) * vx + (R.y - y0) * vy) / (vx * vx + vy * vy)); const d = Math.hypot(R.x - x0 - vx * t, R.y - y0 - vy * t); c.lerp(lin(0xd89a90), clamp(smooth(0.0022, 0.0006, d) * R.front * 0.8)); }
    if (look.freckles) c.lerp(lin(0x9a5a3a), clamp(look.freckles * smooth(0.55, 0.75, noise3(R.x * 900, R.y * 900, R.z * 900) * 0.5 + 0.5) * (0.4 + R.cheek + R.nose)));
    if (look.weather) c.lerp(lin(0xa0604a), clamp(look.weather * (0.3 * R.cheek + 0.3 * R.nose + 0.15 * R.front * smooth(1.58, 1.64, R.y))));
    if (cav) c.multiplyScalar(cav[i]);
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
  }
  return C;
}
function wrapLighting(m, wrap = [0.45, 0.2, 0.14]) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('vec3 irradiance = dotNL * directLight.color;',
      `float wNL = dot( geometryNormal, directLight.direction ); vec3 wrp = vec3(${wrap.map((x) => x.toFixed(3)).join(',')});
       vec3 irradiance = clamp( ( vec3( wNL ) + wrp ) / ( 1.0 + wrp ), 0.0, 1.0 ) * directLight.color;`);
  };
  m.customProgramCacheKey = () => 'wrap' + wrap.join();
  return m;
}
export function skinMaterial({ rough = 0.62, sheen = 0.2, spec = 0.6 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: rough, sheen, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd8c8),
    normalMap: tex('leather_n', [70, 70]), normalScale: new THREE.Vector2(0.14, 0.14), envMapIntensity: 0.6, specularIntensity: spec });
  const wrap = [0.5, 0.22, 0.15];
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float skinRough; varying float vSkinRough;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSkinRough = skinRough;');
    sh.fragmentShader = 'varying float vSkinRough;\n' + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * vSkinRough, 0.05, 1.0);')
      .replace('vec3 irradiance = dotNL * directLight.color;',
        `float wNL = dot( geometryNormal, directLight.direction ); vec3 wrp = vec3(${wrap.join(',')});
         vec3 irradiance = clamp( ( vec3( wNL ) + wrp ) / ( 1.0 + wrp ), 0.0, 1.0 ) * directLight.color;`);
  };
  m.customProgramCacheKey = () => 'skin2';
  return m;
}
/** Rugosité relative par sommet : zone T (front, nez), lèvres et pommettes plus brillantes. */
export function skinRoughness(look = {}) {
  const r = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    const R = REG[i];
    const tz = Math.exp(-((R.x / 0.03) ** 2)) * smooth(1.5, 1.53, R.y) * smooth(1.66, 1.6, R.y) * R.front;
    r[i] = clamp(1.05 - 0.35 * tz - 0.4 * R.nose - 0.45 * R.lips - 0.15 * R.cheek + (look.oily ? -0.15 : 0) + (R.beard * (look.stubble || 0)) * 0.3, 0.35, 1.3);
  }
  return r;
}
const eyeTex = new THREE.TextureLoader().loadAsync('/assets/mh/eye.jpg');
const EYETEX = await eyeTex; EYETEX.colorSpace = THREE.SRGBColorSpace;
export function eyeMaterial(iris = 0x5a3a20) {
  const m = new THREE.MeshPhysicalMaterial({ map: EYETEX, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1, color: 0xe8e0dc });
  const ic = new THREE.Color(iris);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.irisCol = { value: ic };
    sh.fragmentShader = 'uniform vec3 irisCol;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        float sat = (mx - mn) / max(mx, 1e-3); float iris = smoothstep(0.35, 0.6, sat);
        float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
        diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.8, 0.76, 0.74), irisCol * (0.12 + 1.5 * l), iris); }`);
  };
  m.customProgramCacheKey = () => 'eye' + iris;
  return m;
}
export function corneaMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

// ------------------------------------------------------------------ occlusion par courbure (cavités), ligne des cils
/** Facteur d'occlusion par sommet : creux (orbites, narines, commissures, plis) assombris, deux échelles. */
export function cavity(pos, nrm, { strength = 1 } = {}) {
  const out = new Float32Array(NB).fill(1);
  const curv = (P, scale) => {
    const c = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      const n = NEIA[i]; if (!n.length) continue;
      let ax = 0, ay = 0, az = 0, el = 0;
      for (const j of n) { ax += P[j * 3]; ay += P[j * 3 + 1]; az += P[j * 3 + 2]; el += Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]); }
      ax = ax / n.length - P[i * 3]; ay = ay / n.length - P[i * 3 + 1]; az = az / n.length - P[i * 3 + 2]; el /= n.length;
      c[i] = (ax * nrm[i * 3] + ay * nrm[i * 3 + 1] + az * nrm[i * 3 + 2]) / (el * el + 1e-9) * scale;
    }
    return c;
  };
  const blur = (c, it) => { const t = new Float32Array(NB); for (let k = 0; k < it; k++) { t.set(c); for (let i = 0; i < NB; i++) { const n = NEIA[i]; if (!n.length) continue; let s = t[i]; for (const j of n) s += t[j]; c[i] = s / (n.length + 1); } } return c; };
  const c1 = blur(curv(pos, 0.0035), 2);
  const sm = relax(new Float32Array(pos), null, 8, 0.5);
  const c2 = blur(curv(sm, 0.006), 4);
  for (let i = 0; i < NB; i++) out[i] = clamp(1 - strength * (0.55 * Math.max(0, c1[i]) + 0.9 * Math.max(0, c2[i])) + 0.12 * strength * Math.max(0, -c1[i]), 0.35, 1.08);
  return out;
}
/** Sommets du bord des paupières (repère de base) : pour chaque œil, points du bord supérieur ordonnés. */
function lidMargin(E, upper = true) {
  const cand = []; for (let i = 0; i < NB; i++) { const dx = REF[i * 3] - E.x, dy = REF[i * 3 + 1] - E.y, dz = REF[i * 3 + 2] - E.z; const d = Math.hypot(dx, dy, dz); if (d < 0.0145 && dz > 0.004) cand.push(i); }
  const s = Math.sign(E.x), pts = [];
  for (let k = 0; k <= 14; k++) {
    const a = lerp(0.12, 0.88, k / 14) * Math.PI; const tx = E.x - s * Math.cos(a) * 0.0135, ty = E.y + (upper ? 1 : -1) * Math.sin(a) * 0.0058 + 0.0005;
    let best = -1, bd = 1e9; for (const i of cand) { const d = (REF[i * 3] - tx) ** 2 + (REF[i * 3 + 1] - ty) ** 2 * 1.5; if (d < bd) { bd = d; best = i; } }
    if (!pts.includes(best)) pts.push(best);
  }
  return pts;
}
export const LIDS = [LM.eyeL, LM.eyeR].map((E) => ({ E, upper: lidMargin(E, true), lower: lidMargin(E, false) }));
const LASHLINE = new Float32Array(NB);
for (const L of LIDS) for (let i = 0; i < NB; i++) {
  let d = 1e9; for (const j of L.upper) d = Math.min(d, Math.hypot(REF[i * 3] - REF[j * 3], REF[i * 3 + 1] - REF[j * 3 + 1], REF[i * 3 + 2] - REF[j * 3 + 2]));
  let d2 = 1e9; for (const j of L.lower) d2 = Math.min(d2, Math.hypot(REF[i * 3] - REF[j * 3], REF[i * 3 + 1] - REF[j * 3 + 1], REF[i * 3 + 2] - REF[j * 3 + 2]));
  LASHLINE[i] = Math.max(LASHLINE[i], smooth(0.0035, 0.0008, d), 0.45 * smooth(0.0025, 0.0006, d2));
}
