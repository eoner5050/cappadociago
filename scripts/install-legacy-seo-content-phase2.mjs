import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG = path.resolve(import.meta.dirname, '..');
const filesToCopy = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out=[];
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const f=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(f)); else out.push(f);
  }
  return out;
}
for (const relRoot of ['src/components','src/data','src/pages/en/blog','src/pages/tr/blog','src/pages/language/en']) {
  const base=path.join(PKG,relRoot);
  for(const file of walk(base)) filesToCopy.push(file);
}
// Turkish old root redirect files are outside language/en; get them from the map.
const map = JSON.parse(fs.readFileSync(path.join(PKG,'src/data/legacy-seo-content-map.json'),'utf8'));
for (const item of map) {
  if (!item.oldPath.startsWith('/language/en/')) {
    const parts=item.oldPath.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
    const file=path.join(PKG,'src/pages',...parts,'index.astro');
    if(fs.existsSync(file)) filesToCopy.push(file);
  }
}

const backupRoot=path.join(ROOT,'.legacy-seo-content-backup');
let copied=0, backed=0;
for(const src of [...new Set(filesToCopy)]) {
  const rel=path.relative(PKG,src);
  const dest=path.join(ROOT,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest)){
    const existing=fs.readFileSync(dest,'utf8');
    const incoming=fs.readFileSync(src,'utf8');
    if(existing===incoming) continue;
    const b=path.join(backupRoot,rel);
    fs.mkdirSync(path.dirname(b),{recursive:true});
    fs.copyFileSync(dest,b); backed++;
  }
  fs.copyFileSync(src,dest); copied++;
}

// Update Legacy SEO Dashboard targets when that data file exists.
const legacyFile=path.join(ROOT,'src/data/legacy-seo-source.json');
if(fs.existsSync(legacyFile)){
  const legacy=JSON.parse(fs.readFileSync(legacyFile,'utf8'));
  const byOld=new Map(map.map(x=>[x.oldPath,x]));
  let changed=0;
  for(const row of legacy){
    const m=byOld.get(row.oldPath);
    if(m){ row.suggestedTarget=m.newPath; changed++; }
  }
  fs.writeFileSync(legacyFile,JSON.stringify(legacy,null,2)+'\n');
  console.log(`[Legacy SEO] Dashboard hedefi güncellendi: ${changed}`);
}
console.log(`[Legacy SEO Content] Kopyalanan dosya: ${copied}`);
console.log(`[Legacy SEO Content] Yedeklenen çakışma: ${backed}`);
console.log('[Legacy SEO Content] Sonraki adım: npm run seo:audit && npm run build');
