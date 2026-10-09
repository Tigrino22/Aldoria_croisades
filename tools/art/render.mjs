#!/usr/bin/env node
// Rendu des images 3D d'Aldoria (three.js dans Chromium headless via Playwright).
// Usage : node tools/art/render.mjs [filtre...]   ex. : node tools/art/render.mjs items/ portraits/aube-1
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSETS = path.join(ROOT, 'client/public/assets');
const TMP = path.join(HERE, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const req = createRequire('/opt/node22/lib/node_modules/');
  ({ chromium } = req('playwright'));
}

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(HERE, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/web/index.html`);
await page.waitForFunction(() => window.ALDORIA_READY === true, null, { timeout: 120000 });

const jobs = await page.evaluate(() => window.listJobs());
const filters = process.argv.slice(2);
const todo = jobs.filter((j) => !filters.length || filters.some((f) => j.out.includes(f)));
console.log(`${todo.length} image(s) à rendre`);

for (const job of todo) {
  const t0 = Date.now();
  const res = JSON.parse(await page.evaluate((id) => window.renderJob(id), job.out));
  const base = path.join(TMP, job.out.replace(/[/.]/g, '_'));
  for (const k of ['color', 'normal', 'depth']) fs.writeFileSync(`${base}_${k}.png`, Buffer.from(res[k].split(',')[1], 'base64'));
  const out = path.join(ASSETS, job.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('python3', [path.join(HERE, 'pixelize.py'), base, out, String(job.w), String(job.h), String(job.div || 2),
    '--colors', String(job.colors || 48), '--dither', String(job.dither ?? 0.35), '--edge', String(job.edge ?? 1), '--quality', String(job.quality || 92), '--sat', String(job.sat ?? 1.12)], { stdio: 'inherit' });
  console.log(`  ${job.out}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
server.close();
