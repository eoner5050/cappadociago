import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const TOURS=path.join(ROOT,'public','images','tours');

const aliases=[
'Goreme-Standart-Hot-Air-Balloon-Tour.webp',
'Goreme-Comfort-Hot-Air-Balloon-Tour.webp',
'Green-Tour-Cappadocia.webp',
'Cappadocia-Pottery-Making-Experience.webp',
'Turkish-Night-With-Cave-Dinner-Cappadocia.webp',
'Balloons-Watching-Tour-Cappadocia.webp',
'Soganli-Valley-Balloon-Tour.webp',
'Photo-Shoot-and-Flying-Dress-Experience.webp',
'Sunrise-or-Sunset-Horse-Riding-Cappadocia.webp',
'Blue-Tour-Cappadocia-Discover-Hidden-Valleys.webp',
'Private-Cappadocia-Mix-Tour.webp',
'Pamukkale-Balloons-Tour.webp'
];

let n=0;
for(const name of aliases){
  const p=path.join(TOURS,name);
  if(fs.existsSync(p)){fs.unlinkSync(p);n++;}
}
console.log(`[OK] ${n} alias dosyasi kaldirildi. Orijinal tur fotograflarina dokunulmadi.`);
