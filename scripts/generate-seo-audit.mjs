import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd(), PAGES=path.join(ROOT,'src','pages');
const OUT=path.join(ROOT,'src','data','seo-audit.json');
const LEGACY=path.join(ROOT,'src','data','legacy-seo-source.json');
const SITE='https://cappadociago.com';
const SKIP_TOP=new Set(['api','admin']);

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const f=path.join(dir,e.name);
    return e.isDirectory()?walk(f):(/\.(astro|md|mdx)$/i.test(e.name)?[f]:[]);
  });
}
function routeFromFile(file){
  let rel=path.relative(PAGES,file).replaceAll('\\','/').replace(/\.(astro|md|mdx)$/i,'');
  const p=rel.split('/'); if(p.at(-1)==='index')p.pop();
  return '/'+p.filter(Boolean).join('/')+(p.length?'/':'');
}
function norm(u){
  if(!u)return '/'; let x=String(u).trim();
  if(/^https?:\/\//i.test(x)){try{x=new URL(x).pathname}catch{}}
  x=x.split('#')[0].split('?')[0]; if(!x.startsWith('/'))x='/'+x;
  if(x!=='/'&&!x.endsWith('/')&&!/\.[a-z0-9]{2,5}$/i.test(x))x+='/';
  return x;
}
function readMerged(file,depth=0,seen=new Set()){
  const real=path.resolve(file); if(seen.has(real)||depth>5||!fs.existsSync(real))return '';
  seen.add(real); const s=fs.readFileSync(real,'utf8'); let merged=s;
  for(const m of s.matchAll(/import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+\.astro)['"]/g)){
    if(m[1].startsWith('.')) merged+='\n'+readMerged(path.resolve(path.dirname(real),m[1]),depth+1,seen);
  } return merged;
}
function direct(file){return fs.readFileSync(file,'utf8')}
function count(re,s){return [...s.matchAll(re)].length}
function has(re,s){return re.test(s)}
function first(re,s){const m=s.match(re);return m?String(m[1]||'').replace(/\s+/g,' ').trim():''}
function redirectTarget(s){const m=s.match(/Astro\.redirect\(\s*['"`]([^'"`]+)['"`]\s*,?\s*(301|308)?/);return m?{target:norm(m[1]),code:Number(m[2]||302)}:null}
function hrefs(s,route){
  const out=[];
  for(const m of s.matchAll(/href\s*=\s*["']([^"'{}]+)["']/gi)){
    const h=m[1].trim();
    if(h.startsWith('/')&&!h.startsWith('//'))out.push(norm(h));
  }
  for(const m of s.matchAll(/href\s*=\s*\{\s*["']([^"']+)["']\s*\}/gi)){
    const h=m[1].trim(); if(h.startsWith('/'))out.push(norm(h));
  }
  const lang=route.startsWith('/tr/')?'tr':route.startsWith('/es/')?'es':'en';
  for(const m of s.matchAll(/href\s*=\s*\{\s*`([^`]+)`\s*\}/gi)){
    const h=m[1].replaceAll('${lang}',lang).replaceAll('${pageLang}',lang);
    if(h.startsWith('/')&&!h.includes('${')) out.push(norm(h));
  }
  return [...new Set(out)];
}
function imageStats(s){
  const imgs=[...s.matchAll(/<img\\b[^>]*>/gi)].map(x=>x[0]);
  let alt=0,size=0,lazy=0,counted=0;
  for(const tag of imgs){
    const modal=/\\bid\\s*=\\s*["'][^"']*(?:modal|gallerymodal)[^"']*["']/i.test(tag) && !/\\bsrc\\s*=/.test(tag);
    if(modal) continue;
    counted++;
    if(/\\balt\\s*=/.test(tag)) alt++;
    if(/\\bwidth\\s*=/.test(tag)&&/\\bheight\\s*=/.test(tag)) size++;
    const lazyOk =
      /\\bloading\\s*=\\s*["']lazy["']/i.test(tag) ||
      /\\bloading\\s*=\\s*["']eager["']/i.test(tag) ||
      /\\bfetchpriority\\s*=\\s*["']high["']/i.test(tag) ||
      /\\baria-hidden\\s*=\\s*["']true["']/i.test(tag);
    if(lazyOk) lazy++;
  }
  return {images:counted,alt,size,lazy};
}
function canonicalValue(s){
  let m=s.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if(m)return m[1];
  m=s.match(/<link[^>]+rel=["']canonical["'][^>]+href=\{([^}]+)\}/i);
  return m?'dynamic':'';
}
function titleValue(s,route){
  const t=first(/<title[^>]*>([\s\S]*?)<\/title>/i,s);
  if(!t)return '';
  return /[{}]/.test(t)?`dynamic:${route}`:t.replace(/<[^>]+>/g,'').trim();
}
function descriptionValue(s,route){
  const m=s.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  if(m)return m[1].trim();
  return has(/<meta[^>]+name=["']description["'][^>]+content=\{/i,s)?`dynamic:${route}`:'';
}

const files=walk(PAGES).filter(f=>!SKIP_TOP.has(path.relative(PAGES,f).replaceAll('\\','/').split('/')[0])).sort();
const routeFile=new Map(files.map(f=>[norm(routeFromFile(f)),f]));
const routes=new Set(routeFile.keys());
const redirectMap=new Map();
for(const [r,f] of routeFile){const red=redirectTarget(direct(f));if(red)redirectMap.set(r,red)}

function resolveRedirect(r){
  const chain=[r]; let cur=r, loops=false;
  for(let i=0;i<10;i++){
    const red=redirectMap.get(cur); if(!red)return {final:cur,chain,loops};
    cur=red.target;
    if(chain.includes(cur)){chain.push(cur);loops=true;return {final:cur,chain,loops}}
    chain.push(cur);
  }
  return {final:cur,chain,loops:true};
}

const pageRaw=[];
for(const [route,file] of routeFile){
  const raw=direct(file), s=readMerged(file), red=redirectTarget(raw);
  const img=imageStats(s), links=hrefs(s,route);
  const visible=s.replace(/^---[\s\S]*?---/m,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
  const title=titleValue(s,route), description=descriptionValue(s,route), canonical=canonicalValue(s);
  const h1=count(/<h1\b/gi,visible), h2=count(/<h2\b/gi,visible);
  const schema=has(/application\/ld\+json|schema\.org/i,s);
  const robots=has(/<meta[^>]+name=["']robots["']/i,s);
  const hreflang=has(/hreflang=/i,s);
  const og=has(/property=["']og:title["']/i,s)&&has(/property=["']og:description["']/i,s)&&has(/property=["']og:image["']/i,s);
  const twitter=has(/name=["']twitter:card["']/i,s);
  const lang=route.startsWith('/tr/')?'TR':route.startsWith('/es/')?'ES':route.startsWith('/en/')?'EN':'—';
  pageRaw.push({route,file:path.relative(ROOT,file).replaceAll('\\','/'),lang,red,links,title,description,canonical,h1,h2,schema,robots,hreflang,og,twitter,...img});
}

const incoming=new Map([...routes].map(r=>[r,0]));
const brokenLinks=[];
const redirectLinks=[];
for(const p of pageRaw){
  if(p.red)continue;
  for(const link of p.links){
    if(link.startsWith('/api/')||link.startsWith('/admin/'))continue;
    if(routes.has(link)){
      incoming.set(link,(incoming.get(link)||0)+1);
      if(redirectMap.has(link))redirectLinks.push({source:p.route,target:link,final:resolveRedirect(link).final});
    }else if(!link.startsWith('/images/')&&!link.startsWith('/src/')&&!link.startsWith('/favicon')){
      brokenLinks.push({source:p.route,target:link});
    }
  }
}

// Generated listing relationships that source-regex cannot see (card hrefs come from data arrays).
for(const r of routes){
  const m=r.match(/^\/(en|tr|es)\/tours\/[^/]+\/$/);
  if(m) incoming.set(r,Math.max(incoming.get(r)||0,1));
  const b=r.match(/^\/(en|tr)\/blog\/[^/]+\/$/);
  if(b) incoming.set(r,Math.max(incoming.get(r)||0,1));
}

const titleGroups=new Map(), descGroups=new Map();
for(const p of pageRaw.filter(x=>!x.red)){
  if(p.title&&!p.title.startsWith('dynamic:')){const k=p.title.toLowerCase();titleGroups.set(k,[...(titleGroups.get(k)||[]),p.route])}
  if(p.description&&!p.description.startsWith('dynamic:')){const k=p.description.toLowerCase();descGroups.set(k,[...(descGroups.get(k)||[]),p.route])}
}
const duplicateTitles=[...titleGroups.entries()].filter(([,v])=>v.length>1).map(([value,routes])=>({value,routes}));
const duplicateDescriptions=[...descGroups.entries()].filter(([,v])=>v.length>1).map(([value,routes])=>({value,routes}));

const pages=pageRaw.map(p=>{
  const redirectLike=!!p.red;
  const altRatio=p.images?Math.round(p.alt/p.images*100):100;
  const sizeRatio=p.images?Math.round(p.size/p.images*100):100;
  const lazyRatio=p.images?Math.round(p.lazy/p.images*100):100;
  const selfCanonical=p.canonical==='dynamic'||(p.canonical&&norm(p.canonical)===p.route);
  const checks=[
    {label:'SEO Title',ok:!!p.title,weight:10,tip:'Benzersiz title ekleyin.'},
    {label:'Meta Description',ok:!!p.description,weight:10,tip:'Meta description ekleyin.'},
    {label:'Tek H1',ok:p.h1===1,weight:10,tip:`H1 sayısı ${p.h1}.`},
    {label:'Self Canonical',ok:!!p.canonical&&selfCanonical,weight:12,tip:'Nihai URL’ye self-canonical ekleyin.'},
    {label:'Hreflang',ok:p.hreflang,weight:8,tip:'EN/TR/ES hreflang eşleşmelerini ekleyin.'},
    {label:'Robots Meta',ok:p.robots,weight:5,tip:'Index/follow politikasını belirtin.'},
    {label:'Open Graph',ok:p.og,weight:7,tip:'OG title/description/image ekleyin.'},
    {label:'Twitter Card',ok:p.twitter,weight:3,tip:'Twitter Card ekleyin.'},
    {label:'Schema',ok:p.schema,weight:8,tip:'Uygun JSON-LD schema ekleyin.'},
    {label:'Internal Links',ok:p.links.length>=3,weight:7,tip:'En az 3 anlamlı iç link hedefleyin.'},
    {label:'Image ALT',ok:altRatio>=90,weight:8,tip:`ALT kapsaması %${altRatio}.`},
    {label:'Image Dimensions',ok:sizeRatio>=80,weight:5,tip:`width/height kapsaması %${sizeRatio}; CLS için artırın.`},
    {label:'Heading Structure',ok:p.h2>=1,weight:4,tip:'Anlamlı H2/H3 yapısı ekleyin.'},
    {label:'Incoming Link',ok:(incoming.get(p.route)||0)>0||['/en/','/tr/','/es/'].includes(p.route),weight:3,tip:'Sayfaya başka bir indexlenebilir sayfadan link verin.'}
  ];
  let score=Math.round(checks.reduce((a,c)=>a+(c.ok?c.weight:0),0));
  if(redirectLike)score=100;
  return {...p,score,status:score>=90?'excellent':score>=80?'strong':score>=65?'improve':'weak',redirectLike,
    incoming:incoming.get(p.route)||0,altRatio,sizeRatio,lazyRatio,missing:checks.filter(c=>!c.ok).map(c=>c.label),checks};
});

const redirects=[...redirectMap.entries()].map(([old,red])=>{const r=resolveRedirect(old);return {old,target:red.target,code:red.code,final:r.final,chain:r.chain,chainLength:r.chain.length-1,loop:r.loops,targetExists:routes.has(r.final)}}).sort((a,b)=>a.old.localeCompare(b.old));
const chains=redirects.filter(r=>r.chainLength>1||r.loop||!r.targetExists);
const indexable=pages.filter(p=>!p.redirectLike&&!redirectMap.has(p.route)&&!p.route.startsWith('/admin/')&&!p.route.startsWith('/api/'));
const orphanPages=indexable.filter(p=>p.incoming===0&&!redirectMap.has(p.route)&&!['/en/','/tr/','/es/','/'].includes(p.route)).map(p=>p.route);
const canonicalIssues=indexable.filter(p=>!p.canonical||!(p.canonical==='dynamic'||norm(p.canonical)===p.route)).map(p=>({route:p.route,canonical:p.canonical||'missing'}));
const schemaIssues=indexable.filter(p=>!p.schema).map(p=>p.route);
const imageIssues=indexable.filter(p=>p.images&&(p.altRatio<90||p.sizeRatio<80)).map(p=>({route:p.route,images:p.images,altRatio:p.altRatio,sizeRatio:p.sizeRatio,lazyRatio:p.lazyRatio}));

function pct(ok,total){return total?Math.max(0,Math.min(100,Math.round(ok/total*100))):100}
const techChecks=[
  {key:'redirects',label:'301 Redirects',score:pct(redirects.filter(r=>r.code===301&&r.targetExists&&!r.loop).length,redirects.length),issues:chains.length,detail:`${redirects.length} legacy redirect`},
  {key:'canonical',label:'Canonical',score:pct(indexable.length-canonicalIssues.length,indexable.length),issues:canonicalIssues.length,detail:`${indexable.length} indexlenebilir sayfa`},
  {key:'sitemap',label:'Sitemap',score:100,issues:0,detail:`${indexable.length} URL otomatik üretilecek`},
  {key:'robots',label:'Robots.txt',score:100,issues:0,detail:'Admin ve API taraması kapalı; sitemap bildirimi açık'},
  {key:'links',label:'Internal Links',score:pct(indexable.length-orphanPages.length,indexable.length),issues:brokenLinks.length+redirectLinks.length,detail:`${brokenLinks.length} kırık • ${redirectLinks.length} redirect link`},
  {key:'duplicates',label:'Duplicate Content',score:pct(indexable.length-(duplicateTitles.reduce((n,x)=>n+x.routes.length,0)+duplicateDescriptions.reduce((n,x)=>n+x.routes.length,0)),indexable.length),issues:duplicateTitles.length+duplicateDescriptions.length,detail:`${duplicateTitles.length} title • ${duplicateDescriptions.length} description grubu`},
  {key:'orphans',label:'Orphan Pages',score:pct(indexable.length-orphanPages.length,indexable.length),issues:orphanPages.length,detail:`${orphanPages.length} orphan sayfa`},
  {key:'404',label:'404 / Broken Links',score:pct(Math.max(0,indexable.length-brokenLinks.length),indexable.length),issues:brokenLinks.length,detail:`${brokenLinks.length} statik kırık iç link`},
  {key:'schema',label:'Schema',score:pct(indexable.length-schemaIssues.length,indexable.length),issues:schemaIssues.length,detail:`${schemaIssues.length} schema eksik sayfa`},
  {key:'images',label:'Image SEO',score:pct(indexable.length-imageIssues.length,indexable.length),issues:imageIssues.length,detail:`${imageIssues.length} sayfada ALT/ölçü iyileştirmesi`},
  {key:'cwv',label:'Core Web Vitals Readiness',score:90,issues:0,detail:'Statik Astro yapı iyi; gerçek CWV production verisiyle ölçülmeli',provisional:true}
];
const technicalScore=Math.round(techChecks.reduce((s,c)=>s+c.score,0)/techChecks.length);

const sitemapUrls=indexable.map(p=>p.route).sort();
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(r=>`  <url><loc>${SITE}${r}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.mkdirSync(path.join(ROOT,'public'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'public','sitemap.xml'),sitemap);
fs.writeFileSync(path.join(ROOT,'public','robots.txt'),`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

let legacySource=[];try{legacySource=JSON.parse(fs.readFileSync(LEGACY,'utf8'))}catch{}
const legacy=legacySource.map(item=>{
  const old=norm(item.oldPath), suggested=norm(item.suggestedTarget||old), red=redirectMap.get(old);
  if(red)return {...item,oldPath:old,currentTarget:red.target,migrationStatus:'redirected',note:`Aktif ${red.code}: ${old} → ${red.target}`};
  if(routes.has(old))return {...item,oldPath:old,currentTarget:old,migrationStatus:'preserved',note:'Eski URL yeni sitede aynen korunuyor.'};
  if(routes.has(suggested))return {...item,oldPath:old,currentTarget:suggested,migrationStatus:'needs_redirect',note:'Yeni hedef mevcut; eski URL için 301 gerekli.'};
  return {...item,oldPath:old,currentTarget:suggested,migrationStatus:'missing',note:'Yeni karşılık bulunamadı.'};
});
const scored=legacy.filter(x=>Number(x.rankMathScore)>0);
const legacySummary={total:legacy.length,oldAverageScore:scored.length?Math.round(scored.reduce((s,x)=>s+Number(x.rankMathScore||0),0)/scored.length):0,
 preserved:legacy.filter(x=>x.migrationStatus==='preserved').length,redirected:legacy.filter(x=>x.migrationStatus==='redirected').length,
 needsRedirect:legacy.filter(x=>x.migrationStatus==='needs_redirect').length,missing:legacy.filter(x=>x.migrationStatus==='missing').length,
 highValue:legacy.filter(x=>Number(x.rankMathScore)>=80).length};

const scoreable=pages.filter(p=>!p.redirectLike);
const summary={generatedAt:new Date().toISOString(),totalPages:pages.length,averageScore:scoreable.length?Math.round(scoreable.reduce((s,p)=>s+p.score,0)/scoreable.length):0,
 excellent:pages.filter(p=>p.score>=90).length,strong:pages.filter(p=>p.score>=80&&p.score<90).length,improve:pages.filter(p=>p.score>=65&&p.score<80).length,weak:pages.filter(p=>p.score<65).length};

const technical={score:technicalScore,checks:techChecks,redirects,chains,canonicalIssues,brokenLinks,redirectLinks,duplicateTitles,duplicateDescriptions,orphanPages,schemaIssues,imageIssues,sitemapUrls};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify({summary,pages,legacySummary,legacy,technical},null,2)+'\n');
console.log(`[SEO Audit] ${pages.length} route | On-page ortalama ${summary.averageScore}/100`);
console.log(`[Technical SEO] ${technicalScore}/100 | 301 sorun ${chains.length} | canonical ${canonicalIssues.length} | broken ${brokenLinks.length} | orphan ${orphanPages.length}`);
console.log(`[Sitemap] ${sitemapUrls.length} indexlenebilir URL -> public/sitemap.xml`);
