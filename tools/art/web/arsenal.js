// Objets ajoutés (lot 2) : générateurs paramétriques par type d'objet (armes, boucliers, casques, armures, chaussures, bagues).
// Les rangs se lisent dans les matériaux : commun = fer, bois, cuir ; solide = acier, laiton ; rare = gravure, émail, or ;
// légendaire = or, argent, gemmes et lueur. Factions : aube or #d8b453 + soleil ; sables vert #3f8f5a + étoile ; givre bleu #5b7fb0 + corbeau.
import { THREE, MAT, loft, lathe, mesh, displace, tubeAlong, radialSurface, canvasTex, img, tex, fbm, noise3, smooth, clamp, lerp, V, deg, rng, ellipse } from './lib.js';
import * as M from './models.js';

const G = () => new THREE.Group();
const C = (c) => new THREE.Color(c);
export const FC = { aube: '#d8b453', sables: '#3f8f5a', givre: '#5b7fb0' };

// ================================================================== matériaux
const iron = (c = 0x7a7874, r = 0.55) => MAT.metal({ color: c, rough: r, rep: [1, 2] });
const steel = (c = 0xc8cace, r = 0.18) => MAT.polished({ color: c, rough: r, rep: [1, 3] });
const brass = (r = 0.3) => MAT.metal({ color: 0xc8a04c, rough: r });
const gold = (r = 0.2) => MAT.gold({ rough: r });
const silver = (r = 0.12) => MAT.polished({ color: 0xe6e8ec, rough: r, env: 1.1 });
const bronze = (r = 0.4) => MAT.metal({ color: 0x9a7a4a, rough: r });
const wood = (c = 0x7a5232, rep = [1, 4]) => MAT.wood({ color: c, rep });
const leather = (c = 0x5a3520, rep = [1, 2]) => MAT.leather({ color: c, rep });
const cloth = (c, rep = [3, 3], o = {}) => MAT.cloth({ color: c, rep, ...o });
export function gem(color, glow = 0, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.04, metalness: 0, transmission: 0.2, thickness: 0.02, ior: 1.75, attenuationColor: C(color), attenuationDistance: 0.006, clearcoat: 1, envMapIntensity: 1.2, specularIntensity: 0.7, emissive: C(color), emissiveIntensity: Math.max(glow, 0.18), ...o });
}
const glowMat = (color, k = 1.2, base = 0xd8dce4) => { const m = MAT.polished({ color: base, rough: 0.12 }); m.emissive = C(color); m.emissiveIntensity = k; return m; };
const hex = (c) => typeof c === 'number' ? '#' + C(c).getHexString() : c;

/** Métal à motif gravé ou incrusté : draw(c, w, h) dessine sur un fond clair ; or = traits dorés. */
function patternMetal({ base = '#c8c8cc', draw, size = 512, rough = 0.22, rep = [1, 1], bump = 1.5, metal = 1 }) {
  const t = canvasTex(size, size, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); c.globalAlpha = 0.25; c.drawImage(img('metal_c'), 0, 0, w, h); c.globalAlpha = 1; draw(c, w, h); });
  t.repeat.set(...rep);
  const b = t.clone(); b.colorSpace = THREE.NoColorSpace; b.repeat.set(...rep);
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t, bumpMap: b, bumpScale: bump, metalness: metal, roughness: rough * 1.6, envMapIntensity: 1.2, normalMap: tex('metal_n', rep), normalScale: new THREE.Vector2(0.1, 0.1) });
}
function scrolls(c, w, h, color = '#e0b050', n = 6, lw = 4) {
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * h / n;
    c.beginPath(); c.moveTo(0, y);
    for (let x = 0; x <= w; x += w / 8) c.quadraticCurveTo(x + w / 16, y + (((x / (w / 8)) % 2) ? -1 : 1) * h / n * 0.45, x + w / 8, y);
    c.stroke();
    for (let x = w / 16; x < w; x += w / 8) { c.beginPath(); c.arc(x, y + (((Math.round(x / (w / 8))) % 2) ? 1 : -1) * h / n * 0.18, h / n * 0.12, 0, Math.PI * 1.6); c.stroke(); }
  }
}

// ================================================================== lames
/** Lame générale : sections losangées avec gouttière, courbure, dos plat (single), largeur profilée. */
export function blade({ len = 0.8, w0 = 0.05, w1 = 0.04, tip = 0.14, th = 0.008, fuller = 0.6, fullerW = 0.32, curve = 0, single = false, profile = null, steps = 80 } = {}) {
  const secs = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, y = t * len;
    let w = lerp(w0, w1, t);
    const tt = (y - (len - tip)) / tip;
    if (tt > 0) w *= Math.sqrt(Math.max(0, 1 - Math.pow(tt, 1.6)));
    if (profile) w = profile(t, w);
    w = Math.max(w, 0.0008);
    const fz = fuller > 0 ? (1 - 0.55 * smooth(0.0, 0.06, t) * smooth(fuller, fuller - 0.08, t)) : 1;
    const h = th * 0.5 * (1 - 0.35 * t) * (tt > 0 ? (1 - tt * 0.7) : 1);
    const fw = fullerW * w * 0.5;
    const back = single ? h * 0.75 : 0;
    const pts = [
      [w / 2, 0], [w / 2, 0], [w * 0.3, h], [w * 0.3, h],
      [fw, h], [fw * 0.6, h * (0.4 + 0.6 * fz)], [0, h * fz], [-fw * 0.6, h * (0.4 + 0.6 * fz)], [-fw, h],
      [-w * 0.3, h], [-w * 0.3, h], [-w / 2, back], [-w / 2, -back], [-w * 0.3, -h], [-w * 0.3, -h],
      [-fw, -h], [-fw * 0.6, -h * (0.4 + 0.6 * fz)], [0, -h * fz], [fw * 0.6, -h * (0.4 + 0.6 * fz)], [fw, -h],
      [w * 0.3, -h], [w * 0.3, -h],
    ];
    const off = curve * t * t + (single ? (w - w0) / 2 : 0);
    secs.push({ y, pts: pts.map(([x, z]) => [x + off, z]) });
  }
  return M.smoothShade(loft(secs, { closed: true, capStart: true }));
}
function barGeo(len, w, h, taper = 0.7, bend = 0, steps = 24) {
  const secs = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, x = (t - 0.5) * len;
    const s = lerp(1, taper, Math.abs(t - 0.5) * 2);
    const y = bend * Math.pow((t - 0.5) * 2, 2);
    secs.push({ y: x, pts: ellipse(w / 2 * s, h / 2 * s, 12, (a) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25)).map(([a, b]) => [a + y, b]) });
  }
  const g = loft(secs, { capStart: true, capEnd: true });
  g.rotateZ(-Math.PI / 2);
  return g;
}
function gripGeo(len, r0, r1, wraps = 0) {
  const prof = [];
  for (let k = 0; k <= 60; k++) { const t = k / 60; let r = lerp(r0, r1, t) * (1 + 0.12 * Math.sin(t * Math.PI)); if (wraps) r *= 1 + 0.05 * Math.pow(Math.abs(Math.sin(t * wraps * Math.PI)), 0.5); prof.push([r, t * len]); }
  prof.unshift([0.0001, 0]); prof.push([0.0001, len]);
  return lathe(prof, 32);
}
function pommel(type, m, s = 1, gemC = null, glow = 0) {
  const g = G();
  if (type === 'disc' || type === 'sun' || type === 'star') {
    const d = mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.016 * s, 40), m); d.rotation.x = Math.PI / 2; g.add(d);
    const r = mesh(new THREE.TorusGeometry(0.03 * s, 0.005 * s, 10, 40), m); g.add(r);
    const c = mesh(new THREE.SphereGeometry(0.014 * s, 20, 12), m); c.scale.z = 0.6; c.position.z = 0.007 * s; g.add(c);
    if (type === 'sun' || type === 'star') for (let i = 0; i < (type === 'sun' ? 12 : 8); i++) { const a = i / (type === 'sun' ? 12 : 8) * Math.PI * 2; const ray = mesh(new THREE.ConeGeometry(0.006 * s, (i % 2 && type === 'sun' ? 0.014 : 0.022) * s, 8), m); ray.position.set(Math.cos(a) * 0.038 * s, Math.sin(a) * 0.038 * s, 0); ray.rotation.z = a - Math.PI / 2; ray.scale.z = 0.5; g.add(ray); }
  } else if (type === 'wheel') {
    const d = mesh(new THREE.CylinderGeometry(0.032 * s, 0.032 * s, 0.02 * s, 40), m); d.rotation.x = Math.PI / 2; g.add(d);
    const b = mesh(new THREE.CylinderGeometry(0.018 * s, 0.022 * s, 0.03 * s, 32), m); b.rotation.x = Math.PI / 2; g.add(b);
  } else if (type === 'pear') {
    const p = mesh(lathe([[0.0001, 0.05], [0.012, 0.046], [0.022, 0.03], [0.02, 0.012], [0.008, 0], [0.0001, 0]].map(([r, y]) => [r * s, y * s]), 32), m); p.position.y = -0.02 * s; g.add(p);
  } else if (type === 'cap') {
    const p = mesh(new THREE.SphereGeometry(0.02 * s, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); p.rotation.x = Math.PI; p.scale.set(1.2, 1.4, 0.9); g.add(p);
    const k = mesh(new THREE.SphereGeometry(0.008 * s, 12, 8), m); k.position.y = -0.028 * s; g.add(k);
  } else if (type === 'scent') {
    const p = mesh(lathe([[0.0001, 0.06], [0.01, 0.058], [0.024, 0.04], [0.02, 0.022], [0.012, 0.014], [0.016, 0.006], [0.0001, 0]].map(([r, y]) => [r * s, y * s]), 32), m); p.position.y = -0.03 * s; g.add(p);
  } else { const p = mesh(new THREE.SphereGeometry(0.022 * s, 32, 20), m); g.add(p); }
  if (gemC) { const ge = mesh(new THREE.SphereGeometry(0.011 * s, 20, 14), gem(gemC, glow)); ge.scale.z = 0.6; ge.position.z = 0.012 * s; g.add(ge); const ge2 = ge.clone(); ge2.position.z = -0.012 * s; g.add(ge2); }
  return g;
}
/** Épée / sabre paramétrique. */
export function swordX(o = {}) {
  const { len = 0.8, w0 = 0.05, w1 = 0.04, tip = 0.14, curve = 0, single = false, fuller = 0.6, profile = null, th = 0.008,
    bladeMat = steel(), guard = 'bar', guardLen = 0.18, guardBend = 0, guardMat = iron(0xa8a8ac, 0.3), gripLen = 0.1, gripMat = leather(0x4a2c18), wraps = 14,
    pommelType = 'ball', pommelMat = guardMat, pommelS = 1, gems = null, glow = 0, inlay = null, ricasso = 0, guardGem = null } = o;
  const g = G();
  const b = mesh(blade({ len, w0, w1, tip, curve, single, fuller, profile, th }), bladeMat); g.add(b);
  if (inlay) {
    const il = mesh(new THREE.PlaneGeometry(0.007, len * 0.35), inlay); il.position.set(single ? (w0 * 0.05) : 0, len * 0.22, th * 0.32); g.add(il);
    const il2 = il.clone(); il2.position.z = -th * 0.32; il2.rotation.y = Math.PI; g.add(il2);
  }
  if (guard === 'bar' || guard === 'curved') { const q = mesh(barGeo(guardLen, 0.016, 0.022, 0.75, guard === 'curved' ? -0.03 : guardBend), guardMat); q.position.y = -0.01; g.add(q); }
  if (guard === 'wing') {
    const q = mesh(barGeo(guardLen, 0.02, 0.026, 0.5, -0.02), guardMat); q.position.y = -0.01; g.add(q);
    for (const s of [-1, 1]) { const k = mesh(new THREE.SphereGeometry(0.014, 16, 12), guardMat); k.position.set(s * guardLen / 2, 0.012, 0); g.add(k); }
    const lang = mesh(blade({ len: 0.05, w0: 0.034, w1: 0.012, tip: 0.03, th: 0.012, fuller: 0, steps: 10 }), guardMat); lang.position.y = -0.004; g.add(lang);
  }
  if (guard === 'sabre') {
    const q = mesh(barGeo(guardLen, 0.014, 0.018, 0.55, -0.02), guardMat); q.position.y = -0.008; g.add(q);
    for (const s of [-1, 1]) { const k = mesh(new THREE.SphereGeometry(0.01, 16, 12), guardMat); k.position.set(s * guardLen / 2, 0.01, 0); g.add(k); }
    const lang = mesh(blade({ len: 0.045, w0: 0.03, w1: 0.01, tip: 0.025, th: 0.012, fuller: 0, steps: 10 }), guardMat); lang.position.y = -0.004; g.add(lang);
  }
  if (guard === 'disc') { const q = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 40), guardMat); q.scale.z = 0.6; q.position.y = -0.006; g.add(q); }
  if (guardGem) { const ge = mesh(new THREE.OctahedronGeometry(0.012, 0), gem(guardGem, glow)); ge.scale.set(1, 1.3, 0.6); ge.position.set(0, -0.01, 0.013); g.add(ge); const ge2 = ge.clone(); ge2.position.z = -0.013; g.add(ge2); }
  if (ricasso) { const r = mesh(new THREE.BoxGeometry(w0 * 1.05, ricasso, 0.01), guardMat); r.position.y = ricasso / 2; g.add(r); }
  const gr = mesh(gripGeo(gripLen, 0.013, 0.012, wraps), gripMat); gr.rotation.x = Math.PI; gr.position.y = -0.02; g.add(gr);
  const p = pommel(pommelType, pommelMat, pommelS, gems, glow); p.position.y = -0.02 - gripLen - 0.018 * pommelS; g.add(p);
  return g;
}

// ================================================================== haches, masses, marteaux, fléaux
function shaftX(len, r0, r1, m, bend = 0) {
  const secs = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40; const r = lerp(r0, r1, t); secs.push({ y: t * len, pts: ellipse(r, r * 0.92, 14).map(([x, z]) => [x + bend * Math.sin(t * Math.PI), z]) }); }
  return mesh(loft(secs, { capStart: true, capEnd: true }), m);
}
function rings(g, ys, r, m, tube = 0.004) { for (const y of ys) { const t = mesh(new THREE.TorusGeometry(r, tube, 8, 28), m); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); } }
/** Fer de hache : contour en points (x vers le tranchant), effilé vers le tranchant. */
function axeHeadGeo(pts, { depth = 0.014, thinTo = 0.2, edgeX = 0.1 } = {}) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); else sh.lineTo(p[0], p[1]); }
  sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 36 });
  eg.translate(0, 0, -depth / 2);
  displace(eg, (v) => V(v.x, v.y, v.z * lerp(1, thinTo, smooth(0.0, edgeX, v.x))));
  return eg;
}
const AXE = {
  francisca: [[-0.02, 0.022], [0.03, 0.03, 0.07, 0.06], [0.1, 0.075, 0.11, 0.03], [0.105, -0.03, 0.09, -0.06], [0.05, -0.02, 0.02, -0.018], [-0.02, -0.02]],
  bearded: [[-0.022, 0.026], [0.04, 0.03], [0.07, 0.035, 0.1, 0.06], [0.115, 0.0, 0.11, -0.06], [0.1, -0.13, 0.06, -0.17], [0.045, -0.09, 0.03, -0.03], [-0.022, -0.026]],
  battle: [[-0.022, 0.03], [0.02, 0.026, 0.06, 0.1], [0.12, 0.12], [0.15, 0.03, 0.15, -0.04], [0.15, -0.11, 0.12, -0.15], [0.06, -0.13], [0.02, -0.026, -0.022, -0.03]],
  winter: [[-0.022, 0.03], [0.03, 0.03, 0.07, 0.11], [0.1, 0.16], [0.17, 0.06, 0.17, -0.04], [0.17, -0.14, 0.11, -0.2], [0.06, -0.1, 0.02, -0.03], [-0.022, -0.03]],
};
export function axeX({ head = 'bearded', haft = 0.9, haftMat = wood(0x7a5434), headMat = iron(0xa0a0a2, 0.38), scale = 1.3, back = null, inlay = null, glowEdge = null, wrap = null, langets = null, pommelM = null, haftR = 0.016 } = {}) {
  const g = G();
  g.add(shaftX(haft, haftR, haftR * 0.9, haftMat, 0.008));
  const hg = mesh(axeHeadGeo(AXE[head], { edgeX: head === 'francisca' ? 0.09 : 0.12 }), headMat); hg.scale.setScalar(scale); hg.position.set(0, haft - 0.07, 0);
  if (head === 'francisca') hg.rotation.z = 0.25;
  g.add(hg);
  if (back === 'spike') { const s = mesh(new THREE.ConeGeometry(0.014, 0.08, 10), headMat); s.rotation.z = Math.PI / 2; s.position.set(-0.07, haft - 0.07, 0); g.add(s); }
  if (back === 'axe') { const h2 = hg.clone(); h2.scale.x = -scale * 0.85; h2.scale.y = scale * 0.85; h2.position.x = 0; g.add(h2); }
  const eye = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 20), headMat); eye.position.set(0, haft - 0.07, 0); eye.scale.setScalar(scale * 0.85); g.add(eye);
  if (inlay) {
    // fils d'argent tressés sur la joue du fer
    for (const z of [-1, 1]) for (let k = 0; k < 3; k++) {
      const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(V((0.012 + t * 0.06) * scale, haft - 0.07 + (Math.sin(t * Math.PI * 3 + k * 2.1) * 0.012 + (k - 1) * 0.022) * scale, z * 0.0105)); }
      g.add(mesh(tubeAlong(pts, 0.0022, { segs: 40, radial: 5 }), inlay));
    }
  }
  if (glowEdge) {
    const pts = AXE[head]; const sh = new THREE.Shape();
    // bande de tranchant : on reprend le fer et on ne garde que la partie au-delà de x > 0.6 * max
    const eg = axeHeadGeo(pts, { depth: 0.004, thinTo: 1, edgeX: 0.1 });
    const maxX = Math.max(...pts.map((p) => p.length === 4 ? Math.max(p[0], p[2]) : p[0]));
    displace(eg, (v) => v.x < maxX * 0.72 ? V(maxX * 0.72, v.y, v.z) : null);
    const e = mesh(eg, glowEdge); e.scale.set(scale * 1.01, scale * 1.01, scale * 1.2); e.position.set(0.001, haft - 0.07, 0); e.userData.noEdge = false; g.add(e);
    void sh;
  }
  if (wrap) { const w = mesh(gripGeo(0.2, haftR * 1.15, haftR * 1.1, 16), wrap); w.position.y = 0.02; g.add(w); }
  if (langets) { for (const s of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.006, 0.2, 0.012), langets); l.position.set(s * haftR, haft - 0.2, 0); g.add(l); } rings(g, [haft - 0.12, haft - 0.28], haftR * 1.1, langets, 0.0045); }
  if (pommelM) { const p = mesh(new THREE.SphereGeometry(haftR * 1.4, 16, 12), pommelM); p.position.y = 0; g.add(p); }
  return g;
}
export function club() {
  const g = G();
  const prof = []; for (let k = 0; k <= 40; k++) { const t = k / 40; prof.push([lerp(0.017, 0.05, Math.pow(t, 1.6)) * (1 + 0.08 * Math.sin(t * 17)), t * 0.62]); }
  prof.push([0.0001, 0.64]); prof.unshift([0.0001, 0]);
  const cg = lathe(prof, 28);
  displace(cg, (v) => { const k = 1 + 0.12 * fbm(v.x * 25, v.y * 10, v.z * 25, 3); return V(v.x * k, v.y, v.z * k); });
  g.add(mesh(cg, wood(0x6a4a2c, [1, 2])));
  const nail = iron(0x5a5854, 0.6); const r = rng(7);
  for (let i = 0; i < 46; i++) {
    const y = 0.36 + 0.25 * (i / 46) + r() * 0.01; const a = i * 2.39996; const rr = lerp(0.017, 0.05, Math.pow(y / 0.62, 1.6)) * 0.98;
    const n = G(); const sp = mesh(new THREE.ConeGeometry(0.0045, 0.03, 6), nail); sp.position.y = 0.012; n.add(sp);
    const hd = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.003, 8), nail); n.add(hd);
    n.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); n.lookAt(Math.cos(a) * 3, y + 0.4, Math.sin(a) * 3); n.rotateX(Math.PI / 2); g.add(n);
  }
  const wr = mesh(gripGeo(0.12, 0.019, 0.019, 12), leather(0x3a2414)); wr.position.y = 0.02; g.add(wr);
  return g;
}
export function flail({ ballMat = iron(0x8a8884, 0.4), handleMat = wood(0x5a3a22, [1, 2]), metal = iron(0x9a9894, 0.35), gripM = leather(0x3a2214) } = {}) {
  const g = G();
  g.add(shaftX(0.42, 0.017, 0.016, handleMat));
  const wr = mesh(gripGeo(0.14, 0.019, 0.019, 14), gripM); wr.position.y = 0.01; g.add(wr);
  const cap = mesh(lathe([[0.0001, 0], [0.02, 0], [0.02, 0.05], [0.012, 0.07], [0.0001, 0.075]], 20), metal); cap.position.y = 0.41; g.add(cap);
  // chaîne : maillons alternés le long d'une courbe
  const curve = new THREE.CatmullRomCurve3([V(0, 0.48, 0), V(0.05, 0.56, 0.0), V(0.13, 0.6, 0), V(0.21, 0.57, 0)]);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n; const p = curve.getPointAt(t); const T = curve.getTangentAt(t);
    const l = mesh(new THREE.TorusGeometry(0.011, 0.003, 8, 20), metal); l.scale.set(1, 1.6, 1); l.position.copy(p);
    l.quaternion.setFromUnitVectors(V(0, 1, 0), T); if (i % 2) l.rotateY(Math.PI / 2); g.add(l);
  }
  const bp = curve.getPointAt(1).add(V(0.045, -0.025, 0));
  const ball = mesh(new THREE.SphereGeometry(0.045, 32, 20), ballMat); ball.position.copy(bp); g.add(ball);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; const d = V(Math.cos(a) * r, y, Math.sin(a) * r);
    const s = mesh(new THREE.ConeGeometry(0.009, 0.03, 8), ballMat); s.position.copy(bp).addScaledVector(d, 0.052); s.quaternion.setFromUnitVectors(V(0, 1, 0), d); g.add(s);
  }
  return g;
}
export function flangedMace({ len = 0.7, shaftM = steel(0xb0b2b6, 0.25), headM = steel(), trim = gold(), flanges = 8 } = {}) {
  const g = G();
  g.add(shaftX(len, 0.014, 0.013, shaftM));
  const gr = mesh(gripGeo(0.16, 0.017, 0.017, 18), leather(0x5a1a14)); gr.position.y = 0.03; g.add(gr);
  rings(g, [0.03, 0.19, len * 0.55], 0.017, trim, 0.005);
  const cap = mesh(lathe([[0.0001, 0], [0.022, 0], [0.024, 0.02], [0.0001, 0.03]], 24), trim); cap.position.y = -0.005; g.add(cap);
  const core = mesh(lathe([[0.0001, 0], [0.018, 0], [0.022, 0.04], [0.022, 0.12], [0.014, 0.15], [0.0001, 0.155]], 32), headM); core.position.y = len - 0.08; g.add(core);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.015, 0.015); fs.quadraticCurveTo(0.055, 0.035, 0.05, 0.085); fs.lineTo(0.035, 0.12); fs.quadraticCurveTo(0.02, 0.14, 0, 0.15); fs.closePath();
  for (let i = 0; i < flanges; i++) {
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 16 }); fg.translate(0, 0, -0.0025);
    const f = mesh(fg, headM); f.position.y = len - 0.075; f.rotation.y = (i / flanges) * Math.PI * 2; g.add(f);
  }
  const crown = mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 28), trim); crown.rotation.x = Math.PI / 2; crown.position.y = len - 0.075; g.add(crown);
  const top = mesh(lathe([[0.0001, 0], [0.016, 0], [0.012, 0.02], [0.004, 0.045], [0.0001, 0.05]], 20), trim); top.position.y = len + 0.07; g.add(top);
  return g;
}
export function warHammer({ haft = 0.85, headM = steel(0xb8babe, 0.25), haftM = wood(0x5a3a22), trim = null } = {}) {
  const g = G();
  g.add(shaftX(haft, 0.016, 0.015, haftM));
  const hm = trim || headM;
  for (const s of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.006, 0.26, 0.014), hm); l.position.set(s * 0.016, haft - 0.16, 0); g.add(l); }
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.SphereGeometry(0.004, 8, 6), hm); r.position.set(0.019, haft - 0.06 - i * 0.06, 0); g.add(r); const r2 = r.clone(); r2.position.x = -0.019; g.add(r2); }
  const y = haft - 0.03;
  const blk = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.042), headM); blk.position.y = y; g.add(blk);
  // tête de frappe : quatre pointes
  const face = mesh(lathe([[0.0001, 0], [0.026, 0], [0.024, 0.05], [0.028, 0.06], [0.0001, 0.064]], 4, Math.PI / 4), headM); face.rotation.z = Math.PI / 2; face.position.set(-0.02, y, 0); g.add(face);
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const p = mesh(new THREE.ConeGeometry(0.008, 0.016, 4), headM); p.rotation.z = Math.PI / 2; p.position.set(-0.092, y + a * 0.011, b * 0.011); g.add(p); }
  // bec recourbé
  const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(V(0.02 + t * 0.15, y - t * t * 0.07, 0)); }
  g.add(mesh(tubeAlong(pts, (t) => 0.016 * (1 - t * 0.92), { segs: 40, radial: 8 }), headM));
  const spike = mesh(new THREE.ConeGeometry(0.014, 0.11, 4), headM); spike.position.y = y + 0.075; g.add(spike);
  const gr = mesh(gripGeo(0.17, 0.018, 0.018, 16), leather(0x3a2214)); gr.position.y = 0.02; g.add(gr);
  if (trim) rings(g, [haft - 0.1, haft - 0.27], 0.019, trim, 0.004);
  return g;
}

// ================================================================== armes d'hast, lances, arc
export function huntSpear() {
  const g = G();
  g.add(shaftX(1.25, 0.022, 0.02, wood(0x8a6440, [1, 6])));
  const head = mesh(blade({ len: 0.36, w0: 0.035, w1: 0.1, tip: 0.24, th: 0.014, fuller: 0, steps: 50, profile: (t, w) => w * (0.35 + 0.65 * smooth(0, 0.3, t)) }), steel(0xb4b6b8, 0.3)); head.position.y = 1.32; g.add(head);
  const sock = mesh(lathe([[0.0001, 0], [0.021, 0], [0.019, 0.05], [0.014, 0.1], [0.0001, 0.11]], 20), iron(0x8a8884, 0.45)); sock.position.y = 1.22; g.add(sock);
  // traverse (oreilles)
  const bar = mesh(barGeo(0.22, 0.022, 0.022, 0.6), iron(0x7a7672, 0.5)); bar.position.y = 1.25; g.add(bar);
  const tie = mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 20), leather(0x3a2414)); tie.rotation.x = Math.PI / 2; tie.position.y = 1.245; g.add(tie);
  rings(g, [0.6, 0.64, 0.68], 0.019, leather(0x3a2414), 0.004);
  return g;
}
export function guisarme() {
  const g = G();
  g.add(shaftX(1.3, 0.022, 0.02, wood(0x6a4a2c, [1, 6])));
  const m = steel(0xaeb0b4, 0.3);
  // lame longue et crochet recourbé (silhouette en une pièce)
  const pts = [[0.0, -0.06], [0.0, 0.12], [-0.01, 0.2], [-0.02, 0.28, 0.0, 0.42], [0.05, 0.28, 0.07, 0.18], [0.06, 0.1], [0.04, 0.06], [0.05, 0.03, 0.09, 0.03], [0.1, 0.07, 0.07, 0.1], [0.075, 0.06, 0.03, 0.02], [0.02, -0.06]];
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(...p); else sh.lineTo(...p); } sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 30 }); eg.translate(0, 0, -0.005);
  const hd = mesh(eg, m); hd.scale.setScalar(1.7); hd.position.set(0.015, 1.3, 0); g.add(hd);
  // crochet recourbé au dos, bien détaché
  const hk = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const a = t * Math.PI * 1.1; hk.push(V(-0.01 - Math.sin(a) * 0.1, 1.62 + Math.cos(a) * 0.08 - 0.08 + t * 0.02, 0)); }
  g.add(mesh(tubeAlong(hk, (t) => 0.016 * (1 - t * 0.85), { segs: 40, radial: 8 }), m));
  const spike = mesh(new THREE.ConeGeometry(0.014, 0.12, 6), m); spike.rotation.z = Math.PI / 2; spike.position.set(-0.07, 1.36, 0); g.add(spike);
  const sock = mesh(lathe([[0.0001, 0], [0.02, 0], [0.02, 0.12], [0.0001, 0.12]], 16), iron(0x8a8884, 0.45)); sock.position.y = 1.22; g.add(sock);
  return g;
}
function stripeTex(a, b, n = 8, angle = 0.6) {
  return canvasTex(256, 1024, (c, w, h) => {
    c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b;
    for (let i = -n; i < n * 3; i++) { c.beginPath(); const y = i * h / n; c.moveTo(0, y); c.lineTo(w, y + w * angle * 4); c.lineTo(w, y + w * angle * 4 + h / n / 2); c.lineTo(0, y + h / n / 2); c.fill(); }
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.5; c.drawImage(img('wood_c'), 0, 0, w, h); c.globalAlpha = 1;
  });
}
export function lanceX({ len = 1.9, stripes = null, vampM = iron(0x9a9a9c, 0.35), pennon = null, tipM = steel(0xc0c2c6, 0.25), gripM = leather(0x4a2c18) } = {}) {
  const g = G();
  const prof = []; for (let k = 0; k <= 50; k++) { const t = k / 50; let r = 0.042 * (1 - t * 0.7); if (t < 0.12) r = lerp(0.032, 0.042, t / 0.12); prof.push([r, t * len]); }
  prof.unshift([0.0001, 0]); prof.push([0.0001, len]);
  const sm = stripes ? new THREE.MeshPhysicalMaterial({ map: stripeTex(stripes[0], stripes[1]), roughness: 0.55, clearcoat: 0.2 }) : wood(0x9a7448, [1, 6]);
  g.add(mesh(lathe(prof, 24), sm));
  const gr = mesh(gripGeo(0.16, 0.034, 0.034, 10), gripM); gr.position.y = 0.12; g.add(gr);
  const vamp = mesh(lathe([[0.035, 0], [0.13, 0.04], [0.125, 0.05], [0.05, 0.19], [0.04, 0.22]], 40), vampM); vamp.position.y = 0.3; g.add(vamp);
  const tip = mesh(lathe([[0.0001, 0], [0.018, 0], [0.018, 0.03], [0.022, 0.04], [0.0001, 0.17]], 4), tipM); tip.position.y = len - 0.02; g.add(tip);
  if (pennon) {
    const t = canvasTex(256, 128, (c, w, h) => { c.fillStyle = pennon[0]; c.fillRect(0, 0, w, h); c.fillStyle = pennon[1]; c.fillRect(0, h / 2, w, h / 2); if (pennon[2]) { c.save(); c.translate(w * 0.06, 0); c.scale(0.5, 0.5); M.EMBLEM[pennon[2]](c, w * 0.5, h * 2, pennon[3] || '#d8b453'); c.restore(); } });
    const pg = new THREE.PlaneGeometry(0.5, 0.2, 20, 4); pg.translate(0.25, 0, 0);
    displace(pg, (v) => { const u = v.x / 0.5; return V(v.x, v.y * (1 - u * 0.3) - u * u * 0.05, Math.sin(u * 7) * 0.03 * u); });
    const p = mesh(pg, new THREE.MeshPhysicalMaterial({ map: t, alphaMap: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w * 0.7, h / 2); c.lineTo(w, h); c.lineTo(0, h); c.fill(); }, false), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, sheen: 0.5 })); p.position.set(0.02, len - 0.25, 0); g.add(p);
  }
  return g;
}
export function compositeBow({ body = 0x3a2a1c, grip = FC.sables, tips = gold() } = {}) {
  const g = G();
  // branche récurvée dans le plan x-y (corde à gauche)
  const pts = []; const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N * 2 - 1; const y = t * 0.46; const a = Math.abs(t);
    let x = 0.14 * (1 - a * a) - 0.02;
    if (a > 0.8) x += Math.pow((a - 0.8) / 0.2, 2) * 0.08; // récurve vers l'avant
    pts.push(V(x, y, 0));
  }
  const bm = new THREE.MeshPhysicalMaterial({ color: C(body), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, map: tex('wood_c', [1, 6], true), normalMap: tex('wood_n', [1, 6]), normalScale: new THREE.Vector2(0.3, 0.3) });
  g.add(mesh(tubeAlong(pts, (t) => 0.007 + 0.017 * Math.pow(Math.sin(Math.PI * t), 0.6), { segs: 120, radial: 12 }), bm));
  // ventre en corne claire
  const pts2 = pts.map((p) => V(p.x + 0.006, p.y, 0));
  g.add(mesh(tubeAlong(pts2, (t) => 0.005 + 0.009 * Math.pow(Math.sin(Math.PI * t), 0.6), { segs: 120, radial: 10 }), new THREE.MeshPhysicalMaterial({ color: 0xc8b088, roughness: 0.35, clearcoat: 0.6 })));
  const gr = mesh(gripGeo(0.13, 0.024, 0.024, 10), leather(new THREE.Color(grip).getHex())); gr.position.set(0.12, -0.065, 0); g.add(gr);
  for (const s of [-1, 1]) {
    const p = pts[s > 0 ? N : 0]; const k = mesh(new THREE.ConeGeometry(0.011, 0.06, 10), tips); k.position.copy(p); k.rotation.z = s > 0 ? 0.6 : Math.PI - 0.6; g.add(k);
    const band = mesh(new THREE.TorusGeometry(0.009, 0.003, 6, 16), tips); const q = pts[s > 0 ? N - 7 : 7]; band.position.copy(q); band.rotation.x = Math.PI / 2; g.add(band);
  }
  const a = pts[4], b = pts[N - 4];
  g.add(mesh(tubeAlong([a, a.clone().lerp(b, 0.5), b], 0.0035, { segs: 4, radial: 5 }), MAT.plain(0xf0e6cc, 0.8)));
  return g;
}

// ================================================================== emblèmes supplémentaires
M.EMBLEM.royal = (c, w, h, color = '#e8c860') => {
  // étoile du royaume : seize rais alternés + petite couronne à pointes
  const cx = w / 2, cy = h * 0.54, R = w * 0.3; c.fillStyle = color;
  c.beginPath(); for (let i = 0; i < 32; i++) { const a = -Math.PI / 2 + i / 32 * Math.PI * 2; const r = i % 2 ? R * 0.34 : (i % 4 ? R * 0.7 : R); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.fill();
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, R * 0.16, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
  c.beginPath(); c.arc(cx, cy, R * 0.09, 0, 7); c.fill();
  const cy2 = h * 0.16, cw = w * 0.2; c.beginPath(); c.moveTo(cx - cw, cy2 + h * 0.06); c.lineTo(cx - cw, cy2); c.lineTo(cx - cw * 0.5, cy2 + h * 0.03); c.lineTo(cx, cy2 - h * 0.02); c.lineTo(cx + cw * 0.5, cy2 + h * 0.03); c.lineTo(cx + cw, cy2); c.lineTo(cx + cw, cy2 + h * 0.06); c.closePath(); c.fill();
};
M.EMBLEM.chevron = (c, w, h, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(0, h * 0.78); c.lineTo(w / 2, h * 0.36); c.lineTo(w, h * 0.78); c.lineTo(w, h * 0.98); c.lineTo(w / 2, h * 0.56); c.lineTo(0, h * 0.98); c.fill(); };
M.EMBLEM.pale = (c, w, h, color) => { c.fillStyle = color; c.fillRect(w / 2, 0, w / 2, h); };
M.EMBLEM.bend = (c, w, h, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(0, h * 0.1); c.lineTo(w * 0.15, 0); c.lineTo(w, h * 0.85); c.lineTo(w * 0.85, h); c.fill(); };
M.EMBLEM.tower = (c, w, h, color) => {
  c.fillStyle = color; const x0 = w * 0.32, x1 = w * 0.68, y0 = h * 0.3, y1 = h * 0.8;
  c.fillRect(x0, y0, x1 - x0, y1 - y0); for (let i = 0; i < 3; i++) c.fillRect(x0 + i * (x1 - x0) / 2.5, y0 - h * 0.07, (x1 - x0) / 5, h * 0.08);
  c.fillRect(x0 - w * 0.04, y1 - h * 0.03, x1 - x0 + w * 0.08, h * 0.04);
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(w * 0.45, y1); c.lineTo(w * 0.45, h * 0.66); c.arc(w / 2, h * 0.66, w * 0.05, Math.PI, 0); c.lineTo(w * 0.55, y1); c.fill(); c.globalCompositeOperation = 'source-over';
};
M.EMBLEM.ravenBlack = (c, w, h) => M.EMBLEM.raven(c, w, h, '#16181c');
M.EMBLEM.sunPale = (c, w, h, color) => M.EMBLEM.sun(c, w, h, color);
M.EMBLEM.bars = (c, w, h, color) => { c.fillStyle = color; for (let i = 0; i < 3; i++) c.fillRect(0, h * (0.2 + i * 0.25), w, h * 0.1); };

// ================================================================== boucliers
function shieldFromOutline({ inside, cy = 0, W, H, surf, field, emblem, emblemColor, wear = 0.4, rimM, backM = leather(0x4a3020, [2, 3]), base = 'wood', emblemScale = 0.9, emblemY = 0, rivets = 14, rivM = iron(0xa8a29a, 0.35), rimR = 0.012, boards = 0, paintM = null }) {
  const g = G();
  const outline = (a) => { const dx = Math.cos(a), dy = Math.sin(a); let best = 0; for (let r = 0.005; r < 1.6; r += 0.003) { if (!inside(dx * r, cy + dy * r)) break; best = r; } return best; };
  const s = radialSurface(outline, surf, { cy, thick: 0.018, W, H, rings: 46, segs: 240 });
  const t = paintM ? null : M.paintedTex({ field, emblem, emblemColor, base, wear, boards, aspect: W / H, emblemScale, emblemY });
  const paint = paintM || new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.6, normalMap: tex(base === 'wood' ? 'wood_n' : 'leather_n', [1, 1]), normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.12, clearcoatRoughness: 0.5 });
  g.add(mesh(s.front, paint)); g.add(mesh(s.back, backM)); g.add(mesh(s.rim, backM));
  g.add(mesh(tubeAlong(s.outlinePts, rimR, { closed: true, segs: 300, radial: 10 }), rimM));
  for (let i = 0; i < rivets; i++) { const p = s.outlinePts[Math.floor(i / rivets * s.outlinePts.length)]; const d = p.clone().sub(V(0, cy, p.z)).multiplyScalar(0.93).add(V(0, cy, 0)); const r = mesh(new THREE.SphereGeometry(0.008, 12, 8), rivM); r.position.set(d.x, d.y, surf(d.x, d.y) + 0.002); r.scale.z = 0.5; g.add(r); }
  g.userData.surf = surf;
  return g;
}
/** Écu « fer à repasser » (heater). */
export function heater({ W = 0.62, H = 0.74, ...o } = {}) {
  const top = H * 0.5, bot = -H * 0.5;
  const inside = (x, y) => { if (y > top || y < bot) return false; const t = (top - y) / H; const hw = t < 0.38 ? W / 2 : (W / 2) * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.38) / 0.62, 2))); return Math.abs(x) <= hw; };
  const surf = (x) => { const R = 0.55; return Math.sqrt(Math.max(R * R - x * x, 0)) - R; };
  return shieldFromOutline({ inside, cy: 0.05, W, H, surf, ...o });
}
/** Pavois : grand rectangle à arête centrale. */
export function pavise({ W = 0.56, H = 1.0, taper = 0.06, ...o } = {}) {
  const top = H / 2, bot = -H / 2; const rc = 0.06;
  const inside = (x, y) => { if (y > top || y < bot) return false; const hw = W / 2 - taper * (top - y) / H; if (Math.abs(x) > hw) return false; if (y > top - rc && Math.abs(x) > hw - rc) { const dx = Math.abs(x) - (hw - rc), dy = y - (top - rc); if (dx * dx + dy * dy > rc * rc) return false; } return true; };
  const surf = (x) => 0.045 * (1 - Math.min(1, Math.abs(x) / 0.06)) * 1 + 0.02 * (1 - (x * x) / 0.09);
  const g = shieldFromOutline({ inside, cy: 0, W, H, surf, ...o });
  return g;
}
export function roundX({ R = 0.42, field, emblem, emblemColor, wear = 0.5, boards = 6, rimM = null, bossM = null, rivM = null, rimColor = 0x3a2416, base = 'wood', emblemScale = 0.82 } = {}) {
  const g = M.roundShield({ field, emblem, emblemColor, wear, boards, rimMetal: !!rimM, R, base, rimColor });
  g.traverse((o) => {
    if (!o.isMesh) return;
    const tp = o.geometry.type;
    if (tp === 'TubeGeometry' && rimM) o.material = rimM;
    if (tp === 'LatheGeometry' && bossM) o.material = bossM;
    if (tp === 'SphereGeometry' && rivM) o.material = rivM;
  });
  void emblemScale;
  return g;
}
/** Bouclier rond tout en métal (rondache, targe, bouclier d'acier) : profil tourné + motif. */
export function metalRound({ R = 0.3, dome = 0.06, m = steel(), rimM = null, boss = true, bossM = null, spike = false, rivets = 0, rivM = null, ridges = [], ridgeM = null, gems = null, glow = 0 } = {}) {
  const g = G();
  const prof = []; for (let k = 0; k <= 40; k++) { const t = k / 40; const r = t * R; prof.push([r, dome * (1 - t * t)]); }
  prof.push([R, -0.01]); prof.push([R * 0.95, -0.01]);
  const fg = lathe(prof.slice().reverse(), 96);
  fg.rotateX(Math.PI / 2);
  g.add(mesh(fg, m));
  const yAt = (r) => dome * (1 - (r / R) * (r / R));
  if (rimM !== false) { const rim = mesh(new THREE.TorusGeometry(R, 0.012, 10, 96), rimM || m); rim.position.z = 0.002; g.add(rim); }
  for (const rr of ridges) { const t = mesh(new THREE.TorusGeometry(rr * R, 0.006, 8, 96), ridgeM || m); t.position.z = yAt(rr * R) + 0.002; g.add(t); }
  if (boss) { const b = mesh(lathe([[0.0001, 0.07], [0.04, 0.062], [0.065, 0.04], [0.075, 0.012], [0.09, 0.004], [0.09, 0], [0.0001, 0]].reverse(), 48), bossM || m); b.rotation.x = Math.PI / 2; b.position.z = dome - 0.012; g.add(b); }
  if (spike) { const s = mesh(new THREE.ConeGeometry(0.03, 0.17, 24), bossM || m); s.rotation.x = Math.PI / 2; s.position.z = dome + 0.12; g.add(s); }
  if (rivets) for (let i = 0; i < rivets; i++) { const a = i / rivets * Math.PI * 2; const r = mesh(new THREE.SphereGeometry(0.009, 12, 8), rivM || m); r.position.set(Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, yAt(R * 0.88) + 0.002); r.scale.z = 0.6; g.add(r); }
  if (gems) gems.forEach(([a, rr, col, s = 1]) => { const ge = mesh(new THREE.SphereGeometry(0.018 * s, 20, 14), gem(col, glow)); ge.scale.z = 0.55; ge.position.set(Math.cos(a) * rr * R, Math.sin(a) * rr * R, yAt(rr * R) + 0.006); g.add(ge); const cup = mesh(new THREE.TorusGeometry(0.019 * s, 0.004, 8, 24), gold()); cup.position.copy(ge.position); g.add(cup); });
  return g;
}
function arrowsIn(g, n, surf, seed = 3, W = 0.5, H = 0.9) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r.range(-W / 2.6, W / 2.6), y = r.range(-H / 3, H / 2.6);
    const a = G(); const sh = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6), wood(0xb08a58, [1, 1])); sh.position.y = 0.2; a.add(sh);
    for (let k = 0; k < 3; k++) { const f = mesh(new THREE.PlaneGeometry(0.035, 0.09), MAT.plain([0xe8e0d0, 0x8a3020, 0x303030][i % 3], 0.9, { side: THREE.DoubleSide })); f.position.y = 0.39; f.position.x = 0.01; f.rotation.y = k * 2.09; f.translateX(0.008); a.add(f); }
    a.position.set(x, y, surf(x, y) - 0.02); a.rotation.set(Math.PI / 2 + r.range(-0.5, 0.2) - 0.5, 0, r.range(-0.6, 0.6)); g.add(a);
  }
}

// ================================================================== casques
const helmSteel = (c = 0xbcbec2, r = 0.28) => MAT.metal({ color: c, rough: r, rep: [1, 1], normal: 0.12 });
function domeGeo({ r = 0.11, h = 0.2, pow = 0.62, point = 0, zs = 1.12, steps = 40 }) {
  const prof = []; for (let k = 0; k <= steps; k++) { const t = k / steps; prof.push([r * Math.pow(Math.cos(t * Math.PI / 2), pow), t * h]); }
  prof[prof.length - 1][0] = 0.0001;
  const d = lathe(prof, 64); d.scale(1, 1, zs);
  if (point) displace(d, (v) => V(v.x, v.y + point * Math.max(0, 1 - Math.hypot(v.x, v.z) / 0.04), v.z));
  return d;
}
function meridian({ r = 0.112, h = 0.2, pow = 0.62, zs = 1.12, off = 0.004, axis = 'z' }) {
  const pts = []; const N = 30;
  for (let k = -N; k <= N; k++) { const t = 1 - Math.abs(k) / N; const rr = (r * Math.pow(Math.cos(t * Math.PI / 2), pow) + off) * Math.sign(k || 1); const y = t * h + off; pts.push(axis === 'z' ? V(0, y, rr * zs) : V(rr, y, 0)); }
  return pts;
}
const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
function band(g, y, r, h, m, zs = 1.12) { const b = lathe([[r - 0.002, y - 0.004], [r + 0.002, y], [r + 0.002, y + h], [r - 0.002, y + h + 0.004]], 64); b.scale(1, 1, zs); g.add(mesh(b, m)); }
function rivetRing(g, y, r, n, m, zs = 1.12, s = 0.0045) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const k = mesh(new THREE.SphereGeometry(s, 10, 8), m); k.position.set(Math.sin(a) * r, y, Math.cos(a) * r * zs); g.add(k); } }
export function kettleHat({ m = helmSteel(0x8a8884, 0.5), brim = 0.075, trim = null } = {}) {
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.17, pow: 0.7, point: 0.012 }), m));
  const prof = [[0.11, 0.006], [0.13, -0.004], [0.11 + brim, -0.03], [0.11 + brim + 0.004, -0.034], [0.11 + brim, -0.036], [0.128, -0.01], [0.11, 0.0]];
  const b = lathe(prof, 64); b.scale(1, 1, 1.12); g.add(mesh(b, ds(m)));
  const rr = mesh(new THREE.TorusGeometry(0.11 + brim + 0.002, 0.005, 8, 64), trim || m); rr.rotation.x = Math.PI / 2; rr.scale.set(1, 1.1, 1); rr.position.y = -0.034; g.add(rr);
  rivetRing(g, 0.012, 0.114, 12, trim || iron(0x9a9690, 0.4));
  // arête centrale
  g.add(mesh(tubeAlong(meridian({ r: 0.112, h: 0.17, pow: 0.7, off: 0.002 }), 0.006, { segs: 80, radial: 6 }), trim || m));
  return g;
}
export function turbanHelm({ m = helmSteel(0xc4c2bc, 0.25), clothC = FC.sables, trim = gold(), aventail = true, plume = null, arabesque = false } = {}) {
  const g = G();
  const dm = arabesque ? patternMetal({ base: '#c8c8cc', draw: (c, w, h) => scrolls(c, w, h, '#d8a840', 7, 5), rep: [3, 1] }) : m;
  g.add(mesh(domeGeo({ r: 0.112, h: 0.24, pow: 0.9, point: 0.05 }), dm));
  const fin = mesh(lathe([[0.0001, 0], [0.01, 0], [0.006, 0.03], [0.012, 0.05], [0.0001, 0.08]], 20), trim); fin.position.y = 0.27; g.add(fin);
  band(g, 0, 0.113, 0.03, trim);
  // turban : rouleaux torsadés
  const cm = cloth(new THREE.Color(clothC).getHex(), [6, 2], { sheen: 0.8 });
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; pts.push(V(Math.sin(a) * (0.125 - k * 0.006), 0.04 + k * 0.026 + 0.012 * Math.sin(a + k * 1.3), Math.cos(a) * (0.125 - k * 0.006) * 1.12)); }
    g.add(mesh(tubeAlong(pts, 0.017, { segs: 120, radial: 10, closed: true }), cm));
  }
  if (plume) { const pm = MAT.fur({ color: plume, rep: [1, 2] }); const pts = [V(0, 0.3, 0), V(0, 0.37, -0.02), V(0, 0.42, -0.07), V(0, 0.43, -0.12)]; g.add(mesh(tubeAlong(pts, (t) => 0.006 + 0.02 * Math.sin(Math.PI * Math.min(1, t * 1.2)), { segs: 30, radial: 10 }), pm)); }
  if (aventail) g.add(M.aventail({ r: 0.116, len: 0.12, mat: M.mailMat(0xc8c8c6, [12, 3]) }));
  return g;
}
export function northHelm({ m = helmSteel(0x4a4846, 0.45), trim = iron(0x6a6662, 0.4), cheekM = leather(0x4a2c18), crest = null, paint = null } = {}) {
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.19, pow: 0.55 }), m));
  band(g, 0, 0.113, 0.03, paint || trim);
  // bandes croisées
  for (const axis of ['z', 'x']) g.add(mesh(tubeAlong(meridian({ r: 0.112, h: 0.19, pow: 0.55, axis, off: 0.003 }), 0.009, { segs: 80, radial: 4 }), trim));
  // lunettes et nasal
  const spec = G();
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 30; i++) { const a = Math.PI * (i / 30); pts.push(V(s * (0.035 + Math.cos(a) * 0.03 * s), -0.004 - Math.sin(a) * 0.032, 0)); } const tg = tubeAlong(pts, 0.008, { segs: 40, radial: 6 }); tg.scale(1, 1, 0.5); spec.add(mesh(tg, trim)); }
  const nas = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.008), trim); nas.position.set(0, -0.03, 0.004); spec.add(nas);
  spec.position.set(0, 0, 0.126); spec.children.forEach((c) => displace(c.geometry, (v) => V(v.x, v.y, v.z - v.x * v.x * 2.2))); g.add(spec);
  // garde-joues en cuir
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.06, 0); sh.quadraticCurveTo(0.065, -0.07, 0.03, -0.11); sh.lineTo(0.0, -0.09); sh.closePath(); const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }); const c = mesh(cg, cheekM); c.position.set(s * 0.11, 0.0, 0.06); c.rotation.y = s > 0 ? -Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25; if (s < 0) c.scale.x = -1; g.add(c); }
  // nuque en cuir
  const nk = M.aventail({ r: 0.116, len: 0.08, mat: cheekM, flare: 0.5 }); g.add(nk);
  if (crest) { const hm = MAT.fur({ color: crest, rep: [1, 4] }); const pts = meridian({ r: 0.112, h: 0.19, pow: 0.55, off: 0.014 }).slice(4, 44).reverse(); pts.push(V(0, -0.07, -0.15), V(0, -0.16, -0.17)); g.add(mesh(tubeAlong(pts, (t) => 0.018 + 0.026 * Math.sin(Math.PI * Math.min(1, t * 1.05)), { segs: 80, radial: 10 }), hm)); }
  return g;
}
export function sergeantHelm({ m = helmSteel(0xc0c2c4, 0.28), stripe = FC.aube } = {}) {
  // chapel à bord étroit, liseré d'or et petit soleil frontal
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.18, pow: 0.58 }), m));
  const prof = [[0.11, 0.004], [0.122, -0.006], [0.158, -0.022], [0.16, -0.026], [0.124, -0.012], [0.11, 0]]; const b = lathe(prof, 64); b.scale(1, 1, 1.12); g.add(mesh(b, m));
  const sm = new THREE.MeshPhysicalMaterial({ color: C(stripe), roughness: 0.4, clearcoat: 0.6 });
  band(g, 0.02, 0.1135, 0.016, sm);
  const rr = mesh(new THREE.TorusGeometry(0.159, 0.004, 8, 64), sm); rr.rotation.x = Math.PI / 2; rr.scale.set(1, 1.12, 1); rr.position.y = -0.025; g.add(rr);
  const sun = pommel('sun', gold(), 0.9); sun.position.set(0, 0.075, 0.122); sun.rotation.x = -0.45; g.add(sun);
  rivetRing(g, 0.01, 0.114, 10, iron(0xa8a29a, 0.3));
  return g;
}
export function conicalAventail({ m = helmSteel(0xb4b6ba, 0.3), mail = M.mailMat(0xc0c0be, [14, 3]) } = {}) {
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.25, pow: 0.95, point: 0.03 }), m));
  band(g, 0, 0.114, 0.032, iron(0x8a8680, 0.4));
  rivetRing(g, 0.016, 0.117, 14, iron(0xa8a29a, 0.3));
  const av = M.aventail({ r: 0.118, len: 0.2, front: true, mat: mail, flare: 1.1 }); g.add(av);
  return g;
}
export function greatHelm({ m = helmSteel(0xb8babe, 0.28), top = 'flat', trim = null, slitsM = MAT.plain(0x0a0808, 1), crown = null, crest = null, gemC = null, glow = 0, star = null, mantling = null, breaths = true } = {}) {
  const g = G();
  const R = 0.118, yb = -0.09, yc = top === 'flat' ? 0.17 : 0.11;
  const prof = []; for (let k = 0; k <= 30; k++) { const t = k / 30; prof.push([R * (1 - 0.06 * t), yb + t * (yc - yb)]); }
  if (top === 'flat') { prof.push([R * 0.94, yc + 0.004]); prof.push([R * 0.6, yc + 0.012]); prof.push([0.0001, yc + 0.016]); }
  else { for (let k = 1; k <= 14; k++) { const t = k / 14; prof.push([R * 0.94 * Math.pow(Math.cos(t * Math.PI / 2), 0.8), yc + Math.sin(t * Math.PI / 2) * 0.1]); } prof[prof.length - 1][0] = 0.0001; }
  const body = lathe(prof, 64); body.scale(1, 1, 1.08);
  displace(body, (v) => { const front = Math.max(0, v.z) / 0.13; const k = 1 + 0.12 * front * front * (1 - Math.abs(v.x) / 0.12); return V(v.x * (1 - 0.06 * front), v.y, v.z * k); });
  g.add(mesh(body, m));
  // fentes de vision
  for (const s of [-1, 1]) { const sl = mesh(new THREE.BoxGeometry(0.075, 0.011, 0.02), slitsM); sl.position.set(s * 0.045, 0.06, 0.135); sl.rotation.y = s * 0.45; g.add(sl); }
  // renfort frontal : bande verticale et bande des yeux
  const tm = trim || m;
  const bandV = mesh(new THREE.BoxGeometry(0.022, 0.22, 0.01), tm); bandV.position.set(0, 0.02, 0.143); bandV.rotation.x = -0.03; g.add(bandV);
  const bandH = mesh(new THREE.TorusGeometry(R + 0.006, 0.006, 6, 64, Math.PI), tm); bandH.rotation.x = Math.PI / 2; bandH.rotation.z = Math.PI; bandH.scale.set(1, 1.18, 1); bandH.position.y = 0.083; g.add(bandH);
  const bandL = bandH.clone(); bandL.position.y = 0.04; g.add(bandL);
  if (breaths) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const hole = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), slitsM); hole.rotation.x = Math.PI / 2; hole.position.set(s * (0.03 + (i % 3) * 0.014), -0.02 - Math.floor(i / 3) * 0.02, 0.135 - (i % 3) * 0.008); g.add(hole); }
  if (trim) { const bb = mesh(new THREE.TorusGeometry(R, 0.006, 6, 64), trim); bb.rotation.x = Math.PI / 2; bb.scale.set(1, 1.08, 1); bb.position.y = yb + 0.002; g.add(bb); }
  if (crown) {
    const cy = top === 'flat' ? yc - 0.012 : yc - 0.02; const cr = mesh(lathe([[R * 0.97, cy], [R * 1.0, cy + 0.004], [R * 1.0, cy + 0.03], [R * 0.97, cy + 0.034]], 64), crown); cr.scale.set(1, 1, 1.08); g.add(cr);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2; const f = G();
      if (crest === 'laurel') { for (let k = 0; k < 4; k++) { const l = mesh(new THREE.SphereGeometry(0.016, 10, 8), crown); l.scale.set(0.55, 1.5, 0.45); l.position.set((k - 1.5) * 0.012, 0.0 + (k % 2) * 0.012, 0.004); l.rotation.z = (k - 1.5) * 0.7; f.add(l); } }
      else { const sp = mesh(new THREE.ConeGeometry(0.014, 0.05, 4), crown); sp.position.y = 0.03; f.add(sp); const b = mesh(new THREE.SphereGeometry(0.008, 10, 8), crown); b.position.y = 0.058; f.add(b); }
      f.position.set(Math.sin(a) * R * 1.0, cy + 0.03, Math.cos(a) * R * 1.08); f.rotation.y = a; g.add(f);
    }
  }
  if (crest === 'fan') {
    const sh = new THREE.Shape(); sh.moveTo(-0.11, 0); sh.quadraticCurveTo(-0.13, 0.14, 0.0, 0.17); sh.quadraticCurveTo(0.13, 0.14, 0.11, 0); sh.closePath();
    const t = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#b02a20'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e0cc'; for (let i = 0; i < 8; i += 2) { c.beginPath(); c.moveTo(w / 2, h); c.lineTo(i / 8 * w, 0); c.lineTo((i + 1) / 8 * w, 0); c.fill(); } });
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    const pos = fg.attributes.position, uv = fg.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.13) / 0.26, pos.getY(i) / 0.17);
    const f = mesh(fg, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.6, clearcoat: 0.3 })); f.rotation.y = Math.PI / 2; f.scale.setScalar(1.5); f.position.set(-0.006, yc + 0.075, 0); g.add(f);
    const tor = mesh(new THREE.TorusGeometry(0.06, 0.016, 10, 32), cloth(0xe8e0cc, [4, 1])); tor.rotation.x = Math.PI / 2; tor.position.y = yc + 0.08; g.add(tor);
  }
  if (mantling) { const mm = cloth(mantling, [3, 3]); const av = M.aventail({ r: 0.122, len: 0.17, mat: mm, flare: 0.9 }); av.scale.set(0.8, 1, 1); av.position.y = yc + 0.02; g.add(av); }
  if (star) { const s = pommel('star', star, 1.1, gemC, glow); s.position.set(0, 0.15, 0.13); s.rotation.x = -0.25; g.add(s); }
  else if (gemC) { const ge = mesh(new THREE.SphereGeometry(0.014, 20, 14), gem(gemC, glow)); ge.scale.z = 0.6; ge.position.set(0, 0.12, 0.139); g.add(ge); }
  return g;
}
export function crownHelm({ m = helmSteel(0x4a4a4e, 0.4), crownM = gold(0.16), gems = [0xd01030, 0x2a5aff], glow = 0.9 } = {}) {
  // casque-couronne : timbre de fer noirci, couronne d'or à fleurons, nasal et joues
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.2, pow: 0.62 }), m));
  const cr = lathe([[0.112, -0.004], [0.118, 0.0], [0.118, 0.05], [0.114, 0.056]], 64); cr.scale(1, 1, 1.12); g.add(mesh(cr, crownM));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2; const f = G();
    const sh = new THREE.Shape(); sh.moveTo(-0.018, 0); sh.quadraticCurveTo(-0.02, 0.03, 0, 0.065); sh.quadraticCurveTo(0.02, 0.03, 0.018, 0); sh.closePath();
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }); f.add(mesh(fg, crownM));
    const b = mesh(new THREE.SphereGeometry(0.008, 10, 8), crownM); b.position.y = 0.07; f.add(b);
    f.position.set(Math.sin(a) * 0.118, 0.05, Math.cos(a) * 0.118 * 1.12); f.rotation.y = a; f.rotation.x = 0; f.rotateX(-0.12); g.add(f);
    const ge = mesh(new THREE.SphereGeometry(0.009, 16, 12), gem(gems[i % 2], glow)); ge.scale.z = 0.6; const a2 = a + Math.PI / 10; ge.position.set(Math.sin(a2) * 0.121, 0.026, Math.cos(a2) * 0.121 * 1.12); ge.lookAt(Math.sin(a2), 0.026, Math.cos(a2) * 1.12); g.add(ge);
  }
  const nas = loft(Array.from({ length: 20 }, (_, k) => { const t = k / 19; const y = 0.0 - t * 0.1; const w = lerp(0.03, 0.022, t); return { y, pts: [[w / 2, 0.126 + 0.012 * t], [w / 2, 0.134 + 0.012 * t], [-w / 2, 0.134 + 0.012 * t], [-w / 2, 0.126 + 0.012 * t]] }; }), { capStart: true, capEnd: true });
  g.add(mesh(nas, crownM));
  const av = M.aventail({ r: 0.116, len: 0.12, mat: M.mailMat(0x6a6a6a, [12, 3]) }); g.add(av);
  return g;
}
export function maskHelm({ m = helmSteel(0xb0b2b6, 0.3), mail = M.mailMat(0xb8b8b6, [12, 3]), brassy = null, maskM = null } = {}) {
  const g = G();
  g.add(mesh(domeGeo({ r: 0.112, h: 0.21, pow: 0.75, point: 0.015 }), m));
  band(g, 0, 0.113, 0.03, iron(0x8a8680, 0.4));
  // masque facial : plaque bombée avec sourcils, nez et bouche
  const pg = new THREE.SphereGeometry(0.128, 48, 32, Math.PI / 2 - 0.85, 1.7, Math.PI * 0.42, Math.PI * 0.36); pg.scale(1, 1, 1.12);
  g.add(mesh(pg, maskM || m));
  const dark = MAT.plain(0x060505, 1); const fm = brassy || m;
  const zs = (x, y) => 1.12 * Math.sqrt(Math.max(0, 0.128 * 0.128 - x * x - y * y));
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.017, 16, 10), dark); eye.scale.set(1.7, 0.7, 0.35); eye.position.set(s * 0.042, -0.006, zs(0.042, -0.006) + 0.001); eye.rotation.y = s * 0.3; g.add(eye);
    const brow = mesh(new THREE.CapsuleGeometry(0.0065, 0.05, 4, 8), fm); brow.rotation.z = Math.PI / 2 + s * 0.22; brow.position.set(s * 0.043, 0.017, zs(0.043, 0.017) + 0.003); g.add(brow);
    const ms = mesh(new THREE.CapsuleGeometry(0.005, 0.04, 4, 8), fm); ms.rotation.z = Math.PI / 2 - s * 0.5; ms.position.set(s * 0.022, -0.068, zs(0.022, -0.068) + 0.004); g.add(ms);
  }
  const nose = mesh(new THREE.ConeGeometry(0.016, 0.06, 4), fm); nose.rotation.x = 0.3; nose.scale.z = 0.7; nose.position.set(0, -0.032, zs(0, -0.032) + 0.008); g.add(nose);
  const mouth = mesh(new THREE.BoxGeometry(0.045, 0.006, 0.01), dark); mouth.position.set(0, -0.082, zs(0, -0.082) + 0.0); g.add(mouth);
  g.add(M.aventail({ r: 0.116, len: 0.12, mat: mail }));
  return g;
}
export function sallet({ m = helmSteel(0xbabcc0, 0.26) } = {}) {
  // casque de guet : salade ouverte à longue queue
  const g = G();
  const d = domeGeo({ r: 0.112, h: 0.19, pow: 0.6 });
  displace(d, (v) => { const back = Math.max(0, -v.z) / 0.13; return V(v.x, v.y - back * back * 0.01, v.z); });
  g.add(mesh(d, m));
  const prof = []; for (let k = 0; k <= 20; k++) { const t = k / 20; prof.push([0.1135 + t * t * 0.07, -t * 0.09]); }
  const tail = lathe(prof, 64, Math.PI * 0.62, Math.PI * 0.76); tail.scale(1, 1, 1.12);
  g.add(mesh(tail, ds(m)));
  const sides = lathe([[0.1135, 0], [0.116, -0.06], [0.112, -0.065]], 64, -Math.PI * 0.75, Math.PI * 0.5); sides.scale(1, 1, 1.12); g.add(mesh(sides, ds(m))); const s2 = sides.clone(); s2.rotateY(Math.PI); g.add(mesh(s2, ds(m)));
  g.add(mesh(tubeAlong(meridian({ r: 0.112, h: 0.19, pow: 0.6, off: 0.003 }), 0.006, { segs: 80, radial: 6 }), m));
  rivetRing(g, 0.005, 0.115, 10, brass());
  return g;
}
export function bascinet({ m = helmSteel(0xc4c6ca, 0.2), mail = M.mailMat(0xc4c4c2, [16, 3]), visor = true } = {}) {
  const g = G();
  const d = domeGeo({ r: 0.112, h: 0.24, pow: 0.85, point: 0.02 });
  displace(d, (v) => V(v.x, v.y, v.z - 0.03 * smooth(0.05, 0.24, v.y)));
  g.add(mesh(d, m));
  const low = lathe([[0.1125, 0.0], [0.116, -0.08], [0.112, -0.085]], 64, Math.PI * 0.75, Math.PI * 0.5); low.scale(1, 1, 1.12); g.add(mesh(low, ds(m)));
  rivetRing(g, -0.06, 0.118, 12, brass());
  if (visor) {
    // visière en museau
    const vg = lathe([[0.112, 0], [0.108, 0.03], [0.09, 0.085], [0.055, 0.15], [0.02, 0.19], [0.0001, 0.2]], 40); vg.rotateX(Math.PI / 2); vg.scale(1.05, 1.0, 1);
    const vz = mesh(vg, ds(m)); vz.position.set(0, 0.0, 0.035); g.add(vz);
    const dark = MAT.plain(0x060505, 1);
    for (const s of [-1, 1]) { const sl = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.16), dark); sl.position.set(s * 0.04, 0.035, 0.12); sl.rotation.y = s * 0.45; g.add(sl); }
    for (let i = 0; i < 6; i++) { const h = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.1, 5), dark); h.rotation.x = Math.PI / 2; h.position.set(((i % 3) - 1) * 0.014, -0.025 - Math.floor(i / 3) * 0.016, 0.15); g.add(h); }
    for (const s of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), brass()); p.rotation.z = Math.PI / 2; p.position.set(s * 0.116, 0.07, 0.0); g.add(p); }
  }
  const av = M.aventail({ r: 0.118, len: 0.14, mat: mail, flare: 1.0 }); av.position.y = -0.07; g.add(av);
  return g;
}
export function dentedNasal() {
  const h = M.nasalHelm({ mat: helmSteel(0x8a8884, 0.55) });
  h.traverse((o) => { if (o.isMesh && o.geometry.type === 'LatheGeometry') { const r = rng(5); const dents = Array.from({ length: 9 }, () => [V(r.range(-1, 1), r.range(0.1, 0.9), r.range(-1, 1)).normalize(), r.range(0.01, 0.02)]); displace(o.geometry, (v) => { const n = v.clone().normalize(); let d = 0; for (const [p, s] of dents) d += s * Math.max(0, 1 - n.distanceTo(p) / 0.35) ** 2; const k = 1 - d * 0.5; return V(v.x * k, v.y * (1 - d * 0.2), v.z * k); }); } });
  return h;
}
export function doubleCoif() {
  const g = G();
  const c1 = M.coif({ mat: M.mailMat(0xa8a8a6, [12, 10]) }); g.add(c1);
  // seconde épaisseur : un camail plus court par-dessus
  const c2 = M.coif({ mat: M.mailMat(0x8e8e8c, [12, 8]) }); c2.scale.set(1.07, 0.78, 1.07); c2.position.y = 0.02; g.add(c2);
  const lm = leather(0x5a3820, [8, 1]);   const strap = mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 48), lm); strap.rotation.x = Math.PI / 2 - 0.25; strap.scale.set(1, 1.15, 1); strap.position.y = 0.04; g.add(strap);
  return g;
}

// ================================================================== armures (corps)
function surfTex(base, draw, { size = 1024, multiply = 'cloth_c', flip = false, alpha = 1 } = {}) {
  const t = canvasTex(size, size, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); if (multiply) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = alpha; c.drawImage(img(multiply), 0, 0, w, h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; } if (draw) draw(c, w, h); });
  t.flipY = flip;
  return t;
}
export function clothPainted(base, draw, { rep = [1, 1], quilt = false, sheen = 0.5, rough = 0.9 } = {}) {
  const t = surfTex(base, draw);
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: rough, normalMap: tex(quilt ? 'quilt_n' : 'cloth_n', quilt ? [3, 3] : [4, 4]), normalScale: new THREE.Vector2(quilt ? 1.2 : 0.7, quilt ? 1.2 : 0.7), sheen, sheenRoughness: 0.6, sheenColor: C(0xffffff).multiplyScalar(0.4), side: THREE.DoubleSide });
}
/** Lamelles : rangées de petites plaques à bout arrondi, lacées. */
export function lamellarMat({ plate = '#b8b8b8', lace = FC.sables, rows = 16, cols = 40, metal = 0.9, rough = 0.3 } = {}) {
  const draw = (c, w, h, bump) => {
    c.fillStyle = bump ? '#202020' : '#1a1410'; c.fillRect(0, 0, w, h);
    const pw = w / cols, ph = h / rows;
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const x = i * pw + (r % 2) * pw * 0.5, y = r * ph;
      const gr = c.createLinearGradient(x, 0, x + pw, 0);
      if (bump) { gr.addColorStop(0, '#606060'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#606060'); }
      else { gr.addColorStop(0, C(plate).multiplyScalar(0.55).getStyle()); gr.addColorStop(0.45, plate); gr.addColorStop(1, C(plate).multiplyScalar(0.5).getStyle()); }
      c.fillStyle = gr; c.beginPath(); c.moveTo(x + pw * 0.06, y + ph * 1.05); c.lineTo(x + pw * 0.06, y + pw * 0.45); c.arc(x + pw / 2, y + pw * 0.45, pw * 0.44, Math.PI, 0); c.lineTo(x + pw * 0.94, y + ph * 1.05); c.fill();
    }
    if (!bump) { c.fillStyle = lace; for (let r = 0; r < rows; r++) c.fillRect(0, r * ph + ph * 0.7, w, ph * 0.2); }
    else { c.fillStyle = '#909090'; for (let r = 0; r < rows; r++) c.fillRect(0, r * ph + ph * 0.72, w, ph * 0.12); }
  };
  const t = canvasTex(1024, 1024, (c, w, h) => draw(c, w, h, false));
  const b = canvasTex(1024, 1024, (c, w, h) => draw(c, w, h, true), false);
  return new THREE.MeshPhysicalMaterial({ map: t, bumpMap: b, bumpScale: 4, metalness: metal, roughness: rough, envMapIntensity: 1.2, side: THREE.DoubleSide });
}
export function scaleMat({ color = '#9a9890', rows = 22, cols = 34, metal = 0.9, rough = 0.38, trim = null } = {}) {
  const draw = (c, w, h, bump) => {
    c.fillStyle = '#101010'; c.fillRect(0, 0, w, h);
    const pw = w / cols, ph = h / rows;
    for (let r = rows; r >= -1; r--) for (let i = -1; i <= cols; i++) {
      const x = i * pw + (r % 2) * pw * 0.5 + pw / 2, y = r * ph;
      const gr = c.createRadialGradient(x, y + ph * 0.2, 0, x, y + ph * 0.2, pw * 0.7);
      if (bump) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#404040'); } else { gr.addColorStop(0, C(color).multiplyScalar(1.15).getStyle()); gr.addColorStop(1, C(color).multiplyScalar(0.5).getStyle()); }
      c.fillStyle = gr; c.beginPath(); c.moveTo(x - pw * 0.52, y); c.quadraticCurveTo(x - pw * 0.5, y + ph * 1.3, x, y + ph * 1.6); c.quadraticCurveTo(x + pw * 0.5, y + ph * 1.3, x + pw * 0.52, y); c.fill();
      if (!bump) { c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.stroke(); }
    }
  };
  const t = canvasTex(1024, 1024, (c, w, h) => draw(c, w, h, false)); t.flipY = false;
  const b = canvasTex(1024, 1024, (c, w, h) => draw(c, w, h, true), false); b.flipY = false;
  void trim;
  return new THREE.MeshPhysicalMaterial({ map: t, bumpMap: b, bumpScale: 4, metalness: metal, roughness: rough, envMapIntensity: 1.2, side: THREE.DoubleSide });
}
/** Plaques rivetées sous étoffe (cotte de plates, brigandine) : rivets en rangées. */
export function rivetCloth(base, rivet = '#d8b060', { velvet = false, rows = 9, cols = 22, emblem = null } = {}) {
  const t = surfTex(base, (c, w, h) => {
    // ombres des plaques
    for (let r = 0; r < rows; r++) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, (r + 1) * h / rows * 0.62 - 3, w, 6); }
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5 + (r % 2) * 0.25) * w / cols, y = (r + 0.5) * h / rows * 0.62;
      const gr = c.createRadialGradient(x - 2, y - 2, 0, x, y, 9); gr.addColorStop(0, '#fff4d0'); gr.addColorStop(0.4, rivet); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, 7.5, 0, 7); c.fill();
    }
    if (emblem) emblem(c, w, h);
  }, { multiply: velvet ? 'cloth_c' : 'leather_c' });
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: velvet ? 0.85 : 0.6, sheen: velvet ? 1 : 0.3, sheenRoughness: 0.4, sheenColor: C(base).lerp(C(0xffffff), 0.35), normalMap: tex(velvet ? 'cloth_n' : 'leather_n', [3, 3]), normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide });
}
const chestEmblem = (name, color, { u = 0.25, v = 0.3, s = 0.36 } = {}) => (c, w, h) => { const ew = w * s, eh = h * s; c.save(); c.translate(w * u - ew / 2, h * v - eh / 2); M.EMBLEM[name](c, ew, eh, color); c.restore(); };
/** Garment plus court/long, sans manches. */
export function vest({ mat, length = 0.8, flare = 0.6, inflate = 1.06, wrinkle = 0.02 } = {}) {
  const tg = M.torsoGeo({ length, flare });
  displace(tg, (v) => { const n = fbm(v.x * 8, v.y * 3, v.z * 8, 3) * wrinkle; return V(v.x * inflate * (1 + n), v.y, v.z * inflate * (1 + n)); });
  return mesh(tg, mat);
}
export function mantle({ mat, r = 0.25, len = 0.55, span = 1.45, collar = true, flare = 0.35 } = {}) {
  const g = G();
  const secs = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20; const y = 0.07 - t * len; const rr = r * (1 + flare * t) * (t < 0.15 ? lerp(0.62, 1, t / 0.15) : 1);
    const pts = []; for (let i = 0; i <= 40; i++) { const a = Math.PI - span * Math.PI / 2 + (i / 40) * span * Math.PI; const wob = 1 + 0.05 * Math.sin(i * 1.3 + k * 0.7) * t; pts.push([Math.sin(a) * rr * wob, y, Math.cos(a) * rr * 0.75 * wob]); }
    secs.push({ pts });
  }
  const mg = loft(secs, { closed: false }); displace(mg, (v) => { const n = 1 + 0.04 * fbm(v.x * 9, v.y * 9, v.z * 9, 3); return V(v.x * n, v.y, v.z * n); });
  g.add(mesh(mg, mat));
  if (collar) { const cg = new THREE.TorusGeometry(0.15, 0.05, 12, 40); const col = mesh(cg, mat); col.rotation.x = Math.PI / 2; col.scale.set(1, 0.72, 1); col.position.y = 0.05; g.add(col); }
  return g;
}
export function pauldrons(g, m, { trim = null, lames = 3, s = 1 } = {}) {
  for (const side of [-1, 1]) {
    for (let k = 0; k < lames; k++) {
      const pg = new THREE.SphereGeometry(0.1 - k * 0.006, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
      const p = mesh(pg, m); p.scale.set(1.05 * s, 0.75 * s, 0.95 * s); p.position.set(side * (0.17 + k * 0.012), -0.0 - k * 0.04, 0); p.rotation.z = -side * (0.35 + k * 0.12); g.add(p);
      if (trim && k === 0) { const th = Math.PI * 0.42, rr = 0.1 * Math.sin(th); const tr = mesh(new THREE.TorusGeometry(rr, 0.006, 6, 40), trim); tr.rotation.x = Math.PI / 2; tr.position.y = 0.1 * Math.cos(th); p.add(tr); }
    }
  }
}
function lameBands(g, m, ys, r = 0.185, zs = 0.68, trim = null) {
  ys.forEach((y, i) => { const b = mesh(lathe([[r - 0.004, y - 0.035], [r + 0.006, y - 0.03], [r + 0.008, y], [r - 0.002, y + 0.004]], 48), m); b.scale.set(0.95 + i * 0.03, 1, zs + i * 0.02); g.add(b); if (trim) { const t = mesh(new THREE.TorusGeometry(r + 0.006, 0.0035, 6, 48), trim); t.rotation.x = Math.PI / 2; t.scale.set(0.95 + i * 0.03, zs + i * 0.02, 1); t.position.y = y - 0.034; g.add(t); } });
}
export function plateArmor({ m = steel(0xc8cacd, 0.16), trim = null, cloth: clothM = cloth(0x5a2a20, [4, 4]), gemC = null, glow = 0, star = null, bodyOnly = false } = {}) {
  const g = G();
  // jupe d'étoffe sous les tassettes
  g.add(vest({ mat: clothM, length: 0.85, flare: 0.75, inflate: 0.98 }));
  if (!bodyOnly) { const body = M.garment({ mat: M.mailMat(0xb8b8b6, [10, 10]), length: 0.62, sleeve: 0.55, flare: 0.4, wrinkle: 0.01 }); g.add(body); }
  // plastron
  const tg = M.torsoGeo({ length: 0.5, flare: 0.2 });
  displace(tg, (v) => { const front = Math.max(0, v.z); const k = 1.09 + 0.25 * front * Math.max(0, 1 - Math.abs(v.x) / 0.18) * smooth(0.04, -0.25, v.y); return V(v.x * 1.09, v.y, v.z * k); });
  g.add(mesh(tg, m));
  lameBands(g, m, [-0.45, -0.5, -0.55, -0.6], 0.19, 0.7, trim);
  pauldrons(g, m, { trim, lames: 3 });
  // canons et cubitières sur les manches
  if (!bodyOnly) for (const s of [-1, 1]) {
    const arm = G(); arm.position.set(s * 0.17, -0.02, 0); arm.rotation.z = s * deg(22); g.add(arm);
    const up = mesh(new THREE.CylinderGeometry(0.068, 0.063, 0.2, 24), m); up.position.y = -0.18; arm.add(up);
    const el = mesh(new THREE.SphereGeometry(0.068, 20, 14), m); el.position.y = -0.3; el.scale.set(1, 0.8, 1.1); arm.add(el);
    const lo = mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.2, 24), m); lo.position.y = -0.43; arm.add(lo);
    if (trim) for (const y of [-0.08, -0.53]) { const t = mesh(new THREE.TorusGeometry(y < -0.3 ? 0.056 : 0.068, 0.004, 6, 28), trim); t.rotation.x = Math.PI / 2; t.position.y = y; arm.add(t); }
  }
  // gorgerin
  const gor = mesh(lathe([[0.075, 0.1], [0.085, 0.05], [0.16, 0.02], [0.17, 0.0]].reverse(), 48), m); gor.scale.set(1, 1, 0.7); g.add(gor);
  if (trim) { const t = mesh(new THREE.TorusGeometry(0.168, 0.005, 6, 48), trim); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.7, 1); g.add(t); const ar = mesh(new THREE.BoxGeometry(0.012, 0.42, 0.012), trim); ar.position.set(0, -0.24, 0.146); g.add(ar); }
  if (star) { const s = pommel('star', star, 1.5, gemC, glow); s.position.set(0, -0.14, 0.152); s.rotation.x = -0.15; g.add(s); }
  return g;
}

// ================================================================== chaussures
function pairX(fn, { dx = 0.085, z = 0.05, rot = 12 } = {}) { const g = G(); const a = fn(0), b = fn(1); a.position.x = -dx; b.position.x = dx + 0.005; b.position.z = z; b.rotation.y = deg(-rot); a.rotation.y = deg(rot * 0.5); g.add(a, b); return g; }
export function bootX({ mat = leather(0x4a2c1a, [2, 2]), height = 0.2, cuff = null, cuffR = 0.012, straps = [], strapM = leather(0x2a1a10), bands = null, toeCap = null, spur = null, sole = leather(0x2a1a10), pointy = 0, fur = null, buckle = null, laces = null }) {
  const g = M.boot({ mat, height, cuff: false });
  // on retire la sangle d'origine pour la remplacer par les nôtres
  const def = g.children.find((o) => o.geometry && o.geometry.type === 'TorusGeometry'); if (def) g.remove(def);
  const sl = g.children.find((o) => o.geometry && o.geometry.type === 'CylinderGeometry'); if (sl) sl.material = sole;
  if (pointy) { const t = mesh(new THREE.ConeGeometry(0.025, pointy, 12), mat); t.rotation.x = Math.PI / 2; t.scale.set(1, 1, 0.55); t.position.set(0, 0.03, 0.2 + pointy / 2 - 0.01); t.rotation.z = 0; g.add(t); const curl = mesh(new THREE.TorusGeometry(0.012, 0.005, 6, 12, Math.PI), mat); curl.position.set(0, 0.045, 0.2 + pointy - 0.01); curl.rotation.y = Math.PI / 2; g.add(curl); }
  if (cuff) { const c = mesh(new THREE.TorusGeometry(0.064, cuffR, 10, 40), cuff); c.rotation.x = Math.PI / 2; c.scale.set(1, 1.08, 1); c.position.set(0, 0.03 + height, -0.01); g.add(c); }
  if (fur) { const f = mesh(new THREE.CylinderGeometry(0.078, 0.068, 0.09, 28, 1, true), fur); f.position.set(0, height - 0.0, -0.01); f.scale.z = 1.08; g.add(f); const f2 = mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 32), fur); f2.rotation.x = Math.PI / 2; f2.position.set(0, height + 0.04, -0.01); g.add(f2); }
  straps.forEach((y) => { const s = mesh(new THREE.TorusGeometry(0.06 - (y < 0.1 ? 0.004 : 0), 0.0055, 8, 40), strapM); s.rotation.x = Math.PI / 2 - (y < 0.1 ? 0.25 : 0); s.scale.set(1, 1.1, 1); s.position.set(0, y, y < 0.1 ? 0.0 : -0.01); g.add(s); if (buckle) { const b = mesh(new THREE.BoxGeometry(0.018, 0.016, 0.006), buckle); b.position.set(0.055, y, 0.02); b.rotation.y = 1.0; g.add(b); } });
  if (bands) for (let i = 0; i < 4; i++) { const y = 0.12 + i * (height - 0.06) / 4; const b = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.018, 28, 1, true), bands); b.position.set(0, y, -0.01); b.scale.z = 1.08; g.add(b); }
  if (toeCap) { const tc = mesh(new THREE.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toeCap); tc.scale.set(0.75, 0.6, 1.0); tc.position.set(0, 0.012, 0.165); g.add(tc); }
  if (spur) {
    const arc = []; for (let i = 0; i <= 30; i++) { const a = -Math.PI * 0.9 + (i / 30) * Math.PI * 1.8; arc.push(V(Math.sin(a) * 0.064, 0.075, -Math.cos(a) * 0.067)); }
    g.add(mesh(tubeAlong(arc, 0.006, { segs: 50, radial: 8 }), spur));
    const neck = mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.04, 8), spur); neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.075, -0.085); g.add(neck);
    const rowel = G(); for (let i = 0; i < 8; i++) { const sp = mesh(new THREE.ConeGeometry(0.004, 0.022, 6), spur); sp.rotation.x = i / 8 * Math.PI * 2; sp.translateY(0.011); rowel.add(sp); }
    rowel.position.set(0, 0.075, -0.112); g.add(rowel);
  }
  if (laces) { for (let i = 0; i < 6; i++) { const y = 0.09 + i * (height - 0.06) / 6; const l = mesh(new THREE.CapsuleGeometry(0.0025, 0.05, 3, 6), laces); l.rotation.z = Math.PI / 2 + (i % 2 ? 0.45 : -0.45); l.position.set(0, y, 0.058); g.add(l); } }
  return g;
}
export function sandal() {
  const g = G();
  const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.quadraticCurveTo(0.05, -0.04, 0.045, 0.06); sh.quadraticCurveTo(0.05, 0.2, 0.0, 0.22); sh.quadraticCurveTo(-0.05, 0.2, -0.045, 0.06); sh.quadraticCurveTo(-0.05, -0.04, 0, -0.05);
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 }); sg.rotateX(Math.PI / 2); sg.translate(0, 0.025, 0);
  g.add(mesh(sg, leather(0x8a6040, [1, 1])));
  const st = leather(0x5a3a20, [4, 1]);
  // lanières croisées et tour de cheville
  const strap = (pts, r = 0.006) => g.add(mesh(tubeAlong(pts, r, { segs: 30, radial: 6 }), st));
  strap([V(-0.045, 0.03, 0.12), V(0, 0.06, 0.13), V(0.045, 0.03, 0.12)]);
  strap([V(-0.047, 0.03, 0.06), V(0, 0.075, 0.07), V(0.047, 0.03, 0.06)]);
  strap([V(-0.044, 0.03, 0.0), V(-0.03, 0.09, 0.02), V(0, 0.12, 0.03), V(0.03, 0.09, 0.02), V(0.044, 0.03, 0.0)]);
  const ank = mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 32), st); ank.rotation.x = Math.PI / 2; ank.position.set(0, 0.13, -0.005); g.add(ank);
  strap([V(0, 0.03, -0.048), V(0, 0.09, -0.05), V(0, 0.13, -0.048)]);
  const ank2 = mesh(new THREE.TorusGeometry(0.043, 0.006, 6, 32), st); ank2.rotation.x = Math.PI / 2; ank2.position.set(0, 0.17, -0.005); g.add(ank2);
  const bead = mesh(new THREE.SphereGeometry(0.008, 10, 8), gem(0x2a8a5a, 0, { transmission: 0 })); bead.position.set(0, 0.075, 0.075); g.add(bead);
  return g;
}
/** Guêtre / jambière : tube sur le bas de jambe (sans pied). */
export function legGuard({ mat, h = 0.3, r0 = 0.058, r1 = 0.045, front = false, knee = null, laces = null, straps = null, strapM = leather(0x2a1a10), trim = null, sabaton = null, ridge = false }) {
  const g = G();
  const span = front ? Math.PI * 1.1 : Math.PI * 2;
  const secs = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30; const y = 0.06 + t * h; let r = lerp(r1, r0, t) * (1 + 0.15 * Math.exp(-Math.pow((t - 0.62) / 0.22, 2))); const pts = []; for (let i = 0; i <= 40; i++) { const a = -span / 2 + (i / 40) * span; let rr = r; if (ridge) rr *= 1 + 0.12 * Math.max(0, 1 - Math.abs(a) / 0.5); pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr * 1.05]); } secs.push({ pts }); }
  const lg = loft(secs, { closed: false });
  const m = mesh(lg, mat); m.material.side = THREE.DoubleSide; g.add(m);
  if (knee) { const kp = mesh(new THREE.SphereGeometry(0.06, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), knee); kp.rotation.x = Math.PI / 2; kp.scale.set(1, 1, 0.8); kp.position.set(0, h + 0.07, 0.035); g.add(kp); const w = mesh(new THREE.ConeGeometry(0.035, 0.05, 12), knee); w.rotation.x = Math.PI / 2; w.scale.set(1.4, 1, 0.3); w.position.set(0.05, h + 0.07, 0.035); g.add(w); }
  if (laces) for (let i = 0; i < 7; i++) { const y = 0.08 + i * h / 7.5; const l = mesh(new THREE.CapsuleGeometry(0.0022, 0.035, 3, 6), laces); l.rotation.z = Math.PI / 2 + (i % 2 ? 0.5 : -0.5); l.position.set(0, y, lerp(0.047, 0.06, i / 7) + 0.004); g.add(l); }
  if (straps) straps.forEach((y) => { const s = mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 32), strapM); s.rotation.x = Math.PI / 2; s.scale.set(1, 1.05, 1); s.position.y = y; g.add(s); });
  if (trim) for (const y of [0.06, h * 0.5 + 0.06, h + 0.06]) { const t = mesh(new THREE.TorusGeometry(y > h ? r0 * 1.0 : lerp(r1, r0, (y - 0.06) / h) * 1.05, 0.007, 6, 32), trim); t.rotation.x = Math.PI / 2; t.scale.set(1, 1.05, 1); t.position.y = y; g.add(t); }
  if (sabaton) {
    for (let i = 0; i < 6; i++) { const z = 0.0 + i * 0.032; const w = 0.048 - i * 0.003; const sg = new THREE.CylinderGeometry(w, w, 0.04, 20, 1, true, Math.PI / 2, Math.PI); sg.rotateX(Math.PI / 2); const s = mesh(sg, sabaton); s.position.set(0, 0.03 - i * 0.002, z); s.scale.set(1, 1, 0.9 - i * 0.05); s.material.side = THREE.DoubleSide; g.add(s); }
    const tg = new THREE.ConeGeometry(0.034, 0.08, 16, 1, false, Math.PI / 2, Math.PI); tg.rotateX(Math.PI / 2); const toe = mesh(tg, sabaton); toe.position.set(0, 0.02, 0.225); toe.scale.set(1, 0.8, 1); g.add(toe);
    const heel = mesh(new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), sabaton); heel.position.set(0, 0.03, -0.01); heel.scale.set(1, 0.9, 1); g.add(heel);
    const sole = mesh(new THREE.BoxGeometry(0.07, 0.01, 0.26), leather(0x2a1a10)); sole.position.set(0, 0.0, 0.08); g.add(sole);
  }
  return g;
}

// ================================================================== bagues
function ringMetal(kind) {
  switch (kind) {
    case 'iron': return MAT.metal({ color: 0x6a6662, rough: 0.6, rep: [1, 1] });
    case 'bone': return new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.55, sheen: 0.3, map: tex('rock_c', [1, 1], true), normalMap: tex('leather_n', [1, 1]), normalScale: new THREE.Vector2(0.3, 0.3), clearcoat: 0.2 });
    case 'jade': return new THREE.MeshPhysicalMaterial({ color: 0x3a9a6a, roughness: 0.15, transmission: 0.3, thickness: 0.01, clearcoat: 1, sheen: 0.2, map: tex('rock_c', [1, 1], true) });
    case 'steel': return MAT.polished({ color: 0xb8bcc0, rough: 0.2 });
    case 'bronze': return MAT.metal({ color: 0xa88050, rough: 0.35 });
    case 'silver': return MAT.polished({ color: 0xe0e2e6, rough: 0.12, env: 1.2 });
    case 'pale': return MAT.polished({ color: 0xeef0f4, rough: 0.06, env: 1.4 });
    case 'oldgold': return MAT.metal({ color: 0xb09048, rough: 0.45 });
    default: return MAT.gold({ rough: 0.18 });
  }
}
function bandGeo({ r = 0.0105, w = 0.0032, t = 0.0026, flat = false, twist = 0 }) {
  const g = lathe(Array.from({ length: 21 }, (_, k) => { const a = k / 20 * Math.PI * 2; return [r + (Math.cos(a) * 0.5 + 0.5) * t * (flat ? 0.8 : 1), Math.sin(a) * w * (flat ? 1.5 : 1)]; }), 96);
  g.rotateX(Math.PI / 2);
  if (twist) displace(g, (v) => { const a = Math.atan2(v.y, v.x); const k = 1 + 0.05 * Math.sin(a * twist + Math.atan2(v.z, 0.003) * 2); return V(v.x * k, v.y * k, v.z); });
  return g;
}
function facetGem(r, h = 0.6, segs = 8) { const prof = [[0.0001, -r * 0.9], [r, 0], [r * 0.95, r * 0.12], [r * 0.6, r * h], [0.0001, r * h]]; const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), segs); const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng; }
function cabochon(r, h = 0.7) { const g = new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, h, 1); return g; }
/** Bague paramétrique. */
export function ringX({ metal = 'gold', band: bo = {}, setting = null, stone = null, stoneC = 0xaa1020, glow = 0, prongs = 4, stoneR = 0.0075, cut = 'facet', top = null, topM = null, studs = 0, engrave = 0 } = {}) {
  const g = G();
  const m = ringMetal(metal);
  g.add(mesh(bandGeo(bo), m));
  const R = bo.r || 0.0105, Y = R + (bo.t || 0.0026) * 0.7;
  if (setting === 'cup' || stone) {
    const cup = mesh(lathe([[0.0001, 0], [stoneR * 0.5, 0], [stoneR * 1.0, stoneR * 0.5], [stoneR * 1.12, stoneR * 0.85], [0.0001, stoneR * 0.85]], 32), m); cup.position.y = Y - 0.001; g.add(cup);
  }
  if (stone) {
    const sm = gem(stoneC, glow, cut === 'cab' ? { transmission: 0, roughness: 0.2, envMapIntensity: 0.6, clearcoat: 0.5, specularIntensity: 0.4 } : cut === 'brilliant' ? { transmission: 0.6, attenuationDistance: 1 } : {});
    const geo = cut === 'cab' ? cabochon(stoneR * 1.02, 0.75) : cut === 'step' ? new THREE.BoxGeometry(stoneR * 1.6, stoneR * 0.9, stoneR * 1.2) : facetGem(stoneR, 0.6, cut === 'brilliant' ? 16 : 8);
    if (cut === 'step') { geo.translate(0, stoneR * 0.45, 0); }
    const s = mesh(geo, sm); s.position.y = Y + stoneR * 0.8; g.add(s);
    if (cut === 'step') { const fr = mesh(new THREE.BoxGeometry(stoneR * 1.8, stoneR * 0.5, stoneR * 1.4), m); fr.position.y = Y + stoneR * 0.85; g.add(fr); }
    if (prongs) for (let i = 0; i < prongs; i++) { const a = i / prongs * Math.PI * 2 + Math.PI / prongs; const p = mesh(new THREE.CapsuleGeometry(0.0011, stoneR * 0.45, 4, 6), m); p.position.set(Math.cos(a) * stoneR * 0.98, Y + stoneR * 0.95, Math.sin(a) * stoneR * 0.98); p.rotation.z = -Math.cos(a) * 0.4; p.rotation.x = Math.sin(a) * 0.4; g.add(p); }
  }
  if (top) { const t = top(topM || m); t.position.y = Y; g.add(t); }
  if (studs) for (let i = 0; i < studs; i++) { const a = Math.PI / 2 + (i - (studs - 1) / 2) * 0.28; const s = mesh(new THREE.SphereGeometry(0.0013, 8, 6), m); s.position.set(Math.cos(a) * (R + 0.0028), Math.sin(a) * (R + 0.0028), 0); g.add(s); }
  if (engrave) for (let i = 0; i < engrave; i++) { const a = -Math.PI * 0.2 + (i / engrave) * Math.PI * 1.4; const k = mesh(new THREE.BoxGeometry(0.0009, 0.0016, i % 2 ? 0.006 : 0.004), MAT.plain(0x2a1a10)); k.rotation.x = i % 3 ? 0.5 : -0.5; k.position.set(Math.cos(a) * (R + 0.0027), Math.sin(a) * (R + 0.0027), 0); k.rotation.z = a; g.add(k); }
  return g;
}
const sigTop = (emblem) => (m) => { const g = G(); const t = mesh(new THREE.CylinderGeometry(0.0085, 0.0075, 0.005, 8), m); t.position.y = 0.002; g.add(t); const f = mesh(new THREE.CircleGeometry(0.0075, 32), new THREE.MeshPhysicalMaterial({ color: m.color, metalness: 1, roughness: 0.3, normalMap: emblemNormal(emblem), normalScale: new THREE.Vector2(1.6, 1.6) })); f.rotation.x = -Math.PI / 2; f.position.y = 0.0046; g.add(f); return g; };
function emblemNormal(emblem) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = 'rgb(128,128,255)'; c.fillRect(0, 0, w, h);
    const d = document.createElement('canvas'); d.width = w; d.height = h; const dc = d.getContext('2d'); M.EMBLEM[emblem](dc, w, h, '#fff');
    c.filter = 'brightness(0.5) sepia(1) hue-rotate(190deg) saturate(3)'; c.drawImage(d, -3, -3); c.filter = 'none';
    c.strokeStyle = 'rgb(100,100,255)'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h / 2, w * 0.45, 0, 7); c.stroke();
  }, false);
}
const sunTop = (m) => { const g = G(); const d = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 32), m); d.position.y = 0.002; g.add(d); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r = mesh(new THREE.ConeGeometry(0.0016, i % 2 ? 0.004 : 0.0065, 6), m); r.rotation.z = -Math.PI / 2; r.rotation.y = -a; r.position.set(Math.cos(a) * 0.0075, 0.0025, Math.sin(a) * 0.0075); r.scale.y = 1; g.add(r); } const c = mesh(new THREE.SphereGeometry(0.0035, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); c.position.y = 0.0035; g.add(c); return g; };
const eagleTop = (m) => {
  // aigle aux ailes levées en V, tête de profil, yeux de grenat
  const g = G();
  const body = mesh(new THREE.SphereGeometry(0.0034, 16, 12), m); body.scale.set(1, 0.8, 1.7); body.position.set(0, 0.003, 0); g.add(body);
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.004, 0.006, 0.0105, 0.0085);
    for (let k = 0; k < 4; k++) { sh.lineTo(0.0105 - k * 0.0018, 0.0055 - k * 0.0016); sh.lineTo(0.0095 - k * 0.0021, 0.0062 - k * 0.0019); }
    sh.lineTo(0.002, -0.002); sh.closePath();
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 0.0014, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0004, bevelSegments: 2 });
    const w = mesh(wg, m); w.scale.x = s; w.position.set(s * 0.002, 0.003, -0.0007); w.rotation.x = -Math.PI / 2 + 0.5; w.rotation.y = 0; g.add(w);
  }
  const tail = mesh(new THREE.ConeGeometry(0.0028, 0.006, 6), m); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.0025, -0.0065); tail.scale.y = 1; tail.scale.x = 1.4; g.add(tail);
  const hd = mesh(new THREE.SphereGeometry(0.0024, 12, 8), m); hd.position.set(0, 0.0058, 0.0058); g.add(hd);
  const bk = mesh(new THREE.ConeGeometry(0.001, 0.003, 6), m); bk.rotation.x = Math.PI / 2 + 0.6; bk.position.set(0, 0.0052, 0.0085); g.add(bk);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.0009, 8, 6), gem(0x8a0a18, 0.5)); e.position.set(s * 0.0017, 0.0066, 0.0066); g.add(e); }
  return g;
};
const wolfTop = (m) => {
  const g = G();
  for (const s of [-1, 1]) {
    const h = G();
    const sk = mesh(new THREE.SphereGeometry(0.0034, 14, 10), m); sk.scale.set(1, 0.9, 1.1); h.add(sk);
    const sn = mesh(new THREE.ConeGeometry(0.0022, 0.0062, 10), m); sn.rotation.x = Math.PI / 2; sn.position.z = 0.0042; h.add(sn);
    for (const e of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.0012, 0.003, 6), m); ear.position.set(e * 0.0018, 0.0032, -0.0008); h.add(ear); }
    const eye = mesh(new THREE.SphereGeometry(0.0006, 6, 4), gem(0x2a6aa0, 0.3)); eye.position.set(0.0018, 0.0012, 0.0024); h.add(eye); const e2 = eye.clone(); e2.position.x = -0.0018; h.add(e2);
    h.scale.setScalar(1.35); h.position.set(s * 0.0058, 0.003, 0); h.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(h);
  }
  return g;
};
const ironNail = (m) => { const g = G(); const hd = mesh(new THREE.BoxGeometry(0.008, 0.0035, 0.0045), m); hd.position.y = 0.0008; g.add(hd); return g; };
const starTop = (m, gemC, glow) => { const g = G(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const r = mesh(new THREE.ConeGeometry(0.0013, i % 2 ? 0.004 : 0.0072, 4), m); r.rotation.z = -Math.PI / 2; r.rotation.y = -a; r.position.set(Math.cos(a) * 0.0068, 0.002, Math.sin(a) * 0.0068); g.add(r); } const d = mesh(new THREE.CylinderGeometry(0.0062, 0.0066, 0.003, 32), m); d.position.y = 0.0015; g.add(d); const s = mesh(facetGem(0.0045, 0.6, 16), gem(gemC, glow)); s.position.y = 0.0045; g.add(s); return g; };

// ================================================================== table des objets
export function buildItems(fitAndShoot) {
  const swordPose = [12, 25, -42], longPose = [10, 20, -48], axePose = [8, 15, -38], shPose = [-12, 28, 0], helmV = { pose: [8, 28, 0], view: [0, 0.38, 1] }, bodyV = { pose: [5, 25, 0], view: [0, 0.15, 1] }, bootV = { pose: [10, 30, 0], view: [0, 0.4, 1] }, legV = { pose: [6, 30, 0], view: [0, 0.25, 1] }, ringV = { pose: [-20, 20, 0], view: [0, 0.55, 1] };
  const W = (fn, o) => () => fitAndShoot(fn(), o);
  const sw = (o, pose = swordPose, x = {}) => W(() => swordX(o()), { pose, ...x });
  const sh = (fn, x = {}) => W(fn, { pose: shPose, ...x });
  const hm = (fn, x = {}) => W(fn, { ...helmV, ...x });
  const bd = (fn, x = {}) => W(fn, { ...bodyV, ...x });
  const ft = (fn, x = {}) => W(fn, { ...bootV, ...x });
  const rg = (o, x = {}) => W(() => ringX(o), { ...ringV, ...x });
  const aubeM = () => new THREE.MeshPhysicalMaterial({ color: C(FC.aube), metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
  const enamel = (c) => new THREE.MeshPhysicalMaterial({ color: C(c), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });

  return {
    // ----------------------------------------------------------- armes
    'massue-cloutee': W(club, { pose: [10, 20, -40] }),
    francisque: W(() => axeX({ head: 'francisca', haft: 0.5, scale: 1.25, haftMat: wood(0x8a6440, [1, 3]), headMat: iron(0x8a8884, 0.5), haftR: 0.015 }), { pose: [8, 15, -32] }),
    'arc-composite': W(() => compositeBow({ grip: FC.sables }), { pose: [0, 20, -20] }),
    fauchon: sw(() => ({ len: 0.6, w0: 0.05, w1: 0.075, tip: 0.13, single: true, fuller: 0, profile: (t, w) => w, guard: 'bar', guardLen: 0.16, guardMat: steel(0xb8b8bc, 0.28), pommelType: 'disc', gripLen: 0.095, gripMat: leather(0x3a2416) })),
    'lance-de-cavalerie': W(() => lanceX({ len: 1.45, stripes: ['#f0ead8', FC.aube], vampM: aubeM() }), { pose: [10, 20, -50] }),
    cimeterre: sw(() => ({ len: 0.68, w0: 0.036, w1: 0.05, tip: 0.18, curve: -0.12, single: true, fuller: 0.0, guard: 'sabre', guardLen: 0.12, guardMat: brass(), pommelType: 'cap', pommelMat: brass(), gripMat: leather(0x2f5a3a), gripLen: 0.1 })),
    'hache-barbue': W(() => axeX({ head: 'bearded', haft: 0.8, scale: 1.35, headMat: iron(0x9ea0a4, 0.3), haftMat: wood(0x6a4a2c), wrap: leather(0x2a3a5a) }), { pose: axePose }),
    'epieu-de-chasse': W(huntSpear, { pose: longPose }),
    'fleau-d-armes': W(() => flail({ ballMat: steel(0x9a9ca0, 0.3), metal: steel(0xa8aaae, 0.3), gripM: leather(0x5a1a14) }), { pose: [8, 20, -30] }),
    'epee-batarde': sw(() => ({ len: 0.86, w0: 0.05, w1: 0.03, tip: 0.2, fuller: 0.5, guard: 'curved', guardLen: 0.2, guardMat: steel(0xb8bcc0, 0.22), pommelType: 'scent', pommelMat: steel(0xb8bcc0, 0.22), gripLen: 0.17, gripMat: leather(0x2a1a14), wraps: 20, inlay: brass(0.25) })),
    guisarme: W(guisarme, { pose: longPose }),
    'marteau-de-guerre': W(() => warHammer({ trim: brass(0.25) }), { pose: [8, 15, -36] }),
    'sabre-de-l-emir': () => { const g = swordX({ len: 0.7, w0: 0.034, w1: 0.046, tip: 0.17, curve: -0.13, single: true, fuller: 0, bladeMat: patternMetal({ base: '#d0d2d6', draw: (c, w, h) => { c.strokeStyle = '#c89a3a'; c.lineWidth = 6; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(w * 0.42, h * (0.05 + i * 0.05)); c.bezierCurveTo(w * 0.62, h * (0.07 + i * 0.05), w * 0.38, h * (0.09 + i * 0.05), w * 0.58, h * (0.1 + i * 0.05)); c.stroke(); } }, rough: 0.14 }), guard: 'sabre', guardLen: 0.13, guardMat: gold(), pommelType: 'cap', pommelMat: gold(), gripMat: leather(0x1a2a1c), gripLen: 0.1, gems: 0x2a8a50, guardGem: 0x2a8a50 }); const sc = mesh(blade({ len: 0.7, w0: 0.05, w1: 0.06, tip: 0.12, curve: -0.13, single: true, fuller: 0, th: 0.02 }), silver()); sc.position.set(0.06, 0.02, -0.04); sc.scale.set(1, 0.92, 1); const s2 = G(); s2.add(sc); g.add(s2); for (const y of [0.05, 0.25, 0.55]) { const b = mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 20), gold()); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.45, 1); b.position.set(0.06 + (-0.13) * Math.pow(y / 0.7, 2) * 0.9 + 0.005, 0.02 + y * 0.92, -0.04); g.add(b); } return fitAndShoot(g, { pose: [12, 25, -40] }); },
    'epee-de-l-aube': sw(() => ({ len: 0.8, w0: 0.052, w1: 0.04, tip: 0.13, fuller: 0.66, guard: 'bar', guardLen: 0.22, guardBend: -0.012, guardMat: aubeM(), pommelType: 'sun', pommelMat: aubeM(), gripMat: leather(0xe8e0cc), gripLen: 0.1, inlay: gold() })),
    'hache-du-jarl': W(() => axeX({ head: 'bearded', haft: 0.9, scale: 1.45, headMat: patternMetal({ base: '#8a8c90', draw: (c, w, h) => { c.strokeStyle = '#e8eaee'; c.lineWidth = 5; for (let i = 0; i < 10; i++) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (0.1 + i * 0.09) + Math.sin(x / 18 + i) * 10); c.stroke(); } }, rough: 0.3, rep: [6, 6] }), haftMat: wood(0x4a3220), wrap: leather(0x1e2c48), langets: silver(), pommelM: silver(), inlay: silver(), back: 'spike' }), { pose: axePose }),
    'lance-du-connetable': W(() => lanceX({ len: 1.5, stripes: ['#7a1a14', '#e8c860'], vampM: gold(), tipM: steel(0xd0d2d6, 0.15), pennon: ['#a02018', '#e8c860', 'tower', '#e8c860'] }), { pose: [10, 20, -50] }),
    'epee-longue-trempee': sw(() => ({ len: 0.92, w0: 0.046, w1: 0.03, tip: 0.18, fuller: 0.55, bladeMat: new THREE.MeshPhysicalMaterial({ color: 0xb8c4d8, metalness: 1, roughness: 0.16, map: canvasTex(64, 512, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#6a5a8a'); gr.addColorStop(0.18, '#c8a878'); gr.addColorStop(0.3, '#e8ecf0'); gr.addColorStop(1, '#e0e6ee'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), normalMap: tex('metal_n'), normalScale: new THREE.Vector2(0.08, 0.08), envMapIntensity: 1.2 }), guard: 'curved', guardLen: 0.22, guardMat: steel(0x9aa0a8, 0.25), pommelType: 'wheel', pommelMat: steel(0x9aa0a8, 0.25), gripLen: 0.18, gripMat: leather(0x1a2a3a), wraps: 22 })),
    'masse-de-l-ost': W(() => flangedMace({ len: 0.72 }), { pose: [12, 25, -35] }),
    'epee-de-guerre': sw(() => ({ len: 1.0, w0: 0.055, w1: 0.034, tip: 0.18, fuller: 0.5, guard: 'bar', guardLen: 0.3, guardMat: iron(0x9a9ca0, 0.3), pommelType: 'pear', pommelMat: iron(0x9a9ca0, 0.3), gripLen: 0.24, gripMat: leather(0x4a2c18), wraps: 24, ricasso: 0.06 }), [10, 22, -46]),
    'lame-de-l-aurore': sw(() => ({ len: 0.86, w0: 0.054, w1: 0.04, tip: 0.15, fuller: 0.66, bladeMat: (() => { const m = MAT.polished({ color: 0xf0c8c8, rough: 0.1 }); m.emissive = C(0xff6a6a); m.emissiveIntensity = 0.35; return m; })(), guard: 'wing', guardLen: 0.22, guardMat: gold(), pommelType: 'sun', pommelMat: gold(), gripMat: leather(0x8a1a2a), gripLen: 0.11, gems: 0xff5a7a, guardGem: 0xff5a7a, glow: 0.8, inlay: gold() })),
    'hache-du-dernier-hiver': W(() => axeX({ head: 'winter', haft: 0.95, scale: 1.4, headMat: glowMat(0x2a6ab0, 0.45, 0xc8dcf0), haftMat: wood(0x2a2a34), wrap: leather(0x1e2c48), langets: silver(), pommelM: gem(0x8ac8ff, 0.9), glowEdge: glowMat(0x6ab8ff, 2.6, 0x9ad0ff), inlay: gold() }), { pose: axePose }),
    'hache-de-bataille': W(() => axeX({ head: 'battle', haft: 0.95, scale: 1.3, headMat: patternMetal({ base: '#a8aaae', draw: (c, w, h) => scrolls(c, w, h, '#d8a840', 5, 6), rough: 0.25, rep: [5, 5] }), haftMat: wood(0x5a3a22), back: 'axe', langets: brass(), wrap: leather(0x5a1a14) }), { pose: axePose }),
    'epee-d-aldoria': sw(() => ({ len: 0.88, w0: 0.056, w1: 0.042, tip: 0.15, fuller: 0.66, bladeMat: (() => { const m = MAT.polished({ color: 0xe8ecf4, rough: 0.08 }); m.emissive = C(0x9ab8ff); m.emissiveIntensity = 0.25; return m; })(), guard: 'wing', guardLen: 0.24, guardMat: gold(), pommelType: 'star', pommelMat: silver(), gripMat: leather(0x1a2a6a), gripLen: 0.11, gems: 0x3a6aff, guardGem: 0xd01030, glow: 1.0, inlay: gold() })),

    // ----------------------------------------------------------- boucliers
    rondache: sh(() => metalRound({ R: 0.22, dome: 0.05, m: iron(0x7e7c78, 0.55), rimM: iron(0x5e5c58, 0.6), ridges: [0.62], bossM: iron(0x8a8884, 0.45), rivets: 10 })),
    pavois: sh(() => pavise({ field: '#6a3a24', emblem: 'bars', emblemColor: '#c8b48a', wear: 0.55, rimM: leather(0x3a2416, [12, 1]), rimR: 0.012, rivets: 12 }), { pose: [-8, 26, 0] }),
    'bouclier-de-fer': sh(() => { const g = metalRound({ R: 0.4, dome: 0.04, m: patternMetal({ base: '#4e4c48', draw: (c, w, h) => { c.strokeStyle = 'rgba(20,20,20,0.85)'; c.lineWidth = 5; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); } }, rough: 0.5, metal: 1 }), rimM: iron(0x5a5854, 0.55), bossM: iron(0x9a9894, 0.4), rivets: 24, rivM: iron(0xa8a6a2, 0.35) }); return g; }),
    'targe-a-pointe': sh(() => { const g = roundX({ R: 0.3, field: FC.sables, emblem: 'star', emblemColor: '#d8b453', wear: 0.25, boards: 0, base: 'leather', rimM: brass(), bossM: steel(0xc0c2c6, 0.2) }); const s = mesh(new THREE.ConeGeometry(0.035, 0.26, 24), steel(0xc8cace, 0.15)); s.rotation.x = Math.PI / 2; s.position.z = 0.18; g.add(s); return g; }, { pose: [-14, 42, 0] }),
    'bouclier-au-corbeau': sh(() => roundX({ R: 0.42, field: FC.givre, emblem: 'ravenBlack', wear: 0.5, boards: 6, rimColor: 0x2a1c12 })),
    'ecu-blasonne': sh(() => M.kiteShield({ field: '#f2ecd8', emblem: 'sun', emblemColor: '#c08a1c', wear: 0.35, rimMetal: false }), { pose: [-10, 28, 0] }),
    'bouclier-de-cavalier': sh(() => heater({ W: 0.52, H: 0.62, field: '#2a3a6a', emblem: 'bend', emblemColor: '#d8c070', wear: 0.3, rimM: brass(0.3), rivets: 10, rivM: brass() })),
    'grand-pavois': sh(() => { const g = pavise({ W: 0.66, H: 1.12, taper: 0.1, field: '#6a5236', base: 'wood', boards: 5, emblem: 'bars', emblemColor: '#4a4844', wear: 0.3, rimM: wood(0x5a3a20, [1, 1]), rimR: 0.018, rivets: 22, rivM: iron(0x7a7672, 0.5) }); const sp = mesh(new THREE.ConeGeometry(0.02, 0.12, 8), iron(0x6a6662, 0.5)); sp.rotation.x = Math.PI; sp.position.set(-0.2, -0.6, -0.02); g.add(sp); const sp2 = sp.clone(); sp2.position.x = 0.2; g.add(sp2); return g; }, { pose: [-8, 26, 0] }),
    'bouclier-d-acier': sh(() => metalRound({ R: 0.36, dome: 0.08, m: steel(0xd0d2d6, 0.1), rimM: brass(0.2), ridges: [0.55, 0.8], ridgeM: steel(0xd8dadc, 0.08), bossM: steel(0xe0e2e6, 0.08), rivets: 16, rivM: brass(0.2) })),
    'targe-damasquinee': sh(() => metalRound({ R: 0.3, dome: 0.07, m: patternMetal({ base: '#9a9ca2', draw: (c, w, h) => { for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(${i % 2 ? '230,232,236' : '70,72,78'},0.5)`; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= w; x += 6) c.lineTo(x, i * h / 60 + Math.sin(x / 30 + i * 0.7) * 12 + Math.sin(x / 9) * 3); c.stroke(); } c.save(); c.translate(w * 0.1, h * 0.1); M.EMBLEM.star(c, w * 0.8, h * 0.8, '#e0b040'); c.restore(); }, rough: 0.16 }), rimM: gold(), bossM: gold(), spike: false, gems: [[Math.PI / 2, 0.7, 0x2a9a5a], [Math.PI * 7 / 6, 0.7, 0x2a9a5a], [-Math.PI / 6, 0.7, 0x2a9a5a]] })),
    'bouclier-du-jarl': sh(() => roundX({ R: 0.42, field: '#2c4a78', emblem: 'raven', emblemColor: '#dfe3ea', wear: 0.35, boards: 6, rimM: silver(0.15), bossM: silver(0.12), rivM: silver(0.15) })),
    'ecu-du-seneschal': sh(() => heater({ field: FC.aube, emblem: 'sun', emblemColor: '#7a2414', wear: 0.2, rimM: gold(0.2), rimR: 0.014, rivets: 0, emblemY: -0.05 })),
    'pavois-de-siege': sh(() => { const g = pavise({ W: 0.62, H: 1.1, taper: 0.04, field: '#3a4a3a', emblem: 'chevron', emblemColor: '#c8b48a', wear: 0.65, rimM: iron(0x6a6662, 0.5), rimR: 0.014, rivets: 18 }); arrowsIn(g, 6, g.userData.surf, 4, 0.62, 1.1); return g; }, { pose: [-8, 30, 0] }),
    'bouclier-de-la-garde': sh(() => heater({ W: 0.6, H: 0.76, field: '#7a1a18', emblem: 'chevron', emblemColor: '#e0c060', wear: 0.25, rimM: steel(0xc0c2c6, 0.2), rivets: 14, rivM: brass() })),
    'bouclier-de-bataille': sh(() => { const g = roundX({ R: 0.44, field: '#6a5a40', wear: 0.95, boards: 7, rimColor: 0x2a1c10 }); const r = rng(9); for (let i = 0; i < 4; i++) { const p = mesh(new THREE.BoxGeometry(r.range(0.08, 0.14), r.range(0.03, 0.05), 0.006), iron(0x6a6662, 0.55)); p.position.set(r.range(-0.25, 0.25), r.range(-0.25, 0.25), 0.03); p.rotation.z = r.range(-1, 1); g.add(p); for (const s of [-1, 1]) { const k = mesh(new THREE.SphereGeometry(0.006, 8, 6), iron(0x8a8884, 0.4)); k.position.set(s * 0.035, 0, 0.004); p.add(k); } } return g; }),
    'egide-des-ruines': sh(() => metalRound({ R: 0.4, dome: 0.06, m: patternMetal({ base: '#7a8a6a', draw: (c, w, h) => { c.globalAlpha = 0.6; c.fillStyle = '#3a6a5a'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 0, 7); c.fill(); } c.globalAlpha = 1; c.strokeStyle = '#d8b860'; c.lineWidth = 7; for (let k = 1; k < 5; k++) { c.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; const rr = k * w * 0.11 + Math.sin(a * 12) * 6; c.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); } c.stroke(); } M.EMBLEM.royal(c, w, h, '#e8d070'); }, rough: 0.35 }), rimM: gold(0.25), bossM: gold(0.2), gems: [[Math.PI / 2, 0.82, 0x6ad8ff, 1.1], [Math.PI * 7 / 6, 0.82, 0x6ad8ff, 1.1], [-Math.PI / 6, 0.82, 0x6ad8ff, 1.1], [0, 0, 0x6ad8ff, 1.6]], glow: 1.2, boss: false })),
    'ecu-de-l-ost': sh(() => M.kiteShield({ field: '#8a1a14', emblem: 'pale', emblemColor: '#d8b453', wear: 0.3, rimMetal: true }), { pose: [-10, 28, 0] }),
    'bouclier-d-aldoria': sh(() => { const g = heater({ W: 0.64, H: 0.78, field: '#1c2a5a', emblem: 'royal', emblemColor: '#ecd070', emblemScale: 1.15, wear: 0.08, rimM: gold(0.18), rimR: 0.016, rivets: 0 }); for (const [x, y, c] of [[0, 0.33, 0xd01030], [-0.26, 0.33, 0x3a7aff], [0.26, 0.33, 0x3a7aff]]) { const ge = mesh(new THREE.SphereGeometry(0.02, 20, 14), gem(c, 0.9)); ge.scale.z = 0.55; ge.position.set(x, y, g.userData.surf(x, y) + 0.01); g.add(ge); } return g; }),

    // ----------------------------------------------------------- tête
    'chapel-de-fer': hm(() => kettleHat({})),
    'casque-a-turban': hm(() => turbanHelm({})),
    'casque-du-nord': hm(() => northHelm({})),
    'casque-de-sergent': hm(() => sergeantHelm({})),
    'casque-a-aventail': hm(() => conicalAventail({}), { view: [0, 0.3, 1] }),
    'heaume-cylindrique': hm(() => greatHelm({ m: helmSteel(0xa8aaae, 0.35), top: 'flat', breaths: false }), { pose: [6, 20, 0], view: [0, 0.3, 1] }),
    'casque-a-masque': hm(() => maskHelm({ m: helmSteel(0x7a7c80, 0.4), maskM: steel(0xd4d6da, 0.12), brassy: brass(0.3) }), { pose: [4, 16, 0], view: [0, 0.22, 1] }),
    'camail-double': hm(doubleCoif, { pose: [5, 30, 0], view: [0, 0.3, 1] }),
    'casque-de-l-emir': hm(() => turbanHelm({ m: helmSteel(0xd0d0d4, 0.18), clothC: '#e8e0c8', trim: gold(), plume: 0x3f8f5a, arabesque: true })),
    'casque-du-jarl': hm(() => northHelm({ m: helmSteel(0x6a6e78, 0.3), trim: silver(0.2), crest: 0x141414, paint: new THREE.MeshPhysicalMaterial({ color: C(FC.givre), roughness: 0.35, clearcoat: 0.8 }) })),
    'heaume-du-commandeur': hm(() => greatHelm({ m: helmSteel(0xe0e0e2, 0.15), top: 'flat', trim: aubeM(), crown: gold(), crest: 'laurel' }), { pose: [10, 20, 0], view: [0, 0.4, 1] }),
    'casque-de-guet': hm(() => sallet({})),
    bassinet: hm(() => bascinet({}), { pose: [6, 55, 0], view: [0, 0.3, 1] }),
    'heaume-a-cimier': hm(() => greatHelm({ m: helmSteel(0xc4c6ca, 0.2), top: 'sugar', trim: steel(0xa8aaae, 0.3), crest: 'fan', mantling: 0xb02a20 }), { pose: [6, 30, 0], view: [0, 0.3, 1] }),
    'casque-de-veteran': hm(dentedNasal),
    'couronne-de-fer': hm(() => crownHelm({}), { pose: [8, 25, 0] }),
    'grand-heaume': hm(() => greatHelm({ m: helmSteel(0xc8cacd, 0.2), top: 'sugar', trim: brass(0.35) }), { pose: [6, 20, 0], view: [0, 0.3, 1] }),
    'heaume-d-aldoria': hm(() => greatHelm({ m: silver(0.1), top: 'sugar', trim: gold(0.16), crown: gold(0.14), star: gold(0.15), gemC: 0x3a7aff, glow: 1.1, mantling: 0x1c2a6a }), { pose: [6, 22, 0], view: [0, 0.3, 1] }),

    // ----------------------------------------------------------- corps
    'jaque-de-cuir': bd(() => { const g = M.garment({ mat: (() => { const m = MAT.leather({ color: 0x6a4428, rep: [3, 3] }); m.normalMap = tex('quilt_n', [3, 4]); m.normalScale = new THREE.Vector2(1.0, 1.0); return m; })(), length: 0.72, sleeve: 0.48, flare: 0.5, wrinkle: 0.02 }); for (let i = 0; i < 7; i++) { const l = mesh(new THREE.CapsuleGeometry(0.003, 0.045, 3, 6), leather(0x2a1a10)); l.rotation.z = Math.PI / 2 + (i % 2 ? 0.5 : -0.5); l.position.set(0, -0.03 - i * 0.055, 0.13); g.add(l); } const belt = mesh(new THREE.TorusGeometry(0.175, 0.016, 6, 40), leather(0x2a1a10)); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.72, 1); belt.position.y = -0.46; g.add(belt); return g; }),
    lamellaire: bd(() => { const g = M.garment({ mat: lamellarMat({ plate: '#c4bca8', lace: FC.sables }), sleeveMat: M.mailMat(0xb0b0ae, [10, 6]), length: 0.78, sleeve: 0.42, flare: 0.5, wrinkle: 0.0 }); return g; }),
    'broigne-a-ecailles': bd(() => M.garment({ mat: scaleMat({ color: '#8a8884' }), sleeveMat: leather(0x4a3020, [2, 2]), length: 0.85, sleeve: 0.38, flare: 0.6, wrinkle: 0.01 })),
    'cotte-des-clans': bd(() => { const g = M.garment({ mat: M.mailMat(0x9a9a98, [12, 12]), length: 0.95, sleeve: 0.5, flare: 0.7, wrinkle: 0.02 }); g.add(mantle({ mat: MAT.fur({ color: 0x7a5a3a, rep: [3, 3] }), r: 0.25, len: 0.6, span: 1.75, flare: 0.45 })); const b = mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 40), leather(0x2a1a10)); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.72, 1); b.position.y = -0.46; g.add(b); const sw = mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 40), new THREE.MeshPhysicalMaterial({ color: C(FC.givre), roughness: 0.6 })); sw.rotation.x = Math.PI / 2; sw.scale.set(1, 0.72, 1); sw.position.y = -0.43; g.add(sw); return g; }),
    'haubert-blasonne': bd(() => { const g = M.garment({ mat: M.mailMat(0xc0c0be, [12, 14]), length: 1.05, sleeve: 0.56, flare: 0.85, wrinkle: 0.02 }); g.add(vest({ mat: clothPainted('#ece6d4', chestEmblem('sun', '#b07a14', { u: 0.25, v: 0.3, s: 0.5 })), length: 0.95, flare: 0.75, inflate: 1.07 })); return g; }),
    'cotte-de-plates': bd(() => { const g = M.garment({ mat: M.mailMat(0xb8b8b6, [12, 12]), length: 0.92, sleeve: 0.52, flare: 0.7, wrinkle: 0.015 }); g.add(vest({ mat: rivetCloth('#7a2a1e', '#d8b060'), length: 0.62, flare: 0.3, inflate: 1.08, wrinkle: 0.005 })); return g; }),
    'haubert-double': bd(() => { const g = M.garment({ mat: M.mailMat(0xa8a8a6, [13, 15]), length: 1.1, sleeve: 0.56, flare: 0.85, wrinkle: 0.02 }); g.add(mantle({ mat: M.mailMat(0x9a9a98, [14, 6]), r: 0.24, len: 0.34, span: 2.0, collar: true, flare: 0.25 })); return g; }),
    kazaghand: bd(() => { const g = M.garment({ mat: clothPainted(FC.sables, (c, w, h) => { c.strokeStyle = '#d8b453'; c.lineWidth = 6; for (const y of [0.08, 0.5, 0.92]) { c.beginPath(); for (let x = 0; x <= w; x += 16) c.lineTo(x, h * y + Math.sin(x / 16) * 8); c.stroke(); } for (let i = 0; i < 12; i++) { c.save(); c.translate(i * w / 12, h * 0.3); M.EMBLEM.star(c, w / 12, w / 12, '#d8b453'); c.restore(); } }, { quilt: true }), length: 0.95, sleeve: 0.52, flare: 0.75, wrinkle: 0.03 }); const hem = M.garment({ mat: M.mailMat(0xc8c8c6, [12, 3]), length: 1.0, sleeve: 0.56, flare: 0.75, wrinkle: 0 }); hem.scale.set(0.97, 1, 0.97); g.add(hem); return g; }),
    'manteau-de-loup': bd(() => { const g = M.garment({ mat: M.mailMat(0xb8b8b6, [12, 14]), length: 1.0, sleeve: 0.52, flare: 0.8, wrinkle: 0.02 }); g.add(vest({ mat: cloth(0x2a3a5a, [4, 4]), length: 0.9, flare: 0.7, inflate: 1.05 })); g.add(mantle({ mat: MAT.fur({ color: 0xe8e6e0, rep: [3, 3] }), r: 0.26, len: 0.85, span: 1.75, flare: 0.55 })); return g; }),
    'surcot-de-l-ordre': bd(() => { const g = M.garment({ mat: M.mailMat(0xd0d0ce, [16, 18]), length: 1.1, sleeve: 0.56, flare: 0.85, wrinkle: 0.02 }); g.add(vest({ mat: clothPainted('#f2eee2', (c, w, h) => { c.fillStyle = FC.aube; c.fillRect(0, h * 0.96, w, h * 0.04); c.fillRect(0, 0, w, h * 0.02); c.fillRect(w * 0.235, h * 0.42, w * 0.03, h); chestEmblem('sun', '#b07a14', { u: 0.25, v: 0.28, s: 0.5 })(c, w, h); }), length: 1.04, flare: 0.8, inflate: 1.07 })); const b = mesh(new THREE.TorusGeometry(0.185, 0.012, 6, 40), gold()); b.rotation.x = Math.PI / 2; b.scale.set(1.06, 0.74, 1); b.position.y = -0.46; g.add(b); return g; }),
    brigandine: bd(() => { const g = M.garment({ mat: M.mailMat(0xb8b8b6, [12, 12]), length: 0.8, sleeve: 0.55, flare: 0.6, wrinkle: 0.015 }); g.add(vest({ mat: rivetCloth('#2a2a5a', '#e0c070', { velvet: true, rows: 10, cols: 26 }), length: 0.7, flare: 0.45, inflate: 1.09, wrinkle: 0.006 })); return g; }),
    'lamellaire-lourde': bd(() => { const lm = lamellarMat({ plate: '#d8dade', lace: '#6a2a20', rows: 18, cols: 44, rough: 0.22 }); const g = M.garment({ mat: lm, sleeveMat: lm, length: 1.0, sleeve: 0.45, flare: 0.6, wrinkle: 0.0, sleeveFlare: 0.02 }); pauldrons(g, lamellarMat({ plate: '#d8dade', lace: '#6a2a20', rows: 6, cols: 20, rough: 0.22 }), { lames: 1, s: 1.15 }); return g; }),
    'haubert-de-maitre': bd(() => { const g = M.garment({ mat: M.mailMat(0xf4f4f2, [18, 20]), length: 1.1, sleeve: 0.58, flare: 0.85, wrinkle: 0.02 }); const br = brass(0.22);
      const tg = M.torsoGeo({ length: 1.1, flare: 0.85 }); const hemG = M.torsoGeo({ length: 1.1, flare: 0.85 });
      // bordures de laiton : ourlet, encolure et poignets
      g.add(vest({ mat: br, length: 1.1, flare: 0.85, inflate: 1.012, wrinkle: 0 })); g.children[g.children.length - 1].geometry = (() => { const gg = hemG; const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > -1.0) { const k = 0.0; p.setXYZ(i, p.getX(i) * k, -1.0, p.getZ(i) * k); } else { p.setXYZ(i, p.getX(i) * 1.02, y, p.getZ(i) * 1.02); } } gg.computeVertexNormals(); return gg; })();
      void tg;
      for (const s of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(0.06, 0.062, 0.05, 24, 1, true), br); const a = G(); a.position.set(s * 0.17, -0.02, 0); a.rotation.z = s * deg(22); c.position.y = -0.56; a.add(c); g.add(a); }
      const nk = mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 40), br); nk.rotation.x = Math.PI / 2; nk.scale.set(1, 0.6, 1); nk.position.y = 0.04; g.add(nk);
      const belt = mesh(new THREE.TorusGeometry(0.178, 0.016, 6, 40), leather(0x3a1a10)); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.72, 1); belt.position.y = -0.46; g.add(belt);
      const bk = mesh(new THREE.BoxGeometry(0.04, 0.035, 0.01), br); bk.position.set(0, -0.46, 0.13); g.add(bk);
      return g; }),
    'haubert-de-bataille': bd(() => { const g = M.garment({ mat: M.mailMat(0xa8a8a6, [12, 14]), length: 1.05, sleeve: 0.56, flare: 0.85, wrinkle: 0.02 }); pauldrons(g, steel(0xb0b2b6, 0.25), { lames: 3, s: 1.35, trim: brass(0.3) }); const b = mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 40), leather(0x2a1a10)); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.72, 1); b.position.y = -0.46; g.add(b); return g; }),
    'cotte-des-rois': bd(() => plateArmor({ m: gold(0.18), trim: silver(0.1), cloth: M.mailMat(0xe8eaee, [14, 14]), gemC: 0xd01030, glow: 0.9, star: silver(0.1) })),
    'armure-de-plates': bd(() => plateArmor({ m: steel(0xc4c6ca, 0.16), cloth: cloth(0x5a2a20, [4, 4]) })),
    'armure-d-aldoria': bd(() => plateArmor({ m: silver(0.08), trim: gold(0.16), cloth: cloth(0x1c2a6a, [4, 4], { sheen: 1 }), gemC: 0x3a7aff, glow: 1.1, star: gold(0.15) })),

    // ----------------------------------------------------------- pieds
    'sandales-de-marche': ft(() => pairX(sandal, { dx: 0.075, z: 0.04 }), { pose: [25, 30, 0], view: [0, 0.6, 1] }),
    'bottes-fourrees': ft(() => pairX(() => bootX({ mat: leather(0x6a6058, [2, 2]), height: 0.26, fur: MAT.fur({ color: 0xd8d0c0, rep: [3, 2] }), straps: [0.12], strapM: leather(0x2a3a5a) }))),
    'guetres-de-cuir': ft(() => pairX(() => legGuard({ mat: leather(0x6a4428, [2, 3]), h: 0.32, laces: leather(0x2a1a10), straps: [0.07, 0.38] }), { dx: 0.075 }), legV),
    'bottes-a-eperons': ft(() => pairX(() => bootX({ mat: leather(0x3a2214, [2, 3]), height: 0.38, cuff: leather(0x3a2214), straps: [0.075], buckle: gold(), spur: gold(0.18) })), { pose: [8, 68, 0], view: [0, 0.3, 1] }),
    'bottes-renforcees': ft(() => pairX(() => bootX({ mat: leather(0x4a2c1a, [2, 2]), height: 0.3, bands: iron(0x7a7874, 0.45), toeCap: iron(0x7a7874, 0.45), straps: [0.075] })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    'jambieres-de-fer': ft(() => pairX(() => legGuard({ mat: iron(0x8a8884, 0.45), h: 0.34, front: true, ridge: true, straps: [0.1, 0.36], knee: iron(0x8a8884, 0.45) }), { dx: 0.075 }), legV),
    'bottes-du-coureur': ft(() => pairX(() => bootX({ mat: leather(0x2f6a44, [2, 3]), height: 0.3, pointy: 0.07, cuff: gold(), cuffR: 0.008, straps: [0.075], strapM: gold() })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    'bottes-du-traqueur': ft(() => pairX(() => bootX({ mat: MAT.fur({ color: 0x8a7a68, rep: [2, 3] }), height: 0.32, straps: [0.075, 0.15, 0.22, 0.29], strapM: leather(0x2a3a5a), cuff: MAT.fur({ color: 0xe0dcd4 }), cuffR: 0.02, buckle: silver() })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    solerets: ft(() => pairX(() => legGuard({ mat: steel(0xb8babe, 0.25), h: 0.12, sabaton: steel(0xc0c2c6, 0.22), trim: brass() }), { dx: 0.075 }), { pose: [15, 32, 0], view: [0, 0.45, 1] }),
    'chausses-doublees': ft(() => { const g = M.legsGeo({ mat: M.mailMat(0xb0b0ae, [5, 12]), footMat: M.mailMat(0xb0b0ae, [4, 4]), len: 0.85 }); for (const s of [-1, 1]) { const q = mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 24), cloth(0x8a7450, [3, 3], { quilt: true })); q.position.set(s * 0.1, -0.15, 0); g.add(q); const k = mesh(new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), leather(0x4a2c1a)); k.rotation.x = Math.PI / 2; k.position.set(s * 0.1, -0.47, 0.04); g.add(k); } return g; }, { pose: [5, 25, 0], view: [0, 0.2, 1] }),
    'greves-d-acier': ft(() => pairX(() => legGuard({ mat: steel(0x9ea2a8, 0.28), h: 0.36, knee: steel(0xc0c2c6, 0.18), sabaton: steel(0xb8babe, 0.2) }), { dx: 0.075 }), { pose: [8, 32, 0], view: [0, 0.3, 1] }),
    'bottes-du-pelerin': ft(() => pairX((i) => bootX({ mat: leather(0x3a4a2c, [2, 3]), height: 0.34, cuff: leather(0x2a3a20), straps: [0.075, 0.2, 0.3], strapM: leather(0x5a3a20), buckle: brass(0.25), toeCap: brass(0.3) })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    'bottes-de-campagne': ft(() => pairX(() => bootX({ mat: leather(0x5a3418, [2, 3]), height: 0.32, cuff: leather(0x4a2a14), cuffR: 0.016, straps: [0.075, 0.24], buckle: iron(0x9a9894, 0.35) })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    'bottes-de-l-errant': ft(() => pairX(() => { const b = bootX({ mat: leather(0x2a1e3e, [2, 3]), height: 0.4, cuff: silver(0.12), cuffR: 0.008, straps: [0.075, 0.2, 0.32], strapM: leather(0x1a1424), buckle: gold(), spur: silver(0.1) }); const s = pommel('star', silver(0.1), 0.6, 0x7ab0ff, 1.0); s.position.set(0, 0.26, 0.062); b.add(s); return b; }), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
    'greves-de-maitre': ft(() => pairX(() => legGuard({ mat: steel(0xd8dade, 0.1), h: 0.36, knee: steel(0xd8dade, 0.1), sabaton: steel(0xd8dade, 0.1), trim: brass(0.2), ridge: true }), { dx: 0.075 }), { pose: [8, 32, 0], view: [0, 0.3, 1] }),
    'solerets-d-aldoria': ft(() => pairX(() => { const g = legGuard({ mat: silver(0.08), h: 0.3, knee: gold(0.15), sabaton: silver(0.08), trim: gold(0.15), ridge: true }); const s = pommel('star', gold(0.15), 0.5, 0x3a7aff, 1.0); s.position.set(0, 0.2, 0.062); g.add(s); return g; }, { dx: 0.075 }), { pose: [8, 32, 0], view: [0, 0.3, 1] }),

    // ----------------------------------------------------------- bagues
    'anneau-de-fer': rg({ metal: 'iron', band: { r: 0.0105, w: 0.0022, t: 0.0022, twist: 3 }, top: ironNail }),
    'anneau-d-os': rg({ metal: 'bone', band: { r: 0.0105, w: 0.0045, t: 0.0034, flat: true }, engrave: 14 }),
    'anneau-de-cornaline': rg({ metal: 'gold', band: { r: 0.0105, w: 0.003, t: 0.0024 }, stone: true, stoneC: 0xa82410, cut: 'cab', stoneR: 0.0068, prongs: 0, top: (m) => { const g = G(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const b = mesh(new THREE.SphereGeometry(0.0012, 8, 6), enamel(FC.sables)); b.position.set(Math.cos(a) * 0.0078, 0.0028, Math.sin(a) * 0.0078); g.add(b); } return g; } }),
    'anneau-solaire': rg({ metal: 'gold', band: { r: 0.0105, w: 0.0028, t: 0.0024 }, top: sunTop }, { pose: [-10, 20, 0], view: [0, 1.1, 1] }),
    'anneau-de-jade': rg({ metal: 'jade', band: { r: 0.0105, w: 0.0045, t: 0.004 } }),
    'anneau-du-veteran': rg({ metal: 'bronze', band: { r: 0.0105, w: 0.0045, t: 0.003, flat: true }, studs: 10 }),
    'anneau-d-ambre': rg({ metal: 'silver', band: { r: 0.0105, w: 0.003, t: 0.0026 }, stone: true, stoneC: 0xa84a06, cut: 'cab', stoneR: 0.0085, prongs: 6, glow: 0.35 }),
    'anneau-de-rubis': rg({ metal: 'gold', band: { r: 0.0105, w: 0.003, t: 0.0026 }, stone: true, stoneC: 0x8a0010, cut: 'facet', stoneR: 0.0072, prongs: 4 }),
    'sceau-du-capitaine': rg({ metal: 'silver', band: { r: 0.0105, w: 0.0036, t: 0.003 }, top: sigTop('tower') }, { pose: [-10, 20, 0], view: [0, 1.1, 1] }),
    'anneau-d-emeraude': rg({ metal: 'gold', band: { r: 0.0105, w: 0.003, t: 0.0026 }, stone: true, stoneC: 0x0a8a40, cut: 'step', stoneR: 0.0068, prongs: 0 }),
    'anneau-du-loup': rg({ metal: 'silver', band: { r: 0.0105, w: 0.0026, t: 0.0026, twist: 5 }, top: wolfTop }, { pose: [-10, 20, 0], view: [0, 1.1, 1] }),
    'anneau-du-chancelier': rg({ metal: 'gold', band: { r: 0.0105, w: 0.0042, t: 0.0034 }, stone: true, stoneC: 0x5a1a8a, cut: 'cab', stoneR: 0.0092, prongs: 0, top: (m) => { const t = mesh(new THREE.TorusGeometry(0.0098, 0.0014, 8, 32), m); t.rotation.x = Math.PI / 2; t.position.y = 0.001; const g = G(); g.add(t); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const b = mesh(new THREE.SphereGeometry(0.0011, 8, 6), m); b.position.set(Math.cos(a) * 0.0112, 0.001, Math.sin(a) * 0.0112); g.add(b); } return g; } }),
    'anneau-de-l-aigle': rg({ metal: 'gold', band: { r: 0.0105, w: 0.003, t: 0.0026 }, top: eagleTop }, { pose: [-15, 25, 0], view: [0, 0.8, 1] }),
    'anneau-des-ruines': rg({ metal: 'oldgold', band: { r: 0.0105, w: 0.0036, t: 0.003, twist: 4 }, stone: true, stoneC: 0x18a8d0, cut: 'cab', stoneR: 0.0078, glow: 1.4, prongs: 0, engrave: 7 }),
    'anneau-de-diamant': rg({ metal: 'pale', band: { r: 0.0105, w: 0.0024, t: 0.0022 }, stone: true, stoneC: 0xf0f4ff, cut: 'brilliant', stoneR: 0.0068, prongs: 6 }),
    'anneau-d-aldoria': rg({ metal: 'gold', band: { r: 0.0105, w: 0.0036, t: 0.003, twist: 0 }, top: (m) => starTop(m, 0x3a7aff, 1.2), studs: 0 }, { pose: [-10, 20, 0], view: [0, 1.1, 1] }),
  };
}
