import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BACKUP = path.join(ROOT, ".orphan-internal-link-fix-backup");

function backup(file) {
  if (!fs.existsSync(file)) return;
  const rel = path.relative(ROOT, file);
  const dest = path.join(BACKUP, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}

function findFirst(candidates) {
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function write(file, content) {
  backup(file);
  fs.writeFileSync(file, content, "utf8");
  console.log(`[OK] ${path.relative(ROOT, file)}`);
}

function insertBeforeClosing(content, html) {
  if (content.includes("TBC_SEO_CLUSTER_LINKS_START")) return content;
  if (content.includes("</main>")) return content.replace("</main>", `${html}\n</main>`);
  if (content.includes("</body>")) return content.replace("</body>", `${html}\n</body>`);
  return content + "\n" + html + "\n";
}

const blocks = {
  en: `
<!-- TBC_SEO_CLUSTER_LINKS_START -->
<section class="tbc-seo-cluster-links" aria-labelledby="tbc-transfer-links-title">
  <div class="tbc-seo-cluster-inner">
    <p class="tbc-seo-kicker">CAPPADOCIA TRANSFERS</p>
    <h2 id="tbc-transfer-links-title">Airport Transfer Options</h2>
    <p class="tbc-seo-intro">Choose the transfer service that best matches your arrival plan in Cappadocia.</p>
    <div class="tbc-seo-links-grid">
      <a href="/en/transfers/kayseri-airport-shuttle-transfer/">Kayseri Airport Shuttle Transfer</a>
      <a href="/en/transfers/nevsehir-airport-shuttle-transfer/">Nevsehir Airport Shuttle Transfer</a>
      <a href="/en/transfers/private-airport-transfer/">Private Airport Transfer</a>
      <a href="/en/blog/">Cappadocia Travel Guides</a>
    </div>
  </div>
</section>
<!-- TBC_SEO_CLUSTER_LINKS_END -->
<style>
  .tbc-seo-cluster-links{margin:28px auto 0;max-width:1180px;padding:0 20px 28px}
  .tbc-seo-cluster-inner{background:#fff;border:1px solid #e8edf4;border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(12,34,64,.05)}
  .tbc-seo-kicker{margin:0 0 6px;color:#d99a00;font-size:11px;font-weight:800;letter-spacing:.08em}
  .tbc-seo-cluster-links h2{margin:0;color:#071a3d;font-size:22px;line-height:1.2}
  .tbc-seo-intro{margin:8px 0 16px;color:#607089;font-size:14px}
  .tbc-seo-links-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .tbc-seo-links-grid a{display:flex;align-items:center;min-height:52px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;color:#0b2447;background:#f8fafc;font-weight:700;font-size:13px;text-decoration:none}
  .tbc-seo-links-grid a:hover{border-color:#f2b400;background:#fffaf0}
  @media(max-width:850px){.tbc-seo-links-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.tbc-seo-links-grid{grid-template-columns:1fr}}
</style>`,
  tr: `
<!-- TBC_SEO_CLUSTER_LINKS_START -->
<section class="tbc-seo-cluster-links" aria-labelledby="tbc-transfer-links-title">
  <div class="tbc-seo-cluster-inner">
    <p class="tbc-seo-kicker">KAPADOKYA TRANSFERLERİ</p>
    <h2 id="tbc-transfer-links-title">Havalimanı Transfer Seçenekleri</h2>
    <p class="tbc-seo-intro">Kapadokya varış planınıza uygun transfer hizmetini seçin.</p>
    <div class="tbc-seo-links-grid">
      <a href="/tr/transfers/kayseri-airport-shuttle-transfer/">Kayseri Havalimanı Shuttle Transferi</a>
      <a href="/tr/transfers/nevsehir-airport-shuttle-transfer/">Nevşehir Havalimanı Shuttle Transferi</a>
      <a href="/tr/transfers/private-airport-transfer/">Özel Havalimanı Transferi</a>
      <a href="/tr/blog/">Kapadokya Gezi Rehberleri</a>
    </div>
  </div>
</section>
<!-- TBC_SEO_CLUSTER_LINKS_END -->
<style>
  .tbc-seo-cluster-links{margin:28px auto 0;max-width:1180px;padding:0 20px 28px}
  .tbc-seo-cluster-inner{background:#fff;border:1px solid #e8edf4;border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(12,34,64,.05)}
  .tbc-seo-kicker{margin:0 0 6px;color:#d99a00;font-size:11px;font-weight:800;letter-spacing:.08em}
  .tbc-seo-cluster-links h2{margin:0;color:#071a3d;font-size:22px;line-height:1.2}
  .tbc-seo-intro{margin:8px 0 16px;color:#607089;font-size:14px}
  .tbc-seo-links-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .tbc-seo-links-grid a{display:flex;align-items:center;min-height:52px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;color:#0b2447;background:#f8fafc;font-weight:700;font-size:13px;text-decoration:none}
  .tbc-seo-links-grid a:hover{border-color:#f2b400;background:#fffaf0}
  @media(max-width:850px){.tbc-seo-links-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.tbc-seo-links-grid{grid-template-columns:1fr}}
</style>`,
  es: `
<!-- TBC_SEO_CLUSTER_LINKS_START -->
<section class="tbc-seo-cluster-links" aria-labelledby="tbc-transfer-links-title">
  <div class="tbc-seo-cluster-inner">
    <p class="tbc-seo-kicker">TRASLADOS EN CAPADOCIA</p>
    <h2 id="tbc-transfer-links-title">Opciones de Traslado al Aeropuerto</h2>
    <p class="tbc-seo-intro">Elige el servicio de traslado que mejor se adapte a tu llegada a Capadocia.</p>
    <div class="tbc-seo-links-grid">
      <a href="/es/transfers/kayseri-airport-shuttle-transfer/">Traslado desde el Aeropuerto de Kayseri</a>
      <a href="/es/transfers/nevsehir-airport-shuttle-transfer/">Traslado desde el Aeropuerto de Nevşehir</a>
      <a href="/es/transfers/private-airport-transfer/">Traslado Privado al Aeropuerto</a>
    </div>
  </div>
</section>
<!-- TBC_SEO_CLUSTER_LINKS_END -->
<style>
  .tbc-seo-cluster-links{margin:28px auto 0;max-width:1180px;padding:0 20px 28px}
  .tbc-seo-cluster-inner{background:#fff;border:1px solid #e8edf4;border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(12,34,64,.05)}
  .tbc-seo-kicker{margin:0 0 6px;color:#d99a00;font-size:11px;font-weight:800;letter-spacing:.08em}
  .tbc-seo-cluster-links h2{margin:0;color:#071a3d;font-size:22px;line-height:1.2}
  .tbc-seo-intro{margin:8px 0 16px;color:#607089;font-size:14px}
  .tbc-seo-links-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .tbc-seo-links-grid a{display:flex;align-items:center;min-height:52px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;color:#0b2447;background:#f8fafc;font-weight:700;font-size:13px;text-decoration:none}
  .tbc-seo-links-grid a:hover{border-color:#f2b400;background:#fffaf0}
  @media(max-width:850px){.tbc-seo-links-grid{grid-template-columns:1fr}}
</style>`
};

const transferCandidates = {
  en: ["src/pages/en/transfers/index.astro", "src/pages/en/transfers.astro"],
  tr: ["src/pages/tr/transfers/index.astro", "src/pages/tr/transfers.astro"],
  es: ["src/pages/es/transfers/index.astro", "src/pages/es/transfers.astro"],
};

for (const lang of ["en", "tr", "es"]) {
  const file = findFirst(transferCandidates[lang]);
  if (!file) {
    console.log(`[WARN] ${lang.toUpperCase()} transfer hub bulunamadı.`);
    continue;
  }
  const original = fs.readFileSync(file, "utf8");
  const patched = insertBeforeClosing(original, blocks[lang]);
  if (patched !== original) write(file, patched);
  else console.log(`[SKIP] ${path.relative(ROOT, file)} zaten patch'li.`);
}

// Fix auditor: explicit redirect routes must never be counted as orphan pages.
const auditFile = path.join(ROOT, "scripts", "generate-seo-audit.mjs");
if (!fs.existsSync(auditFile)) {
  console.log("[WARN] scripts/generate-seo-audit.mjs bulunamadı; auditor patch atlandı.");
} else {
  let s = fs.readFileSync(auditFile, "utf8");
  const original = s;

  // Patch common orphan expressions robustly.
  s = s.replace(
    /const orphanPages\s*=\s*indexable\.filter\(p=>p\.incoming===0&&!\['\/en\/','\/tr\/','\/es\/','\/'\]\.includes\(p\.route\)\)\.map\(p=>p\.route\);/,
    `const orphanPages=indexable.filter(p=>p.incoming===0&&!redirectMap.has(p.route)&&!['/en/','/tr/','/es/','/'].includes(p.route)).map(p=>p.route);`
  );

  s = s.replace(
    /const orphanPages\s*=\s*indexable\.filter\(([^;]+?)\)\.map\(p=>p\.route\);/,
    (m, inner) => {
      if (m.includes("redirectMap.has")) return m;
      const trimmed = inner.trim();
      if (trimmed.startsWith("p=>")) {
        const expr = trimmed.slice(3);
        return `const orphanPages=indexable.filter(p=>(${expr})&&!redirectMap.has(p.route)).map(p=>p.route);`;
      }
      return m;
    }
  );

  // If auditor still has a page-level redirectLike flag, make it explicit.
  s = s.replace(
    /const indexable=pages\.filter\(p=>!p\.redirectLike&&/,
    `const indexable=pages.filter(p=>!p.redirectLike&&!redirectMap.has(p.route)&&`
  );

  if (s !== original) write(auditFile, s);
  else console.log("[INFO] Auditor için otomatik değişiklik gerekmemiş olabilir.");
}

console.log("");
console.log("Orphan/Internal Link Fix tamamlandı.");
console.log(`Yedekler: ${path.relative(ROOT, BACKUP)}/`);
console.log("");
console.log("Şimdi:");
console.log("  npm run build");
console.log("  npm run seo:audit");
console.log("");
console.log("Beklenen: canonical 0 | broken 0 | orphan belirgin şekilde düşmeli.");
