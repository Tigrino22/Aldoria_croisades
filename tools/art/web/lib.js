// Bibliothèque commune : rendu, bruit, textures, matériaux PBR, géométries procédurales.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries, mergeVertices };

// ------------------------------------------------------------------ hasard & bruit
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.range = (a, b) => a + (b - a) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
const P = new Uint8Array(512);
{ const r = rng(1096); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise3(x, y, z = 0) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const L = (a, b, t) => a + t * (b - a);
  return L(L(L(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u), L(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    L(L(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u), L(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
export function fbm(x, y, z = 0, oct = 5, gain = 0.5) {
  let a = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); n += a; a *= gain; x *= 2.03; y *= 2.03; z *= 2.03; }
  return s / n;
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const deg = (d) => d * Math.PI / 180;

// ------------------------------------------------------------------ moteur de rendu
export const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setPixelRatio(1);
const pmrem = new THREE.PMREMGenerator(renderer);
let roomEnv = null;
export function studioEnv() {
  if (!roomEnv) roomEnv = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  return roomEnv;
}
export function envFromScene(sc, blur = 0.05) { return pmrem.fromScene(sc, blur).texture; }

// ------------------------------------------------------------------ textures
const cache = {};
const loader = new THREE.TextureLoader();
export async function preload(names) {
  await Promise.all(names.map(async (n) => { cache[n] = await loader.loadAsync(`/tex/${n}.png`); }));
}
export function tex(name, repeat = [1, 1], srgb = false, offset = [0, 0], rot = 0) {
  const base = cache[name];
  if (!base) throw new Error('texture manquante ' + name);
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.offset.set(offset[0], offset[1]);
  t.rotation = rot;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
export function img(name) { return cache[name].image; }
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ matériaux
const col = (c) => new THREE.Color(c);
export const MAT = {
  metal({ color = 0x9a9a9a, rough = 0.38, rep = [1, 1], env = 1, normal = 0.35 } = {}) {
    return new THREE.MeshPhysicalMaterial({
      color: col(color), metalness: 1, roughness: rough / 0.45,
      map: tex('metal_c', rep, true), roughnessMap: tex('metal_r', rep), normalMap: tex('metal_n', rep),
      normalScale: new THREE.Vector2(normal, normal), envMapIntensity: env,
    });
  },
  polished({ color = 0xb4b8be, rough = 0.2, rep = [1, 1], env = 0.85 } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), metalness: 1, roughness: rough * 1.6, roughnessMap: tex('metal_r', rep), normalMap: tex('metal_n', rep), normalScale: new THREE.Vector2(0.12, 0.12), envMapIntensity: env, clearcoat: 0.2, clearcoatRoughness: 0.2 });
  },
  gold({ rough = 0.25, rep = [1, 1] } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(0xe0b050), metalness: 1, roughness: rough * 1.6, roughnessMap: tex('metal_r', rep), normalMap: tex('metal_n', rep), normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 1.3 });
  },
  mail({ color = 0xd8d8d6, rep = [8, 8], rough = 0.38 } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), metalness: 0.95, roughness: rough, map: tex('mail_ao', rep, true), normalMap: tex('mail_n', rep), normalScale: new THREE.Vector2(1.6, 1.6), aoMap: tex('mail_ao', rep), envMapIntensity: 1.1 });
  },
  wood({ color = 0x7a5232, rep = [1, 1], rough = 0.7 } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), roughness: rough, map: tex('wood_c', rep, true), normalMap: tex('wood_n', rep), normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: tex('wood_r', rep), clearcoat: 0.05 });
  },
  leather({ color = 0x5a3520, rep = [1, 1], rough = 0.65 } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), roughness: rough, map: tex('leather_c', rep, true), normalMap: tex('leather_n', rep), normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: tex('leather_r', rep), clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.2, sheenColor: col(0x806050) });
  },
  cloth({ color = 0xd8d0c0, rep = [4, 4], rough = 0.95, sheen = 0.6, quilt = false } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), roughness: rough, map: tex('cloth_c', rep, true), normalMap: quilt ? tex('quilt_n', rep) : tex('cloth_n', rep), normalScale: new THREE.Vector2(quilt ? 1.2 : 0.7, quilt ? 1.2 : 0.7), sheen, sheenRoughness: 0.6, sheenColor: col(color).lerp(col(0xffffff), 0.3), side: THREE.DoubleSide });
  },
  fur({ color = 0x6a5a48, rep = [2, 2] } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color), roughness: 1, map: tex('fur_c', rep, true), normalMap: tex('fur_n', rep), normalScale: new THREE.Vector2(1.5, 1.5), sheen: 1, sheenRoughness: 0.4, sheenColor: col(color).lerp(col(0xffffff), 0.4) });
  },
  rock({ color = 0x9a9080, rep = [2, 2] } = {}) {
    return new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.95, map: tex('rock_c', rep, true), normalMap: tex('rock_n', rep), normalScale: new THREE.Vector2(1.2, 1.2) });
  },
  skin({ color = 0xb08068 } = {}) {
    return new THREE.MeshPhysicalMaterial({ color: col(color).multiplyScalar(0.7), roughness: 0.6, envMapIntensity: 0.15, sheen: 0.2, sheenColor: col(0xa05038), normalMap: tex('leather_n', [3, 3]), normalScale: new THREE.Vector2(0.15, 0.15) });
  },
  plain(color, rough = 0.9, extra = {}) { return new THREE.MeshStandardMaterial({ color: col(color), roughness: rough, ...extra }); },
};

// ------------------------------------------------------------------ géométries
/** Balayage : sections = [{y, pts:[[x,z],...]}] (même nombre de points), boucle fermée. */
export function loft(sections, { closed = true, capStart = false, capEnd = false } = {}) {
  const n = sections[0].pts.length, m = sections.length, cols = closed ? n + 1 : n;
  const pos = [], uv = [], idx = [];
  sections.forEach((s, j) => {
    for (let i = 0; i < cols; i++) {
      const p = s.pts[i % n];
      pos.push(p[0], s.y !== undefined ? s.y : p[1], s.y !== undefined ? p[1] : p[2]);
      uv.push(i / (cols - 1), j / (m - 1));
    }
  });
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const addCap = (j, flip) => {
    const s = sections[j]; const ci = pos.length / 3;
    let cx = 0, cz = 0; s.pts.forEach((p) => { cx += p[0]; cz += p[1]; });
    pos.push(cx / n, s.y, cz / n); uv.push(0.5, j / (m - 1));
    for (let i = 0; i < n; i++) { const a = j * cols + i, b = j * cols + ((i + 1) % n); flip ? idx.push(ci, b, a) : idx.push(ci, a, b); }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(m - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // orientation : normales vers l'extérieur de chaque section
  if (closed) {
    let dot = 0; const nA = g.attributes.normal;
    sections.forEach((s, j) => {
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { const q = j * cols + i; cx += pos[q * 3]; cy += pos[q * 3 + 1]; cz += pos[q * 3 + 2]; }
      cx /= n; cy /= n; cz /= n;
      for (let i = 0; i < n; i++) { const q = j * cols + i; dot += (pos[q * 3] - cx) * nA.getX(q) + (pos[q * 3 + 1] - cy) * nA.getY(q) + (pos[q * 3 + 2] - cz) * nA.getZ(q); }
    });
    if (dot < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  }
  g.setAttribute('uv1', g.attributes.uv);
  return g;
}
export function ellipse(rx, rz, n = 24, fn) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = fn ? fn(a) : 1; pts.push([Math.cos(a) * rx * k, Math.sin(a) * rz * k]); }
  return pts;
}
/** Tour (lathe) : profil [[r, y], ...] */
export function lathe(profile, segs = 48, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segs, phiStart, phiLen);
  g.setAttribute('uv1', g.attributes.uv);
  return g;
}
export function displace(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); if (n) nn.fromBufferAttribute(n, i);
    const r = fn(v, nn, i);
    if (r) p.setXYZ(i, r.x, r.y, r.z);
  }
  p.needsUpdate = true; g.computeVertexNormals();
  return g;
}
export function mesh(g, m, { cast = true, receive = true } = {}) {
  if (!g.attributes.uv1 && g.attributes.uv) g.setAttribute('uv1', g.attributes.uv);
  const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = receive; return o;
}
/** Balayage le long d'un chemin dans le plan y-z (ou quelconque) : rx(t), ry(t) ; side = axe latéral fixe. */
export function sweep(path, rx, ry, { n = 28, steps = 80, side = V(1, 0, 0), shape = null, capStart = true, capEnd = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  const secs = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps; const c = curve.getPointAt(t); const T = curve.getTangentAt(t);
    const s = side.clone().sub(T.clone().multiplyScalar(side.dot(T))).normalize(); const up = new THREE.Vector3().crossVectors(T, s).normalize();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const k2 = shape ? shape(t, a) : 1;
      const p = c.clone().addScaledVector(s, Math.cos(a) * rx(t) * k2).addScaledVector(up, Math.sin(a) * ry(t) * k2);
      pts.push([p.x, p.y, p.z]);
    }
    secs.push({ pts });
  }
  const g = loft(secs, { closed: true });
  if (capStart || capEnd) {
    // bouchons simples : éventails
    const pos = Array.from(g.attributes.position.array), uv = Array.from(g.attributes.uv.array), idx = Array.from(g.index.array);
    const cols = n + 1;
    const cap = (j, flip) => {
      const ci = pos.length / 3; const c = curve.getPointAt(j === 0 ? 0 : 1); pos.push(c.x, c.y, c.z); uv.push(0.5, 0.5);
      for (let i = 0; i < n; i++) { const a = j * cols + i, b = j * cols + i + 1; flip ? idx.push(ci, a, b) : idx.push(ci, b, a); }
    };
    // orientation : normale de bouchon vers l'extérieur (on teste)
    const before = idx.length;
    if (capStart) cap(0, false);
    if (capEnd) cap(steps, true);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ng.setIndex(idx);
    ng.computeVertexNormals(); ng.setAttribute('uv1', ng.attributes.uv);
    return ng;
  }
  return g;
}
export function tubeAlong(points, radius, { radial = 12, segs = 64, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, segs, typeof radius === 'number' ? radius : 0.01, radial, closed);
  if (typeof radius === 'function') {
    // rayon variable : on rapproche chaque anneau de son centre
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const c = curve.getPointAt(i / segs); const r = radius(i / segs) / 0.01;
      for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
    }
    g.computeVertexNormals();
  }
  g.setAttribute('uv1', g.attributes.uv);
  return g;
}
/** Surface radiale (bouclier) : outline(a) -> rayon, surf(x,y) -> z ; épaisseur, retourne {front, back, rim} */
export function radialSurface(outline, surf, { rings = 40, segs = 160, thick = 0.02, cx = 0, cy = 0, W = 1, H = 1 } = {}) {
  const mk = (off, flip) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const s = j / rings;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2; const r = outline(a) * s;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        pos.push(x, y, surf(x, y) + off); uv.push(x / W + 0.5, y / H + 0.5);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1;
      flip ? idx.push(a, b, c, b, d, c) : idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.setAttribute('uv1', g.attributes.uv);
    return g;
  };
  const front = mk(0, false), back = mk(-thick, true);
  // bord
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2; const r = outline(a);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, z = surf(x, y);
    pos.push(x, y, z, x, y, z - thick); uv.push(i / segs * 8, 0, i / segs * 8, 1);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rim.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rim.setIndex(idx); rim.computeVertexNormals(); rim.setAttribute('uv1', rim.attributes.uv);
  const outlinePts = [];
  for (let i = 0; i < segs; i += 2) { const a = (i / segs) * Math.PI * 2; const r = outline(a); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; outlinePts.push(V(x, y, surf(x, y) - thick / 2)); }
  return { front, back, rim, outlinePts };
}

// ------------------------------------------------------------------ ciel & éclairage
export function sky({ top = 0x1a2a4a, mid = 0x8a6a5a, horizon = 0xffa060, ground = 0x2a2018, sunDir = V(0, 0.1, -1), sunColor = 0xffc080, sunSize = 0.9995, sunGlow = 2.0, sunStrength = 30, clouds = 0.5, cloudColor = 0xffb080, cloudDark = 0x403040, stars = 0, radius = 5000, cloudScale = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: col(top) }, mid: { value: col(mid) }, horizon: { value: col(horizon) }, ground: { value: col(ground) },
      sunDir: { value: sunDir.clone().normalize() }, sunColor: { value: col(sunColor) }, sunSize: { value: sunSize }, sunGlow: { value: sunGlow }, sunStrength: { value: sunStrength },
      clouds: { value: clouds }, cloudColor: { value: col(cloudColor) }, cloudDark: { value: col(cloudDark) }, stars: { value: stars }, cloudScale: { value: cloudScale },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 top, mid, horizon, ground, sunDir, sunColor, cloudColor, cloudDark; uniform float sunSize, sunGlow, sunStrength, clouds, stars, cloudScale;
      varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fb(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.07; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c = y > 0. ? mix(mix(horizon, mid, smoothstep(0., .18, y)), top, smoothstep(.12, .7, y)) : mix(horizon, ground, smoothstep(0., .08, -y));
        float sd = max(dot(d, normalize(sunDir)), 0.);
        c += sunColor * (pow(sd, 8.) * .35 + pow(sd, 64.) * .6) * sunGlow;
        c += sunColor * smoothstep(sunSize, sunSize + .0003, sd) * sunStrength;
        if (y > 0.) {
          vec2 uv = d.xz / (y + .12) * 1.6 * cloudScale;
          float cl = fb(uv + vec2(3.1, 7.2)); float cl2 = fb(uv * 2.3 + 11.);
          float m = smoothstep(.5 - clouds * .25, .85, cl * .75 + cl2 * .35) * smoothstep(0., .12, y);
          vec3 cc = mix(cloudDark, cloudColor * (1. + pow(sd, 6.) * 3.), clamp(cl2 * 1.3 - .2 + pow(sd, 4.) * .5, 0., 1.));
          c = mix(c, cc, m * clouds);
          float st = step(.9985, h(floor(d.xz / (y + .3) * 600.))) * stars * smoothstep(.1, .5, y) * (1. - m);
          c += vec3(st);
        }
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
  m.frustumCulled = false; m.renderOrder = -1;
  return m;
}
export function sun(scene, { color = 0xffd0a0, intensity = 3, pos = V(-5, 8, 5), target = V(0, 0, 0), size = 10, mapSize = 2048, radius = 6, bias = -0.0003 } = {}) {
  const l = new THREE.DirectionalLight(col(color), intensity);
  l.position.copy(pos); l.target.position.copy(target); scene.add(l.target);
  l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.1; c.far = pos.distanceTo(target) * 3;
  l.shadow.radius = radius; l.shadow.blurSamples = 16; l.shadow.bias = bias; l.shadow.normalBias = 0.02;
  scene.add(l); return l;
}
export function studio(scene, { key = 3.2, rim = 4, fill = 0.5, keyColor = 0xfff0dd, rimColor = 0xcfe0ff, env = 0.9, keyPos = V(-2.5, 4, 3), rimPos = V(2.5, 2.5, -3), shadow = true, size = 1.5 } = {}) {
  scene.environment = studioEnv();
  scene.environmentIntensity = env;
  const k = sun(scene, { color: keyColor, intensity: key, pos: keyPos, size, radius: 12, mapSize: 2048 });
  k.castShadow = shadow;
  const r = new THREE.DirectionalLight(col(rimColor), rim); r.position.copy(rimPos); scene.add(r);
  const f = new THREE.HemisphereLight(0xdde6ff, 0x302820, fill); scene.add(f);
  return { k, r, f };
}
export function shadowCatcher(scene, y = 0, size = 10, opacity = 0.45) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity, color: 0x000000 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m);
  // ombre de contact douce supplémentaire
  const t = canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = y + 0.001; scene.add(blob);
  return { plane: m, blob };
}

// ------------------------------------------------------------------ post-traitement & capture
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.35 }, grain: { value: 0.03 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gain: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1 }, contrast: { value: 1 }, seed: { value: 1 }, aspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette, grain, sat, contrast, seed, aspect; uniform vec3 lift, gain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed)*43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb;
      x = (x - .5) * contrast + .5; float l = dot(x, vec3(.299,.587,.114)); x = mix(vec3(l), x, sat);
      x = x * gain + lift * (1. - x);
      vec2 d = (vUv - .5) * vec2(aspect, 1.); x *= 1. - vignette * smoothstep(.25, 1.1, length(d) * 1.25);
      x += (h(vUv * 1000.) - .5) * grain;
      gl_FragColor = vec4(clamp(x, 0., 1.), c.a); }`,
};
// Résolution « dessinée » : chaque job fixe RES.div (taille finale / taille dessinée) ; on rend à ss x la taille dessinée.
export const RES = { div: 1, ss: 3 };
const depthMat = new THREE.ShaderMaterial({
  vertexShader: `varying float vz; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vz = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vz; void main(){ float d = clamp(log(max(vz, 0.01) * 10.) / log(100000.), 0., 1.); float hi = floor(d * 255.) / 255.; gl_FragColor = vec4(hi, fract(d * 255.), 0., 1.); }`,
});
const normalMat = new THREE.MeshNormalMaterial();
function edgePasses(scene, camera) {
  const hidden = [];
  scene.traverse((o) => { if (o.visible && (o.isPoints || o.isSprite || o.userData.noEdge || (o.material && (o.material.isShadowMaterial || o.material.isShaderMaterial || o.material.transparent && o.material.depthWrite === false)))) { o.visible = false; hidden.push(o); } });
  const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
  const tm = renderer.toneMapping, cs = renderer.outputColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene.overrideMaterial = normalMat; renderer.render(scene, camera); const normal = canvas.toDataURL('image/png');
  scene.overrideMaterial = depthMat; renderer.render(scene, camera); const depth = canvas.toDataURL('image/png');
  scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
  renderer.toneMapping = tm; renderer.outputColorSpace = cs;
  hidden.forEach((o) => (o.visible = true));
  return { normal, depth };
}
export function capture({ scene, camera, w, h, transparent = false, bloom = null, dof = null, grade = {}, exposure = 1 }) {
  if (!transparent) exposure *= 1.2;
  const W = Math.round(w / RES.div * RES.ss), H = Math.round(h / RES.div * RES.ss);
  renderer.setSize(W, H, false);
  if (camera.isPerspectiveCamera) camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = exposure;
  let color;
  if (transparent) {
    renderer.setClearColor(0x000000, 0);
    scene.background = null;
    renderer.render(scene, camera);
    color = canvas.toDataURL('image/png');
  } else {
    renderer.setClearColor(0x000000, 1);
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(1); composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    if (dof) composer.addPass(new BokehPass(scene, camera, { focus: dof.focus, aperture: dof.aperture * 0.5, maxblur: dof.maxblur * 0.5 }));
    if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), bloom.strength ?? 0.4, bloom.radius ?? 0.6, bloom.threshold ?? 0.85));
    composer.addPass(new OutputPass());
    const gp = new ShaderPass(GradeShader);
    const u = gp.uniforms;
    u.vignette.value = grade.vignette ?? 0.3; u.grain.value = 0; u.sat.value = grade.sat ?? 1; u.contrast.value = grade.contrast ?? 1.05;
    if (grade.lift) u.lift.value.set(...grade.lift); if (grade.gain) u.gain.value.set(...grade.gain);
    u.aspect.value = W / H; u.seed.value = 1;
    composer.addPass(gp);
    composer.render();
    color = canvas.toDataURL('image/png');
    composer.dispose(); rt.dispose();
  }
  const e = edgePasses(scene, camera);
  disposeScene(scene);
  return JSON.stringify({ color, ...e });
}
export function disposeScene(scene) {
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m === depthMat || m === normalMat) return; for (const k in m) if (m[k] && m[k].isTexture && m[k] !== roomEnv) m[k].dispose(); m.dispose(); }); } });
}
