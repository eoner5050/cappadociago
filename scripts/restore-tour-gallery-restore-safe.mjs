import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const TOURS=path.join(ROOT,'public','images','tours');

const aliases=[
'Goreme-Standart-Hot-Air-Balloon-Tour.webp',
'Goreme-Comfort-Hot-Air-Balloon-Tour.webp',
'Green-Tour-Cappadocia.webp',
'Cappadocia-Pottery-Making-Experience.webp',
'turkish-night-with-cave-dinner-cappadocia (1).webp',
'Balloons-Watching-Tour-Cappadocia.webp',
'soganli-valley-balloon-tour (1).webp',
'Photo Shoot & Flying Dress Experience (2).webp',
'sunrise-sunset-horse-riding-cappadocia (1).webp',
'Blue-Tour-Cappadocia-Discover-Hidden-Valleys.webp',
'Private-Mix-Cappadocia-Tour.webp',
'pamukkale-balloons-tour (1).webp'
];

let n=0;
for(const name of aliases){
  const p=path.join(TOURS,name);
  if(fs.existsSync(p)){fs.unlinkSync(p);n++;}
}
console.log(`[OK] ${n} alias dosyasi kaldirildi. Orijinal tur fotograflarina dokunulmadi.`);
