// Personnages des scènes : tête sculptée, barbe et silhouettes complètes (les portraits sont dans portraits.js).
import { THREE, MAT, mesh, displace, loft, lathe, ellipse, sweep, tubeAlong, canvasTex, tex, img, fbm, noise3, smooth, clamp, lerp, V, deg, rng, sun, capture } from './lib.js';
import * as M from './models.js';

const G = () => new THREE.Group();
const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));

// ------------------------------------------------------------------ tête
export function headGeo({ jaw = 1, nose = 1, brow = 1, seed = 0 } = {}) {
  const g = new THREE.SphereGeometry(1, 128, 96);
  displace(g, (v) => {
    const dir = v.clone().normalize();
    let x = dir.x * 0.076, y = dir.y * 0.105, z = dir.z * 0.094;
    // mâchoire plus étroite, crâne arrière plus long
    const low = smooth(0.0, -0.1, y);
    x *= 1 - 0.2 * low * (2 - jaw) * 0.6;
    z *= 1 + 0.12 * smooth(0, -1, dir.z) * smooth(-0.04, 0.06, y);
    if (z > 0) z *= 1 - 0.12 * smooth(0.02, -0.1, y) * smooth(0.04, 0, Math.abs(x)) * 0;
    const p = V(x, y, z);
    const front = smooth(0.0, 0.06, z);
    let d = 0;
    // orbites
    for (const s of [-1, 1]) d -= 0.012 * gauss((x - s * 0.031) ** 2 + (y - 0.012) ** 2 * 1.3, 0.014) * front;
    // arcade sourcilière
    d += 0.007 * brow * gauss((y - 0.032) ** 2, 0.008) * gauss(x * x, 0.045) * front;
    // nez
    const ny = clamp((0.03 - y) / 0.06);
    d += nose * 0.024 * Math.pow(ny, 1.3) * gauss(x * x, 0.007 + 0.004 * ny) * smooth(-0.04, -0.028, y) * front;
    for (const s of [-1, 1]) d += 0.006 * gauss((x - s * 0.012) ** 2 + (y + 0.028) ** 2, 0.006) * front;
    // philtrum, lèvres
    d -= 0.004 * gauss((y + 0.04) ** 2, 0.004) * gauss(x * x, 0.02) * front;
    d += 0.004 * gauss((y + 0.05) ** 2, 0.004) * gauss(x * x, 0.016) * front;
    d -= 0.003 * gauss((y + 0.055) ** 2, 0.0015) * gauss(x * x, 0.018) * front;
    d += 0.0035 * gauss((y + 0.061) ** 2, 0.004) * gauss(x * x, 0.014) * front;
    // pommettes, menton
    for (const s of [-1, 1]) d += 0.007 * gauss((x - s * 0.047) ** 2 + (y + 0.008) ** 2, 0.016) * front;
    d += 0.009 * jaw * gauss(x * x + (y + 0.088) ** 2, 0.016) * front;
    // oreilles
    for (const s of [-1, 1]) d += 0.012 * gauss((y - 0.0) ** 2 * 0.4 + z * z, 0.012) * smooth(0.06, 0.075, s * x);
    d += 0.0015 * fbm(x * 60 + seed, y * 60, z * 60, 3);
    return p.add(dir.multiplyScalar(d));
  });
  return g;
}
export function eye(side) {
  const e = mesh(new THREE.SphereGeometry(0.0105, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x120c08, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
  e.position.set(side * 0.031, 0.011, 0.066);
  return e;
}
export function beardGeo({ len = 0.05, full = 1, seed = 1 } = {}) {
  // coque autour de la partie basse du visage + volume sous le menton
  const secs = [];
  for (let k = 0; k <= 30; k++) {
    const t = k / 30; const y = lerp(-0.02, -0.11 - len, t);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = lerp(-1.75, 1.75, i / 40);
      const base = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25 * 0.85;
      const ry = Math.max(y, -0.1);
      let rx = 0.07 * (1 - 0.25 * smooth(0, -0.1, ry)), rz = 0.085;
      let r = 1.0;
      const thick = (0.006 + 0.022 * full * smooth(-0.04, -0.1, y)) * (1 + 0.4 * fbm(i * 0.4 + seed, k * 0.2, seed, 2));
      let x = Math.sin(a) * (rx + thick) * base, z = Math.cos(a) * (rz + thick) * base;
      if (y < -0.1) { const u = (-0.1 - y) / len; x *= 1 - 0.55 * u; z = z * (1 - 0.4 * u) + 0.02 * u; }
      // moustache : on laisse le haut épais seulement près de la lèvre
      pts.push([x, y, z]);
    }
    secs.push({ pts });
  }
  const g = loft(secs, { closed: false });
  displace(g, (v, n) => { const s = 0.004 * fbm(v.x * 140, v.y * 25, v.z * 140 + seed, 3); return v.clone().addScaledVector(n, s); });
  return g;
}
export function moustache(mat) {
  const g = G();
  for (const s of [-1, 1]) {
    const pts = [V(0, -0.038, 0.088), V(s * 0.015, -0.042, 0.087), V(s * 0.028, -0.052, 0.078), V(s * 0.034, -0.066, 0.07)];
    g.add(mesh(tubeAlong(pts, (t) => 0.006 * (1 - t * 0.7), { segs: 20, radial: 8 }), mat));
  }
  return g;
}
function hairMat(color) { return MAT.fur({ color, rep: [6, 2] }); }

// ------------------------------------------------------------------ couvre-chefs par faction
function sablesHelm(r, variant) {
  const g = G();
  const helm = M.spangenhelm({ gilt: variant % 2 === 0 });
  g.add(helm);
  // turban : bandes de tissu enroulées autour de la base du casque
  const cloth = MAT.cloth({ color: [0xe8dcc0, 0x2f5a3a, 0xd8c8a0, 0x4a6a3a][variant], rep: [8, 2], sheen: 0.8 });
  for (let k = 0; k < 6; k++) {
    const pts = []; const tilt = (k % 2 ? 1 : -1) * (0.012 + 0.01 * k);
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const rr = 0.122 + 0.006 * Math.sin(a * 2 + k) - k * 0.004; pts.push(V(Math.sin(a) * rr, 0.012 + k * 0.013 + tilt * Math.sin(a + k), Math.cos(a) * rr * 1.1)); }
    pts.push(pts[0].clone()); pts.push(pts[1].clone());
    const tg = sweep(pts, () => 0.021, (t) => 0.0035 * (1 + 0.3 * Math.sin(t * 40 + k)), { side: V(0, 1, 0), steps: 160, n: 14, capStart: false, capEnd: false });
    displace(tg, (v, n) => v.clone().addScaledVector(n, 0.002 * fbm(v.x * 80, v.y * 80, v.z * 80, 2)));
    g.add(mesh(tg, cloth));
  }
  return g;
}
function restR(off) {
  // rayon mini pour que la maille repose sur les épaules (tête à 1.66, épaules à 1.45)
  return (y) => { const yb = 1.66 + off + y - 1.45; return yb > 0.1 ? 0 : yb > 0.04 ? lerp(0.15, 0.09, (yb - 0.04) / 0.06) : yb > 0 ? lerp(0.2, 0.15, yb / 0.04) : 0.21; };
}
export function headGear(faction, variant) {
  const g = G();
  if (faction === 'aube') {
    const hm = MAT.metal({ color: HELM.aube[variant], rough: 0.36, normal: 0.14 });
    const h = variant === 3 ? M.spangenhelm({ mat: hm }) : M.nasalHelm({ mat: hm, height: [0.27, 0.3, 0.26][variant] || 0.27 });
    h.position.y = 0.045; g.add(h);
    const c = M.coif({ mat: M.mailMat(0x9e9e9c, [12, 10]) }); c.position.y = -0.025; c.scale.set(1.0, 1.0, 1.0); g.add(c);
  } else if (faction === 'sables') {
    const h = sablesHelm(0.12, variant); h.position.y = 0.045; g.add(h);
    const a = M.aventail({ r: 0.12, len: 0.24, front: variant >= 2, flare: 0.2, minR: restR(0.05), mat: M.mailMat(0x9a9890, [14, 4]) }); a.position.y = 0.05; g.add(a);
  } else {
    const h = M.spectacleHelm({ mat: MAT.metal({ color: HELM.givre[variant], rough: [0.36, 0.5, 0.32, 0.45][variant], normal: 0.15 }) }); h.position.y = 0.05; g.add(h);
    const a = M.aventail({ r: 0.118, len: 0.24, flare: 0.2, minR: restR(0.05), mat: M.mailMat(0x9a9a98, [14, 4]) }); a.position.y = 0.05; g.add(a);
  }
  return g;
}

// ------------------------------------------------------------------ tronc réaliste (épaules tombantes)
/** y=0 : ligne des épaules. Profil horizontal : demi-largeur et demi-profondeur selon y. */
export function torso({ mat, len = 0.75, inflate = 0, wrinkle = 0.015, seed = 0, armMat = null, arms = true, armLen = 0.6, armSpread = 8, armRot = null, hands = null }) {
  const g = G();
  const W = [[0.1, 0.06, 0.05], [0.07, 0.08, 0.06], [0.04, 0.125, 0.078], [0.0, 0.17, 0.098], [-0.05, 0.195, 0.112], [-0.12, 0.19, 0.118], [-0.25, 0.178, 0.112], [-0.4, 0.158, 0.102], [-0.5, 0.162, 0.102], [-0.75, 0.19, 0.115], [-1.1, 0.23, 0.135]];
  const prof = (y) => { for (let i = 0; i < W.length - 1; i++) if (y <= W[i][0] && y >= W[i + 1][0]) { const t = (W[i][0] - y) / (W[i][0] - W[i + 1][0]); return [lerp(W[i][1], W[i + 1][1], t), lerp(W[i][2], W[i + 1][2], t)]; } return [W[W.length - 1][1], W[W.length - 1][2]]; };
  const secs = [];
  for (let k = 0; k <= 60; k++) {
    const y = 0.1 - (k / 60) * (len + 0.1);
    const [hw, hd] = prof(y);
    const pts = [];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
      // section en super-ellipse (épaules plus carrées)
      const e = 2.6; const rr = 1 / Math.pow(Math.pow(Math.abs(ca), e) + Math.pow(Math.abs(sa), e), 1 / e);
      let x = ca * hw * rr * (1 + inflate), z = sa * hd * rr * (1 + inflate);
      // poitrine en avant, dos plat
      if (sa > 0) z *= 1 + 0.12 * smooth(0.0, -0.1, y) * smooth(-0.35, -0.2, y);
      pts.push([x, z]);
    }
    secs.push({ y, pts });
  }
  const tg = loft(secs, { closed: true });
  displace(tg, (v) => { const n = fbm(v.x * 9 + seed, v.y * 4, v.z * 9, 3) * wrinkle; return V(v.x * (1 + n), v.y, v.z * (1 + n)); });
  g.add(mesh(tg, mat));
  if (arms) for (const s of [-1, 1]) {
    const am = armMat || mat;
    const arm = G(); arm.position.set(s * 0.175, -0.06, 0.0); arm.rotation.z = s * deg(armSpread);
    if (armRot) { const ar = armRot[s < 0 ? 0 : 1]; arm.rotation.x = deg(ar[0]); arm.rotation.z = s * deg(ar[1]); }
    if (hands) { const hnd = mesh(new THREE.SphereGeometry(0.045, 12, 10), hands); hnd.position.set(0, -armLen - 0.03, 0.04); hnd.scale.set(0.8, 1, 0.9); arm.add(hnd); arm.userData.hand = hnd; }
    arm.name = s < 0 ? 'armL' : 'armR';
    const ag = sweep([V(0, 0.02, 0), V(0, -0.15, 0.005), V(0, -0.3, 0.01), V(0, -armLen, 0.04)], (t) => lerp(0.064, 0.045, t) * (1 + inflate), (t) => lerp(0.06, 0.044, t) * (1 + inflate), { steps: 40, n: 24 });
    displace(ag, (v) => { const n = fbm(v.x * 14, v.y * 8 + s, v.z * 14, 3) * wrinkle * 1.4; return V(v.x * (1 + n), v.y, v.z * (1 + n)); });
    arm.add(mesh(ag, am));
    const delt = mesh(new THREE.SphereGeometry(0.066 * (1 + inflate), 24, 16), am); delt.scale.set(0.95, 0.85, 0.95); delt.position.set(-s * 0.005, -0.0, 0); arm.add(delt);
    g.add(arm);
  }
  return g;
}

// ------------------------------------------------------------------ casques des silhouettes
const HELM = { aube: [0x8c8a86, 0x9a9894, 0x7a7876, 0x8a8680], givre: [0x8a8c90, 0x6a6660, 0x9a9ca0, 0x7a7068] };
export function furMantle(mat, seed = 0) {
  // pèlerine de fourrure épousant les épaules, bord inférieur en mèches
  const secs = [];
  for (let k = 0; k <= 30; k++) {
    const t = k / 30; const y = 0.1 - t * 0.3;
    const hw = [0.09, 0.15, 0.22, 0.26, 0.27][Math.min(4, Math.floor(t * 4))] * 0 + lerp(0.1, 0.27, Math.pow(smooth(0, 0.7, t), 0.8));
    const hd = lerp(0.075, 0.16, smooth(0, 0.7, t));
    const pts = [];
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const tuft = t > 0.75 ? 1 - (t - 0.75) * 2.5 * (0.5 + 0.5 * Math.sin(i * 2.7 + seed)) * 0.6 : 1; pts.push([Math.cos(a) * hw * tuft * 1.04, Math.sin(a) * hd * tuft * 1.04]); }
    secs.push({ y, pts });
  }
  const g = loft(secs, { closed: true });
  displace(g, (v, n) => v.clone().addScaledVector(n, 0.03 * Math.abs(fbm(v.x * 18 + seed, v.y * 30, v.z * 18, 4)) + 0.006 * fbm(v.x * 120, v.y * 200, v.z * 120, 2) + 0.008));
  return mesh(g, mat);
}
export function cloak(mat) {
  // cape : demi-cylindre évasé dans le dos, rabattu sur les épaules
  const secs = [];
  for (let k = 0; k <= 30; k++) {
    const t = k / 30; const y = 0.06 - t * 1.1; const r = lerp(0.2, 0.36, Math.pow(t, 0.7));
    const pts = [];
    for (let i = 0; i <= 48; i++) { const a = lerp(-0.62, 0.62, i / 48) * Math.PI + Math.PI; const fold = 1 + 0.06 * Math.sin(i * 0.9 + t * 2) * t; pts.push([Math.sin(a) * r * 1.0 * fold, y, Math.cos(a) * r * 0.7 * fold - 0.02]); }
    secs.push({ pts });
  }
  const g = loft(secs, { closed: false });
  return mesh(g, mat);
}

/** Silhouette complète (origine aux pieds, regarde vers +z). */
export function figure({ faction = 'aube', variant = 0, coat = null, legs = 0x5a4a3a, helm = true, shield = null, spear = false, sword = false, axe = false, cloakColor = null, armRot = null, hood = null, scale = 1, beard = 0.5, skin = 0xb08068, mail = true, giant = false } = {}) {
  const g = G();
  const skinM = MAT.skin({ color: skin });
  const legM = MAT.cloth({ color: legs, rep: [2, 6] });
  const lg = M.legsGeo({ mat: legM, footMat: MAT.leather({ color: 0x3a2618 }), len: 0.86, sep: 0.09, r0: 0.075, r1: 0.045 });
  lg.position.y = 0.9; g.add(lg);
  const body = G(); body.position.y = 1.45;
  const coatM = coat !== null ? MAT.cloth({ color: coat, rep: [4, 6], sheen: 0.4 }) : null;
  const mailM = M.mailMat(0x9a9a98, [12, 12]);
  const base = mail ? mailM : coatM;
  body.add(torso({ mat: base, len: 0.95, wrinkle: 0.03, seed: variant, armRot, hands: skinM }));
  if (mail && coatM) { const sc = torso({ mat: coatM, inflate: 0.06, arms: false, len: 0.92, wrinkle: 0.04, seed: variant + 2 }); sc.position.y = -0.05; body.add(sc); }
  if (cloakColor !== null) body.add(cloak(MAT.cloth({ color: cloakColor, rep: [4, 4] })));
  const belt = mesh(new THREE.TorusGeometry(0.165, 0.015, 6, 32), MAT.leather({ color: 0x2a1a10 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1.05, 0.72, 1); belt.position.y = -0.47; body.add(belt);
  g.add(body);
  g.add(mesh(lathe([[0.055, 1.48], [0.05, 1.56], [0.052, 1.62]], 16), skinM));
  const head = G(); head.position.set(0, 1.66, 0);
  head.add(mesh(headGeo({ seed: variant }), skinM));
  if (beard > 0) head.add(mesh(beardGeo({ len: 0.02 + beard * 0.05, full: 0.6 + beard * 0.5, seed: variant }), hairMat(0x3a2a1c)));
  if (hood !== null) {
    const hm = MAT.cloth({ color: hood, rep: [3, 3] });
    const hg = M.coif({ mat: hm }); hg.position.y = -0.02; hg.scale.set(1.06, 1.08, 1.08); head.add(hg);
  } else if (helm) head.add(headGear(faction, variant));
  g.add(head);
  const armR = body.getObjectByName('armR'), armL = body.getObjectByName('armL');
  if (spear) { const sp = M.spear({ len: 2.0 }); sp.position.set(0, -0.7 - 0.6, 0.05); armR.userData.hand.add(sp); sp.position.set(0, -0.9, 0); }
  if (sword) { const sw = M.sword({ type: sword === true ? 'normande' : sword }); sw.rotation.x = Math.PI / 2 + 0.3; sw.position.set(0, 0, 0.0); armR.userData.hand.add(sw); }
  if (axe) { const ax = M.daneAxe(); ax.position.set(0, -0.7, 0); armR.userData.hand.add(ax); }
  if (shield) {
    const sh = shield.type === 'kite' ? M.kiteShield({ field: shield.field, emblem: shield.emblem, emblemColor: shield.emblemColor, wear: 0.4 }) : shield.type === 'adarga' ? M.adarga({ field: shield.field, emblem: shield.emblem, emblemColor: shield.emblemColor, studs: false }) : M.roundShield({ field: shield.field, emblem: shield.emblem, emblemColor: shield.emblemColor, rimMetal: true, R: 0.4 });
    sh.position.set(-0.3, 1.15, 0.18); sh.rotation.y = deg(-25); g.add(sh);
  }
  g.scale.setScalar(scale);
  return g;
}

// Les portraits sont produits par portraits.js (humain MakeHuman + rendu peint).
export function register() {}
