import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT,'src');
const TOURS = path.join(ROOT,'public','images','tours');
const BACKUP = path.join(ROOT,'.asset-path-fuzzy-fix-phase2-backup');
const REPORT = path.join(ROOT,'asset-path-fuzzy-fix-phase2');

function walk(d){
  if(!fs.existsSync(d)) return [];
  return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(d,e.name);
    return e.isDirectory()?walk(p):[p];
  });
}
function backup(f){
  const rel=path.relative(ROOT,f), dst=path.join(BACKUP,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  if(!fs.existsSync(dst)) fs.copyFileSync(f,dst);
}
function normStem(name){
  return name
    .replace(/\.[^.]+$/,'')
    .replace(/\s*\(\d+\)\s*$/,'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'');
}
function numericSuffix(name){
  const m=name.match(/\((\d+)\)\.[^.]+$/);
  return m ? Number(m[1]) : 0;
}

if(!fs.existsSync(TOURS)){
  console.error('public/images/tours bulunamadi'); process.exit(1);
}
const actual=fs.readdirSync(TOURS).filter(n=>fs.statSync(path.join(TOURS,n)).isFile());
const exactLower=new Map(actual.map(n=>[n.toLowerCase(),n]));
const byNorm=new Map();
for(const n of actual){
  const k=normStem(n);
  if(!byNorm.has(k)) byNorm.set(k,[]);
  byNorm.get(k).push(n);
}
for(const arr of byNorm.values()){
  arr.sort((a,b)=>{
    const abase=/\(\d+\)\.[^.]+$/.test(a)?1:0;
    const bbase=/\(\d+\)\.[^.]+$/.test(b)?1:0;
    if(abase!==bbase) return abase-bbase; // prefer unsuffixed base
    return numericSuffix(a)-numericSuffix(b);
  });
}

const textFiles=walk(SRC).filter(f=>/\.(astro|ts|js|tsx|jsx|json|md|mdx)$/i.test(f));
const changes=[], unresolved=[], ambiguous=[];
const re=/\/images\/tours\/([^"'`}\)\s<>]+)/g;

for(const f of textFiles){
  let s=fs.readFileSync(f,'utf8'), before=s;
  s=s.replace(re,(full,raw)=>{
    let fn=raw;
    try{fn=decodeURIComponent(raw)}catch{}
    if(exactLower.has(fn.toLowerCase())){
      const real=exactLower.get(fn.toLowerCase());
      if(real!==fn){
        changes.push({file:path.relative(ROOT,f).replaceAll('\\','/'),from:fn,to:real,mode:'case'});
        return `/images/tours/${real}`;
      }
      return full;
    }

    const k=normStem(fn);
    const cands=byNorm.get(k)||[];
    if(cands.length){
      const chosen=cands[0];
      changes.push({file:path.relative(ROOT,f).replaceAll('\\','/'),from:fn,to:chosen,mode:cands.length===1?'normalized':'normalized-preferred',candidates:cands});
      return `/images/tours/${chosen}`;
    }

    unresolved.push({file:path.relative(ROOT,f).replaceAll('\\','/'),value:fn});
    return full;
  });

  if(s!==before){
    backup(f); fs.writeFileSync(f,s,'utf8');
    console.log('[OK]',path.relative(ROOT,f)); 
  }
}

// Targeted homepage/i18n fallbacks for known production misses.
// Replace common nonexistent canonical filenames with real existing files.
const targeted = new Map([
  ['Photo-Shoot-Flying-Dress-Experience.webp','Photo Shoot & Flying Dress Experience.webp'],
  ['Photo-Shoot-&-Flying-Dress-Experience.webp','Photo Shoot & Flying Dress Experience.webp'],
  ['photo-shoot-flying-dress-experience.webp','Photo Shoot & Flying Dress Experience.webp'],
  ['Pamukkale-Balloons-Tour.webp','pamukkale-balloons-tour (1).webp'],
  ['pamukkale-balloons-tour.webp','pamukkale-balloons-tour (1).webp'],
  ['Sunrise-Sunset-Horse-Riding-Cappadocia.webp','sunrise-sunset-horse-riding-cappadocia.webp'],
  ['sunrise-or-sunset-horse-riding-cappadocia.webp','sunrise-sunset-horse-riding-cappadocia.webp']
]);

for(const f of textFiles){
  let s=fs.readFileSync(f,'utf8'), before=s;
  for(const [bad,good] of targeted){
    s=s.replaceAll(`/images/tours/${bad}`,`/images/tours/${good}`);
  }
  if(s!==before){
    backup(f); fs.writeFileSync(f,s,'utf8');
    console.log('[TARGET]',path.relative(ROOT,f));
  }
}

fs.mkdirSync(REPORT,{recursive:true});
fs.writeFileSync(path.join(REPORT,'report.json'),JSON.stringify({changes,unresolved,ambiguous},null,2));

console.log('');
console.log('Fuzzy asset fix Phase 2 tamamlandi.');
console.log('Duzeltilen referans:',changes.length);
console.log('Cozulemeyen:',unresolved.length);
console.log('Yedek:',path.relative(ROOT,BACKUP)+'/');
console.log('Rapor:',path.relative(ROOT,REPORT)+'/report.json');
console.log('');
console.log('Simdi:');
console.log('  npm run build');
console.log('  npx vercel --prod');
