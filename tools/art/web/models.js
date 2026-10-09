// Modèles procéduraux : armes, boucliers, casques, armures, bijoux.
import { THREE, MAT, sweep, loft, lathe, mesh, displace, tubeAlong, radialSurface, canvasTex, img, tex, noise3, fbm, smooth, clamp, lerp, V, deg, rng, ellipse, mergeGeometries } from './lib.js';

const G = () => new THREE.Group();

// ================================================================== lames
/** Lame : y de 0 (garde) à len (pointe). Arêtes vives grâce aux sommets dupliqués. */
export function bladeGeo({ len = 0.78, w0 = 0.052, w1 = 0.04, tip = 0.14, th = 0.0075, fuller = 0.62, fullerW = 0.36, steps = 90, curve = 0, profile = null } = {}) {
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
    const pts = [
      [w / 2, 0], [w / 2, 0],
      [w * 0.3, h], [w * 0.3, h],
      [fw, h], [fw * 0.6, h * (0.4 + 0.6 * fz)], [0, h * fz], [-fw * 0.6, h * (0.4 + 0.6 * fz)], [-fw, h],
      [-w * 0.3, h], [-w * 0.3, h],
      [-w / 2, 0], [-w / 2, 0],
      [-w * 0.3, -h], [-w * 0.3, -h],
      [-fw, -h], [-fw * 0.6, -h * (0.4 + 0.6 * fz)], [0, -h * fz], [fw * 0.6, -h * (0.4 + 0.6 * fz)], [fw, -h],
      [w * 0.3, -h], [w * 0.3, -h],
    ];
    const off = curve * t * t;
    secs.push({ y, pts: pts.map(([x, z]) => [x + off, z]) });
  }
  // sommets dupliqués -> arêtes vives : on construit non-indexé par paires
  const g = loft(secs, { closed: true, capStart: true });
  return hardEdges(g, secs[0].pts.length + 1, secs.length);
}
function hardEdges(g, cols, rows) {
  // recalcul des normales par face pour les colonnes doublées : approche simple -> non indexé + normales lissées par groupes
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  // lissage longitudinal : on moyenne les normales des sommets coïncidents ayant des normales proches
  const p = ng.attributes.position, n = ng.attributes.normal;
  const map = new Map();
  const key = (i) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), sum = new THREE.Vector3();
  const out = new Float32Array(n.array.length);
  for (const ids of map.values()) {
    for (const i of ids) {
      a.fromBufferAttribute(n, i); sum.set(0, 0, 0);
      for (const j of ids) { tmp.fromBufferAttribute(n, j); if (tmp.dot(a) > 0.82) sum.add(tmp); }
      sum.normalize(); out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z;
    }
  }
  ng.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  ng.setAttribute('uv1', ng.attributes.uv);
  return ng;
}
export function smoothShade(g, angle = 0.82) { return hardEdges(g); }

function bar(len, w, h, taper = 0.7, steps = 24, bend = 0) {
  // barre le long de x, section rectangulaire arrondie, extrémités affinées
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
function grip(len, r0, r1, wraps = 0) {
  const prof = [];
  for (let k = 0; k <= 60; k++) {
    const t = k / 60; let r = lerp(r0, r1, t) * (1 + 0.12 * Math.sin(t * Math.PI));
    if (wraps) r *= 1 + 0.05 * Math.pow(Math.abs(Math.sin(t * wraps * Math.PI)), 0.5);
    prof.push([r, t * len]);
  }
  prof.unshift([0.0001, 0]); prof.push([0.0001, len]);
  return lathe(prof, 32);
}

export function sword({ type = 'normande', scale = 1 } = {}) {
  const g = G();
  const steel = type === 'damas' ? damascusMat() : MAT.polished({ color: 0xd8dade, rough: 0.14, rep: [1, 3] });
  const guardMat = type === 'maitre' ? MAT.gold({ rough: 0.22 }) : type === 'damas' ? MAT.metal({ color: 0xc0b4a0, rough: 0.28 }) : MAT.metal({ color: 0xb4b4b8, rough: 0.3 });
  const len = type === 'maitre' ? 0.84 : type === 'damas' ? 0.8 : 0.78;
  const b = mesh(bladeGeo({ len, w0: type === 'damas' ? 0.045 : 0.052, w1: type === 'damas' ? 0.034 : 0.04, tip: type === 'damas' ? 0.18 : 0.13, fuller: type === 'damas' ? 0.0 : 0.66 }), steel);
  g.add(b);
  // garde
  if (type === 'damas') {
    const q = mesh(bar(0.16, 0.014, 0.02, 0.6, 24, -0.025), guardMat); q.position.y = -0.008; g.add(q);
    const lang = mesh(bladeGeo({ len: 0.05, w0: 0.03, w1: 0.012, tip: 0.02, th: 0.012, fuller: 0 }), guardMat); lang.position.y = -0.004; g.add(lang);
    const b1 = mesh(new THREE.SphereGeometry(0.009, 16, 12), guardMat); b1.position.set(0.08, -0.033, 0); g.add(b1);
    const b2 = b1.clone(); b2.position.x = -0.08; g.add(b2);
  } else {
    const q = mesh(bar(type === 'maitre' ? 0.2 : 0.18, 0.016, 0.022, 0.75, 24, type === 'maitre' ? 0.012 : 0), guardMat); q.position.y = -0.01; g.add(q);
    if (type === 'maitre') {
      for (const s of [-1, 1]) { const k = mesh(new THREE.SphereGeometry(0.013, 20, 14), guardMat); k.position.set(s * 0.1, 0.002, 0); g.add(k); }
      const gem = mesh(new THREE.OctahedronGeometry(0.011, 0), new THREE.MeshPhysicalMaterial({ color: 0x8a0a14, roughness: 0.05, transmission: 0.6, ior: 1.77, thickness: 0.02, envMapIntensity: 2 }));
      gem.position.set(0, -0.01, 0.012); gem.scale.set(1, 1.2, 0.6); g.add(gem);
    }
  }
  // poignée
  const gl = type === 'damas' ? 0.11 : 0.1;
  const gr = mesh(grip(gl, 0.013, 0.012, 14), type === 'maitre' ? MAT.leather({ color: 0x3a1410, rep: [1, 2] }) : MAT.leather({ color: 0x4a2c18, rep: [1, 2] }));
  gr.rotation.x = Math.PI; gr.position.y = -0.02; g.add(gr);
  // pommeau
  let pom;
  if (type === 'normande') { pom = mesh(new THREE.SphereGeometry(1, 40, 24), guardMat); pom.scale.set(0.034, 0.024, 0.017); }
  else if (type === 'maitre') { pom = mesh(new THREE.SphereGeometry(1, 40, 24), guardMat); pom.scale.set(0.033, 0.033, 0.018); }
  else { pom = mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.022, 32), guardMat); }
  pom.position.y = -0.02 - gl - 0.018; g.add(pom);
  if (type === 'maitre') {
    const rim = mesh(new THREE.TorusGeometry(0.026, 0.0035, 12, 48), guardMat); rim.position.copy(pom.position); g.add(rim);
    const gem = mesh(new THREE.SphereGeometry(0.011, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x0a2a90, roughness: 0.05, transmission: 0.5, ior: 1.77, thickness: 0.02, clearcoat: 1 }));
    gem.position.copy(pom.position); gem.position.z += 0.013; gem.scale.z = 0.6; g.add(gem);
    // incrustation dorée dans la gouttière
    const inlay = mesh(new THREE.PlaneGeometry(0.008, 0.22), MAT.gold({ rough: 0.3 })); inlay.position.set(0, 0.16, 0.0021); g.add(inlay);
    const inlay2 = inlay.clone(); inlay2.position.z = -0.0021; inlay2.rotation.y = Math.PI; g.add(inlay2);
  }
  g.scale.setScalar(scale);
  return g;
}
function damascusMat() {
  const t = canvasTex(256, 1024, (c, w, h) => {
    const d = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const wv = fbm(u * 2, v * 4, 0.5, 3) * 1.6 + Math.abs(u - 0.5) * 3;
      const s = Math.sin((v * 60 + wv * 6) ) * 0.5 + 0.5;
      const k = 170 + s * 40 + fbm(u * 40, v * 160, 2, 2) * 12;
      const i = (y * w + x) * 4; d.data[i] = k; d.data[i + 1] = k * 0.98; d.data[i + 2] = k * 0.95; d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshPhysicalMaterial({ color: 0xe0e0e4, metalness: 1, roughness: 0.22, map: t, normalMap: tex('metal_n'), normalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 1.2 });
}

export function dagger() {
  const g = G();
  const steel = MAT.polished({ color: 0xc0c2c6, rough: 0.2 });
  g.add(mesh(bladeGeo({ len: 0.24, w0: 0.036, w1: 0.016, tip: 0.1, th: 0.008, fuller: 0.5, fullerW: 0.2, steps: 50 }), steel));
  const q = mesh(bar(0.085, 0.012, 0.016, 0.8), MAT.metal({ color: 0xa09c96, rough: 0.32 })); q.position.y = -0.006; g.add(q);
  const gr = mesh(grip(0.09, 0.012, 0.011, 0), MAT.wood({ color: 0x6a4428, rep: [1, 1] })); gr.rotation.x = Math.PI; gr.position.y = -0.012; g.add(gr);
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.0128, 0.0018, 8, 24), MAT.leather({ color: 0x3a2214 })); r.rotation.x = Math.PI / 2; r.position.y = -0.03 - i * 0.018; g.add(r); }
  const p = mesh(new THREE.SphereGeometry(0.018, 32, 20), MAT.metal({ color: 0xa09c96, rough: 0.32 })); p.position.y = -0.112; g.add(p);
  return g;
}

export function shaft(len, r0, r1, mat, bend = 0) {
  const secs = [];
  for (let k = 0; k <= 60; k++) { const t = k / 60; const r = lerp(r0, r1, t); const off = bend * Math.sin(t * Math.PI); secs.push({ y: t * len, pts: ellipse(r, r * 0.95, 16).map(([x, z]) => [x + off, z]) }); }
  const gg = loft(secs, { capStart: true, capEnd: true });
  return mesh(gg, mat);
}
export function spear({ len = 2.0 } = {}) {
  const g = G();
  g.add(shaft(len, 0.016, 0.014, MAT.wood({ color: 0x8a6440, rep: [1, 6] })));
  // tête en feuille + douille
  const head = mesh(bladeGeo({ len: 0.24, w0: 0.03, w1: 0.04, tip: 0.18, th: 0.012, fuller: 0, steps: 60, profile: (t, w) => w * (0.35 + 0.65 * smooth(0, 0.35, t)) }), MAT.polished({ color: 0xa8a8aa, rough: 0.25 }));
  head.scale.setScalar(1.4); head.position.y = len + 0.12; g.add(head);
  const sock = mesh(lathe([[0.0001, 0], [0.019, 0], [0.018, 0.04], [0.014, 0.1], [0.008, 0.11], [0.0001, 0.11]], 24), MAT.metal({ color: 0xa0a0a2, rough: 0.36 }));
  sock.scale.setScalar(1.2); sock.position.y = len - 0.01; g.add(sock);
  return g;
}
export function staff() {
  const g = G();
  const wood = MAT.wood({ color: 0x6a4a2a, rep: [1, 8] });
  const s = shaft(1.6, 0.021, 0.019, wood, 0.01);
  displace(s.geometry, (v) => { const k = 1 + 0.06 * fbm(v.y * 6, 0.3, 0.1, 3); return V(v.x * k, v.y, v.z * k); });
  g.add(s);
  const iron = MAT.metal({ color: 0x8a8682, rough: 0.45 });
  for (const [y, h] of [[-0.02, 0.14], [1.48, 0.14]]) {
    const f = mesh(lathe([[0.0001, 0], [0.019, 0.0], [0.024, 0.01], [0.024, h - 0.01], [0.023, h], [0.0001, h]], 32), iron); f.position.y = y; g.add(f);
    for (let i = 0; i < 2; i++) { const r = mesh(new THREE.TorusGeometry(0.025, 0.004, 10, 32), iron); r.rotation.x = Math.PI / 2; r.position.y = y + 0.03 + i * (h - 0.06); g.add(r); }
  }
  // spirale de cuir au milieu
  const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200; const a = t * Math.PI * 2 * 9; pts.push(V(Math.cos(a) * 0.0215, 0.62 + t * 0.32, Math.sin(a) * 0.0215)); }
  g.add(mesh(tubeAlong(pts, 0.004, { segs: 400, radial: 6 }), MAT.leather({ color: 0x3c2414 })));
  return g;
}
export function daneAxe() {
  const g = G();
  g.add(shaft(1.15, 0.018, 0.016, MAT.wood({ color: 0x7a5434, rep: [1, 6] }), 0.012));
  const sh = new THREE.Shape();
  // tête : œil à gauche (x<0), lame en croissant vers +x
  sh.moveTo(-0.025, 0.03); sh.lineTo(0.02, 0.022);
  sh.quadraticCurveTo(0.08, 0.03, 0.135, 0.09);
  sh.quadraticCurveTo(0.17, 0.02, 0.165, -0.06);
  sh.quadraticCurveTo(0.16, -0.12, 0.13, -0.17);
  sh.quadraticCurveTo(0.08, -0.06, 0.02, -0.032);
  sh.lineTo(-0.025, -0.035); sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 40 });
  eg.translate(0, 0, -0.006);
  displace(eg, (v) => { const k = lerp(1.0, 0.18, smooth(0.0, 0.15, v.x)); return V(v.x, v.y, v.z * k); });
  const head = mesh(eg, MAT.metal({ color: 0xbcbcbe, rough: 0.26, rep: [0.5, 0.5] }));
  // tranchant poli
  head.scale.setScalar(1.35); head.position.set(0.0, 1.04, 0); g.add(head);
  const eye = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.075, 24), MAT.metal({ color: 0x9a9a9c, rough: 0.38 })); eye.scale.setScalar(1.3); eye.position.set(0, 1.04, 0); g.add(eye);
  return g;
}
export function mace() {
  const g = G();
  g.add(shaft(0.62, 0.016, 0.015, MAT.wood({ color: 0x5a3a22, rep: [1, 3] })));
  const iron = MAT.metal({ color: 0xb0b0b2, rough: 0.3 });
  const core = mesh(lathe([[0.0001, 0], [0.02, 0], [0.024, 0.04], [0.024, 0.11], [0.016, 0.14], [0.0001, 0.15]], 32), iron); core.position.y = 0.5; g.add(core);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.02, 0.02); fs.quadraticCurveTo(0.05, 0.05, 0.045, 0.09); fs.quadraticCurveTo(0.035, 0.12, 0.0, 0.14); fs.closePath();
  for (let i = 0; i < 7; i++) {
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 16 });
    fg.translate(0, 0, -0.003);
    const f = mesh(fg, iron); f.position.y = 0.505; f.rotation.y = (i / 7) * Math.PI * 2; f.position.x = 0; g.add(f);
  }
  const knob = mesh(new THREE.SphereGeometry(0.016, 20, 14), iron); knob.position.y = 0.66; g.add(knob);
  const grip2 = mesh(grip(0.14, 0.018, 0.018, 18), MAT.leather({ color: 0x3a2214 })); grip2.position.y = 0.02; g.add(grip2);
  const cap = mesh(new THREE.CylinderGeometry(0.021, 0.019, 0.02, 24), iron); cap.position.y = 0.01; g.add(cap);
  return g;
}

// ================================================================== emblèmes (canvas)
export const EMBLEM = {
  sun(c, w, h, color = '#c9962a') {
    const cx = w / 2, cy = h * 0.66, R = w * 0.17;
    c.fillStyle = color; c.strokeStyle = color;
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI; const len = i % 2 ? R * 1.25 : R * 1.9; const wd = i % 2 ? 0.07 : 0.1;
      c.beginPath(); c.moveTo(cx + Math.cos(a - wd) * R * 1.12, cy + Math.sin(a - wd) * R * 1.12); c.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len)); c.lineTo(cx + Math.cos(a + wd) * R * 1.12, cy + Math.sin(a + wd) * R * 1.12); c.fill();
    }
    c.beginPath(); c.arc(cx, cy, R, Math.PI, 0); c.closePath(); c.fill();
    c.fillRect(w * 0.12, cy + h * 0.015, w * 0.76, h * 0.028);
    c.fillRect(w * 0.2, cy + h * 0.06, w * 0.6, h * 0.018);
  },
  star(c, w, h, color = '#c9962a') {
    const cx = w / 2, cy = h * 0.5, R = w * 0.32;
    c.fillStyle = color;
    const sq = (rot) => { c.beginPath(); for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } c.closePath(); c.fill(); };
    sq(Math.PI / 4); sq(0);
    c.globalCompositeOperation = 'destination-out'; c.lineWidth = w * 0.012;
    const sqs = (rot, r) => { c.beginPath(); for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.stroke(); };
    sqs(Math.PI / 4, R * 0.78); sqs(0, R * 0.78);
    c.beginPath(); c.arc(cx, cy, R * 0.3, 0, Math.PI * 2); c.stroke();
    c.globalCompositeOperation = 'source-over';
  },
  raven(c, w, h, color = '#c8ccd2') {
    // corbeau « essorant » : ailes déployées, tête de profil, queue en éventail
    c.save(); c.scale(w / 100, h / 100); c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    const E = (x, y, rx, ry, r) => { c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); c.fill(); };
    E(50, 50, 9, 17, 0);                       // corps
    E(50, 30, 6, 6.5, 0);                      // tête
    c.beginPath(); c.moveTo(45, 27); c.quadraticCurveTo(36, 28, 31, 33); c.quadraticCurveTo(38, 33, 46, 33); c.fill(); // bec
    for (const s of [-1, 1]) {                 // ailes
      c.beginPath(); c.moveTo(50 + s * 6, 40);
      c.quadraticCurveTo(50 + s * 22, 26, 50 + s * 40, 22);
      for (let k = 0; k < 6; k++) { const x = 50 + s * (42 - k * 4.2), y = 26 + k * 6.5; c.lineTo(x, y); c.lineTo(50 + s * (36 - k * 4.4), y + 2.5); }
      c.quadraticCurveTo(50 + s * 14, 58, 50 + s * 6, 54); c.closePath(); c.fill();
    }
    c.beginPath(); c.moveTo(45, 62); c.lineTo(38, 84); c.lineTo(44, 82); c.lineTo(47, 87); c.lineTo(50, 82); c.lineTo(53, 87); c.lineTo(56, 82); c.lineTo(62, 84); c.lineTo(55, 62); c.fill(); // queue
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(46, 64); c.lineTo(41, 74); c.lineTo(36, 74); c.moveTo(41, 74); c.lineTo(39, 78); c.moveTo(54, 64); c.lineTo(59, 74); c.lineTo(64, 74); c.moveTo(59, 74); c.lineTo(61, 78); c.stroke(); // pattes
    c.globalCompositeOperation = 'destination-out'; E(48, 28.5, 1.3, 1.3, 0);
    c.lineWidth = 0.8; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(50 + s * 10, 42); c.quadraticCurveTo(50 + s * 22, 34, 50 + s * 34, 30); c.stroke(); c.beginPath(); c.moveTo(50 + s * 10, 47); c.quadraticCurveTo(50 + s * 20, 42, 50 + s * 28, 42); c.stroke(); }
    c.restore(); c.globalCompositeOperation = 'source-over';
  },
  lion(c, w, h, color = '#c9962a') {
    c.save(); c.scale(w / 100, h / 100); c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    const E = (x, y, rx, ry, r) => { c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); c.fill(); };
    const L = (wd, ...p) => { c.lineWidth = wd; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
    E(54, 58, 13, 24, -0.42);             // corps
    // crinière dentelée
    c.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2; const r = i % 2 ? 11 : 16; c.lineTo(42 + Math.cos(a) * r, 30 + Math.sin(a) * r); } c.fill();
    E(33, 24, 8, 7, 0); E(25, 28, 6, 4, 0.2); // tête, museau
    c.beginPath(); c.moveTo(36, 16); c.lineTo(40, 8); c.lineTo(42, 18); c.fill(); // oreille
    L(7, 44, 40, 30, 44, 18, 36);        // patte avant levée
    L(6.5, 48, 48, 32, 58, 20, 54);      // patte avant
    L(2, 18, 36, 12, 32); L(2, 18, 36, 12, 38); L(2, 20, 54, 14, 50); L(2, 20, 54, 14, 57); // griffes
    L(9, 62, 74, 54, 88, 42, 92);        // patte arrière
    L(8, 66, 76, 72, 90, 66, 98);
    L(2, 42, 92, 36, 90); L(2, 42, 92, 36, 96); L(2, 66, 98, 60, 100); L(2, 66, 98, 70, 101);
    c.lineWidth = 3.5; c.beginPath(); c.moveTo(66, 72); c.bezierCurveTo(90, 72, 84, 40, 80, 30); c.stroke(); // queue
    c.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2; const r = i % 2 ? 3 : 6; c.lineTo(80 + Math.cos(a) * r, 26 + Math.sin(a) * r); } c.fill();
    c.fillStyle = '#7a1010'; c.beginPath(); c.moveTo(21, 30); c.lineTo(14, 33); c.lineTo(21, 32); c.fill(); // langue
    c.globalCompositeOperation = 'destination-out'; E(31, 22, 1.5, 1.5, 0);
    c.restore(); c.globalCompositeOperation = 'source-over';
  },
};

/** Texture peinte et usée : base (bois/cuir), champ coloré, emblème, écaillage, crasse. */
export function paintedTex({ field = '#e8e2d0', emblem = null, emblemColor, base = 'wood', size = 1024, wear = 0.6, boards = 0, edge = null, aspect = 1, emblemScale = 1, emblemY = 0 } = {}) {
  return canvasTex(size, size, (c, w, h) => {
    // support
    if (base === 'wood') {
      const wi = img('wood_c'); c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 2); c.drawImage(wi, -w / 2, -h / 2, w, h); c.restore();
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#8a6040'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
      if (boards) { c.strokeStyle = 'rgba(20,10,5,0.8)'; c.lineWidth = 3; for (let i = 1; i < boards; i++) { c.beginPath(); c.moveTo(i * w / boards, 0); c.lineTo(i * w / boards, h); c.stroke(); } }
    } else {
      const li = img('leather_c'); c.drawImage(li, 0, 0, w, h);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#9a6a40'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
    }
    // peinture
    const p = document.createElement('canvas'); p.width = w; p.height = h; const pc = p.getContext('2d');
    pc.fillStyle = field; pc.fillRect(0, 0, w, h);
    // variations de pinceau
    for (let i = 0; i < 400; i++) { pc.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.03})`; pc.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 200, 3 + Math.random() * 10); }
    if (emblem) {
      pc.save(); pc.translate(w / 2, h / 2 + emblemY * h); pc.scale(emblemScale, emblemScale * aspect); pc.translate(-w / 2, -h / 2);
      EMBLEM[emblem](pc, w, h, emblemColor); pc.restore();
    }
    if (edge) { pc.strokeStyle = edge; pc.lineWidth = w * 0.03; pc.stroke(new Path2D(`M0 0 H${w} V${h} H0 Z`)); }
    // écaillage : masque chip.png -> alpha
    const ch = img('chip'); const m = document.createElement('canvas'); m.width = w; m.height = h; const mc = m.getContext('2d');
    mc.drawImage(ch, 0, 0, w, h); const md = mc.getImageData(0, 0, w, h); const pd = pc.getImageData(0, 0, w, h);
    for (let i = 0; i < md.data.length; i += 4) {
      const x = (i / 4) % w, y = Math.floor(i / 4 / w);
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2; const rim = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const k = md.data[i] / 255; const thr = 1 - wear * (0.35 + 0.65 * Math.pow(rim, 3));
      pd.data[i + 3] = k > thr ? 0 : 255;
    }
    pc.putImageData(pd, 0, 0);
    c.drawImage(p, 0, 0);
    // crasse
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.drawImage(img('grime'), 0, 0, w, h);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  });
}

// ================================================================== boucliers
export function kiteShield({ field = '#d8d2c0', emblem = null, emblemColor, wear = 0.55, rimMetal = false, boss = true } = {}) {
  const g = G();
  const H = 1.0, W = 0.56;
  // contour : en polaire depuis (0, 0.12)
  const outline = (a) => {
    const dx = Math.cos(a), dy = Math.sin(a);
    // bord supérieur arrondi, côtés convexes, pointe en bas
    let best = 0;
    for (let r = 0.01; r < 1.2; r += 0.004) {
      const x = dx * r, y = 0.12 + dy * r;
      if (!inside(x, y)) break; best = r;
    }
    return best;
  };
  function inside(x, y) {
    if (y > 0.44 + 0.06 * (1 - Math.pow(x / (W / 2), 2))) return false; // haut légèrement bombé
    if (y < -0.5) return false;
    const t = (0.5 - y) / 1.0; // 0 en haut, 1 en bas
    const hw = (W / 2) * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 0.75) * (t < 0.15 ? 1 : 1);
    return Math.abs(x) <= hw;
  }
  const surf = (x, y) => { const R = 0.42; return Math.sqrt(Math.max(R * R - x * x, 0)) - R + 0.02 * (1 - Math.pow(y - 0.1, 2)); };
  const s = radialSurface(outline, surf, { cy: 0.12, thick: 0.018, W, H, rings: 50, segs: 240 });
  const t = paintedTex({ field, emblem, emblemColor, base: 'wood', wear, boards: 0, aspect: W / H, emblemScale: 0.95, emblemY: -0.1 });
  const paint = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.62, normalMap: tex('wood_n', [1, 1]), normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.1, clearcoatRoughness: 0.6 });
  const front = mesh(s.front, paint); g.add(front);
  g.add(mesh(s.back, MAT.leather({ color: 0x4a3020, rep: [2, 3] })));
  g.add(mesh(s.rim, MAT.leather({ color: 0x3a2214, rep: [6, 1] })));
  // bordure (cuir ou fer)
  g.add(mesh(tubeAlong(s.outlinePts, 0.012, { closed: true, segs: 300, radial: 10 }), rimMetal ? MAT.metal({ color: 0x8a8682, rough: 0.45 }) : MAT.leather({ color: 0x3a2416, rep: [12, 1] })));
  if (boss) {
    const b = mesh(lathe([[0.0001, 0.05], [0.03, 0.045], [0.05, 0.03], [0.062, 0.008], [0.075, 0.0], [0.0001, 0.0]].reverse(), 48), MAT.metal({ color: 0x9a948c, rough: 0.42 }));
    b.rotation.x = Math.PI / 2; b.position.set(0, 0.2, surf(0, 0.2) - 0.004); b.scale.set(0.85, 0.85, 0.85); g.add(b);
  }
  // rivets
  const riv = MAT.metal({ color: 0xa8a29a, rough: 0.35 });
  for (let i = 0; i < 18; i++) { const p = s.outlinePts[Math.floor(i / 18 * s.outlinePts.length)]; const d = p.clone().sub(V(0, 0.12, p.z)).multiplyScalar(0.94).add(V(0, 0.12, 0)); const r = mesh(new THREE.SphereGeometry(0.008, 12, 8), riv); r.position.set(d.x, d.y, surf(d.x, d.y) + 0.002); r.scale.z = 0.5; g.add(r); }
  return g;
}
export function roundShield({ field = '#7a2a20', emblem = null, emblemColor, wear = 0.7, rimMetal = false, R = 0.42, boards = 6, base = 'wood', rimColor = 0x3a2416 } = {}) {
  const g = G();
  const outline = () => R;
  const surf = (x, y) => 0.03 * (1 - (x * x + y * y) / (R * R));
  const s = radialSurface(outline, surf, { thick: 0.012, W: R * 2, H: R * 2, rings: 30, segs: 160 });
  const t = paintedTex({ field, emblem, emblemColor, base, wear, boards, emblemScale: 0.82 });
  const paint = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.62, normalMap: tex(base === 'wood' ? 'wood_n' : 'leather_n', [1, 1], false, [0, 0], Math.PI / 2), normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.08 });
  g.add(mesh(s.front, paint)); g.add(mesh(s.back, MAT.wood({ color: 0x6a4a30 }))); g.add(mesh(s.rim, MAT.wood({ color: 0x5a3a20 })));
  g.add(mesh(tubeAlong(s.outlinePts, rimMetal ? 0.011 : 0.009, { closed: true, segs: 240, radial: 10 }), rimMetal ? MAT.metal({ color: 0x8a8682, rough: 0.45 }) : MAT.leather({ color: rimColor, rep: [16, 1] })));
  const b = mesh(lathe([[0.0001, 0.075], [0.035, 0.07], [0.062, 0.05], [0.075, 0.025], [0.08, 0.008], [0.105, 0.004], [0.105, 0.0], [0.0001, 0]].reverse(), 48), MAT.metal({ color: 0x9a948c, rough: 0.42 }));
  b.rotation.x = Math.PI / 2; b.position.z = 0.025; g.add(b);
  const riv = MAT.metal({ color: 0xa8a29a, rough: 0.35 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = mesh(new THREE.SphereGeometry(0.007, 12, 8), riv); r.position.set(Math.cos(a) * 0.093, Math.sin(a) * 0.093, 0.03); r.scale.z = 0.5; g.add(r); }
  if (rimMetal) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const r = mesh(new THREE.SphereGeometry(0.006, 10, 8), riv); r.position.set(Math.cos(a) * (R - 0.018), Math.sin(a) * (R - 0.018), surf(R - 0.02, 0) + 0.002); r.scale.z = 0.5; g.add(r); }
  return g;
}
export function adarga({ field = '#2f5a34', emblem = null, emblemColor, wear = 0.5, studs = true } = {}) {
  const g = G();
  // cœur à deux lobes (pointe en bas), contour polaire depuis le centre
  const outline = (a) => {
    const dx = Math.cos(a), dy = Math.sin(a); let best = 0;
    for (let r = 0.01; r < 0.8; r += 0.003) { const x = dx * r, y = dy * r; if (heart(x, y)) best = r; }
    return best;
  };
  const HP = []; for (let i = 0; i < 200; i++) { const t = i / 200 * Math.PI * 2; HP.push([16 * Math.pow(Math.sin(t), 3) / 17 * 0.36, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * 0.42 + 0.03]); }
  function heart(x, y) { let c = false; for (let i = 0, j = HP.length - 1; i < HP.length; j = i++) { const [xi, yi] = HP[i], [xj, yj] = HP[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  const surf = (x, y) => 0.06 * (1 - (x * x) / 0.13 - (y * y) / 0.25);
  const s = radialSurface(outline, surf, { thick: 0.014, W: 0.75, H: 0.85, rings: 40, segs: 240 });
  const t = paintedTex({ field, emblem, emblemColor, base: 'leather', wear, aspect: 0.75 / 0.85, emblemScale: 0.8 });
  g.add(mesh(s.front, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.6, normalMap: tex('leather_n', [2, 2]), normalScale: new THREE.Vector2(0.9, 0.9), clearcoat: 0.25, clearcoatRoughness: 0.5 })));
  g.add(mesh(s.back, MAT.leather({ color: 0x6a4a30, rep: [2, 2] }))); g.add(mesh(s.rim, MAT.leather({ color: 0x4a3020 })));
  // coutures du bord
  g.add(mesh(tubeAlong(s.outlinePts, 0.008, { closed: true, segs: 300, radial: 8 }), MAT.leather({ color: 0x3a2214, rep: [20, 1] })));
  const st = MAT.plain(0xd8c8a0, 0.9);
  for (let i = 0; i < 60; i++) { const p = s.outlinePts[Math.floor(i / 60 * s.outlinePts.length)]; const d = p.clone().multiplyScalar(0.93); const k = mesh(new THREE.CapsuleGeometry(0.0025, 0.01, 4, 6), st); k.position.set(d.x, d.y, surf(d.x, d.y) + 0.001); k.rotation.z = Math.atan2(d.y, d.x); g.add(k); }
  // deux petites bosses de métal décoratives
  if (studs) for (const [x, y] of [[-0.12, 0.12], [0.12, 0.12], [0, -0.12]]) { const b = mesh(new THREE.SphereGeometry(0.028, 24, 16), MAT.metal({ color: 0xb09060, rough: 0.3 })); b.position.set(x, y, surf(x, y)); b.scale.z = 0.45; g.add(b); }
  return g;
}

// ================================================================== casques
const steelHelm = (c = 0xb8b9bc, r = 0.3) => MAT.metal({ color: c, rough: r, rep: [1, 1], normal: 0.12 });
export function nasalHelm({ mat = steelHelm(), height = 0.27 } = {}) {
  const g = G();
  const prof = []; for (let k = 0; k <= 40; k++) { const t = k / 40; const r = 0.108 * Math.pow(Math.sin((1 - t) * Math.PI / 2), 0.8) * (1 - 0.06 * t); prof.push([r, t * (height - 0.07)]); }
  prof[prof.length - 1][0] = 0.0001;
  const dome = lathe(prof, 64); dome.scale(1, 1, 1.15);
  displace(dome, (v) => V(v.x, v.y + 0.012 * Math.max(0, 1 - Math.hypot(v.x, v.z) / 0.03), v.z)); // pointe
  g.add(mesh(dome, mat));
  const band = lathe([[0.112, -0.005], [0.114, 0.0], [0.114, 0.032], [0.112, 0.037]], 64); band.scale(1, 1, 1.15);
  g.add(mesh(band, MAT.metal({ color: 0xa8a29c, rough: 0.32, rep: [4, 1] })));
  // nasal
  const nas = loft(Array.from({ length: 20 }, (_, k) => { const t = k / 19; const y = 0.03 - t * 0.11; const w = lerp(0.03, 0.02, t); return { y, pts: [[w / 2, 0.128 + 0.012 * t], [w / 2, 0.136 + 0.012 * t], [-w / 2, 0.136 + 0.012 * t], [-w / 2, 0.128 + 0.012 * t]] }; }), { capStart: true, capEnd: true });
  g.add(mesh(nas, mat));
  const riv = MAT.metal({ color: 0xc0bcb6, rough: 0.3 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const r = mesh(new THREE.SphereGeometry(0.0045, 10, 8), riv); r.position.set(Math.sin(a) * 0.115, 0.017, Math.cos(a) * 0.115 * 1.15); g.add(r); }
  return g;
}
export function spangenhelm({ mat = steelHelm(0xbab6b0), gilt = false } = {}) {
  const g = G();
  const prof = []; for (let k = 0; k <= 40; k++) { const t = k / 40; const r = 0.11 * Math.pow(Math.cos(t * Math.PI / 2), 0.62); prof.push([r, t * 0.2]); }
  prof[prof.length - 1][0] = 0.0001;
  const dome = lathe(prof, 64); dome.scale(1, 1, 1.12);
  g.add(mesh(dome, mat));
  const bandM = gilt ? MAT.gold({ rough: 0.35 }) : MAT.metal({ color: 0x9a8268, rough: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a0 = i / 4 * Math.PI * 2 + Math.PI / 4;
    const pts = prof.slice(0, -1).map(([r, y]) => V(Math.sin(a0) * (r + 0.004), y, Math.cos(a0) * (r + 0.004) * 1.12));
    pts.push(V(0, 0.204, 0));
    const sg = tubeAlong(pts, 0.012, { segs: 60, radial: 4 }); sg.scale(1, 1, 1);
    const m = mesh(sg, bandM); g.add(m);
    for (let k = 0; k < 4; k++) { const p = pts[Math.floor(k * 8 + 4)]; const r = mesh(new THREE.SphereGeometry(0.005, 10, 8), bandM); r.position.copy(p).multiplyScalar(1.03); g.add(r); }
  }
  const band = lathe([[0.113, -0.005], [0.116, 0], [0.116, 0.035], [0.113, 0.04]], 64); band.scale(1, 1, 1.12);
  g.add(mesh(band, bandM));
  const knob = mesh(lathe([[0.0001, 0], [0.018, 0], [0.012, 0.02], [0.006, 0.04], [0.0001, 0.05]], 24), bandM); knob.position.y = 0.195; g.add(knob);
  return g;
}
export function spectacleHelm({ mat = steelHelm(0xb8babd, 0.32) } = {}) {
  const g = G();
  const prof = []; for (let k = 0; k <= 40; k++) { const t = k / 40; const r = 0.11 * Math.pow(Math.cos(t * Math.PI / 2), 0.55); prof.push([r, t * 0.17]); }
  prof[prof.length - 1][0] = 0.0001;
  const dome = lathe(prof, 64); dome.scale(1, 1, 1.12); g.add(mesh(dome, mat));
  const crest = mesh(tubeAlong(prof.map(([r, y]) => V(0, y + 0.004, r * 1.12 + 0.002)).concat(prof.slice().reverse().map(([r, y]) => V(0, y + 0.004, -r * 1.12 - 0.002))), 0.007, { segs: 120, radial: 6 }), mat); g.add(crest);
  const band = lathe([[0.112, -0.005], [0.115, 0], [0.115, 0.03], [0.112, 0.035]], 64); band.scale(1, 1, 1.12); g.add(mesh(band, mat));
  // lunettes : deux orbites + nasal
  const spec = G();
  const sm = MAT.metal({ color: 0xb0b2b6, rough: 0.3 });
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * (i / 40); pts.push(V(s * (0.035 + Math.cos(a) * 0.032 * s), -0.005 - Math.sin(a) * 0.035, 0)); }
    const tg = tubeAlong(pts, 0.008, { segs: 60, radial: 8 }); tg.scale(1, 1, 0.5);
    spec.add(mesh(tg, sm));
  }
  const nasal = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.008), sm); nasal.position.set(0, -0.03, 0.004); spec.add(nasal);
  // plaque de joue/masque
  const mask = loft(Array.from({ length: 12 }, (_, k) => { const t = k / 11; const y = -t * 0.06; const w = 0.15 - t * 0.03; return { y, pts: [[w / 2, 0], [w / 2, 0.006], [-w / 2, 0.006], [-w / 2, 0]] }; }));
  spec.position.set(0, 0.0, 0.124); g.add(spec);
  // bombement : on courbe les lunettes autour de la tête
  spec.children.forEach((c) => displace(c.geometry, (v) => V(v.x, v.y, v.z - (v.x * v.x) * 2.2)));
  return g;
}
export function mailMat(color = 0xc8c8c6, rep = [10, 10]) { return MAT.mail({ color, rep }); }
export function aventail({ r = 0.12, len = 0.14, front = false, mat = mailMat(0xc8c8c6, [12, 3]), minR = null, flare = 0.9 } = {}) {
  // rideau de mailles accroché au bord du casque
  const secs = [];
  const span = front ? Math.PI * 2 : Math.PI * 1.6;
  for (let k = 0; k <= 16; k++) {
    const t = k / 16; const y = -t * len; let rr = r * (1 + flare * t * t); if (minR) rr = Math.max(rr, minR(y));
    const pts = [];
    for (let i = 0; i <= 40; i++) { const a = Math.PI - span / 2 + (i / 40) * span; const wob = 1 + 0.03 * Math.sin(i * 1.7 + k); pts.push([Math.sin(a) * rr * wob, y, Math.cos(a) * rr * 1.12 * wob]); }
    secs.push({ pts });
  }
  const gg = loft(secs.map((s) => ({ pts: s.pts })), { closed: false });
  return mesh(gg, mat);
}
export function coif({ mat = mailMat(0xc8c8c6, [10, 8]) } = {}) {
  const g = G();
  // capuchon : sphère ouverte sur le visage + pèlerine évasée
  const secs = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40; // 0 sommet -> 1 bas de la pèlerine
    let y, r;
    if (t < 0.5) { const a = t / 0.5 * Math.PI * 0.62; y = 0.12 * Math.cos(a); r = 0.118 * Math.sin(a) + 0.002; }
    else { const u = (t - 0.5) / 0.5; y = 0.12 * Math.cos(Math.PI * 0.62) - u * 0.22; r = lerp(0.118 * Math.sin(Math.PI * 0.62), 0.24, Math.pow(u, 1.6)) * (1 - 0.15 * Math.sin(u * Math.PI)); }
    const pts = [];
    const open = smooth(0.18, 0.3, t) * smooth(0.68, 0.55, t); // ouverture du visage
    const halfGap = open * 0.75;
    for (let i = 0; i <= 64; i++) {
      const a = halfGap + (i / 64) * (Math.PI * 2 - 2 * halfGap);
      pts.push([Math.sin(a) * r * (1 + 0.02 * Math.sin(i * 2.3 + k)), y, Math.cos(a) * r * 1.1]);
    }
    secs.push({ pts });
  }
  const gg = loft(secs, { closed: false });
  displace(gg, (v) => { const n = 1 + 0.03 * fbm(v.x * 20, v.y * 20, v.z * 20, 3); return V(v.x * n, v.y, v.z * n); });
  g.add(mesh(gg, mat));
  // bord intérieur en cuir
  return g;
}
export function leatherCap() {
  const g = G();
  const prof = []; for (let k = 0; k <= 30; k++) { const t = k / 30; prof.push([0.112 * Math.pow(Math.cos(t * Math.PI / 2), 0.7), t * 0.15]); }
  prof[prof.length - 1][0] = 0.0001;
  const d = lathe(prof, 64); d.scale(1, 1, 1.12);
  // coutures en quartiers
  displace(d, (v) => { const a = Math.atan2(v.x, v.z); const s = 1 + 0.02 * Math.pow(Math.abs(Math.cos(a * 3)), 12) - 0.006 * (fbm(v.x * 30, v.y * 30, v.z * 30, 2)); return V(v.x * s, v.y, v.z * s); });
  g.add(mesh(d, MAT.leather({ color: 0x6a4428, rep: [2, 2] })));
  const roll = mesh(new THREE.TorusGeometry(0.114, 0.012, 12, 64), MAT.leather({ color: 0x4a2c18, rep: [8, 1] })); roll.rotation.x = Math.PI / 2; roll.scale.set(1, 1.12, 1); roll.position.y = 0.006; g.add(roll);
  const top = mesh(new THREE.SphereGeometry(0.012, 12, 8), MAT.leather({ color: 0x4a2c18 })); top.position.y = 0.15; g.add(top);
  return g;
}

// ================================================================== vêtements / armures (portés par un corps invisible)
/** Tronc : profil (rayon horizontal, y), section ellipse 1 x 0.62 ; jupe fendue optionnelle */
export function torsoGeo({ length = 1.0, sleeve = 0.5, flare = 1.0, split = false, neck = 0.07 } = {}) {
  // y : 0 = épaules (1.45 m), négatif vers le bas
  const secs = [];
  const N = 48;
  for (let k = 0; k <= 50; k++) {
    const t = k / 50; const y = 0.05 - t * length;
    let r;
    if (y > 0) r = lerp(0.19, neck + 0.02, y / 0.05);
    else if (y > -0.45) r = 0.19 - 0.02 * Math.sin((-y / 0.45) * Math.PI) - 0.03 * (-y / 0.45);
    else r = 0.16 + (-(y + 0.45)) * 0.32 * flare;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let rr = r * (1 + (y < -0.45 ? 0.04 * Math.sin(a * 7 + k * 0.1) * smooth(-0.45, -0.8, y) : 0));
      let z = Math.sin(a) * rr * (y > -0.05 ? 0.55 : 0.68), x = Math.cos(a) * rr * (y > -0.05 ? 1.0 : 0.92);
      if (y > -0.02) x *= 1 + 0.6 * smooth(-0.02, 0.05, y) * 0; // épaules
      pts.push([x, z]);
    }
    secs.push({ y, pts });
  }
  return loft(secs, { closed: true });
}
export function armGeo({ len = 0.55, r0 = 0.075, r1 = 0.055, flare = 0 } = {}) {
  const secs = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; let r = lerp(r0, r1, t) + flare * t * t; secs.push({ y: -t * len, pts: ellipse(r, r * 0.9, 24) }); }
  return loft(secs, { closed: true });
}
/** Vêtement complet : tronc + manches, matériau unique ou par partie */
export function garment({ mat, sleeveMat = mat, length = 1.0, sleeve = 0.5, flare = 1.0, sleeveAngle = 22, wrinkle = 0.01, sleeveFlare = 0 }) {
  const g = G();
  const tg = torsoGeo({ length, flare });
  displace(tg, (v) => { const n = fbm(v.x * 8, v.y * 3, v.z * 8, 3) * wrinkle; return V(v.x * (1 + n), v.y, v.z * (1 + n)); });
  g.add(mesh(tg, mat));
  for (const s of [-1, 1]) {
    const ag = armGeo({ len: sleeve, flare: sleeveFlare });
    displace(ag, (v) => { const n = fbm(v.x * 10, v.y * 6, v.z * 10 + s, 3) * wrinkle * 1.5; return V(v.x * (1 + n), v.y, v.z * (1 + n)); });
    const a = mesh(ag, sleeveMat); a.position.set(s * 0.17, -0.02, 0); a.rotation.z = s * deg(sleeveAngle); g.add(a);
    // épaule arrondie
    const sh = mesh(new THREE.SphereGeometry(0.08, 24, 16), sleeveMat); sh.position.set(s * 0.165, -0.025, 0); sh.scale.set(1, 0.9, 0.85); g.add(sh);
  }
  return g;
}
export function legsGeo({ mat, footMat = null, len = 0.9, sep = 0.1, r0 = 0.085, r1 = 0.045 } = {}) {
  const g = G();
  for (const s of [-1, 1]) {
    const secs = [];
    for (let k = 0; k <= 40; k++) { const t = k / 40; let r = lerp(r0, r1, t); r *= 1 + 0.12 * Math.exp(-Math.pow((t - 0.62) / 0.1, 2)) - 0.08 * Math.exp(-Math.pow((t - 0.5) / 0.06, 2)); secs.push({ y: -t * len, pts: ellipse(r, r * 1.05, 28) }); }
    const lg = loft(secs, { closed: true, capStart: true });
    const m = mesh(lg, mat); m.position.x = s * sep; m.rotation.z = s * deg(2); g.add(m);
    if (footMat) { const f = footGeo(footMat); f.position.set(s * (sep + 0.03), -len, 0.0); g.add(f); }
  }
  return g;
}
export function footGeo(mat) {
  const g = G();
  const secs = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; const z = -0.06 + t * 0.26; const w = 0.045 * Math.sin(Math.PI * Math.min(1, (t + 0.08) / 1.02)) + 0.006; const h = 0.07 * (1 - t * 0.6); secs.push({ y: z, pts: ellipse(w, h, 20).map(([x, y]) => [x, y > 0 ? y : y * 0.25]) }); }
  const fg = loft(secs, { capStart: true, capEnd: true });
  fg.rotateX(Math.PI / 2); fg.rotateX(Math.PI);
  const m = mesh(fg, mat); m.position.y = 0.02; g.add(m);
  return g;
}
export function bootGeo(height = 0.2) {
  const path = [V(0, 0.04 + height, -0.01), V(0, 0.1, -0.005), V(0, 0.055, 0.02), V(0, 0.04, 0.09), V(0, 0.035, 0.16), V(0, 0.03, 0.205)];
  const L = path.length;
  const g = sweep(path, (t) => { const k = t * 1; return k < 0.45 ? lerp(0.058, 0.05, k / 0.45) : lerp(0.05, 0.03, smooth(0.45, 1, k)) * (1 + 0.15 * Math.sin(Math.PI * smooth(0.45, 0.9, k))); },
    (t) => t < 0.45 ? lerp(0.062, 0.056, t / 0.45) : lerp(0.056, 0.022, smooth(0.45, 1, t)), { steps: 90, n: 32, capStart: false, capEnd: true });
  displace(g, (v) => { const y = Math.max(v.y, 0.0); const w = 1 + 0.015 * fbm(v.x * 30, v.y * 30, v.z * 30, 3); return V(v.x * w, y, v.z); });
  return g;
}
export function boot({ mat = MAT.leather({ color: 0x4a2c1a, rep: [2, 2] }), height = 0.2, spur = false, cuff = false } = {}) {
  const g = G();
  g.add(mesh(bootGeo(height), mat));
  const sole = mesh(new THREE.CylinderGeometry(1, 1, 0.012, 32), MAT.leather({ color: 0x2a1a10 })); sole.scale.set(0.05, 1, 0.12); sole.position.set(0, 0.006, 0.09); g.add(sole);
  if (cuff) { const c = mesh(new THREE.TorusGeometry(0.06, 0.01, 10, 40), mat); c.rotation.x = Math.PI / 2; c.scale.set(1, 1.08, 1); c.position.set(0, 0.03 + height, -0.01); g.add(c); }
  // lacet / sangle
  const strap = mesh(new THREE.TorusGeometry(0.053, 0.005, 8, 40), MAT.leather({ color: 0x2a1a10 })); strap.rotation.x = Math.PI / 2 - 0.15; strap.scale.set(1, 1.12, 1); strap.position.set(0, 0.1, 0.0); g.add(strap);
  if (spur) {
    const iron = MAT.metal({ color: 0x8a8070, rough: 0.35 });
    const arc = []; for (let i = 0; i <= 30; i++) { const a = -Math.PI * 0.9 + (i / 30) * Math.PI * 1.8; arc.push(V(Math.sin(a) * 0.062, 0.075, -Math.cos(a) * 0.065 - 0.0)); }
    g.add(mesh(tubeAlong(arc, 0.005, { segs: 50, radial: 8 }), iron));
    const prick = mesh(new THREE.ConeGeometry(0.008, 0.05, 12), iron); prick.rotation.x = -Math.PI / 2 - 0.2; prick.position.set(0, 0.07, -0.09); g.add(prick);
  }
  return g;
}

// ================================================================== bijoux
export function ring({ type = 'copper' } = {}) {
  const g = G();
  const mats = {
    copper: new THREE.MeshPhysicalMaterial({ color: 0xd07a4a, metalness: 1, roughness: 0.35, normalMap: tex('metal_n'), normalScale: new THREE.Vector2(0.3, 0.3), map: tex('metal_c', [1, 1], true) }),
    silver: new THREE.MeshPhysicalMaterial({ color: 0xc4c4c8, metalness: 1, roughness: 0.3, normalMap: engraveTex(), normalScale: new THREE.Vector2(1, 1) }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xf0c060, metalness: 1, roughness: 0.18, normalMap: tex('metal_n'), normalScale: new THREE.Vector2(0.12, 0.12) }),
  };
  const m = type === 'copper' ? mats.copper : type === 'silver' ? mats.silver : mats.gold;
  const band = lathe(Array.from({ length: 21 }, (_, k) => { const t = k / 20; const a = t * Math.PI * 2; return [0.0105 + (Math.cos(a) * 0.5 + 0.5) * (type === 'copper' ? 0.0022 : 0.0028), Math.sin(a) * (type === 'silver' ? 0.0042 : 0.0032)]; }), 96);
  band.rotateX(Math.PI / 2);
  // le profil tourné est ici un tore à section ovale
  const bm = mesh(band, m); g.add(bm);
  if (type === 'signet') {
    const top = mesh(new THREE.CylinderGeometry(0.0095, 0.008, 0.006, 48), m); top.position.y = 0.0135; g.add(top);
    const face = mesh(new THREE.CircleGeometry(0.0092, 48), new THREE.MeshPhysicalMaterial({ color: 0xf0c060, metalness: 1, roughness: 0.25, normalMap: signetTex(), normalScale: new THREE.Vector2(1.5, 1.5) }));
    face.rotation.x = -Math.PI / 2; face.position.y = 0.0166; g.add(face);
  }
  if (type === 'sapphire') {
    const cup = mesh(lathe([[0.0001, 0], [0.004, 0], [0.0075, 0.004], [0.0085, 0.007], [0.0001, 0.007]], 32), m); cup.position.y = 0.0115; g.add(cup);
    const gem = mesh(gemGeo(0.0078), new THREE.MeshPhysicalMaterial({ color: 0x1a3aa0, metalness: 0, roughness: 0.02, transmission: 0.75, thickness: 0.01, ior: 1.77, attenuationColor: new THREE.Color(0x0a1a80), attenuationDistance: 0.005, specularIntensity: 1, envMapIntensity: 2.5, clearcoat: 1 }));
    gem.position.y = 0.0185; g.add(gem);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const p = mesh(new THREE.CapsuleGeometry(0.0011, 0.006, 4, 6), m); p.position.set(Math.cos(a) * 0.0075, 0.018, Math.sin(a) * 0.0075); p.rotation.z = -Math.cos(a) * 0.4; p.rotation.x = Math.sin(a) * 0.4; g.add(p); }
  }
  return g;
}
function gemGeo(r) {
  // cabochon taillé à facettes (dôme facetté)
  const prof = [[0.0001, -r * 0.5], [r * 0.6, -r * 0.3], [r, 0], [r * 0.85, r * 0.35], [r * 0.5, r * 0.55], [0.0001, r * 0.62]];
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 12);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}
function engraveTex() {
  return canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = 'rgb(128,128,255)'; c.fillRect(0, 0, w, h);
    // motif d'entrelacs gravé -> carte de normales approchée par traits clairs/sombres
    c.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const x0 = i * w / 16;
      c.strokeStyle = 'rgb(90,128,255)'; c.beginPath(); c.moveTo(x0, h * 0.25); c.bezierCurveTo(x0 + 10, h * 0.9, x0 + 22, h * 0.1, x0 + 32, h * 0.75); c.stroke();
      c.strokeStyle = 'rgb(166,128,255)'; c.beginPath(); c.moveTo(x0 + 2, h * 0.25); c.bezierCurveTo(x0 + 12, h * 0.9, x0 + 24, h * 0.1, x0 + 34, h * 0.75); c.stroke();
    }
    c.strokeStyle = 'rgb(128,90,255)'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h * 0.1); c.lineTo(w, h * 0.1); c.moveTo(0, h * 0.9); c.lineTo(w, h * 0.9); c.stroke();
  }, false);
}
function signetTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = 'rgb(128,128,255)'; c.fillRect(0, 0, w, h);
    const d = document.createElement('canvas'); d.width = w; d.height = h; const dc = d.getContext('2d');
    EMBLEM.sun(dc, w, h, '#fff');
    // relief : décalage clair/sombre
    c.globalAlpha = 0.9; c.filter = 'brightness(0.55) sepia(1) hue-rotate(190deg) saturate(3)';
    c.drawImage(d, -3, -3); c.filter = 'none';
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.strokeStyle = 'rgb(100,100,255)'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h / 2, w * 0.45, 0, 7); c.stroke();
  }, false);
}
