// Point d'entrée : registre des images à produire.
import { preload, RES } from './lib.js';
// chaque module est chargé séparément : une erreur dans l'un n'empêche pas de rendre les autres
let ITEMS = {}, FACTIONS = {};
try { ({ ITEMS, FACTIONS } = await import('./items.js')); } catch (e) { console.error('items.js : ' + (e && e.stack || e)); }

const JOBS = [];
const job = (out, w, h, fn, extra = {}) => JOBS.push({ out, w, h, fn, ...extra });

for (const [id, fn] of Object.entries(ITEMS)) job(`items/${id}.png`, 256, 256, fn, { div: 2, colors: 40 });
for (const [id, fn] of Object.entries(FACTIONS)) job(`factions/${id}.png`, 512, 512, fn, { div: 4, colors: 40 });

const extra = await Promise.allSettled([import('./scenes.js'), import('./people.js'), import('./portraits.js')]);
for (const r of extra) {
  if (r.status === 'fulfilled' && r.value.register) r.value.register(job);
  else if (r.status === 'rejected' && !String(r.reason).includes('Failed to fetch')) console.error(String(r.reason && r.reason.stack || r.reason));
}

await preload(['metal_c', 'metal_n', 'metal_r', 'mail_n', 'mail_ao', 'wood_c', 'wood_n', 'wood_r', 'leather_c', 'leather_n', 'leather_r', 'cloth_c', 'cloth_n', 'quilt_n', 'fur_c', 'fur_n', 'rock_c', 'rock_n', 'sand_c', 'sand_n', 'ground_c', 'ground_n', 'chip', 'grime']);

window.listJobs = () => JOBS.map(({ fn, ...rest }) => rest);
window.renderJob = async (out) => {
  const j = JOBS.find((x) => x.out === out);
  RES.div = j.div || 2; RES.ss = j.ss || 3;
  return await j.fn();
};
window.ALDORIA_READY = true;
