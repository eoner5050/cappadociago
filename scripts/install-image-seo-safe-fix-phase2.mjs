import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const BACKUP = path.join(ROOT, '.image-seo-safe-fix-phase2-backup');
const EXTS = new Set(['.astro', '.html', '.jsx', '.tsx']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    const p = path.join(dir,e.name);
    if (e.isDirectory()) return walk(p);
    return EXTS.has(path.extname(e.name).toLowerCase()) ? [p] : [];
  });
}
function mkdirp(p){ fs.mkdirSync(p,{recursive:true}); }
function backup(file){
  const rel=path.relative(ROOT,file);
  const dest=path.join(BACKUP,rel);
  mkdirp(path.dirname(dest));
  if(!fs.existsSync(dest)) fs.copyFileSync(file,dest);
}
function hasAttr(tag,n){
  return new RegExp(`\\b${n}\\s*=`, 'i').test(tag);
}
function isHeroLike(tag){
  return /\bloading\s*=\s*(?:"eager"|'eager'|\{\s*["']eager["']\s*\})/i.test(tag) ||
         /\bfetchpriority\s*=\s*(?:"high"|'high'|\{\s*["']high["']\s*\})/i.test(tag) ||
         /\b(hero|banner|cover|above[-_ ]?fold|lcp)\b/i.test(tag);
}
function isModal(tag){
  return /\bid\s*=\s*(?:"[^"]*(modal|gallery)[^"]*"|'[^']*(modal|gallery)[^']*')/i.test(tag);
}
function isIcon(tag){
  return /\/images\/icons\//i.test(tag) || /\b(icon|logo)\b/i.test(tag);
}
function staticSrc(tag){
  const m=tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return m?.[1] || '';
}
function knownDims(src){
  const s=src.toLowerCase();
  if(s.includes('/images/icons/')) return [24,24];
  if(s.includes('turkey-balloons-cappadocia-2.webp')) return [600,200];
  if(s.includes('turkey-balloons-cappadocia.webp')) return [600,200];
  if(s.includes('/images/tours/')) return [800,600];
  return null;
}
function addBeforeClose(tag, text){
  return tag.replace(/\s*\/?>$/, m => ` ${text}${m}`);
}

let changedFiles=0, changedImgs=0, lazyAdded=0, sizeAdded=0, skippedDynamicSize=0, skippedHero=0, skippedModal=0;
const notes=[];

for(const file of walk(SRC)){
  let s=fs.readFileSync(file,'utf8');
  let fileChanged=false;
  s=s.replace(/<img\b[\s\S]*?>/gi, tag=>{
    let t=tag, changed=false;

    const hero=isHeroLike(t);
    const modal=isModal(t);

    // Never lazy-load explicit/likely LCP hero images or modal placeholders.
    if(!hasAttr(t,'loading')){
      if(hero){ skippedHero++; }
      else if(modal){ skippedModal++; }
      else {
        t=addBeforeClose(t,'loading="lazy"');
        lazyAdded++; changed=true;
      }
    }

    // Add dimensions only where we have a conservative known static class/source.
    if(!(hasAttr(t,'width') && hasAttr(t,'height'))){
      const src=staticSrc(t);
      const dims=knownDims(src);
      if(dims && !modal){
        if(!hasAttr(t,'width'))  t=addBeforeClose(t,`width="${dims[0]}"`);
        if(!hasAttr(t,'height')) t=addBeforeClose(t,`height="${dims[1]}"`);
        sizeAdded++; changed=true;
      } else {
        skippedDynamicSize++;
      }
    }

    if(changed){ changedImgs++; fileChanged=true; }
    return t;
  });

  if(fileChanged){
    backup(file);
    fs.writeFileSync(file,s,'utf8');
    changedFiles++;
    notes.push(path.relative(ROOT,file).replaceAll('\\','/'));
  }
}

mkdirp(path.join(ROOT,'image-seo-safe-fix-phase2'));
fs.writeFileSync(path.join(ROOT,'image-seo-safe-fix-phase2','result.json'),JSON.stringify({
  changedFiles,changedImgs,lazyAdded,sizeAdded,skippedDynamicSize,skippedHero,skippedModal,files:notes
},null,2));

console.log('');
console.log('Image SEO SAFE FIX Phase 2 tamamlandi.');
console.log(`Degisen dosya        : ${changedFiles}`);
console.log(`Degisen <img>        : ${changedImgs}`);
console.log(`Eklenen lazy         : ${lazyAdded}`);
console.log(`Eklenen width/height : ${sizeAdded}`);
console.log(`Korunan hero/eager   : ${skippedHero}`);
console.log(`Korunan modal        : ${skippedModal}`);
console.log(`Olcusu tahmin edilmeyen/dinamik: ${skippedDynamicSize}`);
console.log(`Yedekler: ${path.relative(ROOT,BACKUP)}/`);
console.log('');
console.log('Simdi sirayla calistir:');
console.log('  npm run build');
console.log('  npm run seo:audit');
console.log('');
console.log('NOT: Script hero/eager/fetchpriority=high gorsellerini lazy yapmaz.');
console.log('NOT: Dinamik galeri gorsellerine uydurma width/height yazmaz.');
