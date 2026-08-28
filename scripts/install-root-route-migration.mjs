import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PKG = path.resolve(import.meta.dirname, "..");
const backupRoot = path.join(ROOT, ".root-route-migration-backup");

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}
function backupIfExists(file) {
  if (!fs.existsSync(file)) return;
  const rel = path.relative(ROOT, file);
  const backup = path.join(backupRoot, rel);
  ensureDir(backup);
  fs.copyFileSync(file, backup);
}
function copy(src, dest, { overwrite = true } = {}) {
  if (!fs.existsSync(src)) throw new Error(`Paket dosyası eksik: ${src}`);
  if (fs.existsSync(dest) && !overwrite) {
    console.log(`[SKIP] Hedef zaten var, korunuyor: ${path.relative(ROOT, dest)}`);
    return "skipped";
  }
  if (fs.existsSync(dest)) backupIfExists(dest);
  ensureDir(dest);
  fs.copyFileSync(src, dest);
  console.log(`[OK] ${path.relative(ROOT, dest)}`);
  return "copied";
}

// 1) Preserve the real Spanish pages.
// If /es/tours/... already exists in the current project, do NOT overwrite it.
// This avoids replacing a newer multilingual version with the legacy root file.
const spanishPages = [
  "goreme-comfort-hot-air-balloon-tour.astro",
  "goreme-standart-hot-air-balloon-tour.astro"
];

for (const file of spanishPages) {
  copy(
    path.join(PKG, "payload", "es", "tours", file),
    path.join(ROOT, "src", "pages", "es", "tours", file),
    { overwrite: false }
  );
}

// 2) Replace legacy root pages with direct 301 redirects.
// Existing files are backed up first.
copy(
  path.join(PKG, "payload", "root-redirects", "tours", "goreme-comfort-hot-air-balloon-tour.astro"),
  path.join(ROOT, "src", "pages", "tours", "goreme-comfort-hot-air-balloon-tour.astro")
);
copy(
  path.join(PKG, "payload", "root-redirects", "tours", "goreme-standart-hot-air-balloon-tour.astro"),
  path.join(ROOT, "src", "pages", "tours", "goreme-standart-hot-air-balloon-tour.astro")
);
copy(
  path.join(PKG, "payload", "root-redirects", "transfers.astro"),
  path.join(ROOT, "src", "pages", "transfers.astro")
);

console.log("");
console.log("Root route migration tamamlandı.");
console.log("Yedekler: .root-route-migration-backup/");
console.log("");
console.log("Şimdi sırayla:");
console.log("  npm run build");
console.log("  npm run seo:audit");
console.log("  npm run dev");
