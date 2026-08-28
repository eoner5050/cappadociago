import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");
const PUBLIC = path.join(ROOT, "public");
const BACKUP = path.join(ROOT, ".image-seo-safe-fix-backup");

const TARGET_COMPONENTS = [
  "HomePage.astro",
  "TourDetailPage.astro",
  "ActivityDetailPage.astro",
  "TransferDetailPage.astro",
  "CategoryToursPage.astro",
  "LegacySeoArticle.astro"
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function ensureDir(p){ fs.mkdirSync(path.dirname(p), {recursive:true}); }

function backup(file) {
  const rel = path.relative(ROOT, file);
  const dest = path.join(BACKUP, rel);
  ensureDir(dest);
  fs.copyFileSync(file, dest);
}

function readU24LE(buf, off) {
  return buf[off] | (buf[off+1] << 8) | (buf[off+2] << 16);
}

function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    // PNG
    if (b.length > 24 && b.slice(1,4).toString() === "PNG") {
      return {width:b.readUInt32BE(16), height:b.readUInt32BE(20)};
    }
    // JPEG
    if (b[0] === 0xFF && b[1] === 0xD8) {
      let i=2;
      while (i < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        const marker = b[i+1];
        const len = b.readUInt16BE(i+2);
        if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) {
          return {height:b.readUInt16BE(i+5), width:b.readUInt16BE(i+7)};
        }
        if (!len || len < 2) break;
        i += 2 + len;
      }
    }
    // WebP
    if (b.length > 30 && b.slice(0,4).toString() === "RIFF" && b.slice(8,12).toString() === "WEBP") {
      const type = b.slice(12,16).toString();
      if (type === "VP8X") {
        return {width:1+readU24LE(b,24), height:1+readU24LE(b,27)};
      }
      if (type === "VP8 " && b.length > 30) {
        // frame header starts after chunk header; signature 9d012a
        for (let i=20; i<Math.min(b.length-10, 80); i++) {
          if (b[i]===0x9d && b[i+1]===0x01 && b[i+2]===0x2a) {
            return {width:b.readUInt16LE(i+3)&0x3fff, height:b.readUInt16LE(i+5)&0x3fff};
          }
        }
      }
      if (type === "VP8L" && b.length > 25 && b[20] === 0x2f) {
        const bits = b.readUInt32LE(21);
        return {width:(bits & 0x3fff)+1, height:((bits >> 14) & 0x3fff)+1};
      }
    }
  } catch {}
  return null;
}

function staticSrc(tag) {
  const m = tag.match(/\bsrc\s*=\s*["'](\/images\/[^"']+)["']/i);
  return m ? m[1] : null;
}

function hasAttr(tag, name) {
  return new RegExp(`\\b${name}\\s*=`, "i").test(tag);
}

function isDecorative(tag) {
  return /\baria-hidden\s*=\s*["']true["']/i.test(tag) || /\balt\s*=\s*["']{2}/i.test(tag);
}

function className(tag) {
  const m = tag.match(/\bclass\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function fallbackSize(tag) {
  const cls = className(tag);
  const src = staticSrc(tag) || "";

  if (/logo/i.test(cls) || /\/logo\//i.test(src)) return {width:180,height:90};
  if (/icon|badge-logo|review-pill-logo|footer-info-icon/i.test(cls) || /\/icons\//i.test(src)) return {width:24,height:24};
  if (/partner|premium/i.test(cls) || /partners/i.test(src)) return {width:260,height:120};
  if (/cat-card|slider|tour-card|card-img|main-photo|side-photo|gallery/i.test(cls+" "+tag)) return {width:800,height:533};
  return {width:800,height:533};
}

function addAttrsToImg(tag) {
  let out = tag;
  const missingW = !hasAttr(out,"width");
  const missingH = !hasAttr(out,"height");
  if (!missingW && !missingH) return out;

  let size = null;
  const src = staticSrc(out);
  if (src) size = imageSize(path.join(PUBLIC, src.replace(/^\//,"")));
  if (!size) size = fallbackSize(out);

  const attrs = [];
  if (missingW) attrs.push(`width="${size.width}"`);
  if (missingH) attrs.push(`height="${size.height}"`);

  // Insert before closing > or />
  out = out.replace(/\s*\/?>$/, m => ` ${attrs.join(" ")}${m.trimStart()}`);
  return out;
}

function ensureLoading(tag) {
  let out = tag;
  if (hasAttr(out,"loading")) return out;
  // Never lazy-load probable LCP/hero images.
  if (/hero|mobile-hero|fetchpriority\s*=\s*["']high["']/i.test(out)) return out;
  // Decorative tiny icons don't need a forced loading mode.
  if (/\/icons\//i.test(out) || /icon|badge-logo|review-pill-logo/i.test(className(out))) return out;
  return out.replace(/\s*\/?>$/, m => ` loading="lazy" decoding="async"${m.trimStart()}`);
}

function patchContent(content) {
  let changed = false;
  const patched = content.replace(/<img\b[\s\S]*?>/gi, tag => {
    let next = addAttrsToImg(tag);
    next = ensureLoading(next);
    if (next !== tag) changed = true;
    return next;
  });
  return {content:patched, changed};
}

const allAstro = walk(SRC_ROOT).filter(f => f.endsWith(".astro"));
const candidates = allAstro.filter(f => TARGET_COMPONENTS.includes(path.basename(f)));

console.log(`Bulunan hedef component: ${candidates.length}/${TARGET_COMPONENTS.length}`);
for (const name of TARGET_COMPONENTS) {
  const hit = candidates.find(f=>path.basename(f)===name);
  console.log(`${hit ? "[FOUND]" : "[MISS] "} ${name}${hit ? " -> "+path.relative(ROOT,hit) : ""}`);
}

let changedFiles = 0;
for (const file of candidates) {
  const original = fs.readFileSync(file,"utf8");
  const {content, changed} = patchContent(original);
  if (!changed) {
    console.log(`[SKIP] ${path.relative(ROOT,file)} zaten uygun.`);
    continue;
  }
  backup(file);
  fs.writeFileSync(file, content, "utf8");
  changedFiles++;
  console.log(`[OK] ${path.relative(ROOT,file)}`);
}

// HomePage is known to have dynamic tour/slider images; give those explicit intrinsic dimensions
// only when still missing after generic patch.
const home = candidates.find(f=>path.basename(f)==="HomePage.astro");
if (home) {
  let s = fs.readFileSync(home,"utf8");
  const before = s;
  s = s.replace(
    /<img\s+src=\{resolveTourCardImage\(tour\)\}\s+alt=\{tour\.title\}\s+loading="lazy"\s+decoding="async"\s*\/>/g,
    '<img src={resolveTourCardImage(tour)} alt={tour.title} width="800" height="533" loading="lazy" decoding="async" />'
  );
  // category slider dynamic images: add width/height if absent
  s = s.replace(
    /<img\s+src=\{sliderTourImages\.([A-Za-z0-9_]+)\}\s+alt="([^"]+)"\s*\/>/g,
    '<img src={sliderTourImages.$1} alt="$2" width="800" height="533" loading="lazy" decoding="async" />'
  );
  if (s !== before) {
    // backup may already exist; don't overwrite the earliest original backup
    const rel = path.relative(ROOT,home);
    const dest = path.join(BACKUP,rel);
    if (!fs.existsSync(dest)) backup(home);
    fs.writeFileSync(home,s,"utf8");
    console.log(`[OK+] ${path.relative(ROOT,home)} dynamic image ölçüleri`);
  }
}

console.log("");
console.log(`Image SEO safe fix tamamlandı. Değişen component sayısı: ${changedFiles}`);
console.log(`Yedekler: ${path.relative(ROOT,BACKUP)}/`);
console.log("");
console.log("Şimdi çalıştır:");
console.log("  npm run build");
console.log("  npm run seo:audit");
console.log("");
console.log("Not: Paket audit puanını yapay biçimde değiştirmez; gerçek <img> etiketlerini iyileştirir.");
