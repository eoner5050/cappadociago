import fs from 'node:fs';
import path from 'node:path';
const ROOT=process.cwd();
const BACKUP=path.join(ROOT,'.asset-path-case-fix-backup');
function walk(d){return fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):[p]}):[]}
if(!fs.existsSync(BACKUP)){console.log('Yedek klasoru bulunamadi.');process.exit(1)}
let n=0;
for(const f of walk(BACKUP)){
  const rel=path.relative(BACKUP,f), dest=path.join(ROOT,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(f,dest); n++;
}
console.log(`[OK] ${n} dosya geri yuklendi.`);
