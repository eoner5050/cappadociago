import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TOURS = path.join(ROOT,'public','images','tours');
const BACKUP = path.join(ROOT,'.tour-gallery-restore-safe-backup');
const REPORT = path.join(ROOT,'tour-gallery-restore-safe');

function copyAlias(srcName,dstName,reason){
  const src=path.join(TOURS,srcName);
  const dst=path.join(TOURS,dstName);
  if(!fs.existsSync(src)){
    return {ok:false,src:srcName,dst:dstName,reason,error:'source-missing'};
  }
  if(fs.existsSync(dst)){
    return {ok:true,src:srcName,dst:dstName,reason,skipped:'already-exists'};
  }
  fs.mkdirSync(BACKUP,{recursive:true});
  fs.copyFileSync(src,dst);
  return {ok:true,src:srcName,dst:dstName,reason,created:true};
}

if(!fs.existsSync(TOURS)){
  console.error('public/images/tours bulunamadi.');
  process.exit(1);
}

const actual=fs.readdirSync(TOURS).filter(n=>fs.statSync(path.join(TOURS,n)).isFile());
const byLower=new Map(actual.map(n=>[n.toLowerCase(),n]));
const results=[];

// 1) SAFE: only-case aliases. Code stays untouched; Linux/Vercel gets the exact expected filename.
const caseAliases=[
  ['goreme-standart-hot-air-balloon-tour.webp','Goreme-Standart-Hot-Air-Balloon-Tour.webp'],
  ['goreme-comfort-hot-air-balloon-tour.webp','Goreme-Comfort-Hot-Air-Balloon-Tour.webp'],
  ['green-tour-cappadocia.webp','Green-Tour-Cappadocia.webp'],
  ['cappadocia-pottery-making-experience.webp','Cappadocia-Pottery-Making-Experience.webp'],
  ['turkish-night-with-cave-dinner-cappadocia.webp','Turkish-Night-With-Cave-Dinner-Cappadocia.webp'],
  ['balloons-watching-tour-cappadocia.webp','Balloons-Watching-Tour-Cappadocia.webp'],
  ['soganli-valley-balloon-tour.webp','Soganli-Valley-Balloon-Tour.webp'],
];
for(const [src,dst] of caseAliases) results.push(copyAlias(src,dst,'case-safe alias'));

// 2) SAFE semantic aliases for known card/fallback names.
// These aliases DO NOT alter gallery family files. The 6-photo sets remain untouched.
const semanticAliases=[
  ['Photo Shoot & Flying Dress Experience.webp','Photo-Shoot-and-Flying-Dress-Experience.webp','photo-shoot card/fallback alias'],
  ['sunrise-sunset-horse-riding-cappadocia.webp','Sunrise-or-Sunset-Horse-Riding-Cappadocia.webp','horse-riding card/fallback alias'],
  ['Blue-Tour-Cappadocia.webp','Blue-Tour-Cappadocia-Discover-Hidden-Valleys.webp','blue-tour card/fallback alias'],
  ['Private-Mix-Cappadocia-Tour.webp','Private-Cappadocia-Mix-Tour.webp','private-mix card/fallback alias'],
];
for(const [src,dst,reason] of semanticAliases) results.push(copyAlias(src,dst,reason));

// Pamukkale has only numbered gallery files. Create only the expected fallback/card alias from (1).
// The numbered (1)-(6) gallery set is NOT changed.
results.push(copyAlias('pamukkale-balloons-tour (1).webp','Pamukkale-Balloons-Tour.webp','pamukkale card/fallback alias; gallery (1)-(6) preserved'));

// Verify families expected to keep their own photo sets.
const familyRules=[
  ['goreme-standart-hot-air-balloon-tour', /^goreme-standart-hot-air-balloon-tour(?: \(\d+\))?\.webp$/i],
  ['goreme-comfort-hot-air-balloon-tour', /^goreme-comfort-hot-air-balloon-tour(?: \(\d+\))?\.webp$/i],
  ['green-tour-cappadocia', /^green-tour-cappadocia(?: \(\d+\))?\.webp$/i],
  ['cappadocia-pottery-making-experience', /^cappadocia-pottery-making-experience(?: \(\d+\))?\.webp$/i],
  ['turkish-night-with-cave-dinner-cappadocia', /^turkish-night-with-cave-dinner-cappadocia(?: \(\d+\))?\.webp$/i],
  ['balloons-watching-tour-cappadocia', /^balloons-watching-tour-cappadocia(?: \(\d+\))?\.webp$/i],
  ['soganli-valley-balloon-tour', /^soganli-valley-balloon-tour(?: \(\d+\))?\.webp$/i],
  ['pamukkale-balloons-tour', /^pamukkale-balloons-tour(?: \(\d+\))?\.webp$/i],
  ['photo-shoot-flying-dress-experience', /^Photo Shoot & Flying Dress Experience(?: \(\d+\))?\.webp$/i],
  ['sunrise-sunset-horse-riding-cappadocia', /^sunrise-sunset-horse-riding-cappadocia(?: \(\d+\))?\.webp$/i],
];

const after=fs.readdirSync(TOURS).filter(n=>fs.statSync(path.join(TOURS,n)).isFile());
const families=familyRules.map(([slug,re])=>{
  const files=after.filter(n=>re.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  return {slug,count:files.length,firstSix:files.slice(0,6),extra:files.slice(6)};
});

fs.mkdirSync(REPORT,{recursive:true});
fs.writeFileSync(path.join(REPORT,'report.json'),JSON.stringify({results,families},null,2));

console.log('\n=== TOUR GALLERY RESTORE SAFE ===');
console.log('Kaynak kod DEGISTIRILMEDI.');
console.log('Mevcut tur foto setleri DEGISTIRILMEDI.');
console.log('Sadece Vercel/Linux icin gerekli alias kopyalari olusturuldu.\n');

for(const r of results){
  console.log(`${r.ok?'[OK]':'[ERR]'} ${r.src} -> ${r.dst}${r.created?' [created]':r.skipped?' [exists]':''}`);
}

console.log('\n=== TUR FOTO AILELERI ===');
for(const f of families){
  console.log(`${f.slug}: ${f.count} dosya | ilk 6: ${f.firstSix.join(' | ')}`);
  if(f.extra.length) console.log(`  kalan/footer adaylari: ${f.extra.join(' | ')}`);
}

console.log(`\nRapor: ${path.relative(ROOT,REPORT)}/report.json`);
console.log('\nSimdi:');
console.log('  npm run build');
console.log('  npx vercel --prod');
