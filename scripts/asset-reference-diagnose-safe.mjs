import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT,'src');
const TOURS = path.join(ROOT,'public','images','tours');
const REPORT = path.join(ROOT,'asset-reference-diagnose');

function walk(d){
  if(!fs.existsSync(d)) return [];
  return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(d,e.name);
    return e.isDirectory()?walk(p):[p];
  });
}
function normalize(s){
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,'and')
    .replace(/\s*\(\d+\)\s*(?=\.[^.]+$)/,'')
    .replace(/[^a-z0-9.]+/g,'');
}

const actual = fs.existsSync(TOURS)
  ? fs.readdirSync(TOURS).filter(n=>fs.statSync(path.join(TOURS,n)).isFile())
  : [];

const actualSet = new Set(actual);
const lowerMap = new Map();
for(const n of actual){
  const k=n.toLowerCase();
  if(!lowerMap.has(k)) lowerMap.set(k,[]);
  lowerMap.get(k).push(n);
}
const normMap = new Map();
for(const n of actual){
  const k=normalize(n);
  if(!normMap.has(k)) normMap.set(k,[]);
  normMap.get(k).push(n);
}

const files=walk(SRC).filter(f=>/\.(astro|ts|js|tsx|jsx|json|md|mdx)$/i.test(f));
const refs=[];
const re=/\/images\/tours\/([^"'`}\)\s<>]+)/g;

for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  let m;
  while((m=re.exec(s))){
    let name=m[1];
    try{name=decodeURIComponent(name)}catch{}
    refs.push({file:path.relative(ROOT,f).replaceAll('\\','/'),name});
  }
}

const unique = new Map();
for(const r of refs){
  if(!unique.has(r.name)) unique.set(r.name,{name:r.name,files:new Set()});
  unique.get(r.name).files.add(r.file);
}

const rows=[];
for(const {name,files} of unique.values()){
  const exact=actualSet.has(name);
  const caseCandidates=lowerMap.get(name.toLowerCase())||[];
  const normCandidates=normMap.get(normalize(name))||[];
  rows.push({
    reference:name,
    exactExists:exact,
    caseOnlyCandidates:caseCandidates,
    normalizedCandidates:normCandidates,
    usedBy:[...files]
  });
}

const missing=rows.filter(r=>!r.exactExists);
const caseOnly=missing.filter(r=>r.caseOnlyCandidates.length===1);
const unresolved=missing.filter(r=>r.caseOnlyCandidates.length!==1);

fs.mkdirSync(REPORT,{recursive:true});
fs.writeFileSync(path.join(REPORT,'report.json'),JSON.stringify({summary:{
  totalReferences:rows.length,
  exactOk:rows.length-missing.length,
  missing:missing.length,
  safeCaseOnlyAliases:caseOnly.length,
  unresolved:unresolved.length
},missing},null,2));

console.log('\n=== TBC ASSET REFERENCE DIAGNOSE - READ ONLY ===');
console.log(`Toplam benzersiz referans : ${rows.length}`);
console.log(`Birebir bulunan           : ${rows.length-missing.length}`);
console.log(`Production'da eksik       : ${missing.length}`);
console.log(`Sadece CASE farki         : ${caseOnly.length}`);
console.log(`Manuel karar gereken      : ${unresolved.length}`);

console.log('\n=== SADECE CASE FARKI OLANLAR ===');
for(const r of caseOnly){
  console.log(`${r.reference}  -->  ${r.caseOnlyCandidates[0]}`);
}

console.log('\n=== MANUEL KARAR GEREKENLER ===');
for(const r of unresolved){
  console.log(`\nREF: ${r.reference}`);
  console.log(`KULLANAN: ${r.usedBy.slice(0,5).join(', ')}`);
  if(r.normalizedCandidates.length){
    console.log(`ADAYLAR: ${r.normalizedCandidates.join(' | ')}`);
  } else {
    console.log('ADAYLAR: yok');
  }
}
console.log(`\n[OK] Rapor: ${path.relative(ROOT,REPORT)}/report.json`);
console.log('[NOT] Hicbir dosya degistirilmedi.\n');
