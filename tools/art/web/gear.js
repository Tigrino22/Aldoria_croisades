// Équipement ajusté au corps MakeHuman : coques (maille, tissu, cuir, fourrure) tirées de la topologie du corps,
// casques ajustés au crâne, accessoires.
import { THREE, MAT, mesh, lathe, sweep, tubeAlong, canvasTex, tex, img, fbm, noise3, smooth, clamp, lerp, V, deg, rng, displace } from './lib.js';
import * as H from './human.js';
import { Collider } from './hair.js';
import { EMBLEM } from './models.js';

const REF = H.REF, NB = H.NB;
const rx = (i) => REF[i * 3], ry = (i) => REF[i * 3 + 1], rz = (i) => REF[i * 3 + 2];

/**
 * Coque : copie des sommets inclus, décalés le long de la normale, lissés, puis repoussés hors du corps.
 * include(i) -> bool ; offset(i) -> m ; relaxW(i) -> 0..1
 */
export function shell(body, { include, offset, iters = 12, relaxW = () => 1, minOff = 0.003, colliders = [], k = 0.5, extraPush = null }) {
  const { pos, nrm } = body;
  const inc = new Uint8Array(NB); for (let i = 0; i < NB; i++) inc[i] = include(i) ? 1 : 0;
  const tri = []; for (let t = 0; t < H.BTRI.length; t += 3) { const a = H.BTRI[t], b = H.BTRI[t + 1], c = H.BTRI[t + 2]; if (inc[a] && inc[b] && inc[c]) tri.push(a, b, c); }
  const P = new Float32Array(pos);
  const off = new Float32Array(NB);
  for (let i = 0; i < NB; i++) if (inc[i]) { off[i] = offset(i); P[i * 3] += nrm[i * 3] * off[i]; P[i * 3 + 1] += nrm[i * 3 + 1] * off[i]; P[i * 3 + 2] += nrm[i * 3 + 2] * off[i]; }
  const w = new Float32Array(NB); for (let i = 0; i < NB; i++) w[i] = inc[i] ? relaxW(i) : 0;
  const cols = [body.collider, ...colliders];
  const p = V(0, 0, 0);
  for (let pass = 0; pass < 3; pass++) {
    H.relax(P, w, Math.ceil(iters / 3), k);
    for (let i = 0; i < NB; i++) if (inc[i]) {
      p.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      for (const c of cols) c.push(p, Math.max(minOff, off[i] * 0.6));
      if (extraPush) extraPush(p, i);
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
    }
  }
  return { pos: P, tri: new Uint32Array(tri), inc };
}
/** Normales de la coque (indexée sur les sommets de base). */
export function shellNormals(sh) {
  const n = new Float32Array(NB * 3), a = V(0, 0, 0), b = V(0, 0, 0), P = sh.pos, T = sh.tri;
  for (let t = 0; t < T.length; t += 3) {
    const i0 = T[t] * 3, i1 = T[t + 1] * 3, i2 = T[t + 2] * 3;
    a.set(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]); b.set(P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]); a.cross(b);
    for (const j of [i0, i1, i2]) { n[j] += a.x; n[j + 1] += a.y; n[j + 2] += a.z; }
  }
  for (let i = 0; i < NB; i++) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1; n[i * 3] /= l; n[i * 3 + 1] /= l; n[i * 3 + 2] /= l; }
  return n;
}
/** Coque -> BufferGeometry compacte ; uv(i, p) -> [u, v] en mètres (divisés par `tile`). */
export function shellGeo(sh, { uv = cylUV(), tile = 0.18, thick = 0 } = {}) {
  const map = new Int32Array(NB).fill(-1); const ids = [];
  for (const i of sh.tri) if (map[i] < 0) { map[i] = ids.length; ids.push(i); }
  const nn = shellNormals(sh);
  const P = new Float32Array(ids.length * 3), N = new Float32Array(ids.length * 3), U = new Float32Array(ids.length * 2);
  ids.forEach((i, k) => {
    for (let c = 0; c < 3; c++) { P[k * 3 + c] = sh.pos[i * 3 + c]; N[k * 3 + c] = nn[i * 3 + c]; }
    const [u, v] = uv(i, sh.pos); U[k * 2] = u / tile; U[k * 2 + 1] = v / tile;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(U, 2));
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(sh.tri, (i) => map[i]), 1));
  g.userData.ids = ids;
  return g;
}
/** UV cylindriques autour de l'axe vertical (coordonnées de référence, donc stables d'un personnage à l'autre). */
export function cylUV(cx = 0, cz = 0.0, R = 0.15) {
  return (i) => { const a = Math.atan2(rx(i) - cx, rz(i) - cz); return [a * R, ry(i)]; };
}

// ------------------------------------------------------------------ régions de référence
/** ouverture du visage (coiffe, voile) */
export function faceHole(i, { cy = 1.515, ry: Ry = 0.074, rx: Rx = 0.058, zmin = 0.03 } = {}) {
  return rz(i) > zmin && ((rx(i) / Rx) ** 2 + ((ry(i) - cy) / Ry) ** 2) < 1;
}
export const isArm = (i) => Math.abs(rx(i)) > 0.17 - 0.25 * Math.max(0, 1.37 - ry(i)) * 0 && ry(i) < 1.40 && Math.abs(rx(i)) > 0.165 + Math.max(0, 1.36 - ry(i)) * 0.25;

// ------------------------------------------------------------------ textures d'équipement
const texCache = {};
/** Lamelles (petites plaques lacées) : couleur + normales approximées par l'albédo. */
export function lamellarTex(color = '#6a5a48', lace = '#5a2a1a') {
  const k = 'lam' + color + lace; if (texCache[k]) return texCache[k];
  return (texCache[k] = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#1a120c'; c.fillRect(0, 0, w, h);
    const rows = 6, cols = 12, pw = w / cols, ph = h / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols + 1; q++) {
      const x = q * pw - (r % 2) * pw * 0.5, y = r * ph;
      const gr = c.createLinearGradient(x, y, x + pw, y);
      gr.addColorStop(0, '#2a2018'); gr.addColorStop(0.15, color); gr.addColorStop(0.7, color); gr.addColorStop(1, '#2a2018');
      c.fillStyle = gr; c.beginPath(); c.roundRect(x + 2, y + 2, pw - 4, ph * 1.05, [pw * 0.45, pw * 0.45, 4, 4]); c.fill();
      c.fillStyle = 'rgba(255,240,210,0.18)'; c.fillRect(x + pw * 0.2, y + 6, pw * 0.15, ph * 0.8);
      c.fillStyle = lace; for (const yy of [0.3, 0.75]) { c.fillRect(x + pw * 0.3, y + ph * yy, pw * 0.4, 5); }
    }
    c.globalAlpha = 0.35; c.globalCompositeOperation = 'multiply'; c.drawImage(img('grime'), 0, 0, w, h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }));
}
/** Tissu teint avec emblème centré sur la poitrine : la texture couvre u in [-0.5,0.5] m autour du torse. */
export function surcoatTex({ field = '#e8e2d0', emblem = null, emblemColor = '#c9962a', trim = null, size = 1024 } = {}) {
  return canvasTex(size, size, (c, w, h) => {
    c.fillStyle = field; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5;
    for (let y = 0; y < h; y += 256) for (let x = 0; x < w; x += 256) c.drawImage(img('cloth_c'), x, y, 256, 256);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (emblem) { c.save(); const s = 0.3; c.translate(w * 0.5, h * 0.42); c.scale(s, s); c.translate(-w / 2, -h / 2); EMBLEM[emblem](c, w, h, emblemColor); c.restore(); }
    if (trim) { c.fillStyle = trim; c.fillRect(0, h * 0.02, w, h * 0.03); }
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.drawImage(img('grime'), 0, 0, w, h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  });
}
export function mail(color = 0xa8a8a6, rep = 1) {
  const m = MAT.mail({ color, rep: [rep, rep], rough: 0.42 });
  m.envMapIntensity = 0.9;
  return m;
}

// ------------------------------------------------------------------ matériaux triplanaires (pas de couture d'UV)
const TRI_GLSL = `
uniform sampler2D triTex; uniform float triScale, triBump, triDark, triRough, triMetal; uniform vec3 triTint;
varying vec3 vTriP; varying vec3 vTriN; float triH;
vec3 triPerturb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
  vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) ); vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) ); vec3 vN = surf_norm;
  vec3 R1 = cross( vSigmaY, vN ); vec3 R2 = cross( vN, vSigmaX ); float fDet = dot( vSigmaX, R1 ) * faceDirection;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 ); return normalize( abs( fDet ) * surf_norm - vGrad ); }
`;
/** Matériau physique dont le motif (albédo, relief, rugosité) est projeté en triplanaire depuis une texture en niveaux de gris. */
export function triMat({ texName = 'mail_ao', scale = 5, bump = 1, dark = 0.25, roughVar = 0.5, metalVar = 0.6, ...phys } = {}) {
  const m = new THREE.MeshPhysicalMaterial(phys);
  const t = tex(texName, [1, 1], false);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { triTex: { value: t }, triScale: { value: scale }, triBump: { value: bump }, triDark: { value: dark }, triRough: { value: roughVar }, triMetal: { value: metalVar } });
    sh.vertexShader = 'varying vec3 vTriP; varying vec3 vTriN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTriP = position; vTriN = normal;');
    sh.fragmentShader = TRI_GLSL + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 bw = pow(abs(normalize(vTriN)), vec3(4.)); bw /= (bw.x + bw.y + bw.z); vec3 p = vTriP * triScale;
          triH = texture2D(triTex, p.zy).r * bw.x + texture2D(triTex, p.xz).r * bw.y + texture2D(triTex, p.xy).r * bw.z;
          diffuseColor.rgb *= mix(triDark, 1.0, triH); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 1.0, triRough * (1.0 - triH));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= mix(1.0 - triMetal, 1.0, triH);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n { vec2 dH = vec2(dFdx(triH), dFdy(triH)) * triBump; normal = triPerturb(-vViewPosition, normal, dH, faceDirection); }');
  };
  m.customProgramCacheKey = () => 'tri' + texName;
  return m;
}
export const mailMat = (color = 0xa8a8a6, o = {}) => triMat({ texName: 'mail_ao', scale: 7, bump: 2.2, dark: 0.04, color, metalness: 1, roughness: 0.3, envMapIntensity: 3.0, ...o });
export const clothMat = (color, o = {}) => triMat({ texName: 'cloth_n', scale: 9, bump: 0.6, dark: 0.85, roughVar: 0, metalVar: 0, color, roughness: 0.92, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3), side: THREE.DoubleSide, ...o });

// ------------------------------------------------------------------ bords de coques : boucles, lissage, ourlets
export function boundaryLoops(tri) {
  const cnt = new Map();
  for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) { const a = tri[t + k], b = tri[t + (k + 1) % 3]; const key = a < b ? a * NB + b : b * NB + a; cnt.set(key, (cnt.get(key) || 0) + 1); }
  const adj = new Map();
  for (const [key, c] of cnt) if (c === 1) { const a = Math.floor(key / NB), b = key % NB; if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [start]; seen.add(start); let prev = -1, cur = start;
    for (;;) { const nx = adj.get(cur).find((v) => v !== prev && !seen.has(v)); if (nx == null) break; loop.push(nx); seen.add(nx); prev = cur; cur = nx; }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}
/** Lissage de Taubin d'une boucle (sur les positions de la coque, en place). */
export function smoothLoop(P, loop, iters = 20) {
  const n = loop.length, tmp = new Float32Array(n * 3);
  for (let it = 0; it < iters * 2; it++) {
    const f = it % 2 ? -0.53 : 0.5;
    for (let k = 0; k < n; k++) { const a = loop[(k + n - 1) % n], b = loop[k], c = loop[(k + 1) % n]; for (let j = 0; j < 3; j++) tmp[k * 3 + j] = P[b * 3 + j] + f * ((P[a * 3 + j] + P[c * 3 + j]) / 2 - P[b * 3 + j]); }
    for (let k = 0; k < n; k++) for (let j = 0; j < 3; j++) P[loop[k] * 3 + j] = tmp[k * 3 + j];
  }
}
export function loopPoints(P, loop, out = 0) { return loop.map((i) => V(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); }
export function rimTube(pts, r, mat, closed = true) {
  const c = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  return mesh(new THREE.TubeGeometry(c, Math.max(64, pts.length * 3), r, 8, closed), mat);
}

// ------------------------------------------------------------------ casques ajustés
/** Mesure du crâne (positions déformées) : centre, demi-axes, hauteur des sourcils. */
export function skull(pos) {
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, top = -1e9;
  const browY = H.LM.eyeY + 0.03;
  for (let i = 0; i < NB; i++) {
    if (ry(i) < browY || Math.abs(rx(i)) > 0.1) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); top = Math.max(top, y);
  }
  let by = 0, n = 0; for (let i = 0; i < NB; i++) if (H.REG[i].brow > 0.5) { by += pos[i * 3 + 1]; n++; }
  by /= n || 1;
  return { cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2, ax: (mxx - mnx) / 2, az: (mxz - mnz) / 2, top, browY: by };
}
/**
 * Casque ajusté : on mesure le bord (coque du crâne coupée à la ligne de bord, lissée), puis on construit une calotte
 * analytique (révolution elliptique) posée dans le plan du bord. shape : 'cone' | 'round' | 'onion'.
 */
export function helmCap(B, { pad = 0.02, rim = 0.028, back = 0.03, height = 0.02, shape = 'cone', mat, bandMat, bandR = 0.0032, bandH = 0.02, rivets = 0, rivetMat = null, nasal = 0, nasalW = 0.017 }) {
  const eyeY = H.LM.eyeY;
  const rimLine = (i) => eyeY + rim - back * smooth(0.06, -0.08, rz(i));
  const sh = shell(B, { include: (i) => ry(i) > rimLine(i) && Math.abs(rx(i)) < 0.12 && !(Math.abs(rx(i)) > 0.062 && ry(i) < 1.6), offset: () => pad, iters: 30, k: 0.5, minOff: pad * 0.9 });
  const P = sh.pos;
  const loop = boundaryLoops(sh.tri).sort((a, b) => b.length - a.length)[0];
  smoothLoop(P, loop, 40);
  const pts = loopPoints(P, loop);
  const c = V(0, 0, 0); pts.forEach((p) => c.add(p)); c.multiplyScalar(1 / pts.length);
  // repère du plan du bord
  let front = pts[0], backP = pts[0], left = pts[0], right = pts[0];
  for (const p of pts) { if (p.z > front.z) front = p; if (p.z < backP.z) backP = p; if (p.x > left.x) left = p; if (p.x < right.x) right = p; }
  const ez = front.clone().sub(backP).normalize(), ex0 = left.clone().sub(right).normalize();
  const ey = new THREE.Vector3().crossVectors(ez, ex0).normalize(); const ex = new THREE.Vector3().crossVectors(ey, ez).normalize();
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { const d = p.clone().sub(c); x0 = Math.min(x0, d.dot(ex)); x1 = Math.max(x1, d.dot(ex)); z0 = Math.min(z0, d.dot(ez)); z1 = Math.max(z1, d.dot(ez)); }
  c.addScaledVector(ex, (x0 + x1) / 2).addScaledVector(ez, (z0 + z1) / 2);
  const ax = (x1 - x0) / 2, az = (z1 - z0) / 2;
  let top = 0; for (let i = 0; i < NB; i++) if (sh.inc[i]) top = Math.max(top, V(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).sub(c).dot(ey));
  const Hh = top + height;
  if (0) console.error('HELM', c.x.toFixed(3), c.y.toFixed(3), c.z.toFixed(3), 'ax', ax.toFixed(3), 'az', az.toFixed(3), 'ey', ey.x.toFixed(2), ey.y.toFixed(2), ey.z.toFixed(2), 'eyeY', eyeY.toFixed(3), 'loop', loop.length, 'pts', pts.map(p=>p.y.toFixed(3)).filter((_, k) => k % 10 == 0).join(','));
  const prof = [];
  const rFn = (t) => { let r;
    if (shape === 'cone') r = Math.pow(1 - t, 0.62) * (1 + 0.1 * Math.sin(Math.PI * t) * (1 - t));
    else if (shape === 'onion') r = t < 0.85 ? Math.pow(Math.cos(t / 0.85 * Math.PI / 2 * 0.86), 0.75) : lerp(Math.pow(Math.cos(Math.PI / 2 * 0.86), 0.75), 0, (t - 0.85) / 0.15);
    else r = Math.pow(Math.max(0, 1 - t * t), 0.5) * (1 + 0.04 * t);
    return r; };
  for (let k = 0; k <= 60; k++) { const t = k / 60; prof.push([Math.max(rFn(t), 0.0004), t * Hh]); }
  const g = new THREE.Group();
  const toWorld = new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(c);
  const dome = lathe(prof, 128); dome.scale(ax, 1, az); dome.applyMatrix4(toWorld);
  g.add(mesh(dome, mat));
  // bandeau
  const band = lathe([[0.985, -bandR * 0.4], [1.0 + bandR / ax * 1.4, 0], [1.0 + bandR / ax * 1.4, bandH], [0.985, bandH + 0.003]], 128);
  band.scale(ax, 1, az); band.applyMatrix4(toWorld); g.add(mesh(band, bandMat || mat));
  if (rivets) for (let k = 0; k < rivets; k++) {
    const a = (k / rivets) * Math.PI * 2;
    const p = V(Math.sin(a) * (ax + bandR * 1.4), bandH * 0.5, Math.cos(a) * (az + bandR * 1.4)).applyMatrix4(toWorld);
    const rv = mesh(new THREE.SphereGeometry(0.0032, 10, 8), rivetMat || bandMat || mat); rv.position.copy(p); g.add(rv);
  }
  if (nasal) {
    // nasal : du bandeau à l'arête du nez, légèrement galbé
    const f = V(0, bandH, az + bandR * 1.3).applyMatrix4(toWorld);
    let best = -1, bd = 1e9; for (let i = 0; i < NB; i++) if (Math.abs(rx(i)) < 0.003 && rz(i) > 0.1) { const d = Math.abs(ry(i) - (eyeY + 0.03 - nasal)); if (d < bd) { bd = d; best = i; } }
    const b = V(B.pos[best * 3], B.pos[best * 3 + 1], B.pos[best * 3 + 2]).addScaledVector(V(B.nrm[best * 3], B.nrm[best * 3 + 1], B.nrm[best * 3 + 2]), 0.009);
    const m = f.clone().lerp(b, 0.5).addScaledVector(ez, 0.004);
    const pp = new THREE.QuadraticBezierCurve3(f, m, b).getPoints(24);
    g.add(mesh(sweep(pp, () => 0.0032, (t) => lerp(nasalW, nasalW * 0.8, t), { side: ex, steps: 30, n: 12 }), bandMat || mat));
  }
  g.userData = { c, ex, ey, ez, ax, az, Hh, bandH, toWorld, rFn };
  return g;
}
/** Turban enroulé autour d'un casque (repère du casque). */
export function turbanWraps(helm, { cloth, wraps = 6, seed = 1, base = 0.003, step = 0.0085, thick = 0.0045, width = 0.012, bulge = 0.07 } = {}) {
  const { toWorld, ax, az, Hh, rFn } = helm.userData;
  const g = new THREE.Group(); const r = rng(seed);
  for (let k = 0; k < wraps; k++) {
    const pts = []; const tilt = (k % 2 ? 1 : -1) * (0.004 + 0.003 * k); const ph = r() * 6;
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2; const y = base + k * step + tilt * Math.sin(a + ph) + 0.004 * Math.max(0, -Math.cos(a)) * k * 0.3;
      const rr = rFn(clamp(y / Hh)) * (1 + bulge * (1 - k / (wraps + 2)) + 0.02 * Math.sin(a * 3 + k));
      pts.push(V(Math.sin(a) * ax * rr, y, Math.cos(a) * az * rr).applyMatrix4(toWorld));
    }
    const tg = sweep(pts, () => width, (t) => thick * (1 + 0.25 * Math.sin(t * 40 + k)), { side: V(0, 1, 0), steps: 220, n: 14, capStart: false, capEnd: false });
    displace(tg, (v, n) => v.clone().addScaledVector(n, 0.0016 * fbm(v.x * 120, v.y * 120, v.z * 120 + k, 2)));
    g.add(mesh(tg, cloth));
  }
  return g;
}
/** Broche / plaque ronde avec emblème. */
export function brooch({ emblem = 'raven', color = '#c8ccd2', field = '#2a3a5a', r = 0.022, metal }) {
  const t = canvasTex(256, 256, (c, w, h) => { c.fillStyle = field; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.scale(0.85, 0.85); c.translate(-w / 2, -h / 2); EMBLEM[emblem](c, w, h, color); c.restore(); });
  const face = new THREE.MeshPhysicalMaterial({ map: t, metalness: 0.6, roughness: 0.35, envMapIntensity: 2 });
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.004, 48), [metal, face, metal]); disc.castShadow = true; disc.rotation.x = Math.PI / 2; g.add(disc);
  const rim = mesh(new THREE.TorusGeometry(r, 0.0025, 8, 48), metal); g.add(rim);
  return g;
}
/** Lunettes de casque (Givre) : deux gardes en bande plate autour des yeux, rivées au bandeau, et un nasal. */
export function spectacles(B, eyes, { mat, pad = 0.02, bandY = null } = {}) {
  const g = new THREE.Group();
  const ids = []; for (let i = 0; i < NB; i++) if (rz(i) > 0.06 && ry(i) > 1.48 && ry(i) < 1.64 && Math.abs(rx(i)) < 0.08) ids.push(i);
  const surf = (x, y, extra = 0) => { let best = -1, bd = 1e9; for (const i of ids) { const d = (B.pos[i * 3] - x) ** 2 + (B.pos[i * 3 + 1] - y) ** 2; if (d < bd) { bd = d; best = i; } } const k = pad + extra; return V(B.pos[best * 3] + B.nrm[best * 3] * k, B.pos[best * 3 + 1] + B.nrm[best * 3 + 1] * k, B.pos[best * 3 + 2] + B.nrm[best * 3 + 2] * k); };
  for (const E of [eyes.left, eyes.right]) {
    const s = Math.sign(E.x); const top = bandY ?? E.y + 0.028;
    const pts = [];
    for (let k = 0; k <= 24; k++) { const th = Math.PI * (k / 24); const x = E.x - s * 0.026 * Math.cos(th) + s * 0.002; const y = top - (top - (E.y - 0.024)) * Math.sin(th); pts.push(surf(x, y, 0.004 * Math.sin(th))); }
    const pp = new THREE.CatmullRomCurve3(pts).getPoints(48);
    g.add(mesh(sweep(pp, () => 0.0026, () => 0.0065, { side: V(0, 0, 1), steps: 60, n: 10 }), mat));
  }
  const top = (bandY ?? (eyes.left.y + eyes.right.y) / 2 + 0.028);
  const cx = (eyes.left.x + eyes.right.x) / 2;
  const nas = []; for (let k = 0; k <= 8; k++) { const t = k / 8; nas.push(surf(cx, top + 0.005 - t * 0.055, 0.002 + 0.006 * t)); }
  g.add(mesh(sweep(new THREE.CatmullRomCurve3(nas).getPoints(20), () => 0.003, (t) => lerp(0.009, 0.007, t), { side: V(0, 0, 1), steps: 30, n: 10 }), mat));
  return g;
}

// ------------------------------------------------------------------ fond, lumière
export function backdrop(faction, variant) {
  const base = { aube: ['#3a2a1a', '#0c0806'], sables: ['#3e2812', '#0e0804'], givre: ['#1e2632', '#07090d'] }[faction];
  return canvasTex(512, 640, (c, w, h) => {
    const gr = c.createRadialGradient(w * (0.35 + 0.3 * (variant % 2)), h * 0.32, 10, w * 0.5, h * 0.5, w * 0.95);
    gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const d = c.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x / 110 + variant * 3, y / 140, 3.3 + faction.length, 5); const i = (y * w + x) * 4; const k = 1 + n * 0.55; d.data[i] *= k; d.data[i + 1] *= k; d.data[i + 2] *= k; }
    c.putImageData(d, 0, 0);
  });
}
