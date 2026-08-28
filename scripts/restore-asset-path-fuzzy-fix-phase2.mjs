import fs from 'node:fs';import path from 'node:path';
const ROOT=process.cwd(),B=path.join(ROOT,'.asset-path-fuzzy-fix-phase2-backup');
function walk(d){return fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):[p]}):[]}
if(!fs.existsSync(B)){console.log('Yedek yok');process.exit(1)}
let n=0;for(const f of walk(B)){const rel=path.relative(B,f),dst=path.join(ROOT,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(f,dst);n++}
console.log(`[OK] ${n} dosya geri yuklendi.`);
