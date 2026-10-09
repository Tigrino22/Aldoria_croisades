// Scènes : fonds, ennemis, travaux, actions. Rendues petit puis « illustrées » par pixelize.py.
import { THREE, MAT, mesh, displace, loft, lathe, ellipse, sweep, tubeAlong, canvasTex, tex, img, fbm, noise3, smooth, clamp, lerp, V, deg, rng, sky, sun, envFromScene, capture } from './lib.js';
import * as M from './models.js';
import { figure, torso } from './people.js';
import * as A from './arsenal.js';

const G = () => new THREE.Group();
const C = (c) => new THREE.Color(c);

// ================================================================== environnement
function world({ top, mid, horizon, ground = 0x2a2018, sunDir, sunColor = 0xffc080, sunI = 2.5, sunStrength = 20, clouds = 0.5, cloudColor, cloudDark, stars = 0, fog = 0x806050, fogD = 0.012, amb = 0.35, ambSky, ambGround = 0x302418, shadowSize = 30, sunGlow = 2, cloudScale = 1, moon = false }) {
  const scene = new THREE.Scene();
  const sk = sky({ top, mid, horizon, ground, sunDir, sunColor, sunStrength, clouds, cloudColor: cloudColor ?? sunColor, cloudDark: cloudDark ?? mid, stars, sunGlow, cloudScale, sunSize: moon ? 0.9992 : 0.9995 });
  scene.add(sk);
  const es = new THREE.Scene(); es.add(sk.clone());
  scene.environment = envFromScene(es, 0.04);
  scene.environmentIntensity = 0.6;
  scene.fog = new THREE.FogExp2(C(fog), fogD);
  const d = sunDir.clone().normalize();
  const s = sun(scene, { color: sunColor, intensity: sunI, pos: d.clone().multiplyScalar(60), target: V(0, 0, 0), size: shadowSize, radius: 3, mapSize: 2048, bias: -0.0005 });
  s.shadow.camera.far = 200;
  scene.add(new THREE.HemisphereLight(C(ambSky ?? top), C(ambGround), amb));
  return scene;
}
function terrain(scene, { size = 200, seg = 220, h, color, rough = 1, normalRep = 40, cx = 0, cz = 0 }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const cols = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; p.setY(i, h(x, z)); }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const c = C(color(p.getX(i) + cx, p.getZ(i) + cz, p.getY(i), 1 - n.getY(i))); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, normalMap: tex('ground_n', [normalRep, normalRep]), normalScale: new THREE.Vector2(0.6, 0.6) });
  const t = mesh(g, m); t.position.set(cx, 0, cz); scene.add(t);
  return t;
}
const mixc = (a, b, t) => C(a).lerp(C(b), clamp(t));
function hsample(fn) { return fn; }

// ------------------------------------------------------------------ végétation, rochers
function conifer(h = 8, color = 0x23361f, r = rng(1)) {
  const g = G();
  const trunk = mesh(new THREE.CylinderGeometry(h * 0.02, h * 0.035, h * 0.4, 8), MAT.plain(0x3a2a1c)); trunk.position.y = h * 0.2; g.add(trunk);
  const m = new THREE.MeshStandardMaterial({ color: C(color), roughness: 1, normalMap: tex('fur_n', [2, 2]), normalScale: new THREE.Vector2(1.5, 1.5) });
  for (let k = 0; k < 5; k++) {
    const t = k / 5; const cg = new THREE.ConeGeometry(h * (0.3 - t * 0.05) * (1 - t * 0.5), h * 0.38, 9, 3);
    displace(cg, (v) => V(v.x * (1 + 0.25 * noise3(v.x * 2 + k, v.y * 3, v.z * 2)), v.y, v.z * (1 + 0.25 * noise3(v.z * 2, v.y * 3 + k, v.x))));
    const c = mesh(cg, m); c.position.y = h * (0.3 + t * 0.16); c.rotation.y = r() * 6; g.add(c);
  }
  return g;
}
function broadleaf(h = 6, color = 0x3d5a26, r = rng(2)) {
  const g = G();
  const trunk = mesh(tubeAlong([V(0, 0, 0), V(0.1, h * 0.3, 0), V(-0.1, h * 0.55, 0.1)], (t) => h * 0.04 * (1 - t * 0.5), { segs: 12, radial: 8 }), MAT.plain(0x4a3626)); g.add(trunk);
  const m = new THREE.MeshStandardMaterial({ color: C(color), roughness: 1, normalMap: tex('fur_n', [3, 3]), normalScale: new THREE.Vector2(2, 2) });
  for (let k = 0; k < 6; k++) {
    const s = h * (0.22 + r() * 0.12); const bg = new THREE.IcosahedronGeometry(s, 2);
    displace(bg, (v) => v.clone().multiplyScalar(1 + 0.22 * noise3(v.x * 1.5 + k, v.y * 1.5, v.z * 1.5)));
    const b = mesh(bg, m); b.position.set((r() - 0.5) * h * 0.4, h * (0.62 + r() * 0.25), (r() - 0.5) * h * 0.4); g.add(b);
  }
  return g;
}
function cypress(h = 7, r = rng(3)) {
  const g = G();
  const m = new THREE.MeshStandardMaterial({ color: 0x24361e, roughness: 1, normalMap: tex('fur_n', [2, 4]), normalScale: new THREE.Vector2(2, 2) });
  const cg = new THREE.SphereGeometry(1, 12, 16); displace(cg, (v) => V(v.x * (1 + 0.2 * noise3(v.y * 4, v.x * 3, 1)), v.y, v.z));
  const c = mesh(cg, m); c.scale.set(h * 0.12, h * 0.5, h * 0.12); c.position.y = h * 0.5; g.add(c);
  return g;
}
function palm(h = 7, r = rng(4)) {
  const g = G();
  const lean = r.range(-0.6, 0.6);
  const pts = [V(0, 0, 0), V(lean * 0.4, h * 0.4, 0), V(lean, h, 0.2)];
  g.add(mesh(tubeAlong(pts, (t) => 0.22 * (1 - t * 0.35), { segs: 20, radial: 8 }), new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1, normalMap: tex('wood_n', [1, 6]) })));
  const fm = new THREE.MeshStandardMaterial({ color: 0x3d5a22, roughness: 0.9, side: THREE.DoubleSide });
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2 + r() * 0.3; const L = h * 0.42;
    const fp = []; for (let i = 0; i <= 8; i++) { const t = i / 8; fp.push(V(Math.cos(a) * L * t, -L * 0.55 * t * t + L * 0.25 * t, Math.sin(a) * L * t)); }
    const fg = sweep(fp, (t) => 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), () => 0.02, { side: V(-Math.sin(a), 0, Math.cos(a)), steps: 16, n: 6 });
    const f = mesh(fg, fm); f.position.copy(pts[2]); g.add(f);
  }
  return g;
}
function bush(s = 1, color = 0x4a5a2a) {
  const bg = new THREE.IcosahedronGeometry(s, 2); displace(bg, (v) => V(v.x * (1 + 0.3 * noise3(v.x * 2, v.y * 2, v.z * 2)), v.y * 0.6, v.z * (1 + 0.3 * noise3(v.z * 2, v.x, v.y))));
  return mesh(bg, new THREE.MeshStandardMaterial({ color: C(color), roughness: 1, normalMap: tex('fur_n', [2, 2]), normalScale: new THREE.Vector2(2, 2) }));
}
function rock(s = 1, color = 0x8a8070, seed = 1) {
  const g = new THREE.IcosahedronGeometry(s, 3); displace(g, (v) => v.clone().multiplyScalar(1 + 0.35 * fbm(v.x * 1.2 / s + seed, v.y * 1.2 / s, v.z * 1.2 / s, 4)));
  g.scale(1, 0.7, 1);
  return mesh(g, MAT.rock({ color, rep: [1, 1] }));
}
function scatter(scene, n, fn, place, seed = 5) { const r = rng(seed); for (let i = 0; i < n; i++) { const o = fn(r, i); if (!o) continue; const p = place(r, i); if (!p) continue; o.position.copy(p); o.rotation.y = r() * 6.28; scene.add(o); } }

// ------------------------------------------------------------------ bâtiments
const stoneM = (c = 0xc8b898, rep = [4, 4]) => new THREE.MeshStandardMaterial({ color: C(c), roughness: 0.95, map: tex('rock_c', rep, true), normalMap: tex('rock_n', rep), normalScale: new THREE.Vector2(0.8, 0.8) });
function wall(len, h, th, mat, cren = true) {
  const g = G();
  const w = mesh(new THREE.BoxGeometry(len, h, th), mat); w.position.y = h / 2; g.add(w);
  if (cren) { const n = Math.floor(len / 1.2); for (let i = 0; i < n; i++) { const c = mesh(new THREE.BoxGeometry(0.7, 0.8, th * 1.05), mat); c.position.set(-len / 2 + 0.6 + i * (len - 1.2) / Math.max(1, n - 1), h + 0.4, 0); g.add(c); } }
  return g;
}
function tower(r, h, mat, { roof = null, cren = true } = {}) {
  const g = G();
  const t = mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24), mat); t.position.y = h / 2; g.add(t);
  const lip = mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.5, 24), mat); lip.position.y = h; g.add(lip);
  if (cren) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const c = mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), mat); c.position.set(Math.cos(a) * r * 1.05, h + 0.7, Math.sin(a) * r * 1.05); c.rotation.y = -a; g.add(c); }
  if (roof) { const ro = mesh(new THREE.ConeGeometry(r * 1.25, r * 2.2, 24), MAT.plain(roof, 0.8)); ro.position.y = h + 0.25 + r * 1.1; g.add(ro); }
  // meurtrières
  for (let i = 0; i < 3; i++) { const s = mesh(new THREE.BoxGeometry(0.15, 0.9, 0.2), MAT.plain(0x120c08)); const a = i * 2.1; s.position.set(Math.cos(a) * r, h * (0.45 + i * 0.15), Math.sin(a) * r); s.rotation.y = -a; g.add(s); }
  return g;
}
function keep(w, d, h, mat) {
  const g = G();
  const b = mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.y = h / 2; g.add(b);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const t = mesh(new THREE.BoxGeometry(1.2, h + 1.5, 1.2), mat); t.position.set(sx * w / 2, (h + 1.5) / 2, sz * d / 2); g.add(t); }
  const n = 6; for (let i = 0; i < n; i++) for (const sz of [-1, 1]) { const c = mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), mat); c.position.set(-w / 2 + 1 + i * (w - 2) / (n - 1), h + 0.4, sz * d / 2); g.add(c); }
  for (let i = 0; i < 4; i++) { const wdw = mesh(new THREE.BoxGeometry(0.4, 1.0, 0.2), MAT.plain(0x140c08)); wdw.position.set(-w / 3 + i * w / 4.5, h * 0.65, d / 2 + 0.01); g.add(wdw); }
  return g;
}
function house(w = 4, d = 3, h = 2.4, { wallC = 0xb8a888, roofC = 0x8a6a40, flat = false, seed = 1 } = {}) {
  const g = G();
  const wm = new THREE.MeshStandardMaterial({ color: C(wallC), roughness: 1, map: tex('rock_c', [2, 1], true), normalMap: tex('rock_n', [2, 1]) });
  const b = mesh(new THREE.BoxGeometry(w, h, d), wm); b.position.y = h / 2; g.add(b);
  if (flat) { const r = mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2), wm); r.position.y = h + 0.1; g.add(r); }
  else {
    const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.3, 0); sh.lineTo(0, h * 0.6); sh.lineTo(d / 2 + 0.3, 0); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: w + 0.4, bevelEnabled: false }); rg.translate(0, 0, -(w + 0.4) / 2); rg.rotateY(Math.PI / 2);
    const r = mesh(rg, new THREE.MeshStandardMaterial({ color: C(roofC), roughness: 1, map: tex('fur_c', [3, 3], true), normalMap: tex('fur_n', [3, 3]), normalScale: new THREE.Vector2(2, 2) })); r.position.y = h; g.add(r);
  }
  const door = mesh(new THREE.BoxGeometry(0.8, 1.5, 0.1), MAT.wood({ color: 0x4a3020 })); door.position.set(0, 0.75, d / 2 + 0.02); g.add(door);
  return g;
}
function bellTent(r = 2.2, h = 3.2, color = 0xd8ccb0, glow = 0) {
  const g = G();
  const m = MAT.cloth({ color, rep: [6, 4], sheen: 0.3 });
  if (glow) { m.emissive = C(0xff8a30); m.emissiveIntensity = glow; m.emissiveMap = null; }
  const tg = lathe([[0.05, h], [r * 0.35, h * 0.72], [r * 0.95, h * 0.32], [r, 0]].reverse(), 24);
  displace(tg, (v) => { const a = Math.atan2(v.z, v.x); const k = 1 - 0.05 * Math.abs(Math.sin(a * 6)) * (1 - v.y / h); return V(v.x * k, v.y, v.z * k); });
  g.add(mesh(tg, m));
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), MAT.wood()); pole.position.y = h + 0.3; g.add(pole);
  const flap = mesh(new THREE.PlaneGeometry(0.9, 1.6), MAT.plain(glow ? 0xffa050 : 0x1a120c, 1, glow ? { emissive: C(0xff9040), emissiveIntensity: 2 * glow } : {})); flap.position.set(0, 0.8, r - 0.12); flap.rotation.x = -0.25; g.add(flap);
  return g;
}
function ridgeTent(w = 3, l = 4, h = 2.2, color = 0xc8b898, glow = 0) {
  const g = G();
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(0, h); sh.lineTo(w / 2, 0); sh.closePath();
  const tg = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false }); tg.translate(0, 0, -l / 2);
  const m = MAT.cloth({ color, rep: [3, 3], sheen: 0.3 }); if (glow) { m.emissive = C(0xff8030); m.emissiveIntensity = glow; }
  g.add(mesh(tg, m));
  return g;
}
export function banner(color = 0xa02a20, emblem = null, emblemColor = '#d4a640', h = 4, wave = 1) {
  const g = G();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 8), MAT.wood({ color: 0x5a3a20 })); pole.position.y = h / 2; g.add(pole);
  const tip = mesh(new THREE.ConeGeometry(0.06, 0.25, 8), MAT.metal({ color: 0xc0a060 })); tip.position.y = h + 0.12; g.add(tip);
  const t = canvasTex(128, 256, (c, w, hh) => { c.fillStyle = '#' + C(color).getHexString(); c.fillRect(0, 0, w, hh); if (emblem) { c.save(); c.translate(0, hh * 0.15); c.scale(1, 0.5); M.EMBLEM[emblem](c, w, w * 2 * 0.9, emblemColor); c.restore(); } c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, hh * 0.9, w, hh * 0.1); });
  const cg = new THREE.PlaneGeometry(0.9, 1.6, 12, 16);
  displace(cg, (v) => { const u = (v.x + 0.45) / 0.9; let y = v.y; if (v.y < -0.5) { const cut = Math.abs(v.x) * 1.2; y = Math.max(v.y, -0.8 + cut * 0.4); } return V(v.x, y, Math.sin(u * 5 + v.y * 2) * 0.1 * u * wave); });
  const cl = mesh(cg, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide })); cl.position.set(0.47, h - 0.9, 0); g.add(cl);
  const bar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), MAT.wood()); bar.rotation.z = Math.PI / 2; bar.position.set(0.47, h - 0.08, 0); g.add(bar);
  return g;
}
function fire(scene, pos, s = 1, { light = 30, smoke = true } = {}) {
  const g = G(); g.position.copy(pos);
  const logs = MAT.wood({ color: 0x3a2618 });
  for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.9 * s, 6), logs); l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = i * 1.25; l.position.y = 0.15 * s; g.add(l); }
  const fm = (c, i) => new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(i), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 6; i++) { const f = mesh(new THREE.ConeGeometry(0.22 * s * (1 - i * 0.1), (0.9 - i * 0.08) * s, 8), fm(i < 2 ? 0xffd070 : 0xff6a20, 3)); f.position.set((i % 3 - 1) * 0.12 * s, 0.45 * s, ((i >> 1) % 2 - 0.5) * 0.15 * s); f.rotation.z = (i - 3) * 0.08; f.castShadow = false; g.add(f); }
  const core = mesh(new THREE.SphereGeometry(0.25 * s, 10, 8), fm(0xffe0a0, 4)); core.position.y = 0.25 * s; g.add(core);
  const pl = new THREE.PointLight(0xff8a3a, light * s, 14 * s, 1.6); pl.position.y = 0.8 * s; pl.castShadow = s >= 1; if (pl.castShadow) { pl.shadow.mapSize.set(512, 512); pl.shadow.radius = 4; } g.add(pl);
  if (smoke) puffs(g, V(0, 1.2 * s, 0), 12, s, 0x3a3430, 0.35);
  scene.add(g);
  return g;
}
const puffTex = () => canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
function puffs(parent, at, n, s, color, op) {
  const r = rng(n * 17 + 3); const t = puffTex();
  for (let i = 0; i < n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: C(color), transparent: true, opacity: op * (1 - i / n), depthWrite: false })); const k = i / n; sp.position.set(at.x + (r() - 0.3) * k * 3 * s, at.y + k * 6 * s, at.z + (r() - 0.5) * k * 2 * s); sp.scale.setScalar((0.8 + k * 3) * s); parent.add(sp); }
}
function torch(scene, pos, s = 1) {
  const g = G(); g.position.copy(pos);
  const st = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.6, 6), MAT.wood({ color: 0x3a2618 })); g.add(st);
  const f = mesh(new THREE.ConeGeometry(0.1, 0.4, 8), new THREE.MeshBasicMaterial({ color: C(0xffa040).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); f.position.y = 0.45; g.add(f);
  const pl = new THREE.PointLight(0xff8a3a, 12 * s, 9, 1.6); pl.position.y = 0.6; g.add(pl);
  scene.add(g); return g;
}
function embers(scene, center, n, spread, color = 0xffa040, size = 0.12) {
  const r = rng(n + 11); const pp = [];
  for (let i = 0; i < n; i++) pp.push(center.x + (r() - 0.5) * spread, center.y + r() * spread * 0.6, center.z + (r() - 0.5) * spread);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size, color: C(color).multiplyScalar(3), map: puffTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
}

// ------------------------------------------------------------------ animaux
function quadruped({ len = 1.6, h = 1.5, girth = 0.36, neck = 0.9, headL = 0.55, legR = 0.07, color = 0x5a3a24, mat = null, hump = 0, neckUp = 0.7, tail = 'horse', ears = 0.12, snout = 0.6, lowHead = 0 }) {
  const g = G();
  const m = mat || new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.6, sheen: 0.4, sheenColor: C(color).lerp(C(0xffffff), 0.3), normalMap: tex('fur_n', [4, 4]), normalScale: new THREE.Vector2(0.4, 0.4) });
  const top = h - girth * 0.3;
  const body = sweep([V(0, top, -len / 2), V(0, top + 0.03, -len / 6), V(0, top, len / 6), V(0, top + 0.02, len / 2)], (t) => girth * (0.85 + 0.25 * Math.sin(Math.PI * t)) * 0.9, (t) => girth * (0.9 + 0.2 * Math.sin(Math.PI * t)), { steps: 30, n: 20, shape: hump ? (t, a) => 1 + hump * Math.exp(-((t - 0.45) ** 2) / 0.02) * Math.max(0, Math.sin(a)) : null });
  g.add(mesh(body, m));
  // cou & tête
  const nb = V(0, top + girth * 0.3, len / 2 - 0.05);
  const nt = V(0, top + neck * neckUp - lowHead, len / 2 + neck * (1 - neckUp * 0.6));
  const ng = sweep([nb, nb.clone().lerp(nt, 0.5).add(V(0, 0.05, 0)), nt], (t) => lerp(girth * 0.55, girth * 0.3, t), (t) => lerp(girth * 0.75, girth * 0.35, t), { steps: 16, n: 16 });
  g.add(mesh(ng, m));
  const hd = nt.clone().add(V(0, -0.04, headL * 0.9 * (1 - lowHead)).add(V(0, -lowHead * 0.4, 0)));
  const hg = sweep([nt.clone().add(V(0, 0.02, -0.04)), nt.clone().lerp(hd, 0.5), hd], (t) => lerp(girth * 0.3, girth * 0.16 * snout, t), (t) => lerp(girth * 0.36, girth * 0.2, t), { steps: 14, n: 14 });
  g.add(mesh(hg, m));
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(ears * 0.35, ears, 6), m); e.position.copy(nt).add(V(s * girth * 0.18, girth * 0.32, 0)); e.rotation.z = -s * 0.3; g.add(e); }
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x080606, roughness: 0.2 });
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(girth * 0.045, 8, 6), eyeM); e.position.copy(nt.clone().lerp(hd, 0.3)).add(V(s * girth * 0.22, girth * 0.12, 0)); g.add(e); }
  // pattes
  const legs = [[-1, len / 2 - 0.12, 1], [1, len / 2 - 0.12, -1], [-1, -len / 2 + 0.12, -1], [1, -len / 2 + 0.12, 1]];
  legs.forEach(([s, z, ph]) => {
    const front = z > 0;
    const sw = ph * 0.12;
    const p = [V(s * girth * 0.5, top - girth * 0.2, z), V(s * girth * 0.55, h * 0.45, z + (front ? 0.02 : -0.08) + sw), V(s * girth * 0.55, h * 0.18, z + (front ? 0 : -0.02) + sw * 1.5), V(s * girth * 0.55, 0.0, z + 0.02 + sw * 2)];
    g.add(mesh(sweep(p, (t) => legR * (t < 0.3 ? 2.2 - t * 3 : 1.1 - t * 0.2), (t) => legR * (t < 0.3 ? 2.6 - t * 4 : 1.1), { steps: 20, n: 10 }), m));
  });
  // queue
  if (tail === 'horse') g.add(mesh(sweep([V(0, top + 0.05, -len / 2 - 0.05), V(0, top - 0.25, -len / 2 - 0.25), V(0, top - 0.8, -len / 2 - 0.3)], (t) => 0.06 + t * 0.06, (t) => 0.05 + t * 0.03, { steps: 12, n: 8 }), new THREE.MeshStandardMaterial({ color: C(color).multiplyScalar(0.4), roughness: 0.9 })));
  else if (tail === 'wolf') g.add(mesh(sweep([V(0, top, -len / 2 - 0.02), V(0, top - 0.15, -len / 2 - 0.25), V(0, top - 0.35, -len / 2 - 0.4)], (t) => 0.06 + 0.06 * Math.sin(Math.PI * t), (t) => 0.06 + 0.06 * Math.sin(Math.PI * t), { steps: 12, n: 10 }), m));
  else g.add(mesh(sweep([V(0, top, -len / 2), V(0, top - 0.3, -len / 2 - 0.08)], () => 0.03, () => 0.03, { steps: 4, n: 6 }), m));
  return g;
}
const horse = (color = 0x4a2e1c) => quadruped({ len: 1.6, h: 1.55, girth: 0.34, neck: 0.85, headL: 0.5, color, ears: 0.12, neckUp: 0.75 });
const camel = (color = 0xb08a5a) => quadruped({ len: 1.6, h: 2.0, girth: 0.36, neck: 1.1, headL: 0.45, color, hump: 0.9, neckUp: 0.55, ears: 0.08, legR: 0.06, tail: 'thin' });
const wolf = () => quadruped({ len: 1.05, h: 0.78, girth: 0.25, neck: 0.3, headL: 0.32, color: 0x6a645c, ears: 0.12, neckUp: 0.45, legR: 0.035, tail: 'wolf', snout: 0.7, mat: MAT.fur({ color: 0x7a7468, rep: [3, 3] }) });
function sheep(seed = 1) {
  const g = G(); const wool = MAT.fur({ color: 0xd8d0c0, rep: [3, 3] }); wool.sheen = 0.2;
  const bg = new THREE.SphereGeometry(0.4, 20, 14); displace(bg, (v, n) => v.clone().addScaledVector(n, 0.06 * fbm(v.x * 8 + seed, v.y * 8, v.z * 8, 3)));
  const b = mesh(bg, wool); b.scale.set(0.85, 0.75, 1.25); b.position.y = 0.6; g.add(b);
  const dark = MAT.plain(0x2a2420, 0.8);
  const hd = mesh(new THREE.SphereGeometry(0.13, 12, 10), dark); hd.scale.set(0.8, 0.9, 1.4); hd.position.set(0, 0.72, 0.52); hd.rotation.x = 0.5; g.add(hd);
  for (const [x, z] of [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]]) { const l = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.4, 6), dark); l.position.set(x, 0.2, z); g.add(l); }
  return g;
}
function rider(horseColor, figOpts) {
  const g = G(); g.add(horse(horseColor));
  const f = figure({ ...figOpts, armRot: figOpts.armRot || [[-30, 15], [-40, 12]] });
  f.position.set(0, 0.62, 0.05);
  // jambes écartées : on les masque sous une housse
  f.children[0].scale.set(1.9, 0.6, 1); f.children[0].position.y = 1.05;
  g.add(f);
  const saddle = mesh(new THREE.BoxGeometry(0.75, 0.15, 0.7), MAT.leather({ color: 0x4a2a18 })); saddle.position.set(0, 1.5, 0); g.add(saddle);
  return g;
}

// ------------------------------------------------------------------ préréglages d'ambiance
const DUSK = { top: 0x1c2a4a, mid: 0x6a4a5a, horizon: 0xf09050, sunColor: 0xffa060, fog: 0x6a5060, fogD: 0.006, amb: 0.55, ambSky: 0x5a6a9a, ambGround: 0x3a2418, sunGlow: 1.2 };
const NIGHT = { top: 0x050a18, mid: 0x101a30, horizon: 0x2a3550, ground: 0x0a0a10, sunColor: 0xb0c4f0, sunI: 1.4, sunStrength: 6, fog: 0x1a2438, fogD: 0.02, amb: 0.45, ambSky: 0x30406a, ambGround: 0x080a10, stars: 1, clouds: 0.35, cloudColor: 0x3a4a6a, cloudDark: 0x0a1020, moon: true, sunGlow: 0.6 };
const DESERT = { top: 0x3a6aa8, mid: 0x8ab0d0, horizon: 0xf0d0a0, ground: 0x6a5030, sunColor: 0xfff0d0, sunI: 3.2, fog: 0xc8c0b0, fogD: 0.005, amb: 0.55, ambSky: 0x6a8ac0, ambGround: 0x8a6a40, clouds: 0.15, cloudColor: 0xffffff, cloudDark: 0xc0c8d8 };
const DAY = { top: 0x3a6ab0, mid: 0x8ab8e0, horizon: 0xdce8f0, sunColor: 0xfff4e0, sunI: 3, fog: 0xa8b8c8, fogD: 0.005, amb: 0.6, ambSky: 0x7a9ad0, ambGround: 0x4a4028, clouds: 0.45, cloudColor: 0xffffff, cloudDark: 0x8a98b0 };
const FOREST = { top: 0x2a3a40, mid: 0x5a6a60, horizon: 0xa8a080, sunColor: 0xffe0b0, sunI: 2.2, fog: 0x4a5a50, fogD: 0.025, amb: 0.6, ambSky: 0x6a8a90, ambGround: 0x1a1a10, clouds: 0.6, cloudColor: 0xb0b0a0, cloudDark: 0x404848 };

function cam(fov, pos, look) { const c = new THREE.PerspectiveCamera(fov, 1, 0.1, 6000); c.position.copy(pos); c.lookAt(look); return c; }
const shoot = (scene, camera, w, h, o = {}) => capture({ scene, camera, w, h, bloom: { strength: 0.22, radius: 0.4, threshold: 0.92, ...(o.bloom || {}) }, grade: { vignette: 0.35, contrast: 1.05, sat: 1.05, ...(o.grade || {}) }, exposure: o.exposure ?? 1 });

// heightfields
const hills = (amp = 3, sc = 0.03, base = 0) => (x, z) => base + amp * fbm(x * sc, z * sc, 0.3, 5);
const grassCol = (x, z, h, sl) => mixc(0x5a6a2a, 0x8a7a40, 0.5 + fbm(x * 0.05, z * 0.05, 1, 3)).lerp(C(0x6a5a40), smooth(0.15, 0.4, sl));
const sandCol = (x, z, h, sl) => mixc(0xd8b070, 0xc09050, 0.5 + fbm(x * 0.04, z * 0.04, 2, 3)).lerp(C(0x9a6a40), smooth(0.2, 0.5, sl));
const snowCol = (x, z, h, sl) => mixc(0xc8d0dc, 0xe8ecf0, 0.5 + fbm(x * 0.05, z * 0.05, 3, 3)).lerp(C(0x5a5a60), smooth(0.3, 0.6, sl));
const dryCol = (x, z, h, sl) => mixc(0xb09a68, 0x8a8048, 0.5 + fbm(x * 0.05, z * 0.05, 4, 3)).lerp(C(0x7a6a50), smooth(0.2, 0.5, sl));
const forestFloor = (x, z, h, sl) => mixc(0x3a3a20, 0x4a3a28, 0.5 + fbm(x * 0.1, z * 0.1, 5, 3));
const roadMix = (fn, rx = (z) => 0, w = 2.2, col = 0x8a7458) => (x, z, h, sl) => fn(x, z, h, sl).lerp(C(col), smooth(w, w * 0.5, Math.abs(x - rx(z)) + fbm(x * 0.3, z * 0.3, 7, 2)));

const SH = { aube: { type: 'kite', field: '#e4ddca', emblem: 'sun', emblemColor: '#c99528' }, sables: { type: 'adarga', field: '#2c5a38', emblem: 'star', emblemColor: '#d0a038' }, givre: { type: 'round', field: '#1a2440', emblem: 'raven', emblemColor: '#c4c8ce' } };

// ================================================================== scènes
const S = {};

S.title = (w, h) => {
  const sd = V(1.1, 0.06, -1);
  const scene = world({ ...DUSK, horizon: 0xffa050, mid: 0x7a4a50, top: 0x141c34, sunDir: sd, sunI: 2.2, sunStrength: 25, clouds: 0.55, cloudColor: 0xffb070, cloudDark: 0x4a2a3a, fog: 0x8a5a58, fogD: 0.004, shadowSize: 60, amb: 0.55 });
  const hill = (x, z) => 14 * Math.exp(-((x - 18) ** 2 + (z + 60) ** 2) / 900) + hills(4, 0.02)(x, z) + 2 * fbm(x * 0.1, z * 0.1, 2, 3) * Math.exp(-((x - 18) ** 2 + (z + 60) ** 2) / 900);
  terrain(scene, { size: 600, seg: 260, h: hill, color: (x, z, hh, sl) => dryCol(x, z, hh, sl).lerp(C(0xd0a868), smooth(-40, -150, z) * 0.6) });
  const stone = stoneM(0xd8c0a0, [3, 3]);
  const cit = G(); cit.position.set(18, hill(18, -60) - 0.5, -60);
  const R = 14, pts = 7;
  for (let i = 0; i < pts; i++) {
    const a = i / pts * Math.PI * 2, b = (i + 1) / pts * Math.PI * 2;
    const p1 = V(Math.cos(a) * R, 0, Math.sin(a) * R), p2 = V(Math.cos(b) * R, 0, Math.sin(b) * R);
    const wl = wall(p1.distanceTo(p2), 7, 1.6, stone); wl.position.copy(p1.clone().add(p2).multiplyScalar(0.5)); wl.rotation.y = -Math.atan2(p2.z - p1.z, p2.x - p1.x); cit.add(wl);
    const t = tower(2.4, 10 + (i % 2) * 2, stone, { roof: i % 3 === 0 ? 0x7a3a28 : null }); t.position.copy(p1); cit.add(t);
  }
  const k = keep(9, 7, 17, stone); k.position.set(-1, 0, -2); cit.add(k);
  const plinthG = new THREE.CylinderGeometry(15.5, 22, 16, 40, 8); displace(plinthG, (v) => { const a = Math.atan2(v.z, v.x); const k = 1 + 0.08 * fbm(Math.cos(a) * 3, v.y * 0.15, Math.sin(a) * 3, 4); return V(v.x * k, v.y, v.z * k); });
  const plinth = mesh(plinthG, MAT.rock({ color: 0xb09878, rep: [6, 2] })); plinth.position.y = -8; cit.add(plinth);
  const k2 = tower(2.8, 24, stone, { roof: 0x6a3020 }); k2.position.set(5, 0, -4); cit.add(k2);
  const dome = mesh(new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stoneM(0xe0d0b0)); dome.position.set(-6, 9, 5); cit.add(dome);
  const domeBase = mesh(new THREE.CylinderGeometry(3, 3, 9, 24), stone); domeBase.position.set(-6, 4.5, 5); cit.add(domeBase);
  [[5, 25.5, -4, 0xa02a20], [-1, 18.5, -2, 0xe4ddca], [-9.5, 13, 3, 0x2c5a38]].forEach(([x, y, z, c], i) => { const b = banner(c, i === 1 ? 'sun' : null, '#c99528', 3.5); b.position.set(x, y - 1, z); b.scale.setScalar(1.6); cit.add(b); });
  scene.add(cit);
  scatter(scene, 40, (r) => (r() < 0.5 ? cypress(r.range(5, 9), r) : r() < 0.6 ? palm(r.range(6, 9), r) : bush(r.range(1, 2.2), 0x5a6230)), (r) => { const x = r.range(-30, 70), z = r.range(-90, -20); if (Math.hypot(x - 18, z + 60) < 20) return null; return V(x, hill(x, z), z); }, 7);
  scatter(scene, 14, (r) => rock(r.range(0.8, 2.5), 0xb09a78, r() * 9), (r) => { const x = r.range(-20, 50), z = r.range(-40, -5); return V(x, hill(x, z), z); }, 8);
  embers(scene, V(18, 30, -60), 30, 60, 0xffc890, 0.25);
  const c = cam(38, V(-22, 6, 4), V(4, 12, -60));
  return shoot(scene, c, w, h, { grade: { vignette: 0.5, sat: 1.1 } });
};

S.camp = (w, h) => {
  const scene = world({ ...DUSK, top: 0x0c1226, mid: 0x3a2a40, horizon: 0xb05a3a, sunDir: V(-0.6, 0.02, -1), sunI: 0.5, sunStrength: 8, fog: 0x3a2a30, fogD: 0.025, amb: 0.18, clouds: 0.5, cloudColor: 0xc06040, cloudDark: 0x1a1424, stars: 0.6 });
  terrain(scene, { size: 300, h: hills(2.5, 0.03), color: (x, z, hh, sl) => grassCol(x, z, hh, sl).multiplyScalar(0.8).lerp(C(0x5a4a38), 0.4) });
  const hh = hills(2.5, 0.03);
  const r = rng(9);
  const tents = [[-8, -10, 'b'], [-3, -16, 'r'], [4, -12, 'b'], [10, -18, 'b'], [-12, -22, 'r'], [0, -26, 'b'], [14, -28, 'r'], [-6, -32, 'b'], [7, -38, 'b']];
  tents.forEach(([x, z, t], i) => { const o = t === 'b' ? bellTent(r.range(2, 2.8), r.range(3, 3.8), [0xd8ccb0, 0xc8b898, 0xa89878][i % 3], i % 3 === 0 ? 0.8 : 0) : ridgeTent(3, 4, 2.2, 0xb8a888, i % 2 ? 0.5 : 0); o.position.set(x, hh(x, z) - 0.1, z); o.rotation.y = r() * 6; scene.add(o); });
  [[0, -6], [-9, -18], [9, -22]].forEach(([x, z], i) => fire(scene, V(x, hh(x, z), z), i ? 0.8 : 1.2, { light: 40 }));
  [[-4, -8, 0xa02a20], [6, -16, 0x2c5a38], [-10, -26, 0x1a2a50], [3, -30, 0xe4ddca]].forEach(([x, z, c], i) => { const b = banner(c, ['sun', 'star', 'raven', 'sun'][i], i === 2 ? '#c4c8ce' : '#c99528', 5); b.position.set(x, hh(x, z), z); scene.add(b); });
  [[1.5, -4.5, 200], [-1.5, -5.2, 140], [-7.5, -16.5, 30], [8, -20.5, 250]].forEach(([x, z, ry], i) => { const f = figure({ faction: ['aube', 'sables', 'givre', 'aube'][i], variant: i, coat: [0xd8d0bc, 0x2f5a3a, 0x2a3a5a, 0xd0c8b0][i], cloakColor: i % 2 ? 0x3a2a20 : null, spear: i === 0 }); f.position.set(x, hh(x, z), z); f.rotation.y = deg(ry); scene.add(f); });
  // ratelier d'armes
  for (let i = 0; i < 5; i++) { const sp = M.spear({ len: 2.2 }); sp.position.set(4 + i * 0.25, hh(4, -7), -7); sp.rotation.z = 0.12; scene.add(sp); }
  embers(scene, V(0, 1, -6), 40, 6);
  const c = cam(42, V(2, 3.2, 6), V(-1, 2, -18));
  return shoot(scene, c, w, h, { exposure: 0.9, grade: { vignette: 0.55 } });
};

// ------------------------------------------------------------------ ennemis
function enemyScene(preset, groundFn, colFn, opts = {}) {
  const scene = world({ ...preset, ...opts });
  terrain(scene, { size: 200, h: groundFn, color: colFn });
  return scene;
}
S.loup = (w, h) => {
  const gh = hills(1.2, 0.05);
  const scene = enemyScene(NIGHT, gh, snowCol, { sunDir: V(0.4, 0.5, -1), sunI: 1.4, fogD: 0.04 });
  scatter(scene, 45, (r) => conifer(r.range(6, 12), 0x1c2c24, r), (r) => { const x = r.range(-25, 25), z = r.range(-40, -6); if (Math.abs(x) < 3 && z > -14) return null; return V(x, gh(x, z), z); }, 3);
  const wf = wolf(); wf.position.set(0, gh(0, -3), -3); wf.rotation.y = deg(-25); scene.add(wf);
  const w2 = wolf(); w2.position.set(-4.5, gh(-4.5, -9), -9); w2.rotation.y = deg(30); w2.scale.setScalar(0.95); scene.add(w2);
  // yeux luisants
  [wf, w2].forEach((o) => o.traverse((m) => { if (m.isMesh && m.geometry.type === 'SphereGeometry' && m.material.color && m.material.color.getHex() === 0x080606) { m.material = new THREE.MeshBasicMaterial({ color: C(0xffd060).multiplyScalar(4) }); } }));
  const c = cam(35, V(1.2, 1.1, 2.2), V(-0.8, 0.7, -5));
  return shoot(scene, c, w, h, { exposure: 1.3, grade: { vignette: 0.45 } });
};
S.brigand = (w, h) => {
  const gh = hills(1, 0.04);
  const scene = enemyScene(FOREST, gh, roadMix(forestFloor, (z) => Math.sin(z * 0.1) * 2), { sunDir: V(-0.6, 0.6, 0.6), amb: 0.8 });
  scatter(scene, 50, (r) => (r() < 0.6 ? broadleaf(r.range(7, 11), 0x2e4420, r) : conifer(r.range(8, 12), 0x223420, r)), (r) => { const x = r.range(-20, 20), z = r.range(-40, -4); if (Math.abs(x - Math.sin(z * 0.1) * 2) < 3.5) return null; return V(x, gh(x, z), z); }, 4);
  const f = figure({ faction: 'aube', variant: 2, coat: 0x4a3a28, mail: false, hood: 0x3a2e22, legs: 0x3a3024, axe: true, beard: 1, armRot: [[-10, 10], [-50, 20]], skin: 0x9a7058 });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-15); scene.add(f);
  const f2 = figure({ variant: 3, coat: 0x5a4a30, mail: false, hood: 0x2a2a20, legs: 0x3a3024, beard: 0.6, skin: 0x9a7058 }); f2.position.set(-3, gh(-3, -8), -8); f2.rotation.y = deg(20); scene.add(f2);
  const c = cam(38, V(0.5, 1.5, 0.4), V(-0.4, 1.15, -6));
  return shoot(scene, c, w, h, { exposure: 1.1 });
};
S.deserteur = (w, h) => {
  const gh = hills(1.5, 0.03);
  const scene = enemyScene(DUSK, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).multiplyScalar(0.7).lerp(C(0x2a2018), smooth(0.2, 0.5, fbm(x * 0.15, z * 0.15, 9, 3) + 0.2)), { sunDir: V(-0.7, 0.3, 0.6), fogD: 0.01 });
  const f = figure({ faction: 'aube', variant: 0, coat: 0x8a8070, legs: 0x4a4030, armRot: [[-20, 12], [-15, 18]], beard: 0.8, spear: true });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-20); scene.add(f);
  // champ de bataille : boucliers brisés, lances plantées
  scatter(scene, 10, (r) => { const s = M.spear({ len: 2 }); s.rotation.z = r.range(-0.5, 0.5); s.rotation.x = r.range(-0.4, 0.4); return s; }, (r) => { const x = r.range(-12, 12), z = r.range(-20, -5); return V(x, gh(x, z) - 0.3, z); }, 6);
  scatter(scene, 4, (r) => { const s = M.roundShield({ field: '#5a3a2a', R: 0.4 }); s.rotation.x = -Math.PI / 2 + 0.3; return s; }, (r) => { const x = r.range(-6, 6), z = r.range(-10, -4); return V(x, gh(x, z) + 0.1, z); }, 7);
  fire(scene, V(6, gh(6, -16), -16), 1.4, { light: 20 });
  const c = cam(38, V(0.6, 1.4, 0.4), V(-0.4, 1.2, -6));
  return shoot(scene, c, w, h);
};
S.pillard = (w, h) => {
  const dunes = (x, z) => 2 * Math.sin(x * 0.08 + Math.sin(z * 0.05) * 2) + 1.5 * fbm(x * 0.03, z * 0.03, 1, 4) * 3;
  const scene = enemyScene({ ...DESERT, horizon: 0xf0a060, mid: 0xc08060, top: 0x3a4a78, sunColor: 0xffb070, sunI: 2.6 }, dunes, sandCol, { sunDir: V(-0.8, 0.12, -1), fogD: 0.012 });
  const rd = rider(0x2a1e16, { faction: 'sables', variant: 1, coat: 0x2a2a2a, cloakColor: 0x3a3028, spear: true, armRot: [[-20, 10], [-60, 15]], beard: 1, skin: 0x7a5038 });
  rd.position.set(0, dunes(0, -4) - 0.1, -4); rd.rotation.y = deg(-55); scene.add(rd);
  const r2 = rider(0x6a4a30, { faction: 'sables', variant: 0, coat: 0x8a7050, spear: true, skin: 0x7a5038 }); r2.position.set(-6, dunes(-6, -14), -14); r2.rotation.y = deg(-40); scene.add(r2);
  const c = cam(40, V(2.2, 1.6, 1.5), V(-0.6, 1.8, -6));
  return shoot(scene, c, w, h);
};
S.mercenaire = (w, h) => {
  const gh = (x, z) => hills(2, 0.04)(x, z) + Math.max(0, -z - 30) * 0.6;
  const scene = enemyScene({ ...DAY, horizon: 0xd8c8b0, sunColor: 0xffe8c8, clouds: 0.7, cloudDark: 0x6a7080 }, gh, (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x7a7068), smooth(0.25, 0.5, sl)), { sunDir: V(-0.6, 0.5, 0.3) });
  scatter(scene, 12, (r) => rock(r.range(0.6, 2), 0x8a8478, r() * 9), (r) => { const x = r.range(-14, 14), z = r.range(-25, -5); return V(x, gh(x, z), z); }, 3);
  const f = figure({ faction: 'aube', variant: 3, coat: 0x6a3a28, legs: 0x3a3028, shield: { type: 'round', field: '#6a5030' }, axe: true, cloakColor: 0x4a3a2a, armRot: [[-10, 12], [-45, 18]], beard: 0.9, skin: 0xa07058 });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-20); scene.add(f);
  const c = cam(38, V(0.5, 1.4, 0.4), V(-0.4, 1.2, -6));
  return shoot(scene, c, w, h);
};
S['chevalier-noir'] = (w, h) => {
  const gh = hills(1.2, 0.04);
  const scene = enemyScene({ ...DUSK, top: 0x1a0a10, mid: 0x5a1a1a, horizon: 0xc04020, sunColor: 0xff6030, fog: 0x4a1a14, fogD: 0.02, clouds: 0.8, cloudColor: 0xa03020, cloudDark: 0x1a0808 }, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).multiplyScalar(0.45), { sunDir: V(0.6, 0.25, 0.7), sunI: 2.2, amb: 0.6 });
  const blackSteel = MAT.metal({ color: 0x3a3a3e, rough: 0.35 });
  const f = figure({ faction: 'aube', variant: 0, coat: 0x141414, legs: 0x1a1a1a, shield: { type: 'kite', field: '#151515' }, sword: true, cloakColor: 0x200808, armRot: [[-10, 10], [-30, 15]], beard: 0 });
  f.traverse((o) => { if (o.isMesh && o.material && o.material.metalness === 1) o.material = blackSteel; if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.normalMap && o.material.normalScale && o.material.normalScale.x === 1.6) { o.material = MAT.mail({ color: 0x3a3a3a, rep: [12, 12] }); } });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-12); scene.add(f);
  scatter(scene, 8, (r) => { const b = broadleaf(r.range(5, 8), 0x1a1410, r); b.children.slice(1).forEach((c) => (c.visible = r() < 0.3)); return b; }, (r) => { const x = r.range(-15, 15), z = r.range(-30, -12); if (Math.abs(x) < 4) return null; return V(x, gh(x, z), z); }, 9);
  const c = cam(38, V(0.4, 1.3, 0.5), V(-0.3, 1.35, -6));
  return shoot(scene, c, w, h, { grade: { vignette: 0.5 } });
};
S.champion = (w, h) => {
  const gh = (x, z) => 0.3 * fbm(x * 0.1, z * 0.1, 1, 3);
  const scene = enemyScene({ ...DESERT, top: 0x2a3a5a, mid: 0x8a8090, horizon: 0xe8b880, sunColor: 0xffc890, sunI: 2.2, fog: 0xb09070, fogD: 0.02, clouds: 0.5 }, gh, (x, z, hh, sl) => mixc(0xa89878, 0x8a7a60, 0.5 + fbm(x * 0.2, z * 0.2, 1, 3)), { sunDir: V(0.7, 0.35, -0.6) });
  const st = stoneM(0xc8b8a0, [1, 3]);
  // ruines : colonnes, murs effondrés
  [[-4, -8, 6], [4, -8, 3.5], [-4, -14, 4.5], [4, -14, 6], [-4, -20, 2], [4, -20, 5]].forEach(([x, z, hh]) => { const col = mesh(new THREE.CylinderGeometry(0.5, 0.55, hh, 16), st); col.position.set(x, hh / 2, z); scene.add(col); const cap = mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), st); cap.position.set(x, hh + 0.2, z); if (hh > 4.5) scene.add(cap); });
  const wl = wall(12, 4, 1, st, false); wl.position.set(0, 0, -24); scene.add(wl);
  scatter(scene, 14, (r) => { const b = mesh(new THREE.BoxGeometry(r.range(0.5, 1.2), r.range(0.4, 0.8), r.range(0.5, 1)), st); b.rotation.set(r(), r(), r()); return b; }, (r) => V(r.range(-7, 7), 0.2, r.range(-18, -4)), 4);
  const f = figure({ faction: 'aube', variant: 1, coat: 0x6a5a40, legs: 0x3a3028, shield: { type: 'round', field: '#5a4a3a' }, sword: 'maitre', cloakColor: 0x5a2018, armRot: [[-10, 12], [-25, 20]], scale: 2.1, beard: 1 });
  f.position.set(0, 0, -9); f.rotation.y = deg(-8); scene.add(f);
  const c = cam(40, V(0.5, 0.9, 1.6), V(0, 3.2, -9));
  return shoot(scene, c, w, h);
};

// ------------------------------------------------------------------ travaux
S.troupeaux = (w, h) => {
  const gh = (x, z) => hills(5, 0.025)(x, z) + Math.max(0, -z - 20) * 0.3;
  const scene = world({ ...DAY, sunDir: V(-0.6, 0.6, -0.4) });
  terrain(scene, { size: 300, h: gh, color: grassCol });
  scatter(scene, 22, (r) => sheep(r() * 9), (r) => { const x = r.range(-10, 10), z = r.range(-20, -4); return V(x, gh(x, z), z); }, 2);
  scatter(scene, 12, (r) => broadleaf(r.range(5, 8), 0x3a5a24, r), (r) => { const x = r.range(-40, 40), z = r.range(-80, -30); return V(x, gh(x, z), z); }, 3);
  const f = figure({ variant: 2, coat: 0x6a5a3a, mail: false, hood: 0x5a4a30, legs: 0x4a3a28, beard: 0.8, skin: 0xa07058 }); const st = M.staff(); st.position.set(0.45, 0, 0.1); f.add(st); f.position.set(3, gh(3, -3), -3); f.rotation.y = deg(-40); scene.add(f);
  return shoot(scene, cam(40, V(2, 3, 5), V(0, 0, -12)), w, h);
};
S.bucheron = (w, h) => {
  const gh = hills(0.8, 0.05);
  const scene = world({ ...FOREST, sunDir: V(-0.6, 0.7, -0.3), fogD: 0.03 });
  terrain(scene, { size: 200, h: gh, color: forestFloor });
  scatter(scene, 40, (r) => conifer(r.range(9, 14), 0x223420, r), (r) => { const x = r.range(-20, 20), z = r.range(-35, -5); if (Math.hypot(x, z + 4) < 5) return null; return V(x, gh(x, z), z); }, 5);
  const wood = MAT.wood({ color: 0x8a6440, rep: [1, 2] });
  for (let i = 0; i < 7; i++) { const lg = mesh(new THREE.CylinderGeometry(0.22, 0.24, 3, 14), wood); lg.rotation.z = Math.PI / 2; lg.position.set(-1.5 + (i % 4) * 0.02, gh(-1.5, -3) + 0.22 + (i < 4 ? 0 : 0.4), -3 + (i < 4 ? (i - 1.5) * 0.46 : (i - 5) * 0.46)); lg.rotation.y = 0.3; scene.add(lg); const end = mesh(new THREE.CircleGeometry(0.22, 14), MAT.plain(0xc8a070)); end.position.copy(lg.position).add(V(1.5 * Math.cos(0.3) + 0.01, 0, -1.5 * Math.sin(0.3))); end.rotation.y = Math.PI / 2 + 0.3; scene.add(end); }
  const stump = mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 16), wood); stump.position.set(1.2, gh(1.2, -2) + 0.3, -2); scene.add(stump);
  const top = mesh(new THREE.CircleGeometry(0.4, 16), MAT.plain(0xc8a070)); top.rotation.x = -Math.PI / 2; top.position.set(1.2, gh(1.2, -2) + 0.61, -2); scene.add(top);
  const ax = M.daneAxe(); ax.scale.setScalar(0.7); ax.rotation.z = 0.6; ax.rotation.y = 0.4; ax.position.set(1.0, gh(1.2, -2) - 0.05, -1.8); scene.add(ax);
  return shoot(scene, cam(42, V(1.5, 2, 3), V(-0.4, 0.6, -4)), w, h);
};
S.pelerins = (w, h) => {
  const gh = hills(3, 0.025);
  const rx = (z) => Math.sin(z * 0.06) * 4;
  const scene = world({ ...DUSK, top: 0x3a5a8a, mid: 0xc09080, horizon: 0xffc080, sunDir: V(-0.3, 0.15, -1), sunI: 2.2, fogD: 0.012 });
  terrain(scene, { size: 300, h: gh, color: roadMix(dryCol, rx, 1.8) });
  [[0.4, -4], [-0.6, -6], [0.8, -8.5], [-0.2, -12]].forEach(([x, z], i) => { const f = figure({ variant: i, coat: [0x6a5a48, 0x8a7a60, 0x5a4a3a, 0x7a6a50][i], mail: false, hood: [0x4a3a2a, 0x6a5a48, 0x3a2e24, 0x5a4a38][i], legs: 0x4a3a2a, beard: i % 2, skin: 0xa07058, cloakColor: 0x5a4a38 }); const st = M.staff(); st.scale.setScalar(1.1); st.position.set(0.42, 0, 0.15); f.add(st); f.position.set(rx(z) + x, gh(rx(z) + x, z), z); f.rotation.y = deg(170 + i * 5); scene.add(f); });
  scatter(scene, 18, (r) => (r() < 0.5 ? cypress(r.range(5, 8), r) : broadleaf(r.range(4, 6), 0x5a6230, r)), (r) => { const z = r.range(-60, -6), x = rx(z) + (r() < 0.5 ? -1 : 1) * r.range(4, 25); return V(x, gh(x, z), z); }, 3);
  return shoot(scene, cam(40, V(1.5, 1.8, 1), V(-1, 1.2, -14)), w, h);
};
S.forge = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x100806, 0.06);
  scene.add(new THREE.HemisphereLight(0x302820, 0x0a0604, 0.25));
  const floor = mesh(new THREE.PlaneGeometry(30, 30), MAT.rock({ color: 0x4a3a2c, rep: [6, 6] })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wl = mesh(new THREE.PlaneGeometry(30, 10), stoneM(0x6a5a48, [8, 3])); wl.position.set(0, 5, -4); scene.add(wl);
  // foyer
  const hearth = mesh(new THREE.BoxGeometry(2.4, 1, 1.6), stoneM(0x7a6a58, [2, 1])); hearth.position.set(-2.2, 0.5, -3); scene.add(hearth);
  const coals = mesh(new THREE.BoxGeometry(1.8, 0.1, 1.1), new THREE.MeshBasicMaterial({ color: C(0xff5a10).multiplyScalar(1.5) })); coals.position.set(-2.2, 1.02, -3); scene.add(coals);
  const pl = new THREE.PointLight(0xff7020, 14, 12, 1.6); pl.position.set(-2.2, 1.6, -2.6); pl.castShadow = true; scene.add(pl);
  const hood = mesh(new THREE.CylinderGeometry(0.4, 1.4, 1.6, 4), stoneM(0x5a4a3a)); hood.position.set(-2.2, 2.8, -3.2); hood.rotation.y = Math.PI / 4; scene.add(hood);
  // enclume
  const iron = MAT.metal({ color: 0x5a5a5c, rough: 0.4 });
  const an = G(); an.position.set(0.4, 0, -1.5);
  const blk = mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 12), MAT.wood({ color: 0x4a3020 })); blk.position.y = 0.3; an.add(blk);
  const body = mesh(new THREE.BoxGeometry(0.7, 0.3, 0.28), iron); body.position.y = 0.75; an.add(body);
  const waist = mesh(new THREE.BoxGeometry(0.35, 0.2, 0.2), iron); waist.position.y = 0.55; an.add(waist);
  const horn = mesh(new THREE.ConeGeometry(0.13, 0.45, 12), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.55, 0.78, 0); an.add(horn);
  const bar = mesh(new THREE.BoxGeometry(0.6, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: C(0xffa030).multiplyScalar(3) })); bar.position.set(0.05, 0.92, 0.02); an.add(bar);
  const ham = G(); const hh = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), iron); const hd = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.4, 8), MAT.wood()); hd.rotation.z = Math.PI / 2; hd.position.x = 0.2; ham.add(hh, hd); ham.position.set(-0.25, 0.95, -0.05); ham.rotation.y = 0.5; an.add(ham);
  const tong = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), iron); tong.rotation.z = 1.3; tong.position.set(0.5, 0.95, 0.05); an.add(tong);
  scene.add(an);
  const bl = new THREE.PointLight(0xffa040, 6, 3, 2); bl.position.set(0.4, 1.1, -1.2); scene.add(bl);
  embers(scene, V(0.4, 1.0, -1.4), 40, 1.2, 0xffb040, 0.04);
  for (let i = 0; i < 4; i++) { const t = M.sword({ type: 'normande' }); t.position.set(1.8 + i * 0.25, 1.7, -3.9); t.rotation.z = Math.PI; scene.add(t); }
  const bucket = mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 14), MAT.wood({ color: 0x5a3a20 })); bucket.position.set(1.5, 0.25, -2.3); scene.add(bucket);
  scene.add(new THREE.AmbientLight(0x6a5040, 0.6));
  return shoot(scene, cam(40, V(1.4, 1.5, 0.6), V(0, 0.8, -1.8)), w, h, { exposure: 1.0, bloom: { strength: 0.4 } });
};
S.remparts = (w, h) => {
  const scene = world({ ...NIGHT, sunDir: V(0.6, 0.45, 0.6), sunI: 1.6 });
  terrain(scene, { size: 300, h: hills(2, 0.03, -1), color: (x, z, hh, sl) => grassCol(x, z, hh, sl).multiplyScalar(0.5) });
  const st = stoneM(0xa89880, [6, 2]);
  const wl = wall(40, 8, 3, st); wl.position.set(0, 0, -12); wl.rotation.y = 0.35; scene.add(wl);
  const tw = tower(3, 12, st, { roof: 0x3a2a24 }); tw.position.set(-6, 0, -9.5); scene.add(tw);
  const tw2 = tower(3, 11, st); tw2.position.set(12, 0, -16.5); scene.add(tw2);
  for (let i = 0; i < 6; i++) { const x = -16 + i * 6.5; const z = -12 - Math.tan(0.35) * x + 1.9; torch(scene, V(x, 6.2, z), 2.2); }
  const g1 = figure({ faction: 'aube', variant: 0, coat: 0xd8d0bc, spear: true }); g1.position.set(2, 8.2, -12.5 + 0.3); g1.rotation.y = deg(30); scene.add(g1);
  return shoot(scene, cam(42, V(6, 3, 6), V(-1, 6, -12)), w, h, { exposure: 1.5 });
};
S.caravane = (w, h) => {
  const dunes = (x, z) => 2.5 * Math.sin(x * 0.06 + Math.sin(z * 0.04) * 2) + 4 * fbm(x * 0.02, z * 0.02, 1, 4);
  const scene = world({ ...DESERT, sunDir: V(-0.7, 0.2, -1), sunColor: 0xffc890, horizon: 0xf8c890 });
  terrain(scene, { size: 400, h: dunes, color: sandCol });
  for (let i = 0; i < 5; i++) { const x = -6 + i * 3.2, z = -8 - i * 2.2; const cm = camel([0xb08a5a, 0x9a7448, 0xc0986a, 0xa88050, 0xb89060][i]); cm.position.set(x, dunes(x, z), z); cm.rotation.y = deg(110); scene.add(cm);
    const load = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), MAT.cloth({ color: [0x8a3020, 0x2f5a3a, 0xc8a050, 0x5a3a6a, 0x8a3020][i], rep: [2, 2] })); load.position.set(x, dunes(x, z) + 2.1, z); load.rotation.y = deg(110); scene.add(load); }
  const f = figure({ faction: 'sables', variant: 2, coat: 0xd8c8a0, cloakColor: 0x8a7050, skin: 0x7a5038, helm: false, hood: 0xe8dcc0 }); const st = M.staff(); st.position.set(0.42, 0, 0.15); f.add(st); f.position.set(-9, dunes(-9, -6), -6); f.rotation.y = deg(100); scene.add(f);
  scatter(scene, 3, (r) => palm(r.range(6, 8), r), (r) => { const x = r.range(20, 35), z = r.range(-40, -30); return V(x, dunes(x, z), z); }, 4);
  return shoot(scene, cam(40, V(-4, 3.5, 6), V(2, 2, -14)), w, h);
};
S.eclaireur = (w, h) => {
  const ridge = (x, z) => 6 * Math.exp(-((z + 12) ** 2) / 40) + hills(3, 0.02)(x, z) - Math.max(0, z + 4) * 0.5;
  const scene = world({ ...DUSK, sunDir: V(-0.6, 0.35, 0.7), sunI: 2.8, horizon: 0xffb060, top: 0x24345a });
  terrain(scene, { size: 400, h: ridge, color: (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x8a7a50), 0.4) }); scene.add(new THREE.AmbientLight(0x8a7a90, 0.5));
  const rd = rider(0x6a4a30, { faction: 'aube', variant: 1, coat: 0xd8d0bc, cloakColor: 0x7a2a20, spear: true });
  rd.position.set(0, ridge(0, -12), -12); rd.rotation.y = deg(-80); scene.add(rd);
  const b = banner(0xa02a20, null, '#c99528', 3); b.position.set(0.3, ridge(0, -12) + 1.6, -12.2); b.scale.setScalar(0.8); scene.add(b);
  return shoot(scene, cam(36, V(3, 1.5, 6), V(0, 4.5, -12)), w, h);
};
S.recrues = (w, h) => {
  const scene = world({ ...DAY, sunDir: V(-0.5, 0.7, 0.3) });
  terrain(scene, { size: 200, h: (x, z) => 0.2 * fbm(x * 0.1, z * 0.1, 1, 2), color: (x, z) => mixc(0x8a7458, 0x9a8462, 0.5 + fbm(x * 0.2, z * 0.2, 1, 3)) });
  // palissade
  const wood = MAT.wood({ color: 0x6a4a2a, rep: [1, 2] });
  for (let i = 0; i < 40; i++) { const p = mesh(new THREE.CylinderGeometry(0.15, 0.15, 3 + (i % 3) * 0.2, 8), wood); p.position.set(-12 + i * 0.6, 1.5, -14); scene.add(p); const tp = mesh(new THREE.ConeGeometry(0.15, 0.4, 8), wood); tp.position.set(-12 + i * 0.6, 3.2 + (i % 3) * 0.1, -14); scene.add(tp); }
  // mannequins d'entraînement
  for (const x of [-4, 4]) { const post = mesh(new THREE.CylinderGeometry(0.1, 0.12, 2, 8), wood); post.position.set(x, 1, -8); scene.add(post); const arm = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), wood); arm.rotation.z = Math.PI / 2; arm.position.set(x, 1.6, -8); scene.add(arm); const sack = mesh(new THREE.SphereGeometry(0.3, 12, 10), MAT.cloth({ color: 0xb09a70 })); sack.position.set(x, 2.1, -8); sack.scale.y = 1.3; scene.add(sack); const sh = M.roundShield({ field: '#7a5a3a', R: 0.4 }); sh.position.set(x, 1.4, -7.85); scene.add(sh); }
  [[-2, -5, 160], [-0.5, -5.2, 170], [1, -5, 180], [2.5, -5.3, 190], [0, -2.5, 10]].forEach(([x, z, ry], i) => { const f = figure({ faction: i === 4 ? 'aube' : 'aube', variant: i % 4, coat: i === 4 ? 0xa02a20 : 0xb8a888, mail: i === 4, helm: i === 4, legs: 0x5a4a38, spear: i < 4, armRot: i < 4 ? [[-10, 10], [-60, 10]] : [[-10, 10], [-10, 10]], beard: i % 2 ? 0.4 : 0 }); f.position.set(x, 0, z); f.rotation.y = deg(ry); scene.add(f); });
  const b = banner(0xe4ddca, 'sun', '#c99528', 5); b.position.set(5, 0, -12); scene.add(b);
  return shoot(scene, cam(40, V(4, 3.5, 3), V(-1, 1, -8)), w, h);
};
S.brigands = (w, h) => {
  const gh = hills(0.8, 0.05);
  const rx = (z) => Math.sin(z * 0.12) * 2.5;
  const scene = world({ ...FOREST, top: 0x18242c, mid: 0x34403a, horizon: 0x6a7058, sunI: 1.2, fog: 0x2a3430, fogD: 0.03, amb: 1.4, ambSky: 0x6a80a0, sunDir: V(0.3, 0.8, 0.3) });
  terrain(scene, { size: 200, h: gh, color: roadMix((x, z, hh, sl) => forestFloor(x, z, hh, sl).multiplyScalar(0.6), rx, 1.6, 0x4a3e30) });
  scatter(scene, 70, (r) => (r() < 0.5 ? broadleaf(r.range(8, 12), 0x1c2a18, r) : conifer(r.range(9, 13), 0x18241a, r)), (r) => { const z = r.range(-40, -4), x = r.range(-18, 18); if (Math.abs(x - rx(z)) < 3.5) return null; return V(x, gh(x, z), z); }, 6);
  const f = figure({ variant: 3, coat: 0x2a2620, mail: false, hood: 0x1a1814, legs: 0x2a2620, beard: 1, skin: 0x8a6048 }); f.position.set(-2.5, gh(-2.5, -8), -8); f.rotation.y = deg(60); scene.add(f);
  const lantern = new THREE.PointLight(0xffa050, 10, 10, 1.6); lantern.position.set(-2.2, gh(-2.5, -8) + 1.3, -7.6); scene.add(lantern);
  return shoot(scene, cam(42, V(0.5, 1.7, 2), V(-1, 1.2, -12)), w, h, { exposure: 1.8 });
};
S.ambassade = (w, h) => {
  const scene = world({ ...DUSK, sunDir: V(-0.6, 0.25, -0.6), sunI: 2.2, top: 0x2a3a60, horizon: 0xf8b070 });
  terrain(scene, { size: 200, h: hills(1, 0.03), color: dryCol });
  // grande tente ouverte (pavillon)
  const cloth = MAT.cloth({ color: 0xe8dcc0, rep: [6, 4], sheen: 0.4 });
  const roof = mesh(lathe([[0.1, 4.5], [2.2, 3.5], [4.6, 2.6]], 8), cloth); roof.position.set(0, 0, -6); scene.add(roof);
  const val = mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.5, 8, 1, true), MAT.cloth({ color: 0xa02a20, rep: [8, 1] })); val.position.set(0, 2.35, -6); scene.add(val);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), MAT.wood()); p.position.set(Math.cos(a) * 4.4, 1.3, -6 + Math.sin(a) * 4.4); scene.add(p); }
  const back = mesh(new THREE.CylinderGeometry(4.5, 4.5, 2.6, 16, 1, true, Math.PI * 0.85, Math.PI * 1.3), MAT.cloth({ color: 0xc8b898, rep: [8, 2] })); back.position.set(0, 1.3, -6); scene.add(back);
  // table et documents
  const table = mesh(new THREE.BoxGeometry(2.6, 0.1, 1.2), MAT.wood({ color: 0x5a3a20 })); table.position.set(0, 0.85, -5.5); scene.add(table);
  for (const x of [-1.1, 1.1]) for (const z of [-0.45, 0.45]) { const l = mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), MAT.wood({ color: 0x4a2a18 })); l.position.set(x, 0.42, -5.5 + z); scene.add(l); }
  const cloth2 = mesh(new THREE.BoxGeometry(2.7, 0.02, 0.6), MAT.cloth({ color: 0x2f5a3a })); cloth2.position.set(0, 0.91, -5.5); scene.add(cloth2);
  const parch = mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshStandardMaterial({ map: (() => { const t = tex('wood_c', [1, 1], true); return null; })(), color: 0xe8d8b0, roughness: 0.9 })); parch.rotation.x = -Math.PI / 2; parch.position.set(-0.3, 0.93, -5.4); parch.rotation.z = 0.2; scene.add(parch);
  const cup = mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.15, 12), MAT.gold()); cup.position.set(0.6, 0.98, -5.5); scene.add(cup);
  [[-2.4, -3.2, 0xe4ddca, 'sun'], [2.4, -3.2, 0x2c5a38, 'star'], [6.5, -7, 0x1a2a50, 'raven']].forEach(([x, z, c, e]) => { const b = banner(c, e, e === 'raven' ? '#c4c8ce' : '#c99528', 4.5); b.position.set(x, 0, z); scene.add(b); });
  [[-1.8, -5.5, 90, 'aube', 0xe4ddca], [1.8, -5.5, -90, 'sables', 0x2f5a3a]].forEach(([x, z, ry, fa, co], i) => { const f = figure({ faction: fa, variant: i, coat: co, cloakColor: i ? 0xc8a050 : 0x7a2a20, armRot: [[-10, 10], [-35, 10]] }); f.position.set(x, 0, z); f.rotation.y = deg(ry); scene.add(f); });
  return shoot(scene, cam(42, V(3.5, 2.6, 4), V(-0.4, 1.3, -5.5)), w, h);
};

// ------------------------------------------------------------------ actions
S.patrouille = (w, h) => {
  const gh = hills(2.5, 0.025); const rx = (z) => Math.sin(z * 0.05) * 5;
  const scene = world({ ...DAY, sunDir: V(-0.7, 0.45, -0.3), clouds: 0.6 });
  terrain(scene, { size: 300, h: gh, color: roadMix(grassCol, rx, 1.8) });
  for (let i = 0; i < 6; i++) { const z = -4 - i * 2.2; const x = rx(z) + (i % 2 ? 0.6 : -0.6); const f = figure({ faction: 'aube', variant: i % 4, coat: 0xd8d0bc, spear: true, shield: i % 2 ? SH.aube : null, armRot: [[-5, 8], [-25, 10]] }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(195 - i * 2); scene.add(f); }
  scatter(scene, 20, (r) => broadleaf(r.range(5, 9), 0x3a5a24, r), (r) => { const z = r.range(-80, -8), x = rx(z) + (r() < 0.5 ? -1 : 1) * r.range(6, 30); return V(x, gh(x, z), z); }, 3);
  const b = banner(0xe4ddca, 'sun', '#c99528', 4.5); b.position.set(rx(-6) + 1.2, gh(rx(-6), -6), -6); scene.add(b);
  return shoot(scene, cam(38, V(4, 2.5, 3), V(-1, 1.3, -10)), w, h);
};
S.pillage = (w, h) => {
  const gh = hills(1.2, 0.03);
  const scene = world({ ...DUSK, top: 0x1a1018, mid: 0x5a2a20, horizon: 0xd05a20, sunColor: 0xff7030, sunDir: V(0.4, 0.05, -1), sunI: 1.2, fog: 0x3a1a10, fogD: 0.02, clouds: 0.8, cloudColor: 0x8a3a1a, cloudDark: 0x1a0a08 });
  terrain(scene, { size: 200, h: gh, color: (x, z, hh, sl) => grassCol(x, z, hh, sl).multiplyScalar(0.6) });
  const r = rng(3);
  [[-6, -10], [0, -14], [7, -11], [-10, -20], [4, -22], [12, -19]].forEach(([x, z], i) => { const hs = house(r.range(4, 6), r.range(3, 4), 2.6, { roofC: 0x6a5030, wallC: 0xa89070 }); hs.position.set(x, gh(x, z), z); hs.rotation.y = r() * 3; scene.add(hs); if (i % 2 === 0) { fire(scene, V(x, gh(x, z) + 3, z), 2.2, { light: 60 }); } });
  [[-1, -5, 160], [2.5, -6, 200], [-4, -7, 120]].forEach(([x, z, ry], i) => { const f = figure({ faction: 'givre', variant: i, coat: [0x2a3a5a, 0x4a5466, 0x34445e][i], cloakColor: 0x3a3228, axe: i === 0, sword: i === 1, shield: i === 2 ? SH.givre : null, armRot: [[-10, 12], [-70, 20]], beard: 1 }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(ry); scene.add(f); });
  embers(scene, V(0, 4, -14), 80, 20);
  return shoot(scene, cam(40, V(1, 2.2, 3), V(0, 2.2, -12)), w, h, { exposure: 1.1 });
};
S.duel = (w, h) => {
  const scene = world({ ...DUSK, sunDir: V(-0.8, 0.25, -0.6), sunI: 2.8, horizon: 0xffa050, top: 0x2a3a60 });
  terrain(scene, { size: 300, h: hills(1.5, 0.02), color: dryCol });
  const a = figure({ faction: 'aube', variant: 0, coat: 0xe4ddca, shield: SH.aube, sword: true, cloakColor: 0x7a2a20, armRot: [[-30, 15], [-80, 25]] }); a.position.set(-1.3, 0, -6); a.rotation.y = deg(80); scene.add(a);
  const b = figure({ faction: 'sables', variant: 0, coat: 0x2f5a3a, shield: SH.sables, sword: 'damas', cloakColor: 0xc8b48a, armRot: [[-30, 15], [-100, 20]], skin: 0x8a5e44 }); b.position.set(1.3, 0, -6); b.rotation.y = deg(-80); scene.add(b);
  const dh = hills(1.5, 0.02); scatter(scene, 8, (r) => cypress(r.range(6, 9), r), (r) => { const x = r.range(-30, 30), z = r.range(-60, -30); return V(x, dh(x, z) - 0.3, z); }, 5);
  return shoot(scene, cam(36, V(0, 1.3, 1), V(0, 1.4, -6)), w, h);
};
S.bataille = (w, h) => {
  const gh = hills(2, 0.02);
  const scene = world({ ...DUSK, top: 0x2a2a3a, mid: 0x8a6a5a, horizon: 0xe8a060, sunDir: V(-0.7, 0.35, 0.3), sunI: 2.4, fog: 0xa07a5a, fogD: 0.015, clouds: 0.7 });
  terrain(scene, { size: 300, h: gh, color: (x, z, hh, sl) => dryCol(x, z, hh, sl).lerp(C(0x6a5a40), 0.3) });
  const r = rng(12);
  for (let i = 0; i < 26; i++) {
    const side = i % 2; const x = (side ? 1 : -1) * r.range(0.5, 6) + r.range(-1, 1); const z = -4 - r.range(0, 16);
    const fa = side ? ['sables', 'givre'][i % 4 === 1 ? 1 : 0] : 'aube';
    const f = figure({ faction: fa, variant: i % 4, coat: fa === 'aube' ? 0xd8d0bc : fa === 'sables' ? [0x2f5a3a, 0xc8b48a][i % 2] : 0x2a3a5a, spear: i % 3 === 0, sword: i % 3 === 1, axe: i % 3 === 2 && fa === 'givre', shield: i % 2 ? SH[fa] : null, armRot: [[-20, 15], [-r.range(30, 110), 20]], skin: fa === 'sables' ? 0x8a5e44 : 0xb08068 });
    f.position.set(x, gh(x, z), z); f.rotation.y = deg(side ? -90 + r.range(-30, 30) : 90 + r.range(-30, 30)); scene.add(f);
  }
  [[-5, -12, 0xe4ddca, 'sun'], [5, -14, 0x2c5a38, 'star'], [-8, -18, 0xa02a20, null]].forEach(([x, z, c, e]) => { const b = banner(c, e, '#c99528', 5); b.position.set(x, gh(x, z), z); scene.add(b); });
  const dust = G(); puffs(dust, V(0, 0.5, -10), 30, 2, 0xb09070, 0.25); scene.add(dust);
  return shoot(scene, cam(40, V(1, 1.8, 1), V(0, 1.2, -10)), w, h);
};
S.travail = (w, h) => {
  const gh = hills(1.5, 0.03);
  const scene = world({ ...DAY, sunDir: V(-0.5, 0.5, -0.4), horizon: 0xf0e0c0 });
  terrain(scene, { size: 300, h: gh, color: (x, z, hh, sl) => { const rows = Math.sin(x * 2.2) > 0.2; return grassCol(x, z, hh, sl).lerp(C(rows ? 0xc8a850 : 0xa88a40), smooth(-6, -10, z) * smooth(-40, -30, z)); } });
  // charpente en construction
  const wood = MAT.wood({ color: 0x9a7448, rep: [1, 2] });
  const fr = G(); fr.position.set(-3, gh(-3, -6), -6);
  for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) { const p = mesh(new THREE.BoxGeometry(0.2, 3, 0.2), wood); p.position.set(x, 1.5, z); fr.add(p); }
  for (const z of [-1.5, 1.5]) { const b = mesh(new THREE.BoxGeometry(4.2, 0.2, 0.2), wood); b.position.set(0, 3, z); fr.add(b); }
  for (const x of [-2, 0, 2]) { const s = new THREE.Shape(); s.moveTo(-1.6, 0); s.lineTo(0, 1.6); s.lineTo(1.6, 0); s.lineTo(1.4, 0); s.lineTo(0, 1.4); s.lineTo(-1.4, 0); const rg = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }); const rf = mesh(rg, wood); rf.rotation.y = Math.PI / 2; rf.position.set(x, 3.1, 0); fr.add(rf); }
  scene.add(fr);
  for (let i = 0; i < 6; i++) { const pl = mesh(new THREE.BoxGeometry(3, 0.12, 0.3), wood); pl.position.set(1.5, gh(1.5, -4) + 0.1 + i * 0.12, -4); scene.add(pl); }
  [[0.5, -4, 200], [-1, -6, 120], [3, -8, 230]].forEach(([x, z, ry], i) => { const f = figure({ variant: i, coat: [0x8a6a40, 0x6a5a3a, 0x9a8a60][i], mail: false, helm: false, hood: i === 1 ? 0x5a4a30 : null, legs: 0x4a3a28, armRot: [[-40, 15], [-70, 15]], beard: i % 2, skin: 0xa87860 }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(ry); scene.add(f); });
  const hs = house(5, 4, 2.6, {}); hs.position.set(8, gh(8, -14), -14); scene.add(hs);
  return shoot(scene, cam(40, V(3, 2.5, 3), V(-1.5, 1.5, -7)), w, h);
};
S.hopital = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x1a1208, 0.05);
  scene.add(new THREE.HemisphereLight(0x8a7050, 0x1a1008, 0.4));
  const floor = mesh(new THREE.PlaneGeometry(30, 30), MAT.cloth({ color: 0x5a4a30, rep: [10, 10] })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // tente : toile intérieure
  const tg = new THREE.CylinderGeometry(7, 7, 6, 24, 1, true); const tm = MAT.cloth({ color: 0xc8b088, rep: [8, 3] }); tm.side = THREE.BackSide;
  const tent = mesh(tg, tm); tent.position.set(0, 3, -4); scene.add(tent);
  const roof = mesh(new THREE.ConeGeometry(7, 3, 24, 1, true), tm); roof.position.set(0, 7.5, -4); scene.add(roof);
  const pole = mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 8), MAT.wood()); pole.position.set(0, 4.5, -4); scene.add(pole);
  // lits de camp
  const wood = MAT.wood({ color: 0x6a4a2a });
  [[-3, -3, 0.2], [-3, -6, 0.1], [3, -3, -0.2], [3, -6.5, 0]].forEach(([x, z, ry], i) => {
    const bed = G(); bed.position.set(x, 0, z); bed.rotation.y = Math.PI / 2 + ry;
    const fr2 = mesh(new THREE.BoxGeometry(2, 0.12, 0.9), wood); fr2.position.y = 0.5; bed.add(fr2);
    for (const a of [-0.9, 0.9]) for (const b of [-0.4, 0.4]) { const l = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), wood); l.position.set(a, 0.25, b); bed.add(l); }
    const sheet = mesh(new THREE.BoxGeometry(1.9, 0.15, 0.85), MAT.cloth({ color: 0xe0d8c8 })); sheet.position.y = 0.62; bed.add(sheet);
    const body = mesh(new THREE.CapsuleGeometry(0.22, 1.1, 6, 12), MAT.cloth({ color: [0x7a6a50, 0x5a4a3a, 0x8a7a5a, 0x6a5a48][i] })); body.rotation.z = Math.PI / 2; body.position.set(0.1, 0.8, 0); body.scale.z = 0.8; bed.add(body);
    const hd = mesh(new THREE.SphereGeometry(0.12, 12, 10), MAT.skin()); hd.position.set(-0.75, 0.8, 0); bed.add(hd);
    const band = mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 16), MAT.cloth({ color: 0xf0e8e0 })); band.position.set(-0.75, 0.85, 0); band.rotation.y = Math.PI / 2; bed.add(band);
    scene.add(bed);
  });
  // table, bougies, bassine
  const tb = mesh(new THREE.BoxGeometry(1.4, 0.08, 0.7), wood); tb.position.set(0, 0.8, -1.8); scene.add(tb);
  for (const x of [-0.6, 0.6]) for (const z of [-0.3, 0.3]) { const l = mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), wood); l.position.set(x, 0.4, -1.8 + z); scene.add(l); }
  [[-0.4, -1.7], [0.3, -1.95], [0.55, -1.6]].forEach(([x, z]) => { const cd = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), MAT.plain(0xe8e0c8)); cd.position.set(x, 0.94, z); scene.add(cd); const fl = mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: C(0xffc060).multiplyScalar(4) })); fl.position.set(x, 1.07, z); fl.scale.y = 1.8; scene.add(fl); const pl = new THREE.PointLight(0xffa050, 4, 8, 1.5); pl.position.set(x, 1.2, z); scene.add(pl); });
  const basin = mesh(lathe([[0.0, 0], [0.2, 0.0], [0.28, 0.12], [0.27, 0.12], [0.19, 0.01], [0.0, 0.01]], 20), MAT.metal({ color: 0xc08050, rough: 0.4 })); basin.position.set(-0.1, 0.84, -1.8); scene.add(basin);
  const f = figure({ variant: 1, coat: 0x8a8070, mail: false, helm: false, hood: 0x6a6050, legs: 0x5a4a38, armRot: [[-40, 10], [-50, 10]], beard: 0.7 }); f.position.set(-1.4, 0, -4.2); f.rotation.y = deg(90); scene.add(f);
  const lamp = new THREE.PointLight(0xffb060, 10, 14, 1.6); lamp.position.set(0, 3, -4); lamp.castShadow = true; scene.add(lamp);
  return shoot(scene, cam(48, V(2.5, 2.4, 2.2), V(-0.5, 0.7, -4)), w, h, { exposure: 1.2 });
};

// ================================================================== lot 2 : ennemis et travaux
// Aides : casque, arme en main, armure sur le tronc d'une silhouette de people.js (figure).
function helmOn(f, helm, y = 0.045) { const head = f.children[3]; for (const c of [...head.children]) if (c.isGroup) head.remove(c); helm.position.y = y; head.add(helm); return f; }
function inHand(f, obj, { rx = Math.PI / 2 + 0.3, ry = 0, rz = 0, pos = [0, 0, 0], left = false } = {}) { const arm = f.getObjectByName(left ? 'armL' : 'armR'); obj.rotation.set(rx, ry, rz); obj.position.set(...pos); arm.userData.hand.add(obj); return obj; }
function onBody(f, obj) { f.children[1].add(obj); return obj; }
function glowEyes(f, color = 0x7ad0ff) { const head = f.children[3]; for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(2.5), fog: false })); e.position.set(s * 0.034, 0.025, 0.118); head.add(e); } const pl = new THREE.PointLight(color, 0.06, 0.8, 2); pl.position.set(0, 0.03, 0.25); head.add(pl); }
function fill(scene, color = 0xffd8b8, i = 1.4, pos = V(2, 3, 6)) { const l = new THREE.DirectionalLight(C(color), i); l.position.copy(pos); scene.add(l); return l; }
function bear() {
  const fur = MAT.fur({ color: 0x4a3222, rep: [3, 3] });
  const b = quadruped({ len: 1.55, h: 1.15, girth: 0.6, neck: 0.42, headL: 0.36, legR: 0.12, mat: fur, hump: 0.35, neckUp: 0.3, tail: 'thin', ears: 0.08, snout: 0.8, lowHead: 0.05, color: 0x4a3222 });
  b.traverse((o) => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && o.material.color && o.material.color.getHex() === 0x080606) o.material = new THREE.MeshBasicMaterial({ color: C(0xc08030).multiplyScalar(1.2) }); });
  return b;
}
function ruinTower(r, h, mat, seed = 1) {
  const g = G(); const rr = rng(seed);
  const t = mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24, 8, true), mat);
  displace(t.geometry, (v) => { const a = Math.atan2(v.z, v.x); const top = h / 2 - 2.5 * Math.max(0, Math.sin(a * 2 + 1)) - 1.5 * Math.abs(noise3(a * 2, 1, 2)); return v.y > top ? V(v.x, top, v.z) : null; });
  t.position.y = h / 2; t.material.side = THREE.DoubleSide; g.add(t);
  for (let i = 0; i < 3; i++) { const s = mesh(new THREE.BoxGeometry(0.2, 0.9, 0.3), MAT.plain(0x120c08)); const a = i * 2.1 + 0.5; s.position.set(Math.cos(a) * r, h * (0.3 + i * 0.12), Math.sin(a) * r); s.rotation.y = -a; g.add(s); }
  for (let i = 0; i < 8; i++) { const b = mesh(new THREE.BoxGeometry(rr.range(0.4, 0.9), rr.range(0.3, 0.6), rr.range(0.4, 0.8)), mat); b.position.set(r * 1.4 * Math.cos(i), 0.2, r * 1.4 * Math.sin(i)); b.rotation.set(rr(), rr(), rr()); g.add(b); }
  return g;
}
function chest(s = 1, gold = false) {
  const g = G(); const w = MAT.wood({ color: 0x5a3820, rep: [1, 1] }); const ir = MAT.metal({ color: 0x5a5854, rough: 0.5 });
  const b = mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), w); b.position.y = 0.225; g.add(b);
  const lid = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16, 1, false, 0, Math.PI), w); lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.y = 0.45; lid.rotation.x = 0; g.add(lid); lid.rotation.set(0, 0, Math.PI / 2); lid.geometry.rotateY(Math.PI / 2);
  for (const x of [-0.3, 0, 0.3]) { const band = mesh(new THREE.BoxGeometry(0.05, 0.47, 0.52), ir); band.position.set(x, 0.225, 0); g.add(band); }
  const lock = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.03), gold ? MAT.gold() : ir); lock.position.set(0, 0.38, 0.26); g.add(lock);
  if (gold) { for (let i = 0; i < 14; i++) { const c = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12), MAT.gold()); c.position.set((i % 5 - 2) * 0.12 + 0.03, 0.03, 0.35 + Math.floor(i / 5) * 0.06); c.rotation.x = 0.2 * (i % 3); g.add(c); } }
  g.scale.setScalar(s); return g;
}
function wheel(r = 0.45, m = MAT.wood({ color: 0x5a3a20 })) { const g = G(); const t = mesh(new THREE.TorusGeometry(r, 0.05, 8, 24), m); g.add(t); for (let i = 0; i < 8; i++) { const sp = mesh(new THREE.CylinderGeometry(0.02, 0.02, r * 2, 6), m); sp.rotation.z = i / 8 * Math.PI; g.add(sp); } const hub = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 10), m); hub.rotation.x = Math.PI / 2; g.add(hub); return g; }
function cart(load = null) {
  const g = G(); const w = MAT.wood({ color: 0x6a4a2a, rep: [2, 1] });
  const bed = mesh(new THREE.BoxGeometry(1.4, 0.12, 2.4), w); bed.position.y = 0.75; g.add(bed);
  for (const s of [-1, 1]) { const side = mesh(new THREE.BoxGeometry(0.06, 0.35, 2.4), w); side.position.set(s * 0.7, 0.95, 0); g.add(side); const wh = wheel(); wh.rotation.y = Math.PI / 2; wh.position.set(s * 0.8, 0.45, 0); g.add(wh); const sh = mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), w); sh.position.set(s * 0.35, 0.7, 1.9); sh.rotation.x = 0.12; g.add(sh); }
  if (load) { load.position.y = 0.81; g.add(load); }
  return g;
}
function throne(mat) {
  const g = G();
  const seat = mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1), mat); seat.position.y = 0.45; g.add(seat);
  const back = mesh(new THREE.BoxGeometry(1.4, 2.6, 0.3), mat); back.position.set(0, 1.3, -0.55); g.add(back);
  displace(back.geometry, (v) => v.y > 1.0 && v.x > 0.2 ? V(v.x, 1.0 - (v.x - 0.2) * 0.8, v.z) : null);
  for (const s of [-1, 1]) { const arm = mesh(new THREE.BoxGeometry(0.22, 0.45, 1.1), mat); arm.position.set(s * 0.6, 1.12, 0); g.add(arm); }
  const step = mesh(new THREE.BoxGeometry(2.6, 0.25, 2.2), mat); step.position.set(0, 0.0, 0.2); g.add(step);
  return g;
}
function sarcophagus(mat, seed = 1) {
  const g = G(); const b = mesh(new THREE.BoxGeometry(1.0, 0.8, 2.2), mat); b.position.y = 0.4; g.add(b);
  const lid = mesh(new THREE.BoxGeometry(1.1, 0.16, 2.3), mat); lid.position.y = 0.88; lid.rotation.y = (seed % 3 - 1) * 0.12; g.add(lid);
  const eff = mesh(new THREE.CapsuleGeometry(0.2, 1.2, 6, 10), mat); eff.rotation.x = Math.PI / 2; eff.scale.y = 0.6; eff.position.y = 1.0; g.add(eff);
  return g;
}
function watchtower(h = 6, mat = MAT.wood({ color: 0x5a3a20, rep: [1, 4] })) {
  const g = G();
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = mesh(new THREE.CylinderGeometry(0.12, 0.15, h, 8), mat); p.position.set(x * 1.1, h / 2, z * 1.1); p.rotation.set(-z * 0.04, 0, x * 0.04); g.add(p); }
  const pl = mesh(new THREE.BoxGeometry(3, 0.15, 3), mat); pl.position.y = h - 1.2; g.add(pl);
  for (const [x, z, ry] of [[0, 1.45, 0], [0, -1.45, 0], [1.45, 0, Math.PI / 2], [-1.45, 0, Math.PI / 2]]) { const r = mesh(new THREE.BoxGeometry(3, 0.9, 0.08), mat); r.position.set(x, h - 0.7, z); r.rotation.y = ry; g.add(r); }
  const roof = mesh(new THREE.ConeGeometry(2.4, 1.6, 4), MAT.plain(0x4a3a24, 1, { map: tex('fur_c', [3, 3], true) })); roof.rotation.y = Math.PI / 4; roof.position.y = h + 0.9; g.add(roof);
  for (let i = 0; i < 10; i++) { const rg = mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), mat); rg.position.set(0, 0.4 + i * 0.45, 1.45); g.add(rg); }
  return g;
}
function palisade(scene, n, x0, z0, dx, dz, h = 3, seed = 1) { const r = rng(seed); const wood = MAT.wood({ color: 0x6a4a2a, rep: [1, 2] }); for (let i = 0; i < n; i++) { const hh = h + r.range(-0.2, 0.3); const p = mesh(new THREE.CylinderGeometry(0.15, 0.16, hh, 8), wood); p.position.set(x0 + i * dx, hh / 2, z0 + i * dz); scene.add(p); const tp = mesh(new THREE.ConeGeometry(0.15, 0.4, 8), wood); tp.position.set(x0 + i * dx, hh + 0.2, z0 + i * dz); scene.add(tp); } }
function water(scene, size, y, color = 0x2a4058, pos = V(0, 0, 0)) { const w = mesh(new THREE.PlaneGeometry(size[0], size[1], 40, 40), new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.08, metalness: 0.2, normalMap: tex('cloth_n', [20, 20]), normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 1.5 })); w.rotation.x = -Math.PI / 2; w.position.copy(pos); w.position.y = y; scene.add(w); return w; }
function mapTex() {
  return canvasTex(512, 384, (c, w, h) => {
    c.fillStyle = '#d8c49a'; c.fillRect(0, 0, w, h); c.globalAlpha = 0.35; c.drawImage(img('cloth_c'), 0, 0, w, h); c.globalAlpha = 1;
    const r = rng(4); c.strokeStyle = '#5a6a8a'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h * 0.6); for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.6 + Math.sin(x / 40) * 30 + r() * 6); c.stroke();
    c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); const cx = r() * w, cy = r() * h; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; c.lineTo(cx + Math.cos(a) * (50 + r() * 30), cy + Math.sin(a) * (40 + r() * 20)); } c.stroke(); }
    for (const [x, y, col] of [[0.25, 0.3, '#c99528'], [0.7, 0.35, '#2f6a44'], [0.5, 0.75, '#3a5a8a']]) { c.fillStyle = col; c.beginPath(); c.arc(x * w, y * h, 14, 0, 7); c.fill(); }
    c.strokeStyle = '#8a1a14'; c.lineWidth = 5; c.beginPath(); c.moveTo(w * 0.3, h * 0.35); c.quadraticCurveTo(w * 0.45, h * 0.2, w * 0.65, h * 0.33); c.stroke();
  });
}
function siegeTower(h = 9) {
  const g = G(); const w = MAT.wood({ color: 0x6a4a2a, rep: [2, 4] });
  const b = mesh(new THREE.BoxGeometry(3, h, 3), w); b.position.y = h / 2 + 0.5; g.add(b);
  const hide = mesh(new THREE.BoxGeometry(3.1, h * 0.85, 0.1), MAT.leather({ color: 0x7a5a3a, rep: [3, 6] })); hide.position.set(0, h * 0.45 + 0.5, 1.55); g.add(hide);
  const ramp = mesh(new THREE.BoxGeometry(2.4, 0.12, 2.2), w); ramp.position.set(0, h + 0.2, 2.2); ramp.rotation.x = -1.1; g.add(ramp);
  for (const s of [-1, 1]) for (const z of [-1, 1]) { const wh = wheel(0.5); wh.rotation.y = Math.PI / 2; wh.position.set(s * 1.6, 0.5, z * 1.0); g.add(wh); }
  for (let i = 0; i < 6; i++) { const pl = mesh(new THREE.BoxGeometry(3.15, 0.1, 0.12), w); pl.position.set(0, 1 + i * h / 6, 1.62); g.add(pl); }
  return g;
}
function ram() {
  const g = G(); const w = MAT.wood({ color: 0x5a3a20, rep: [1, 3] });
  const sh = new THREE.Shape(); sh.moveTo(-1.2, 0); sh.lineTo(0, 1.4); sh.lineTo(1.2, 0); sh.closePath();
  const rf = new THREE.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false }); rf.translate(0, 0, -2);
  const roof = mesh(rf, MAT.leather({ color: 0x6a4a30, rep: [3, 3] })); roof.position.y = 1.6; g.add(roof);
  for (const s of [-1, 1]) for (const z of [-1.6, 1.6]) { const p = mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), w); p.position.set(s * 1.0, 0.8, z); g.add(p); const wh = wheel(0.4); wh.rotation.y = Math.PI / 2; wh.position.set(s * 1.15, 0.4, z); g.add(wh); }
  const log = mesh(new THREE.CylinderGeometry(0.22, 0.25, 5, 12), w); log.rotation.x = Math.PI / 2; log.position.set(0, 1.0, 0.5); g.add(log);
  const head = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.4, 12), MAT.metal({ color: 0x5a5854 })); head.rotation.x = Math.PI / 2; head.position.set(0, 1.0, 3.0); g.add(head);
  return g;
}
function crane() {
  const g = G(); const w = MAT.wood({ color: 0x8a6a40, rep: [1, 4] });
  for (const s of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.2, 7, 0.2), w); l.position.set(s * 0.9, 3.3, 0); l.rotation.z = s * 0.14; g.add(l); }
  const boom = mesh(new THREE.BoxGeometry(0.18, 0.18, 6), w); boom.position.set(0, 6.6, 1.8); boom.rotation.x = 0.35; g.add(boom);
  const rope = mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 4), MAT.plain(0xb0a080)); rope.position.set(0, 5.4, 4.4); g.add(rope);
  const blk = mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), stoneM(0xc8b898, [1, 1])); blk.position.set(0, 3.6, 4.4); g.add(blk);
  const wh = wheel(1.2, w); wh.position.set(0, 1.25, -0.6); g.add(wh);
  return g;
}
function crows(scene, center, n, spread, seed = 3) {
  const r = rng(seed); const m = MAT.plain(0x0a0a0c, 0.9, { side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) { const b = G(); for (const s of [-1, 1]) { const wg = mesh(new THREE.PlaneGeometry(0.5, 0.14), m); wg.position.x = s * 0.25; wg.rotation.z = s * r.range(0.2, 0.6); b.add(wg); } b.position.set(center.x + r.range(-spread, spread), center.y + r.range(0, spread * 0.4), center.z + r.range(-spread * 0.3, spread * 0.3)); b.rotation.y = r() * 3; scene.add(b); }
}
const royalBanner = (h = 5) => banner(0x1c2a5a, 'royal', '#e8c860', h);

// ------------------------------------------------------------------ ennemis (lot 2)
S.ours = (w, h) => {
  const gh = (x, z) => hills(1.6, 0.05)(x, z) + Math.max(0, -z - 12) * 0.5;
  const scene = enemyScene({ ...DUSK, top: 0x24304a, mid: 0x7a7080, horizon: 0xe8b890, sunColor: 0xffd0a0, fog: 0x8a8a98, fogD: 0.012, clouds: 0.6 }, gh, (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0xd8dce4), smooth(0.2, 0.8, fbm(x * 0.12, z * 0.12, 6, 3) + 0.25 + hh * 0.08)), { sunDir: V(-0.7, 0.35, -0.4), sunI: 2.2 });
  [[-30, -80, 30], [20, -90, 40], [55, -70, 26]].forEach(([x, z, s], i) => { const m = rock(s, 0x8a8a92, i * 3); m.scale.y = 1.6; m.position.set(x, gh(x, z) - 4, z); scene.add(m); });
  scatter(scene, 22, (r) => conifer(r.range(6, 11), 0x1e2e24, r), (r) => { const x = r.range(-25, 25), z = r.range(-40, -8); if (Math.abs(x) < 4 && z > -16) return null; return V(x, gh(x, z), z); }, 8);
  scatter(scene, 10, (r) => rock(r.range(0.5, 1.6), 0x8a8478, r() * 9), (r) => { const x = r.range(-8, 8), z = r.range(-12, -3); if (Math.abs(x) < 1.6 && z > -6) return null; return V(x, gh(x, z), z); }, 4);
  const b = bear(); b.position.set(0.2, gh(0.2, -3.6), -3.6); b.rotation.y = deg(-30); scene.add(b); fill(scene, 0xd8d0d8, 1.0);
  const c = cam(38, V(1.2, 1.0, 0.6), V(-0.3, 0.9, -5));
  return shoot(scene, c, w, h, { grade: { vignette: 0.45 } });
};
S['chef-brigand'] = (w, h) => {
  const gh = hills(1, 0.04);
  const scene = enemyScene({ ...FOREST, sunI: 1.8, horizon: 0xc8a070, fog: 0x4a4a3a }, gh, (x, z, hh, sl) => forestFloor(x, z, hh, sl).lerp(C(0x6a5a3a), 0.3), { sunDir: V(0.6, 0.45, -0.5), amb: 0.8 });
  const tw = ruinTower(3, 11, stoneM(0x9a8a74, [6, 4]), 2); tw.position.set(4.5, gh(4.5, -14), -14); scene.add(tw);
  scatter(scene, 40, (r) => (r() < 0.6 ? broadleaf(r.range(7, 11), 0x2a3c1e, r) : conifer(r.range(8, 12), 0x223420, r)), (r) => { const x = r.range(-22, 22), z = r.range(-40, -6); if (Math.hypot(x - 4.5, z + 14) < 6 || (Math.abs(x) < 4 && z > -12)) return null; return V(x, gh(x, z), z); }, 4);
  fire(scene, V(-2.5, gh(-2.5, -8), -8), 1, { light: 30 });
  const f = figure({ faction: 'aube', variant: 2, coat: 0x6a2a1e, legs: 0x3a3024, cloakColor: 0x2a2018, beard: 1, armRot: [[-15, 12], [-35, 18]], skin: 0x9a7058 });
  helmOn(f, A.kettleHat({ m: MAT.metal({ color: 0x6a6864, rough: 0.5 }) }), 0.06);
  inHand(f, A.axeX({ head: 'bearded', haft: 0.8, scale: 1.3 }), { rx: Math.PI / 2 + 0.3, pos: [0, 0, 0] });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-18); scene.add(f);
  [[-3.2, -7, 40], [-1.6, -9.5, 20]].forEach(([x, z, ry], i) => { const g = figure({ variant: i + 1, coat: [0x4a3a28, 0x3a3a2a][i], mail: false, hood: [0x2a2a20, 0x3a2e22][i], legs: 0x3a3024, beard: 0.7, spear: i === 0, skin: 0x9a7058 }); g.position.set(x, gh(x, z), z); g.rotation.y = deg(ry); scene.add(g); });
  const c = cam(38, V(0.5, 1.5, 0.4), V(-0.3, 1.3, -6));
  return shoot(scene, c, w, h, { exposure: 1.05 });
};
S.assassin = (w, h) => {
  const gh = hills(1.8, 0.04);
  const scene = enemyScene({ ...NIGHT, sunI: 1.6, fogD: 0.03, horizon: 0x3a4a6a }, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).multiplyScalar(0.5), { sunDir: V(0.5, 0.45, -0.7) });
  scatter(scene, 14, (r) => (r() < 0.6 ? cypress(r.range(5, 8), r) : bush(r.range(0.8, 1.6), 0x2a3420)), (r) => { const x = r.range(-20, 20), z = r.range(-35, -6); if (Math.abs(x) < 3 && z > -10) return null; return V(x, gh(x, z), z); }, 5);
  scatter(scene, 8, (r) => rock(r.range(0.6, 1.6), 0x6a6a70, r() * 9), (r) => { const x = r.range(-9, 9), z = r.range(-12, -4); if (Math.abs(x) < 1.5) return null; return V(x, gh(x, z), z); }, 6);
  const f = figure({ variant: 3, coat: 0x1c1c22, mail: false, hood: 0x141418, legs: 0x18181c, beard: 0, armRot: [[-55, 22], [-70, 14]], skin: 0x8a6048, cloakColor: 0x101014 });
  inHand(f, A.swordX({ len: 0.32, w0: 0.03, w1: 0.016, tip: 0.12, fuller: 0.4, guard: 'bar', guardLen: 0.08, gripLen: 0.09, pommelType: 'ball' }), { rx: Math.PI / 2 + 0.2 });
  inHand(f, M.dagger(), { rx: Math.PI / 2 + 0.6, left: true });
  // regard dans l'ombre de la capuche
  glowEyes(f, 0xffe0a0); fill(scene, 0x8aa0d0, 0.9);
  f.position.set(0, gh(0, -2.8), -2.8); f.rotation.y = deg(-12); scene.add(f);
  const c = cam(38, V(0.4, 1.35, 0.5), V(-0.2, 1.3, -6));
  return shoot(scene, c, w, h, { exposure: 1.6, grade: { vignette: 0.5 } });
};
S['chevalier-renegat'] = (w, h) => {
  const gh = hills(1.2, 0.04);
  const scene = enemyScene({ ...DUSK, top: 0x2a2030, mid: 0x7a4a40, horizon: 0xe08040, sunColor: 0xff9050, fog: 0x6a4a40, fogD: 0.015, clouds: 0.7, cloudColor: 0xc06040, cloudDark: 0x2a1a20 }, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).multiplyScalar(0.55), { sunDir: V(-0.6, 0.2, -0.7), sunI: 2.4 });
  const r = rng(5);
  [[-7, -16], [6, -20]].forEach(([x, z], i) => { const hs = house(5, 4, 2.6, { roofC: 0x3a2a20, wallC: 0x8a7a68 }); hs.position.set(x, gh(x, z), z); hs.rotation.y = r() * 3; scene.add(hs); fire(scene, V(x, gh(x, z) + 2.5, z), 1.8, { light: 50 }); });
  const f = figure({ faction: 'aube', variant: 0, coat: 0x5a5650, legs: 0x2a2826, cloakColor: 0x3a1a18, armRot: [[-12, 12], [-30, 16]], beard: 0, shield: { type: 'kite', field: '#3a3a3c', emblem: 'sun', emblemColor: '#6a6458' } });
  helmOn(f, A.greatHelm({ m: MAT.metal({ color: 0x8a8a8e, rough: 0.4 }), top: 'flat' }), 0.03);
  inHand(f, A.swordX({ len: 0.86, w0: 0.05, w1: 0.032, tip: 0.18, guard: 'curved', guardLen: 0.2, gripLen: 0.16, pommelType: 'wheel' }));
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-15); scene.add(f);
  embers(scene, V(0, 3, -18), 50, 16); fill(scene, 0xffb080, 1.6);
  const c = cam(38, V(0.5, 1.4, 0.4), V(-0.3, 1.35, -6));
  return shoot(scene, c, w, h, { grade: { vignette: 0.45 } });
};
S['fou-de-guerre'] = (w, h) => {
  const gh = hills(1.4, 0.05);
  const scene = enemyScene({ ...NIGHT, top: 0x1a2236, mid: 0x4a5670, horizon: 0x8a9ab8, sunColor: 0xd0dcf0, sunI: 2.2, sunStrength: 4, fog: 0x8a94a8, fogD: 0.03, amb: 0.8, stars: 0, clouds: 0.8, cloudColor: 0x8a9ab0, cloudDark: 0x2a3040, moon: false }, gh, snowCol, { sunDir: V(-0.5, 0.5, -0.6) });
  scatter(scene, 35, (r) => conifer(r.range(7, 12), 0x1c2a24, r), (r) => { const x = r.range(-25, 25), z = r.range(-40, -8); if (Math.abs(x) < 4 && z > -14) return null; return V(x, gh(x, z), z); }, 3);
  const f = figure({ faction: 'givre', variant: 1, coat: 0x6a5a48, mail: false, legs: 0x3a3430, helm: false, beard: 1, armRot: [[-120, 30], [-140, 22]], skin: 0xc09078 });
  onBody(f, A.mantle({ mat: MAT.fur({ color: 0x5a4434, rep: [3, 3] }), r: 0.25, len: 0.5, span: 1.7, flare: 0.4 }));
  inHand(f, A.axeX({ head: 'bearded', haft: 0.75, scale: 1.3 }), { rx: Math.PI / 2 + 0.6 });
  inHand(f, A.axeX({ head: 'francisca', haft: 0.5, scale: 1.2 }), { rx: Math.PI / 2 + 0.8, left: true });
  // chevelure en bataille
  const hair = mesh(new THREE.SphereGeometry(0.13, 16, 12), MAT.fur({ color: 0x8a5a2a, rep: [2, 2] })); hair.scale.set(1, 0.8, 1.05); hair.position.set(0, 0.06, -0.03); f.children[3].add(hair);
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-10); scene.add(f);
  const snow = G(); puffs(snow, V(0, 0, -6), 20, 1.5, 0xe8eef8, 0.15); scene.add(snow); fill(scene, 0xc8d4ec, 1.6);
  const c = cam(38, V(0.4, 1.3, 0.6), V(-0.2, 1.6, -6));
  return shoot(scene, c, w, h, { exposure: 1.05, grade: { vignette: 0.45 } });
};
S['garde-du-tyran'] = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x140c0a, 0.05);
  scene.add(new THREE.HemisphereLight(0x5a4a40, 0x0a0604, 0.5));
  const floor = mesh(new THREE.PlaneGeometry(40, 40), stoneM(0x5a4a3c, [10, 10])); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const st = stoneM(0x6a5a4a, [6, 3]);
  const wl = mesh(new THREE.BoxGeometry(30, 12, 1), st); wl.position.set(0, 6, -9); scene.add(wl);
  const gate = mesh(new THREE.BoxGeometry(3.2, 4.5, 0.4), MAT.wood({ color: 0x3a2414, rep: [2, 3] })); gate.position.set(0, 2.25, -8.4); scene.add(gate);
  for (const x of [-4, 4]) { const col = mesh(new THREE.CylinderGeometry(0.6, 0.7, 12, 16), st); col.position.set(x, 6, -7.5); scene.add(col); torch(scene, V(x * 0.62, 3.2, -7.9), 1.8); const b = banner(0x6a0a0a, 'tower', '#1a1a1a', 5.5); b.position.set(x * 1.6, 0, -8.2); scene.add(b); }
  const f = figure({ faction: 'aube', variant: 1, coat: 0x3a0e0c, legs: 0x1a1414, armRot: [[-8, 14], [-25, 14]], beard: 0, scale: 1.25 });
  onBody(f, A.plateArmor({ m: MAT.metal({ color: 0x4a4a4e, rough: 0.32 }), trim: MAT.metal({ color: 0x8a1a14, rough: 0.4 }), cloth: MAT.cloth({ color: 0x3a0e0c }), bodyOnly: true }));
  helmOn(f, A.greatHelm({ m: MAT.metal({ color: 0x4a4a4e, rough: 0.32 }), top: 'sugar', trim: MAT.metal({ color: 0x8a1a14, rough: 0.4 }) }), 0.03);
  const gs = A.guisarme(); gs.scale.setScalar(1.25); inHand(f, gs, { rx: 0.15, pos: [0, -0.9, 0.04] });
  f.position.set(0, 0, -3.4); f.rotation.y = deg(-12); scene.add(f);
  const key = new THREE.PointLight(0xffa060, 8, 10, 1.6); key.position.set(-1.5, 3, -1.5); scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a4a3a, 0.4));
  return shoot(scene, cam(40, V(0.6, 1.4, 0.8), V(-0.2, 1.7, -6)), w, h, { exposure: 1.2, bloom: { strength: 0.35 } });
};
S['seigneur-pillard'] = (w, h) => {
  const hill = (x, z) => hills(1.5, 0.03)(x, z) + 7 * Math.exp(-((x + 22) ** 2 + (z + 75) ** 2) / 500);
  const scene = enemyScene({ ...DUSK, top: 0x1e1a2a, mid: 0x6a3a30, horizon: 0xd8703a, sunColor: 0xff8040, fog: 0x5a3a30, fogD: 0.012, clouds: 0.8, cloudColor: 0xb05030, cloudDark: 0x2a1418 }, hill, (x, z, hh, sl) => grassCol(x, z, hh, sl).multiplyScalar(0.6), { sunDir: V(0.7, 0.2, -0.6), sunI: 2 });
  const st = stoneM(0x8a7a68, [4, 4]); const cs = G(); cs.position.set(-22, hill(-22, -75) - 0.5, -75);
  const k = keep(8, 6, 12, st); cs.add(k); for (const [x, z] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) { const t = tower(2, 9, st, { roof: 0x3a2018 }); t.position.set(x, 0, z); cs.add(t); }
  for (const [a, b] of [[[-7, -5], [7, -5]], [[-7, 5], [7, 5]], [[-7, -5], [-7, 5]], [[7, -5], [7, 5]]]) { const p1 = V(a[0], 0, a[1]), p2 = V(b[0], 0, b[1]); const wl = wall(p1.distanceTo(p2), 6, 1.2, st); wl.position.copy(p1.clone().add(p2).multiplyScalar(0.5)); wl.rotation.y = -Math.atan2(p2.z - p1.z, p2.x - p1.x); cs.add(wl); }
  scene.add(cs);
  const r = rng(6); [[6, -14], [10, -20]].forEach(([x, z]) => { const hs = house(4.5, 3.5, 2.4, { roofC: 0x5a4028, wallC: 0x9a8868 }); hs.position.set(x, hill(x, z), z); hs.rotation.y = r() * 3; scene.add(hs); fire(scene, V(x, hill(x, z) + 2.6, z), 1.8, { light: 50 }); });
  const f = figure({ faction: 'aube', variant: 3, coat: 0x4a1a3a, legs: 0x2a2026, cloakColor: 0x2a0a1a, armRot: [[-12, 14], [-40, 18]], beard: 0.9, shield: { type: 'kite', field: '#1a1a1a', emblem: 'bend', emblemColor: '#a01a14' } });
  helmOn(f, A.bascinet({ visor: false, m: MAT.metal({ color: 0x9a9a9e, rough: 0.3 }) }), 0.03);
  inHand(f, A.flangedMace({ len: 0.6, shaftM: MAT.metal({ color: 0x7a7a7e }), headM: MAT.metal({ color: 0x9a9a9e, rough: 0.3 }), trim: MAT.gold() }), { rx: Math.PI / 2 + 0.4 });
  f.position.set(0, hill(0, -3), -3); f.rotation.y = deg(-20); scene.add(f);
  embers(scene, V(8, 3, -17), 40, 10); fill(scene, 0xffa070, 1.7);
  return shoot(scene, cam(38, V(0.6, 1.4, 0.4), V(-0.5, 1.5, -6)), w, h);
};
S['capitaine-mercenaire'] = (w, h) => {
  const gh = hills(1, 0.04);
  const scene = enemyScene({ ...DAY, horizon: 0xd8c8a8, clouds: 0.7, cloudDark: 0x707888, sunColor: 0xffe0b0 }, gh, (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x8a7a50), 0.35), { sunDir: V(-0.6, 0.45, 0.3) });
  const r = rng(2); [[-7, -12], [-2, -16], [5, -13], [9, -19]].forEach(([x, z], i) => { const t = i % 2 ? ridgeTent(3, 4, 2.2, 0xa89878) : bellTent(2.2, 3.2, 0xc8b898); t.position.set(x, gh(x, z) - 0.1, z); t.rotation.y = r() * 6; scene.add(t); });
  // trois bannières, déchirées
  [[-3, -7, 0xe4ddca, 'sun', '#c99528'], [-1.6, -7.6, 0x2c5a38, 'star', '#d0a038'], [-0.2, -8.2, 0x1a2a50, 'raven', '#c4c8ce']].forEach(([x, z, c, e, ec], i) => { const b = banner(c, e, ec, 4.2, 1.4); b.position.set(x, gh(x, z), z); b.rotation.z = (i - 1) * 0.08; scene.add(b); });
  const f = figure({ variant: 2, coat: 0x2a2a5a, legs: 0x5a2a1a, cloakColor: 0x6a5a3a, armRot: [[-10, 14], [-30, 18]], beard: 0.6, skin: 0xa07058 });
  onBody(f, A.vest({ mat: A.rivetCloth('#2a2a5a', '#e0c070', { velvet: true }), length: 0.6, flare: 0.3, inflate: 1.12 }));
  helmOn(f, A.sallet({}), 0.04);
  inHand(f, A.swordX({ len: 0.78, w0: 0.05, w1: 0.03, tip: 0.17, guard: 'curved', guardLen: 0.2, gripLen: 0.14, pommelType: 'scent', guardMat: MAT.metal({ color: 0xc8a050, rough: 0.3 }) }));
  f.position.set(0.3, gh(0.3, -3), -3); f.rotation.y = deg(-22); scene.add(f);
  return shoot(scene, cam(38, V(0.6, 1.45, 0.4), V(-0.5, 1.4, -6)), w, h);
};
S['seigneur-dechu'] = (w, h) => {
  const gh = hills(1.6, 0.03);
  const scene = enemyScene({ ...DUSK, top: 0x2a2a40, mid: 0x8a5a50, horizon: 0xf09050, sunColor: 0xffa060, fog: 0x8a6050, fogD: 0.012, clouds: 0.75 }, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).multiplyScalar(0.6), { sunDir: V(-0.5, 0.12, -1), sunI: 2.4 });
  scatter(scene, 14, (r) => { const s = M.spear({ len: 2 }); s.rotation.z = r.range(-0.6, 0.6); s.rotation.x = r.range(-0.4, 0.4); return s; }, (r) => { const x = r.range(-12, 12), z = r.range(-22, -5); return V(x, gh(x, z) - 0.3, z); }, 6);
  [[-5, -10, 0x1c2a5a, 'royal'], [6, -14, 0x5a1a14, null]].forEach(([x, z, c, e], i) => { const b = banner(c, e, '#c8a850', 4.5, 1.5); b.position.set(x, gh(x, z) - 0.2, z); b.rotation.z = i ? -0.35 : 0.25; scene.add(b); });
  const f = figure({ faction: 'aube', variant: 0, coat: 0x2a2a30, legs: 0x2a2626, cloakColor: 0x4a1410, armRot: [[-30, 8], [-30, -2]], beard: 1, helm: false, skin: 0xa07860 });
  onBody(f, A.plateArmor({ m: MAT.metal({ color: 0x6a6a70, rough: 0.35 }), trim: MAT.metal({ color: 0xa08040, rough: 0.4 }), cloth: MAT.cloth({ color: 0x2a2a30 }), bodyOnly: true }));
  const hair = mesh(new THREE.SphereGeometry(0.125, 16, 12), MAT.fur({ color: 0x6a6a68, rep: [2, 2] })); hair.scale.set(1, 0.75, 1.05); hair.position.set(0, 0.05, -0.03); f.children[3].add(hair);
  inHand(f, A.swordX({ len: 1.0, w0: 0.055, w1: 0.034, tip: 0.18, guard: 'bar', guardLen: 0.3, gripLen: 0.24, pommelType: 'pear', ricasso: 0.06 }), { rx: Math.PI + 0.1, pos: [0.0, 0, 0.0] });
  crows(scene, V(0, 7, -16), 6, 6); fill(scene, 0xffc090, 1.7);
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-8); scene.add(f);
  return shoot(scene, cam(38, V(0.5, 1.3, 0.5), V(-0.3, 1.45, -6)), w, h);
};
S['gardien-des-tombeaux'] = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x060a10, 0.07);
  scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x05070a, 0.8)); fill(scene, 0x6a8ab0, 0.6);
  const st = stoneM(0x6a6a68, [8, 8]);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), st); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const back = mesh(new THREE.BoxGeometry(30, 10, 1), stoneM(0x5a5a5c, [8, 3])); back.position.set(0, 5, -12); scene.add(back);
  for (let i = 0; i < 4; i++) for (const x of [-3.5, 3.5]) { const col = mesh(new THREE.CylinderGeometry(0.45, 0.5, 6, 14), stoneM(0x7a7874, [1, 3])); col.position.set(x, 3, -2.5 - i * 3); scene.add(col); }
  [[-2.2, -5, 0.1], [2.2, -6, -0.1], [-2.2, -9, 0], [2.2, -10.5, 0.05]].forEach(([x, z, ry], i) => { const s = sarcophagus(stoneM(0x8a8682, [1, 1]), i); s.position.set(x, 0, z); s.rotation.y = ry; scene.add(s); });
  for (const [x, z] of [[-3.2, -4], [3.2, -7]]) { const l = new THREE.PointLight(0x5ab0ff, 12, 9, 1.5); l.position.set(x, 2.4, z); scene.add(l); const f2 = mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: C(0x8ad0ff).multiplyScalar(3), fog: false })); f2.position.copy(l.position); scene.add(f2); }
  const bronze = MAT.metal({ color: 0x5a7a62, rough: 0.5 });
  const f = figure({ faction: 'aube', variant: 2, coat: 0x2a3a34, legs: 0x1a2220, cloakColor: 0x1a2622, armRot: [[-25, 14], [-15, 12]], beard: 0, skin: 0x7a8a88, helm: false });
  onBody(f, A.plateArmor({ m: bronze, trim: MAT.metal({ color: 0xa08848, rough: 0.45 }), cloth: MAT.cloth({ color: 0x1a2a26 }), bodyOnly: true }));
  helmOn(f, A.crownHelm({ m: bronze, crownM: MAT.metal({ color: 0xa08848, rough: 0.45 }), gems: [0x5ad0ff, 0x5ad0ff], glow: 1.2 }), 0.045);
  glowEyes(f, 0x6ad0ff);
  const sh = A.metalRound({ R: 0.36, dome: 0.06, m: bronze, rimM: MAT.metal({ color: 0xa08848, rough: 0.45 }) }); sh.position.set(-0.32, 1.15, 0.2); sh.rotation.y = deg(-25); f.add(sh);
  const sp = M.spear({ len: 2.1 }); inHand(f, sp, { rx: 0.1, pos: [0, -0.9, 0.04] });
  f.position.set(0, 0, -3.4); f.rotation.y = deg(-10); scene.add(f);
  embers(scene, V(0, 1.5, -5), 40, 5, 0x6ac0ff, 0.06);
  return shoot(scene, cam(42, V(0.5, 1.3, 0.8), V(-0.2, 1.6, -6)), w, h, { exposure: 1.4, bloom: { strength: 0.45 } });
};
S['general-renegat'] = (w, h) => {
  const gh = (x, z) => hills(2.2, 0.03)(x, z) - Math.max(0, -z - 8) * 0.25;
  const scene = enemyScene({ ...DUSK, top: 0x1e2236, mid: 0x6a4a4a, horizon: 0xe09060, sunColor: 0xffa070, fog: 0x7a5a50, fogD: 0.014, clouds: 0.7, cloudDark: 0x2a1e24 }, gh, (x, z, hh, sl) => dryCol(x, z, hh, sl).lerp(C(0x5a5038), 0.4), { sunDir: V(-0.8, 0.25, -0.5), sunI: 2.4 });
  const r = rng(11);
  for (let i = 0; i < 34; i++) { const x = r.range(-14, 10), z = r.range(-26, -10); const f = figure({ variant: i % 4, coat: [0x1a1a1a, 0x3a1a14, 0x2a2a2a][i % 3], legs: 0x2a2420, spear: i % 2 === 0, shield: i % 3 === 0 ? { type: 'round', field: '#1a1a1a' } : null, beard: 0.5 }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(160 + r.range(-15, 15)); scene.add(f); }
  [[-6, -16], [2, -20], [7, -14]].forEach(([x, z]) => { const b = banner(0x141414, 'bend', '#a01a14', 5.5); b.position.set(x, gh(x, z), z); scene.add(b); });
  const rd = rider(0x1a1410, { faction: 'aube', variant: 1, coat: 0x1a1a1a, cloakColor: 0x6a0e0a, armRot: [[-20, 10], [-70, 15]], beard: 0.8 });
  rd.position.set(0.5, gh(0.5, -5) - 0.1, -5); rd.rotation.y = deg(-60); scene.add(rd);
  const fig = rd.children[1]; helmOn(fig, A.greatHelm({ m: MAT.metal({ color: 0x3a3a3e, rough: 0.35 }), top: 'sugar', trim: MAT.metal({ color: 0x8a1a14, rough: 0.4 }), crest: 'fan' }), 0.03);
  inHand(fig, A.swordX({ len: 0.85, guard: 'curved', guardLen: 0.2, gripLen: 0.14, pommelType: 'wheel' }), { rx: Math.PI * 0.9 }); fill(scene, 0xffc0a0, 1.8, V(4, 4, 6));
  return shoot(scene, cam(40, V(2.6, 2.2, 1.6), V(-0.8, 2.0, -7)), w, h);
};
S['roi-sans-couronne'] = (w, h) => {
  const gh = (x, z) => hills(1.0, 0.04)(x, z) - Math.max(0, -z - 6) * 0.9;
  const scene = enemyScene({ ...DUSK, top: 0x1a2240, mid: 0x6a5070, horizon: 0xf0a060, sunColor: 0xffb070, fog: 0x7a6070, fogD: 0.008, clouds: 0.6 }, gh, (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x7a6a4a), 0.4), { sunDir: V(0.7, 0.15, -0.8), sunI: 2.6 });
  // la capitale en ruines, au loin dans la vallée
  const st = stoneM(0xb8a890, [3, 3]); const cit = G(); cit.position.set(-8, gh(-8, -60) - 1, -60);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const t = ruinTower(2, 8 + (i % 3) * 3, st, i); t.position.set(Math.cos(a) * 12, 0, Math.sin(a) * 12); cit.add(t); }
  const k = ruinTower(4, 18, st, 9); cit.add(k); scene.add(cit);
  [[-2.2, -5], [2.4, -6]].forEach(([x, z]) => { const b = royalBanner(5); b.position.set(x, gh(x, z), z); scene.add(b); });
  const f = figure({ faction: 'aube', variant: 1, coat: 0x1c2a5a, legs: 0x1a1a2a, cloakColor: 0x1c2a5a, armRot: [[-10, 12], [-25, 14]], beard: 0.7, helm: false, skin: 0xb08068 });
  onBody(f, A.plateArmor({ m: MAT.polished({ color: 0xc8cad0, rough: 0.15 }), trim: MAT.gold(), cloth: MAT.cloth({ color: 0x1c2a5a }), bodyOnly: true, star: MAT.gold() }));
  const hair = mesh(new THREE.SphereGeometry(0.125, 16, 12), MAT.fur({ color: 0x2a1a10, rep: [2, 2] })); hair.scale.set(1, 0.78, 1.05); hair.position.set(0, 0.05, -0.03); f.children[3].add(hair);
  inHand(f, A.swordX({ len: 0.88, w0: 0.056, w1: 0.042, guard: 'wing', guardLen: 0.24, guardMat: MAT.gold(), pommelType: 'star', pommelMat: MAT.gold(), gripMat: MAT.leather({ color: 0x1a2a6a }) }), { rx: Math.PI / 2 + 0.5 });
  f.position.set(0, gh(0, -3), -3); f.rotation.y = deg(-20); scene.add(f); fill(scene, 0xffc8a0, 1.8);
  return shoot(scene, cam(38, V(0.6, 1.3, 0.5), V(-0.6, 1.45, -6)), w, h);
};
S['seigneur-des-ruines'] = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0a0c14, 0.045);
  scene.add(new THREE.HemisphereLight(0x4a5a7a, 0x080808, 0.5));
  const st = stoneM(0x7a746c, [8, 8]);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), st); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const back = mesh(new THREE.BoxGeometry(30, 14, 1), stoneM(0x5a5652, [8, 4])); back.position.set(0, 7, -10); scene.add(back);
  const r = rng(7);
  [[-4, -4, 7], [4, -4, 3.2], [-4, -8, 2.4], [4, -8, 7]].forEach(([x, z, hh]) => { const col = mesh(new THREE.CylinderGeometry(0.5, 0.55, hh, 14), st); col.position.set(x, hh / 2, z); scene.add(col); });
  scatter(scene, 16, (rr) => { const b = mesh(new THREE.BoxGeometry(rr.range(0.4, 1.2), rr.range(0.3, 0.7), rr.range(0.4, 1)), st); b.rotation.set(rr(), rr(), rr()); return b; }, (rr) => V(rr.range(-6, 6), 0.2, rr.range(-9, -2)), 5);
  const th = throne(stoneM(0x8a8070, [1, 2])); th.position.set(0, 0.12, -5); scene.add(th);
  [[-1.5, -6.5], [1.5, -6.5]].forEach(([x, z]) => { const b = royalBanner(6); b.position.set(x, 0, z); b.children.forEach((c) => { if (c.geometry && c.geometry.type === 'PlaneGeometry') c.scale.y = 0.75; }); scene.add(b); });
  const f = figure({ faction: 'aube', variant: 0, coat: 0x1c2240, legs: 0x1a1a22, cloakColor: 0x141a34, armRot: [[-38, 22], [-38, 22]], beard: 0, skin: 0x6a6c70, helm: false });
  onBody(f, A.plateArmor({ m: MAT.metal({ color: 0x8a8a90, rough: 0.35 }), trim: MAT.gold({ rough: 0.4 }), cloth: MAT.cloth({ color: 0x1c2240 }), bodyOnly: true }));
  helmOn(f, A.crownHelm({ m: MAT.metal({ color: 0x5a5a60, rough: 0.4 }), crownM: MAT.gold({ rough: 0.3 }), gems: [0x5ab0ff, 0xd01030], glow: 1.4 }), 0.045);
  glowEyes(f, 0x7ac8ff);
  f.children[0].rotation.x = -1.35; f.children[0].position.z = 0.0;
  inHand(f, A.swordX({ len: 0.88, guard: 'wing', guardLen: 0.24, guardMat: MAT.gold(), pommelType: 'star', pommelMat: MAT.gold() }), { rx: Math.PI * 0.75 });
  f.position.set(0, 0.95 - 0.9 + 0.08, -4.8); scene.add(f);
  const shaft = new THREE.SpotLight(0xbfd0ff, 22, 20, 0.35, 0.6, 1.2); shaft.position.set(2, 10, -2); shaft.target.position.set(0, 1.5, -5); scene.add(shaft, shaft.target); shaft.castShadow = true;
  embers(scene, V(0, 2, -5), 30, 6, 0x9ac0ff, 0.05);
  void r;
  return shoot(scene, cam(42, V(0.8, 1.5, 0.6), V(0, 1.6, -5)), w, h, { exposure: 1.5, bloom: { strength: 0.45 } });
};

// ------------------------------------------------------------------ travaux (lot 2)
S.chantier = (w, h) => {
  const gh = hills(1.2, 0.03);
  const scene = world({ ...DAY, sunDir: V(-0.5, 0.55, -0.3), horizon: 0xe8dcc0 });
  terrain(scene, { size: 300, h: (x, z) => gh(x, z) - 1.4 * smooth(2, 0.5, Math.abs(z + 8 + Math.sin(x * 0.2))), color: (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x7a5a3a), smooth(2.5, 1, Math.abs(z + 8 + Math.sin(x * 0.2)))) });
  const st = stoneM(0xc8b898, [4, 4]);
  const tw = mesh(new THREE.CylinderGeometry(3, 3.2, 5, 24), st); tw.position.set(-3, 2.5, -14); scene.add(tw);
  const wl = wall(10, 3, 1.4, st, false); wl.position.set(4, 0, -14.5); scene.add(wl);
  // échafaudage
  const wd = MAT.wood({ color: 0x9a7448, rep: [1, 3] });
  for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.5; const p = mesh(new THREE.CylinderGeometry(0.07, 0.07, 7, 6), wd); p.position.set(-3 + Math.cos(a) * 3.6, 3.5, -14 + Math.sin(a) * 3.6); scene.add(p); }
  for (const y of [2.2, 4.4]) { const ring = mesh(new THREE.TorusGeometry(3.6, 0.06, 6, 24, Math.PI * 0.85), wd); ring.rotation.x = Math.PI / 2; ring.rotation.z = -1.25; ring.position.set(-3, y, -14); scene.add(ring); }
  const cr = crane(); cr.position.set(5, gh(5, -12), -12); cr.rotation.y = -0.6; scene.add(cr);
  scatter(scene, 10, (r) => mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), st), (r) => V(r.range(-1, 4), 0.2, r.range(-6, -3)), 4);
  [[0.5, -4, 200], [-1.5, -5.5, 120], [2.5, -6.5, 230], [-4, -9, 160]].forEach(([x, z, ry], i) => { const f = figure({ variant: i, coat: [0x8a6a40, 0x6a5a3a, 0x9a8a60, 0x7a6040][i], mail: false, helm: false, hood: i === 1 ? 0x5a4a30 : null, legs: 0x4a3a28, armRot: [[-40, 15], [-70, 15]], beard: i % 2, skin: 0xa87860 }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(ry); scene.add(f); });
  const b = banner(0xe4ddca, 'sun', '#c99528', 4.5); b.position.set(-6, gh(-6, -9), -9); scene.add(b);
  return shoot(scene, cam(40, V(3, 2.6, 3), V(-1, 2, -10)), w, h);
};
S.percepteur = (w, h) => {
  const gh = hills(1, 0.03);
  const scene = world({ ...DUSK, sunDir: V(-0.6, 0.35, -0.4), sunI: 2.6, top: 0x2a3a60, horizon: 0xf8c080 });
  terrain(scene, { size: 200, h: gh, color: roadMix(dryCol, (z) => 0, 3) });
  const r = rng(3); [[-7, -10], [6, -11], [-9, -18], [8, -20], [0, -24]].forEach(([x, z]) => { const hs = house(r.range(4, 6), r.range(3, 4), 2.6, { roofC: 0x7a6038, wallC: 0xb8a888 }); hs.position.set(x, gh(x, z), z); hs.rotation.y = Math.atan2(-x, -z) + Math.PI; scene.add(hs); });
  const table = mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9), MAT.wood({ color: 0x5a3a20 })); table.position.set(-0.6, 0.82, -5); scene.add(table);
  for (const x of [-1.4, 0.2]) for (const z of [-0.35, 0.35]) { const l = mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), MAT.wood({ color: 0x4a2a18 })); l.position.set(x, 0.4, -5 + z); scene.add(l); }
  const ch = chest(0.9, true); ch.position.set(0.7, 0, -4.6); ch.rotation.y = -0.4; scene.add(ch);
  for (let i = 0; i < 4; i++) { const bag = mesh(new THREE.SphereGeometry(0.13, 12, 10), MAT.cloth({ color: 0x9a7a50 })); bag.scale.y = 1.2; bag.position.set(-1.2 + i * 0.25, 0.98, -5 + (i % 2) * 0.15); scene.add(bag); }
  const parch = mesh(new THREE.PlaneGeometry(0.5, 0.35), MAT.plain(0xe8d8b0)); parch.rotation.x = -Math.PI / 2; parch.position.set(-0.3, 0.87, -4.9); scene.add(parch);
  const col = figure({ variant: 1, coat: 0x4a2a5a, mail: false, helm: false, hood: 0x3a2048, legs: 0x3a2a30, beard: 0.4, armRot: [[-50, 10], [-50, 10]] }); col.position.set(-0.6, 0, -5.8); scene.add(col);
  [[2.2, -5.5, -60], [-2.6, -5.2, 60]].forEach(([x, z, ry], i) => { const g = figure({ faction: 'aube', variant: i + 2, coat: 0xd8d0bc, spear: true, shield: i ? SH.aube : null }); g.position.set(x, 0, z); g.rotation.y = deg(ry); scene.add(g); });
  [[0.4, -2.8, 190], [-0.6, -2.4, 175]].forEach(([x, z, ry], i) => { const p = figure({ variant: i, coat: [0x6a5a40, 0x8a7a58][i], mail: false, helm: false, hood: 0x5a4a30, legs: 0x4a3a28, beard: 0.6, skin: 0xa07058 }); p.position.set(x, 0, z); p.rotation.y = deg(ry); scene.add(p); });
  return shoot(scene, cam(40, V(2.5, 2.4, 1.6), V(-0.8, 1.0, -5.5)), w, h);
};
S.frontiere = (w, h) => {
  const gh = (x, z) => hills(2.5, 0.03)(x, z) - 1.6 * smooth(6, 2, Math.abs(z + 12 + Math.sin(x * 0.15) * 2));
  const scene = world({ ...DUSK, sunDir: V(0.7, 0.25, -0.6), sunI: 2.4, top: 0x24345a, horizon: 0xf0a868 });
  terrain(scene, { size: 300, h: gh, color: (x, z, hh, sl) => grassCol(x, z, hh, sl).lerp(C(0x8a7a5a), smooth(4, 2, Math.abs(z + 12 + Math.sin(x * 0.15) * 2))) });
  water(scene, [300, 6], -0.9, 0x3a5070, V(0, 0, -12));
  const wt = watchtower(6.5); wt.position.set(-4, gh(-4, -5), -5); wt.rotation.y = 0.3; scene.add(wt);
  palisade(scene, 14, 0, -6.5, 0.32, 0.02, 2.6, 3);
  const b = banner(0xe4ddca, 'sun', '#c99528', 3); b.position.set(-4, gh(-4, -5) + 5.4, -5); scene.add(b);
  const g1 = figure({ faction: 'aube', variant: 0, coat: 0xd8d0bc, spear: true, shield: SH.aube }); g1.position.set(1.2, gh(1.2, -4), -4); g1.rotation.y = deg(160); scene.add(g1);
  const g2 = figure({ faction: 'aube', variant: 2, coat: 0xd8d0bc, spear: true }); g2.position.set(-4, gh(-4, -5) + 5.3, -4.4); g2.rotation.y = deg(170); scene.add(g2);
  // en face, de l'autre côté du gué
  const b2 = banner(0x2c5a38, 'star', '#d0a038', 4); b2.position.set(10, gh(10, -22), -22); scene.add(b2);
  scatter(scene, 16, (r) => (r() < 0.5 ? cypress(r.range(5, 8), r) : broadleaf(r.range(4, 7), 0x4a5a2a, r)), (r) => { const x = r.range(-30, 30), z = r.range(-45, -18); return V(x, gh(x, z), z); }, 9);
  fire(scene, V(2.4, gh(2.4, -5.5), -5.5), 0.6, { light: 15 });
  return shoot(scene, cam(40, V(3.5, 2.2, 2.5), V(-1.5, 1.8, -10)), w, h);
};
S.cavalerie = (w, h) => {
  const gh = hills(2.4, 0.025); const rx = (z) => Math.sin(z * 0.05) * 5;
  const scene = world({ ...DAY, sunDir: V(-0.7, 0.4, 0.3), clouds: 0.6, horizon: 0xe8dcc0 });
  terrain(scene, { size: 300, h: gh, color: roadMix(grassCol, rx, 2.2) });
  for (let i = 0; i < 5; i++) { const z = -5 - i * 3.2; const x = rx(z) + (i % 2 ? 0.9 : -0.9); const rd = rider([0x4a2e1c, 0x2a1e16, 0x6a4a30, 0x3a2a1c, 0x8a6a48][i], { faction: 'aube', variant: i % 4, coat: 0xd8d0bc, cloakColor: i === 0 ? 0x7a2a20 : null, spear: i !== 0, armRot: [[-20, 10], [-45, 12]] }); rd.position.set(x, gh(x, z) - 0.1, z); rd.rotation.y = deg(170 + (i % 2 ? -6 : 6)); scene.add(rd); }
  const b = banner(0xe4ddca, 'sun', '#c99528', 3); b.position.set(rx(-5) - 0.6, gh(rx(-5), -5) + 1.7, -5.1); b.scale.setScalar(0.85); scene.add(b);
  scatter(scene, 22, (r) => broadleaf(r.range(5, 9), 0x3a5a24, r), (r) => { const z = r.range(-80, -6), x = rx(z) + (r() < 0.5 ? -1 : 1) * r.range(7, 30); return V(x, gh(x, z), z); }, 3);
  const dust = G(); puffs(dust, V(rx(-10), 0.3, -10), 18, 1.6, 0xc8b090, 0.2); scene.add(dust);
  return shoot(scene, cam(38, V(4, 2.3, 4), V(-0.8, 1.6, -11)), w, h);
};
S.espion = (w, h) => {
  const gh = hills(1.5, 0.03);
  const scene = world({ ...NIGHT, sunDir: V(0.4, 0.4, -0.8), sunI: 1.3 });
  terrain(scene, { size: 300, h: gh, color: (x, z, hh, sl) => grassCol(x, z, hh, sl).multiplyScalar(0.55).lerp(C(0x3a3428), 0.3) });
  const r = rng(13);
  [[-1, -9], [4, -12], [-5, -14], [1.5, -17], [7, -19], [-3, -21]].forEach(([x, z], i) => { const t = i % 2 ? ridgeTent(3, 4, 2.2, 0x6a5a48, i === 1 ? 0.5 : 0) : bellTent(2.3, 3.3, 0x7a6a50, i === 0 ? 0.0 : 0.6); t.position.set(x, gh(x, z) - 0.1, z); t.rotation.y = r() * 6; scene.add(t); });
  fire(scene, V(2.5, gh(2.5, -14), -14), 1, { light: 35 });
  [[3.4, -13.2, 220], [1.4, -13.6, 120]].forEach(([x, z, ry], i) => { const g = figure({ faction: 'sables', variant: i, coat: 0x2f5a3a, spear: i === 0 }); g.position.set(x, gh(x, z), z); g.rotation.y = deg(ry); scene.add(g); });
  const b = banner(0x2c5a38, 'star', '#d0a038', 4.5); b.position.set(-2.5, gh(-2.5, -12), -12); scene.add(b);
  // l'espion, accroupi derrière la toile
  const f = figure({ variant: 3, coat: 0x1a1a1e, mail: false, hood: 0x121216, legs: 0x16161a, beard: 0, armRot: [[-60, 15], [-30, 12]], skin: 0x8a6048, cloakColor: 0x0e0e12 });
  f.children[0].scale.y = 0.6; f.children[0].position.y = 0.55; f.children.slice(1).forEach((c) => (c.position.y -= 0.32)); f.rotation.x = 0.0;
  f.position.set(-1.1, gh(-1.1, -3.6), -3.6); f.rotation.y = deg(165); scene.add(f); fill(scene, 0x9ab0e0, 0.8, V(-3, 4, 4));
  return shoot(scene, cam(40, V(-0.3, 1.5, 0.4), V(0.6, 0.9, -12)), w, h, { exposure: 1.7 });
};
S.convoi = (w, h) => {
  const gh = hills(2, 0.03); const rx = (z) => Math.sin(z * 0.06) * 4;
  const scene = world({ ...DUSK, sunDir: V(-0.5, 0.3, -0.7), sunI: 2.6, top: 0x3a5a8a, mid: 0xb08a7a, horizon: 0xffc080 });
  terrain(scene, { size: 300, h: gh, color: roadMix(dryCol, rx, 2.4) });
  [[-4, 0], [-11, 1]].forEach(([z, k]) => { const x = rx(z); const load = G(); const c1 = chest(0.9, false); c1.position.x = -0.25; load.add(c1); const c2 = chest(0.8, true); c2.position.set(0.25, 0, -0.9); load.add(c2); const ct = cart(load); ct.position.set(x, gh(x, z), z); ct.rotation.y = deg(175 + k * 6); scene.add(ct); const hs = horse([0x4a2e1c, 0x6a4a30][k]); hs.position.set(x + 0.1, gh(x, z + 3), z + 3.2); hs.rotation.y = deg(175); scene.add(hs); });
  [[1.3, -2.5], [-1.4, -6], [1.4, -8.5], [-1.3, -13]].forEach(([dx, z], i) => { const x = rx(z) + dx; const g = figure({ faction: 'aube', variant: i % 4, coat: 0xd8d0bc, spear: true, shield: i % 2 ? SH.aube : null, cloakColor: i === 0 ? 0x7a2a20 : null }); g.position.set(x, gh(x, z), z); g.rotation.y = deg(178); scene.add(g); });
  const b = banner(0xe4ddca, 'sun', '#c99528', 4); b.position.set(rx(-2.5) + 1.8, gh(rx(-2.5) + 1.8, -2.5), -2.5); scene.add(b);
  scatter(scene, 18, (r) => (r() < 0.5 ? cypress(r.range(5, 8), r) : broadleaf(r.range(4, 6), 0x5a6230, r)), (r) => { const z = r.range(-60, -6), x = rx(z) + (r() < 0.5 ? -1 : 1) * r.range(5, 25); return V(x, gh(x, z), z); }, 3);
  return shoot(scene, cam(40, V(3.5, 2.6, 3), V(-0.4, 1.0, -9)), w, h);
};
S['maitre-d-armes'] = (w, h) => {
  const scene = world({ ...DAY, sunDir: V(-0.6, 0.6, 0.2), horizon: 0xe8dcc0 });
  terrain(scene, { size: 200, h: (x, z) => 0.15 * fbm(x * 0.1, z * 0.1, 1, 2), color: (x, z) => mixc(0xb09a72, 0xc8b088, 0.5 + fbm(x * 0.2, z * 0.2, 1, 3)) });
  palisade(scene, 40, -12, -13, 0.6, 0, 3, 2);
  // râtelier d'armes
  const wd = MAT.wood({ color: 0x5a3a20, rep: [1, 2] }); const rack = G(); rack.position.set(4, 0, -8.5);
  for (const x of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), wd); p.position.set(x, 0.8, 0); rack.add(p); }
  const bar = mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), wd); bar.position.y = 1.4; rack.add(bar);
  [A.swordX({}), A.axeX({ head: 'bearded', haft: 0.8 }), A.huntSpear(), A.swordX({ len: 1.0, gripLen: 0.22 })].forEach((o, i) => { o.position.set(-0.8 + i * 0.5, 0.2, 0.1); o.rotation.z = 0.05; if (i === 2) o.scale.setScalar(0.8); rack.add(o); });
  scene.add(rack);
  const q = G(); const post = mesh(new THREE.CylinderGeometry(0.1, 0.12, 2, 8), wd); post.position.y = 1; q.add(post); const arm = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), wd); arm.rotation.z = Math.PI / 2; arm.position.y = 1.8; q.add(arm); const sh = M.roundShield({ field: '#7a5a3a', R: 0.35 }); sh.position.set(-0.6, 1.6, 0.05); q.add(sh); q.position.set(-5, 0, -9); scene.add(q);
  const m = figure({ faction: 'aube', variant: 1, coat: 0xa02a20, mail: true, helm: false, beard: 1, armRot: [[-20, 18], [-60, 20]], skin: 0xa87860 });
  inHand(m, A.swordX({ len: 0.8, guard: 'bar', guardLen: 0.2, gripLen: 0.12 }), { rx: Math.PI / 2 + 0.6 });
  m.position.set(-1.1, 0, -5); m.rotation.y = deg(70); scene.add(m);
  [[1.1, -4.6, -100], [1.5, -6.2, -80]].forEach(([x, z, ry], i) => { const s = figure({ faction: 'aube', variant: i + 2, coat: 0xb8a888, mail: i === 0, helm: i === 0, legs: 0x5a4a38, shield: i === 0 ? { type: 'round', field: '#7a5a3a' } : null, armRot: [[-30, 15], [-70, 18]], beard: 0.2 }); inHand(s, A.swordX({ len: 0.75 }), { rx: Math.PI / 2 + 0.5 }); s.position.set(x, 0, z); s.rotation.y = deg(ry); scene.add(s); });
  const b = banner(0xe4ddca, 'sun', '#c99528', 5); b.position.set(-8, 0, -12); scene.add(b);
  return shoot(scene, cam(40, V(1, 2.0, 2), V(0, 1.1, -6)), w, h);
};
S.siege = (w, h) => {
  const gh = hills(1.2, 0.03);
  const scene = world({ ...DUSK, top: 0x2a2a3a, mid: 0x8a5a4a, horizon: 0xe89050, sunDir: V(-0.7, 0.25, -0.4), sunI: 2.2, fog: 0x8a6a5a, fogD: 0.014, clouds: 0.75 });
  terrain(scene, { size: 300, h: gh, color: (x, z, hh, sl) => dryCol(x, z, hh, sl).lerp(C(0x5a4a38), 0.35) });
  const st = stoneM(0xb0a088, [6, 2]);
  const wl = wall(50, 9, 3, st); wl.position.set(0, 0, -20); wl.rotation.y = 0.12; scene.add(wl);
  [[-10, -18.8], [9, -21]].forEach(([x, z]) => { const t = tower(3.2, 13, st, { roof: 0x5a2a20 }); t.position.set(x, 0, z); scene.add(t); });
  const sgt = siegeTower(10); sgt.position.set(-3, gh(-3, -14), -14); sgt.rotation.y = 0.12; scene.add(sgt);
  const rm = ram(); rm.position.set(4.5, gh(4.5, -13), -13); rm.rotation.y = 0.12; scene.add(rm);
  const r = rng(4);
  for (let i = 0; i < 14; i++) { const x = r.range(-7, 8), z = r.range(-11, -5); const f = figure({ faction: 'aube', variant: i % 4, coat: 0xd8d0bc, spear: i % 3 === 0, shield: i % 2 ? SH.aube : null, armRot: [[-20, 12], [-r.range(20, 80), 15]] }); f.position.set(x, gh(x, z), z); f.rotation.y = deg(180 + r.range(-20, 20)); scene.add(f); }
  [[-6, -7], [3, -8]].forEach(([x, z]) => { const b = banner(0xe4ddca, 'sun', '#c99528', 5); b.position.set(x, gh(x, z), z); scene.add(b); });
  fire(scene, V(7, 9.5, -20.5), 2.2, { light: 60 });
  const dust = G(); puffs(dust, V(0, 0.5, -12), 26, 2, 0xb09070, 0.25); scene.add(dust);
  fill(scene, 0xffb890, 1.2);
  return shoot(scene, cam(40, V(2.5, 3.0, 7), V(0, 3.6, -15)), w, h);
};
S.conseil = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x1a1208, 0.05);
  scene.add(new THREE.HemisphereLight(0x8a7050, 0x1a1008, 0.7));
  const floor = mesh(new THREE.PlaneGeometry(30, 30), MAT.cloth({ color: 0x5a3a24, rep: [10, 10] })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const tg = new THREE.CylinderGeometry(7, 7, 6, 24, 1, true); const tm = MAT.cloth({ color: 0xb02a20, rep: [8, 3] }); tm.side = THREE.BackSide;
  const tent = mesh(tg, tm); tent.position.set(0, 3, -4); scene.add(tent);
  const roof = mesh(new THREE.ConeGeometry(7, 3, 24, 1, true), MAT.cloth({ color: 0xd8c8a0, rep: [8, 3] })); roof.material.side = THREE.BackSide; roof.position.set(0, 7.5, -4); scene.add(roof);
  const table = mesh(new THREE.BoxGeometry(3, 0.1, 1.6), MAT.wood({ color: 0x4a2a18 })); table.position.set(0, 0.9, -4); scene.add(table);
  for (const x of [-1.3, 1.3]) for (const z of [-0.6, 0.6]) { const l = mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), MAT.wood({ color: 0x3a2010 })); l.position.set(x, 0.45, -4 + z); scene.add(l); }
  const map = mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshStandardMaterial({ map: mapTex(), roughness: 0.9 })); map.rotation.x = -Math.PI / 2; map.position.set(0, 0.96, -4); scene.add(map);
  [[-0.6, -4.2, 0xc99528], [0.4, -3.8, 0x2f6a44], [0.7, -4.3, 0x3a5a8a], [-0.2, -3.7, 0xa02a20]].forEach(([x, z, c]) => { const p = mesh(new THREE.ConeGeometry(0.05, 0.16, 8), MAT.plain(c, 0.5)); p.position.set(x, 1.04, z); scene.add(p); });
  [[-0.9, -4.5], [0.95, -3.6]].forEach(([x, z]) => { const cd = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), MAT.plain(0xe8e0c8)); cd.position.set(x, 1.08, z); scene.add(cd); const fl = mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: C(0xffc060).multiplyScalar(4) })); fl.position.set(x, 1.24, z); fl.scale.y = 1.8; scene.add(fl); const pl = new THREE.PointLight(0xffa050, 5, 8, 1.5); pl.position.set(x, 1.4, z); scene.add(pl); });
  [[-2.0, -4.0, 90, 'aube', 0xe4ddca, 0x7a2a20], [0, -5.3, 0, 'aube', 0xa02a20, 0x3a2a20], [2.0, -4.2, -90, 'aube', 0xd8d0bc, 0x5a4a38], [-1.1, -5.2, 30, 'aube', 0x2a3a5a, 0x2a2a3a]].forEach(([x, z, ry, fa, co, cl], i) => { const f = figure({ faction: fa, variant: i, coat: co, cloakColor: cl, helm: false, beard: [1, 0.8, 0.5, 1][i], armRot: [[-30, 10], [-45, 10]] }); f.position.set(x, 0, z); f.rotation.y = deg(ry); scene.add(f); });
  const b = banner(0xe4ddca, 'sun', '#c99528', 4); b.position.set(-3, 0, -8); scene.add(b);
  const lamp = new THREE.PointLight(0xffb060, 18, 14, 1.4); lamp.position.set(0, 3.2, -3); lamp.castShadow = true; scene.add(lamp);
  return shoot(scene, cam(46, V(2.2, 2.6, 0.6), V(-0.3, 0.9, -4.2)), w, h, { exposure: 1.2 });
};
S.ruines = (w, h) => {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0a0806, 0.06);
  scene.add(new THREE.HemisphereLight(0x5a5048, 0x080606, 0.6));
  { const sp = new THREE.SpotLight(0xd8c8a8, 80, 30, 0.35, 0.6, 1.2); sp.position.set(-3, 13, -5); sp.target.position.set(0, 2.2, -11); scene.add(sp, sp.target); }
  const st = stoneM(0x8a8070, [8, 8]);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), st); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const back = mesh(new THREE.BoxGeometry(30, 10, 1), stoneM(0x6a6258, [8, 3])); back.position.set(0, 5, -13); scene.add(back);
  for (let i = 0; i < 4; i++) for (const x of [-3.2, 3.2]) { const hh = i === 1 && x > 0 ? 2.2 : 6; const col = mesh(new THREE.CylinderGeometry(0.45, 0.5, hh, 14), st); col.position.set(x, hh / 2, -2 - i * 3); scene.add(col); }
  scatter(scene, 18, (rr) => { const b = mesh(new THREE.BoxGeometry(rr.range(0.4, 1.2), rr.range(0.3, 0.7), rr.range(0.4, 1)), st); b.rotation.set(rr(), rr(), rr()); return b; }, (rr) => V(rr.range(-5, 5), 0.2, rr.range(-12, -3)), 8);
  // statue d'un ancien roi
  const stat = figure({ faction: 'aube', variant: 0, coat: 0x8a8478, legs: 0x8a8478, mail: false, helm: false, beard: 1, armRot: [[-10, 10], [-10, 10]] });
  stat.traverse((o) => { if (o.isMesh) o.material = st; });
  helmOn(stat, A.crownHelm({ m: st, crownM: st, gems: [0x8a8478, 0x8a8478], glow: 0 }), 0.045);
  stat.scale.setScalar(2.2); stat.position.set(0, 0.4, -11); scene.add(stat);
  const ped = mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), st); ped.position.set(0, 0.4, -11); scene.add(ped);
  const ex = figure({ faction: 'aube', variant: 1, coat: 0x5a4a38, cloakColor: 0x3a2e24, helm: false, hood: 0x4a3a2a, armRot: [[-10, 12], [-110, 20]], beard: 0.6 });
  ex.position.set(0.8, 0, -4.5); ex.rotation.y = deg(195); scene.add(ex);
  const tor = G(); const st2 = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.5, 6), MAT.wood({ color: 0x3a2618 })); tor.add(st2); const fl = mesh(new THREE.ConeGeometry(0.08, 0.3, 8), new THREE.MeshBasicMaterial({ color: C(0xffa040).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); fl.position.y = 0.38; tor.add(fl); const pl = new THREE.PointLight(0xff9a40, 14, 12, 1.5); pl.position.y = 0.5; pl.castShadow = true; tor.add(pl); inHand(ex, tor, { rx: Math.PI, pos: [0, -0.05, 0] });
  embers(scene, V(0.8, 2.2, -4.6), 20, 1.2, 0xffb040, 0.04);
  return shoot(scene, cam(44, V(1.6, 1.8, 0.6), V(0, 1.6, -9)), w, h, { exposure: 1.3, bloom: { strength: 0.4 } });
};

export function register(job) {
  job('bg/title.jpg', 1920, 1080, () => S.title(1920, 1080), { div: 3, colors: 64, dither: 0.4 });
  job('bg/camp.jpg', 1920, 1080, () => S.camp(1920, 1080), { div: 3, colors: 56, dither: 0.4 });
  for (const id of ['loup', 'brigand', 'deserteur', 'pillard', 'mercenaire', 'chevalier-noir', 'champion', 'ours', 'chef-brigand', 'assassin', 'chevalier-renegat', 'fou-de-guerre', 'garde-du-tyran', 'seigneur-pillard', 'capitaine-mercenaire', 'seigneur-dechu', 'gardien-des-tombeaux', 'general-renegat', 'roi-sans-couronne', 'seigneur-des-ruines']) job(`enemies/${id}.jpg`, 512, 384, () => S[id](512, 384), { div: 2, colors: 48 });
  for (const id of ['troupeaux', 'bucheron', 'pelerins', 'forge', 'remparts', 'caravane', 'eclaireur', 'recrues', 'brigands', 'ambassade', 'chantier', 'percepteur', 'frontiere', 'cavalerie', 'espion', 'convoi', 'maitre-d-armes', 'siege', 'conseil', 'ruines']) job(`jobs/${id}.jpg`, 512, 320, () => S[id](512, 320), { div: 2, colors: 48 });
  for (const id of ['patrouille', 'pillage', 'duel', 'bataille', 'travail', 'hopital']) job(`actions/${id}.jpg`, 800, 450, () => S[id](800, 450), { div: 2, colors: 56 });
}
