import { TOUR_IMAGE_FILES } from '../data/tourImageFiles.generated';

const files = [...TOUR_IMAGE_FILES];

function norm(v = '') {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.(webp|png|jpe?g|avif)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function familyName(file = '') {
  return norm(file)
    .replace(/^tbc\s+/, '')
    .replace(/\s+\d+$/, '')
    .trim();
}

function photoNo(file = '') {
  const m = file.match(/\((\d+)\)\s*\.(webp|png|jpe?g|avif)$/i);
  return m ? Number(m[1]) : 0;
}

function gallerySort(a: string, b: string) {
  const na = photoNo(a);
  const nb = photoNo(b);
  if (na !== nb) return na - nb;
  const aMain = a.startsWith('tbc-') ? -1 : 0;
  const bMain = b.startsWith('tbc-') ? -1 : 0;
  if (aMain !== bMain) return aMain - bMain;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const FAMILY_ALIASES: Record<string, string[]> = {
  'private cappadocia mix tour': ['private mix cappadocia tour'],
  'private mix cappadocia tour': ['private mix cappadocia tour'],
  'photo shoot flying dress experience': ['photo shoot flying dress experience'],
  'sunrise sunset horse riding cappadocia': ['sunrise sunset horse riding cappadocia'],
  'cappadocia classic car tour': ['cappadocia classic car tour'],
  'private airport transfer': ['private airport transfer'],
};

export function getTourGallery({
  slug = '',
  title = '',
  preferred = [],
  max = 6
}: {
  slug?: string;
  title?: string;
  preferred?: string[];
  max?: number;
} = {}) {
  const slugFamily = norm(slug);
  const allowedFamilies = new Set<string>([
    slugFamily,
    ...(FAMILY_ALIASES[slugFamily] || [])
  ].filter(Boolean));

  // Always honor page-level preferred images first. Some private/package tours
  // intentionally use related Red/Green/Mix/Activity photos whose filenames do
  // not share the page slug, so filtering only by slug would hide the gallery.
  const existingPreferred = preferred
    .map(url => ({ url, base: url.split('/').pop() || '' }))
    .filter(x => x.base && files.includes(x.base));

  // Also allow the image families referenced by the page so we can fill the
  // gallery up to `max` with related numbered photos when available.
  for (const p of existingPreferred) {
    const fam = familyName(p.base);
    if (fam) allowedFamilies.add(fam);
  }

  const matched = files
    .filter(file => allowedFamilies.has(familyName(file)))
    .sort(gallerySort);

  const ordered = [
    ...existingPreferred.map(x => x.base),
    ...matched
  ];

  return [...new Set(ordered)]
    .slice(0, Math.max(1, max))
    .map(file => `/images/tours/${file}`);
}

export function getSiteGallery(max = 8) {
  const preferredOrder = [
    'balloon', 'goreme', 'red', 'green', 'blue', 'atv', 'jeep',
    'horse', 'camel', 'classic', 'pottery', 'photo', 'ihlara',
    'soganli', 'pamukkale', 'transfer'
  ];

  const picked: string[] = [];
  const used = new Set<string>();

  for (const token of preferredOrder) {
    const match = files.find(f => !used.has(f) && norm(f).includes(token));
    if (match) {
      used.add(match);
      picked.push(`/images/tours/${match}`);
      if (picked.length >= max) return picked;
    }
  }

  for (const f of [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (!used.has(f)) picked.push(`/images/tours/${f}`);
    if (picked.length >= max) break;
  }

  return picked;
}
