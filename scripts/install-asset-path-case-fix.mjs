import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const PUBLIC_TOURS = path.join(ROOT, 'public', 'images', 'tours');
const BACKUP = path.join(ROOT, '.asset-path-case-fix-backup');
const REPORT_DIR = path.join(ROOT, 'asset-path-case-fix');

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);
    return e.isDirectory()?walk(p):[p];
  });
}
function backup(file){
  const rel=path.relative(ROOT,file);
  const dest=path.join(BACKUP,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(!fs.existsSync(dest)) fs.copyFileSync(file,dest);
}
function normKey(s){ return s.toLowerCase(); }

if(!fs.existsSync(PUBLIC_TOURS)){
  console.error('public/images/tours bulunamadi.');
  process.exit(1);
}

const actualFiles = fs.readdirSync(PUBLIC_TOURS).filter(n=>fs.statSync(path.join(PUBLIC_TOURS,n)).isFile());
const byLower = new Map();
for(const name of actualFiles){
  const key = normKey(name);
  if(!byLower.has(key)) byLower.set(key,[]);
  byLower.get(key).push(name);
}

const textFiles = walk(SRC).filter(f=>/\.(astro|ts|js|tsx|jsx|json|md|mdx|css)$/i.test(f));
const changedFiles=[];
const replacements=[];
const unresolved=[];
const ambiguous=[];

const re = /\/images\/tours\/([^"'`}\)\s<>]+)/g;

for(const file of textFiles){
  let s=fs.readFileSync(file,'utf8');
  const before=s;

  s=s.replace(re,(full,filename)=>{
    let decoded=filename;
    try { decoded = decodeURIComponent(filename); } catch {}

    const candidates = byLower.get(normKey(decoded));
    if(candidates && candidates.length===1){
      const actual=candidates[0];
      if(actual !== decoded){
        replacements.push({
          file:path.relative(ROOT,file).replaceAll('\\','/'),
          from:decoded,
          to:actual
        });
        return `/images/tours/${actual}`;
      }
      return full;
    }

    if(candidates && candidates.length>1){
      ambiguous.push({
        file:path.relative(ROOT,file).replaceAll('\\','/'),
        value:decoded,
        candidates
      });
      return full;
    }

    // Try a stricter normalization only for lookup: spaces/underscores/hyphens kept semantically.
    const compact = decoded.toLowerCase().replace(/%20/g,' ');
    const near = actualFiles.filter(n=>n.toLowerCase()===compact);
    if(near.length===1){
      const actual=near[0];
      if(actual!==decoded){
        replacements.push({
          file:path.relative(ROOT,file).replaceAll('\\','/'),
          from:decoded,
          to:actual
        });
        return `/images/tours/${actual}`;
      }
    } else {
      unresolved.push({
        file:path.relative(ROOT,file).replaceAll('\\','/'),
        value:decoded
      });
    }
    return full;
  });

  if(s!==before){
    backup(file);
    fs.writeFileSync(file,s,'utf8');
    changedFiles.push(path.relative(ROOT,file).replaceAll('\\','/'));
    console.log(`[OK] ${path.relative(ROOT,file)}`);
  }
}

fs.mkdirSync(REPORT_DIR,{recursive:true});
fs.writeFileSync(path.join(REPORT_DIR,'report.json'),JSON.stringify({
  changedFiles,
  replacements,
  unresolved,
  ambiguous
},null,2));

console.log('');
console.log('Asset path case fix tamamlandi.');
console.log(`Degisen dosya: ${changedFiles.length}`);
console.log(`Duzeltilen referans: ${replacements.length}`);
console.log(`Cozulemeyen referans: ${unresolved.length}`);
console.log(`Belirsiz eslesme: ${ambiguous.length}`);
console.log(`Yedekler: ${path.relative(ROOT,BACKUP)}/`);
console.log(`Rapor: ${path.relative(ROOT,REPORT_DIR)}/report.json`);
console.log('');
console.log('Simdi:');
console.log('  npm run build');
console.log('  npx vercel --prod');
