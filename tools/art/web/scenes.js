// Scènes : fonds, ennemis, travaux, actions. Rendues petit puis « illustrées » par pixelize.py.
import { THREE, MAT, mesh, displace, loft, lathe, ellipse, sweep, tubeAlong, canvasTex, tex, fbm, noise3, smooth, clamp, lerp, V, deg, rng, sky, sun, envFromScene, capture } from './lib.js';
import * as M from './models.js';
import { figure, torso } from './people.js';

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

export function register(job) {
  job('bg/title.jpg', 1920, 1080, () => S.title(1920, 1080), { div: 3, colors: 64, dither: 0.4 });
  job('bg/camp.jpg', 1920, 1080, () => S.camp(1920, 1080), { div: 3, colors: 56, dither: 0.4 });
  for (const id of ['loup', 'brigand', 'deserteur', 'pillard', 'mercenaire', 'chevalier-noir', 'champion']) job(`enemies/${id}.jpg`, 512, 384, () => S[id](512, 384), { div: 2, colors: 48 });
  for (const id of ['troupeaux', 'bucheron', 'pelerins', 'forge', 'remparts', 'caravane', 'eclaireur', 'recrues', 'brigands', 'ambassade']) job(`jobs/${id}.jpg`, 512, 320, () => S[id](512, 320), { div: 2, colors: 48 });
  for (const id of ['patrouille', 'pillage', 'duel', 'bataille', 'travail', 'hopital']) job(`actions/${id}.jpg`, 800, 450, () => S[id](800, 450), { div: 2, colors: 56 });
}
