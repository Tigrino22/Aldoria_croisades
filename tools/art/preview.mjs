#!/usr/bin/env node
// Génère client/public/assets/preview.html (planche contact) et sa capture tools/art/preview.png.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = path.resolve(HERE, '../../client/public/assets');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(png|jpg)$/.test(f)) files.push(path.relative(A, p)); } })(A);
const groups = {};
for (const f of files) { const g = f.includes('/') ? f.split('/')[0] : 'racine'; (groups[g] ||= []).push(f); }
const big = new Set(['map', 'bg', 'ui', 'actions', 'racine']);
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aldoria – planche des images</title>
<style>body{margin:0;padding:16px;background:#1c1712;color:#e8dcc0;font:13px/1.3 Georgia,serif}h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;margin:18px 0 6px;color:#d4a640;border-bottom:1px solid #4a3a28}
.g{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;background:#2a221a;padding:6px;border:1px solid #3a2e22}figure img{display:block;image-rendering:pixelated;background:repeating-conic-gradient(#3a3028 0 25%,#2e261e 0 50%) 0 0/16px 16px}
figcaption{font:11px monospace;color:#b8a888;margin-top:4px}</style></head><body><h1>Aldoria Croisades — images (${files.length})</h1>
${Object.entries(groups).map(([g, fs2]) => `<h2>${g}</h2><div class="g">${fs2.map((f) => `<figure><img src="${f}" style="height:${big.has(g) ? 180 : 128}px"><figcaption>${f}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(A, 'preview.html'), html);
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(pathToFileURL(path.join(A, 'preview.html')).href);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: path.join(HERE, 'preview.png'), fullPage: true });
await b.close();
console.log('preview ok', files.length, 'images');
