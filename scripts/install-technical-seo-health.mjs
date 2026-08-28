import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const PKG=path.resolve(import.meta.dirname,'..');
const files=[
  'scripts/generate-seo-audit.mjs',
  'src/pages/admin/seo-dashboard.astro',
  'src/scripts/seo-dashboard.ts'
];
const backup=path.join(ROOT,'.technical-seo-health-backup');
for(const rel of files){
  const src=path.join(PKG,rel), dest=path.join(ROOT,rel);
  if(fs.existsSync(dest)){
    const b=path.join(backup,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(dest,b);
  }
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);
}
console.log('[Technical SEO] 3 dosya kuruldu ve mevcut sürümler .technical-seo-health-backup altında yedeklendi.');
console.log('[Technical SEO] Şimdi: npm run seo:audit');
console.log('[Technical SEO] Audit ayrıca public/robots.txt ve public/sitemap.xml üretir.');
