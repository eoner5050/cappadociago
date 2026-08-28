import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXTS = new Set(['.astro', '.html', '.jsx', '.tsx']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return EXTS.has(path.extname(e.name).toLowerCase()) ? [p] : [];
  });
}

function lineNo(s, index) {
  return s.slice(0, index).split(/\r?\n/).length;
}

function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\}|[^\\s>]+)`, 'i');
  return re.test(tag);
}

const files = walk(SRC);
const findings = [];
let totalImages = 0, missingAlt = 0, missingSize = 0, missingLazy = 0;

for (const file of files) {
  const s = fs.readFileSync(file, 'utf8');
  const re = /<img\b[\s\S]*?>/gi;
  let m;
  while ((m = re.exec(s))) {
    totalImages++;
    const tag = m[0];
    const hasAlt = attr(tag, 'alt');
    const hasW = attr(tag, 'width');
    const hasH = attr(tag, 'height');
    const hasLazy = /\bloading\s*=\s*(?:"lazy"|'lazy'|\{\s*["']lazy["']\s*\})/i.test(tag);
    const issues = [];
    if (!hasAlt) { issues.push('ALT'); missingAlt++; }
    if (!(hasW && hasH)) { issues.push('SIZE'); missingSize++; }
    if (!hasLazy) { issues.push('LAZY'); missingLazy++; }
    if (issues.length) {
      findings.push({
        file: path.relative(ROOT, file).replaceAll('\\','/'),
        line: lineNo(s, m.index),
        issues,
        tag: tag.replace(/\s+/g, ' ').slice(0, 220)
      });
    }
  }
}

const grouped = new Map();
for (const f of findings) {
  if (!grouped.has(f.file)) grouped.set(f.file, {ALT:0,SIZE:0,LAZY:0,total:0});
  const g = grouped.get(f.file);
  g.total++;
  for (const x of f.issues) g[x]++;
}

const sorted = [...grouped.entries()].sort((a,b)=>b[1].total-a[1].total);

console.log('\n=== TBC IMAGE SEO DIAGNOSE (READ-ONLY) ===');
console.log(`Taranan kaynak dosya : ${files.length}`);
console.log(`Toplam <img>         : ${totalImages}`);
console.log(`Sorunlu <img>        : ${findings.length}`);
console.log(`ALT eksik            : ${missingAlt}`);
console.log(`width/height eksik   : ${missingSize}`);
console.log(`loading="lazy" eksik : ${missingLazy}`);

console.log('\n=== EN COK SORUN URETEN DOSYALAR ===');
for (const [file,g] of sorted.slice(0,30)) {
  console.log(`${String(g.total).padStart(3)} sorun | ALT ${g.ALT} | SIZE ${g.SIZE} | LAZY ${g.LAZY} | ${file}`);
}

console.log('\n=== DETAY (ilk 100) ===');
for (const f of findings.slice(0,100)) {
  console.log(`\n${f.file}:${f.line} [${f.issues.join(', ')}]\n  ${f.tag}`);
}

const reportDir = path.join(ROOT, 'image-seo-diagnose');
fs.mkdirSync(reportDir, {recursive:true});
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  summary:{files:files.length,totalImages,problemImages:findings.length,missingAlt,missingSize,missingLazy},
  byFile:Object.fromEntries(sorted),
  findings
}, null, 2));

console.log('\n[OK] Detayli rapor: image-seo-diagnose/report.json');
console.log('[NOT] Hicbir site dosyasi degistirilmedi.\n');
