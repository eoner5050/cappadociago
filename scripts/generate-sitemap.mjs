import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const OUTPUT = path.join(ROOT, 'public', 'sitemap.xml');
const SITE_URL = 'https://cappadociago.com';
const LOCALES = ['en', 'tr', 'es'];

// These are the commercial pages we want crawlers to discover immediately.
// Google does not use the old sitemap <priority> value, so we order the
// canonical URLs first instead of publishing misleading priority metadata.
const IMPORTANT_SUFFIXES = [
  '/',
  '/tours/goreme-standart-hot-air-balloon-tour/',
  '/tours/goreme-comfort-hot-air-balloon-tour/',
  '/tours/red-tour-cappadocia/',
  '/tours/green-tour-cappadocia/',
  '/balloon-tours/',
  '/cappadocia-tours/',
];

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.astro')) files.push(full);
  }
  return files;
}

function routeFromPageFile(file, locale) {
  const localeDir = path.join(PAGES_DIR, locale);
  let relative = path.relative(localeDir, file).replaceAll('\\', '/');

  if (relative === 'index.astro') return `/${locale}/`;
  if (relative.endsWith('/index.astro')) relative = relative.slice(0, -'/index.astro'.length);
  else relative = relative.slice(0, -'.astro'.length);

  return `/${locale}/${relative}/`.replace(/\/{2,}/g, '/');
}

async function isIndexablePage(file) {
  const source = await readFile(file, 'utf8');

  // Localized route files should be real pages. Exclude any explicit redirect
  // or noindex route so sitemap.xml contains canonical indexable URLs only.
  if (/Astro\.redirect\s*\(/.test(source)) return false;
  if (/\bnoindex\s*=\s*\{?true\}?/i.test(source)) return false;
  if (/\bnoindex\s*:\s*true\b/i.test(source)) return false;
  return true;
}

function suffixForRoute(route) {
  return route.replace(/^\/(en|tr|es)/, '') || '/';
}

function importantRank(route) {
  const suffix = suffixForRoute(route);
  const i = IMPORTANT_SUFFIXES.indexOf(suffix);
  if (i === -1) return 1000;
  // Keep EN first for each high-priority path, followed by TR and ES.
  const locale = route.split('/')[1];
  return i * 10 + LOCALES.indexOf(locale);
}

function routeSort(a, b) {
  const ar = importantRank(a);
  const br = importantRank(b);
  if (ar !== br) return ar - br;
  return a.localeCompare(b, 'en');
}

const routes = [];
for (const locale of LOCALES) {
  const dir = path.join(PAGES_DIR, locale);
  try {
    const files = await walk(dir);
    for (const file of files) {
      if (await isIndexablePage(file)) routes.push(routeFromPageFile(file, locale));
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const uniqueRoutes = [...new Set(routes)].sort(routeSort);
const routeSet = new Set(uniqueRoutes);

function alternatesFor(route) {
  const suffix = suffixForRoute(route);
  const items = LOCALES
    .map(locale => `/${locale}${suffix}`.replace(/\/{2,}/g, '/'))
    .filter(candidate => routeSet.has(candidate));

  // Only emit hreflang when at least two real localized equivalents exist.
  return items.length >= 2 ? items : [];
}

const rows = uniqueRoutes.map(route => {
  const loc = `${SITE_URL}${route}`;
  const alternates = alternatesFor(route);
  const alternateXml = alternates.map(altRoute => {
    const altLocale = altRoute.split('/')[1];
    return `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${xmlEscape(`${SITE_URL}${altRoute}`)}" />`;
  });

  if (alternates.some(alt => alt.startsWith('/en/'))) {
    alternateXml.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(`${SITE_URL}/en${suffixForRoute(route)}`)}" />`);
  }

  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    ...alternateXml,
    '  </url>',
  ].join('\n');
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...rows,
  '</urlset>',
  '',
].join('\n');

await writeFile(OUTPUT, xml, 'utf8');

const importantChecks = IMPORTANT_SUFFIXES.slice(0, 5).flatMap(suffix =>
  LOCALES.map(locale => `/${locale}${suffix}`.replace(/\/{2,}/g, '/'))
);
const missingImportant = importantChecks.filter(route => !routeSet.has(route));

console.log(`[sitemap] Generated ${uniqueRoutes.length} canonical URLs -> public/sitemap.xml`);
if (missingImportant.length) {
  console.warn('[sitemap] Important localized routes not found:', missingImportant.join(', '));
}
