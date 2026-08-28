import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');
const mappingFile = path.join(PACKAGE_ROOT, 'src', 'data', 'legacy-seo-redirects-phase1.json');
const mappings = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const backupRoot = path.join(ROOT, '.legacy-seo-backup');

function routeFile(route) {
  const parts = route.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
  return path.join(ROOT, 'src', 'pages', ...parts, 'index.astro');
}
function packageRouteFile(route) {
  const parts = route.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
  return path.join(PACKAGE_ROOT, 'src', 'pages', ...parts, 'index.astro');
}
function ensureDir(file){ fs.mkdirSync(path.dirname(file), {recursive:true}); }

let installed=0, skipped=0, backedUp=0;
for (const item of mappings) {
  const dest=routeFile(item.old);
  const src=packageRouteFile(item.old);
  if (!fs.existsSync(src)) continue;

  if (fs.existsSync(dest)) {
    const existing=fs.readFileSync(dest,'utf8');
    const expected=fs.readFileSync(src,'utf8');
    if (existing===expected) { skipped++; continue; }

    const backup=path.join(backupRoot, ...item.old.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean), 'index.astro');
    ensureDir(backup);
    fs.copyFileSync(dest, backup);
    backedUp++;
  }

  ensureDir(dest);
  fs.copyFileSync(src,dest);
  installed++;
}

console.log(`[Legacy SEO Phase 1] Kurulan 301: ${installed}`);
console.log(`[Legacy SEO Phase 1] Zaten aynıydı: ${skipped}`);
console.log(`[Legacy SEO Phase 1] Yedeklenen çakışma: ${backedUp}`);
console.log('[Legacy SEO Phase 1] Sonraki adım: npm run seo:audit && npm run build');
