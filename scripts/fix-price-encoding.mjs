import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const backup = path.join(root, `encoding-price-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(backup,{recursive:true});

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}
function backupFile(file){
  const rel=path.relative(root,file), dest=path.join(backup,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);
}

const cp1252Reverse = new Map([
  ['€',0x80],['‚',0x82],['ƒ',0x83],['„',0x84],['…',0x85],['†',0x86],['‡',0x87],['ˆ',0x88],['‰',0x89],['Š',0x8A],['‹',0x8B],['Œ',0x8C],['Ž',0x8E],['‘',0x91],['’',0x92],['“',0x93],['”',0x94],['•',0x95],['–',0x96],['—',0x97],['˜',0x98],['™',0x99],['š',0x9A],['›',0x9B],['œ',0x9C],['ž',0x9E],['Ÿ',0x9F]
]);
function cp1252Bytes(str){const arr=[];for(const ch of str){const c=ch.codePointAt(0);if(c<=255)arr.push(c);else if(cp1252Reverse.has(ch))arr.push(cp1252Reverse.get(ch));else return null;}return Buffer.from(arr)}
function badScore(s){return (s.match(/Ã|Â|â[€-ÿ]|ðŸ|Ä[±ŸžŸ]|Å[Ÿž]|ï¿½/g)||[]).length*5+(s.match(/�/g)||[]).length*20}
function fixText(s){let cur=s;for(let i=0;i<3;i++){const b=cp1252Bytes(cur);if(!b)break;const next=b.toString('utf8');if(next.includes('�')||badScore(next)>=badScore(cur))break;cur=next;}return cur}

const codeFiles=walk(path.join(root,'src')).filter(f=>/\.(astro|ts|js|mjs)$/.test(f));
let encodingFixed=0, priceFixed=0;
for(const file of codeFiles){
  let s=fs.readFileSync(file,'utf8'), original=s;
  // Repair classic UTF-8 read as Windows-1252 only when it objectively reduces mojibake markers.
  if(badScore(s)>0){const fixed=fixText(s);if(fixed!==s){s=fixed;encodingFixed++;}}

  // Custom detail pages using tbcMainPrice: active future availability controls the starting price; default is fallback only.
  if(s.includes('tbcMainPrice') && s.includes('const values=[Number(tbcProduct.default_price||0),...future.filter')){
    s=s.replace(/const values=\[Number\(tbcProduct\.default_price\|\|0\),\.\.\.future\.filter\(r=>tbcRemaining\(r\)>0\)\.map\(r=>Number\(r\.price\|\|0\)\)\]\.filter\(v=>v>0\);\s*if\(values\.length && tbcMainPrice\) tbcMainPrice\.textContent=tbcMoney\(Math\.min\(\.\.\.values\)\);/g,
`const values=future.filter(r=>tbcRemaining(r)>0).map(r=>Number(r.price||0)).filter(v=>v>0);
      const tbcMinPrice=values.length?Math.min(...values):Number(tbcProduct.default_price||0);
      if(tbcMinPrice>0 && tbcMainPrice){
        tbcMainPrice.textContent=tbcMoney(tbcMinPrice);
        let tbcOldPrice=document.getElementById('tbc-main-old-price');
        if(!tbcOldPrice){tbcOldPrice=document.createElement('del');tbcOldPrice.id='tbc-main-old-price';tbcOldPrice.style.cssText='margin-right:8px;font-size:16px;color:#8b95a5;font-weight:700;text-decoration:line-through';tbcMainPrice.parentNode?.insertBefore(tbcOldPrice,tbcMainPrice)}
        tbcOldPrice.textContent=tbcMoney(Math.round(tbcMinPrice*1.20));
      }`);
    if(s!==original) priceFixed++;
  }
  if(s!==original){backupFile(file);fs.writeFileSync(file,s,'utf8')}
}
console.log(`Encoding files repaired: ${encodingFixed}`);
console.log(`Custom detail price files repaired: ${priceFixed}`);
console.log(`Backup: ${backup}`);
