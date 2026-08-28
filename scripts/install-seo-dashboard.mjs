import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const pkgFile=path.join(root,'package.json');
if(!fs.existsSync(pkgFile)) throw new Error('package.json bulunamadı. Komutu proje kökünde çalıştırın.');
const pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));
pkg.scripts ||= {};
pkg.scripts['seo:audit']='node scripts/generate-seo-audit.mjs';
// Keep user's existing scripts intact; only add predev/prebuild if not present, otherwise prepend safely once.
function addHook(name,cmd){const old=pkg.scripts[name];if(!old) pkg.scripts[name]=cmd;else if(!old.includes('generate-seo-audit.mjs')) pkg.scripts[name]=cmd+' && '+old;}
addHook('predev','node scripts/generate-seo-audit.mjs');
addHook('prebuild','node scripts/generate-seo-audit.mjs');
fs.writeFileSync(pkgFile,JSON.stringify(pkg,null,2)+'\n');

const adminFile=path.join(root,'src','pages','admin','index.astro');
if(fs.existsSync(adminFile)){
  let s=fs.readFileSync(adminFile,'utf8');
  if(!s.includes('/admin/seo-dashboard/')){
    const anchor='        <button data-tab="reservations">🧾 Rezervasyon Detayları</button>';
    if(s.includes(anchor)){
      s=s.replace(anchor,anchor+'\n        <a href="/admin/seo-dashboard/" style="display:block;color:#dce6f0;text-decoration:none;padding:12px 13px;border-radius:11px;font-weight:800">🔎 SEO Dashboard</a>');
      fs.writeFileSync(adminFile,s);
      console.log('[SEO Dashboard] Admin menüsüne bağlantı eklendi.');
    } else console.log('[SEO Dashboard] Admin nav marker bulunamadı; dashboard yine /admin/seo-dashboard/ adresinde çalışır.');
  }
}
console.log('[SEO Dashboard] package.json scriptleri hazır.');
console.log('[SEO Dashboard] Legacy SEO Migration bölümü de hazır.');
console.log('[SEO Dashboard] Şimdi: npm run seo:audit');
