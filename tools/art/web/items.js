// Objets d'inventaire (256x256, fond transparent) et écus de faction (512x512).
import { THREE, MAT, canvasTex, img, tex, studio, shadowCatcher, mesh, V, deg, capture, displace, fbm, lathe, loft, ellipse, lerp, smooth, tubeAlong } from './lib.js';
import * as M from './models.js';
import { buildItems } from './arsenal.js';

export function fitAndShoot(obj, { w = 256, h = 256, ss = 3, pose = [0, 0, 0], view = [0.0, 0.32, 1], fov = 28, pad = 1.08, shadow = false, light = {}, exposure = 1.0, catcherOpacity = 0.4 } = {}) {
  const scene = new THREE.Scene();
  const holder = new THREE.Group(); holder.add(obj);
  obj.rotation.set(deg(pose[0]), deg(pose[1]), deg(pose[2]), 'YXZ');
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  scene.add(holder);
  holder.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  const sph = box2.getBoundingSphere(new THREE.Sphere());
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.01, 100);
  const dir = V(...view).normalize();
  // distance pour que la boîte projetée tienne dans le cadre
  const corners = []; for (const x of [box2.min.x, box2.max.x]) for (const y of [box2.min.y, box2.max.y]) for (const z of [box2.min.z, box2.max.z]) corners.push(V(x, y, z));
  let d = sph.radius / Math.sin(deg(fov / 2));
  for (let it = 0; it < 30; it++) {
    cam.position.copy(dir).multiplyScalar(d); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let m = 0; for (const p of corners) { const q = p.clone().project(cam); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); }
    d *= m * pad > 0 ? Math.pow(m * pad, 0.9) : 1;
  }
  const sz = sph.radius;
  studio(scene, { size: sz * 1.6, keyPos: V(-2.2, 4.5, 3).multiplyScalar(sz), rimPos: V(3, 2, -3).multiplyScalar(sz), ...light });
  if (shadow) {
    const cat = shadowCatcher(scene, box2.min.y - sz * 0.02, sz * 8, catcherOpacity);
    cat.blob.scale.set((box2.max.x - box2.min.x) * 1.1, (box2.max.z - box2.min.z) * 1.4 + sz * 0.3, 1);
    cat.blob.material.opacity = 0.7;
  }
  return capture({ scene, camera: cam, w, h, ss, transparent: true, exposure });
}

const swordPose = [12, 25, -42];
export const ITEMS = {
  'baton-ferre': () => fitAndShoot(M.staff(), { pose: [10, 20, -48] }),
  dague: () => fitAndShoot(M.dagger(), { pose: [14, 30, -40] }),
  lance: () => fitAndShoot(M.spear({ len: 1.5 }), { pose: [10, 20, -48] }),
  'hache-danoise': () => fitAndShoot(M.daneAxe(), { pose: [8, 15, -38] }),
  'epee-normande': () => fitAndShoot(M.sword({ type: 'normande' }), { pose: swordPose }),
  'epee-damasquinee': () => fitAndShoot(M.sword({ type: 'damas' }), { pose: swordPose }),
  'masse-d-armes': () => fitAndShoot(M.mace(), { pose: [12, 25, -35] }),
  'epee-du-maitre': () => fitAndShoot(M.sword({ type: 'maitre' }), { pose: swordPose, light: { key: 3.6 } }),
  'bouclier-rond': () => fitAndShoot(M.roundShield({ field: '#8a3a24', boards: 6, wear: 0.75 }), { pose: [-12, 28, 0] }),
  'targe-de-cuir': () => fitAndShoot(M.adarga({ field: '#7a5434', wear: 0.25 }), { pose: [-12, 28, 0] }),
  'bouclier-cercle': () => fitAndShoot(M.roundShield({ field: '#34485a', boards: 7, rimMetal: true, wear: 0.6 }), { pose: [-12, 28, 0] }),
  'ecu-en-amande': () => fitAndShoot(M.kiteShield({ field: '#9a3020', wear: 0.5 }), { pose: [-10, 28, 0] }),
  'ecu-au-lion': () => fitAndShoot(M.kiteShield({ field: '#a02a20', emblem: 'lion', emblemColor: '#d4a640', wear: 0.4 }), { pose: [-10, 28, 0] }),
  'bonnet-de-cuir': () => fitAndShoot(M.leatherCap(), { pose: [8, 35, 0], view: [0, 0.45, 1] }),
  spangenhelm: () => fitAndShoot(M.spangenhelm({ gilt: true }), { pose: [8, 35, 0], view: [0, 0.4, 1] }),
  'casque-a-nasal': () => fitAndShoot(M.nasalHelm(), { pose: [6, 35, 0], view: [0, 0.35, 1] }),
  camail: () => fitAndShoot(M.coif(), { pose: [5, 30, 0], view: [0, 0.3, 1] }),
  'heaume-a-lunettes': () => { const g = new THREE.Group(); g.add(M.spectacleHelm()); const a = M.aventail({ r: 0.118, len: 0.12 }); g.add(a); return fitAndShoot(g, { pose: [6, 35, 0], view: [0, 0.35, 1] }); },
  gambison: () => fitAndShoot(M.garment({ mat: MAT.cloth({ color: 0x8a7450, rep: [3, 3], quilt: true, sheen: 0.2 }), length: 0.85, sleeve: 0.5, flare: 0.5, wrinkle: 0.03 }), { pose: [5, 25, 0], view: [0, 0.15, 1] }),
  broigne: () => fitAndShoot(broigne(), { pose: [5, 25, 0], view: [0, 0.15, 1] }),
  'cotte-courte': () => fitAndShoot(M.garment({ mat: M.mailMat(0xc8c8c6, [11, 10]), length: 0.7, sleeve: 0.28, flare: 0.6, wrinkle: 0.02 }), { pose: [5, 25, 0], view: [0, 0.15, 1] }),
  jaseran: () => fitAndShoot(jaseran(), { pose: [5, 25, 0], view: [0, 0.15, 1] }),
  haubert: () => fitAndShoot(M.garment({ mat: M.mailMat(0xc8c8c6, [12, 14]), length: 1.15, sleeve: 0.56, flare: 0.9, wrinkle: 0.025 }), { pose: [5, 25, 0], view: [0, 0.15, 1] }),
  'chausses-de-laine': () => fitAndShoot(woolLegs(), { pose: [5, 25, 0], view: [0, 0.2, 1] }),
  'bottes-de-cuir': () => fitAndShoot(pair(() => M.boot({ height: 0.16 })), { pose: [10, 30, 0], view: [0, 0.4, 1] }),
  'bottes-de-cavalier': () => fitAndShoot(pair(() => M.boot({ height: 0.38, spur: true, cuff: true, mat: MAT.leather({ color: 0x3a2214, rep: [2, 3] }) })), { pose: [8, 35, 0], view: [0, 0.3, 1] }),
  'chausses-de-mailles': () => fitAndShoot(M.legsGeo({ mat: M.mailMat(0xc8c8c6, [5, 12]), footMat: M.mailMat(0xc8c8c6, [4, 4]), len: 0.85 }), { pose: [5, 25, 0], view: [0, 0.2, 1] }),
  'anneau-de-cuivre': () => fitAndShoot(M.ring({ type: 'copper' }), { pose: [-20, 20, 0], view: [0, 0.6, 1] }),
  'anneau-d-argent': () => fitAndShoot(M.ring({ type: 'silver' }), { pose: [-20, 20, 0], view: [0, 0.6, 1] }),
  'chevaliere-d-or': () => fitAndShoot(M.ring({ type: 'signet' }), { pose: [-20, 20, 0], view: [0, 0.6, 1] }),
  'anneau-de-saphir': () => fitAndShoot(M.ring({ type: 'sapphire' }), { pose: [-20, 20, 0], view: [0, 0.5, 1], light: { env: 1.4 } }),
};
// objets du lot 2 (générateurs paramétriques de arsenal.js)
Object.assign(ITEMS, buildItems(fitAndShoot));
function pair(fn) { const g = new THREE.Group(); const a = fn(), b = fn(); a.position.x = -0.08; b.position.x = 0.09; b.position.z = 0.05; b.rotation.y = deg(-12); a.rotation.y = deg(6); g.add(a, b); return g; }
function broigne() {
  const g = M.garment({ mat: MAT.leather({ color: 0x5a3820, rep: [3, 3] }), length: 0.85, sleeve: 0.35, flare: 0.6, wrinkle: 0.015 });
  // anneaux de fer cousus en rangs
  const iron = MAT.metal({ color: 0x9a9894, rough: 0.42 });
  const ringG = new THREE.TorusGeometry(0.014, 0.0035, 6, 16);
  const count = 26 * 16; const im = new THREE.InstancedMesh(ringG, iron, count); im.castShadow = true;
  let k = 0; const o = new THREE.Object3D();
  for (let row = 0; row < 16; row++) for (let i = 0; i < 26; i++) {
    const y = -0.02 - row * 0.045; const a = (i + (row % 2) * 0.5) / 26 * Math.PI * 2;
    let r = y > -0.45 ? 0.19 - 0.02 * Math.sin((-y / 0.45) * Math.PI) - 0.03 * (-y / 0.45) : 0.16 + (-(y + 0.45)) * 0.32 * 0.6;
    const x = Math.cos(a) * r * 0.92, z = Math.sin(a) * r * 0.68;
    o.position.set(x * 1.02, y, z * 1.03); o.lookAt(x * 3, y, z * 3); o.updateMatrix(); im.setMatrixAt(k++, o.matrix);
  }
  im.count = k; g.add(im);
  return g;
}
function jaseran() {
  const g = M.garment({ mat: MAT.cloth({ color: 0x6a2a3a, rep: [4, 4], sheen: 1 }), length: 0.8, sleeve: 0.4, flare: 0.7, wrinkle: 0.025 });
  // mailles visibles aux bords (ourlet et manches)
  const hem = M.garment({ mat: M.mailMat(0xd0d0ce, [12, 3]), length: 0.86, sleeve: 0.46, flare: 0.7, wrinkle: 0.0 });
  hem.scale.set(0.97, 1, 0.97); g.add(hem);
  // galon brodé
  const trim = MAT.cloth({ color: 0xc09a40, rep: [10, 1], sheen: 1 });
  const neck = mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 40), trim); neck.rotation.x = Math.PI / 2; neck.scale.set(1, 0.6, 1); neck.position.y = 0.045; g.add(neck);
  return g;
}
function woolLegs() {
  const t = canvasTex(512, 1024, (c, w, h) => {
    c.fillStyle = '#8a7558'; c.fillRect(0, 0, w, h);
    const bw = 64;
    for (let k = -20; k < 40; k++) {
      const y0 = k * bw;
      const gr = c.createLinearGradient(0, y0, 0, y0 + bw);
      gr.addColorStop(0, '#4a3c2c'); gr.addColorStop(0.15, '#8f7a5c'); gr.addColorStop(0.6, '#a08a6a'); gr.addColorStop(0.92, '#6a5840'); gr.addColorStop(1, '#3a2e22');
      c.save(); c.transform(1, -0.35, 0, 1, 0, 0); c.fillStyle = gr; c.fillRect(-w, y0, w * 3, bw); c.restore();
    }
    c.globalCompositeOperation = 'multiply'; c.drawImage(img('cloth_c'), 0, 0, w, h); c.drawImage(img('cloth_c'), 0, 0, w, h);
  });
  t.repeat.set(1, 1);
  const bump = t.clone(); bump.colorSpace = THREE.NoColorSpace;
  const wool = new THREE.MeshPhysicalMaterial({ color: 0xd8c8b0, map: t, bumpMap: bump, bumpScale: 3, roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xc8b8a0), normalMap: tex('cloth_n', [3, 6]), normalScale: new THREE.Vector2(0.5, 0.5) });
  return M.legsGeo({ mat: wool, footMat: MAT.leather({ color: 0x4a2c1a }), len: 0.85 });
}
// --------------------------------------------------------------- écus de faction (512)
export const FACTIONS = {
  aube: () => fitAndShoot(M.kiteShield({ field: '#e6e0cf', emblem: 'sun', emblemColor: '#c99528', wear: 0.35, rimMetal: true, boss: false }), { w: 512, h: 512, ss: 2, pose: [-6, 18, 0], view: [0, 0.1, 1], shadow: false, pad: 1.04 }),
  sables: () => fitAndShoot(M.adarga({ field: '#2c5a38', emblem: 'star', emblemColor: '#d0a038', wear: 0.3, studs: false }), { w: 512, h: 512, ss: 2, pose: [-6, 18, 0], view: [0, 0.1, 1], shadow: false, pad: 1.04 }),
  givre: () => fitAndShoot(M.roundShield({ field: '#1a2440', emblem: 'raven', emblemColor: '#c4c8ce', wear: 0.4, boards: 5, rimMetal: true }), { w: 512, h: 512, ss: 2, pose: [-6, 18, 0], view: [0, 0.1, 1], shadow: false, pad: 1.04 }),
};
