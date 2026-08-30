import { defineMiddleware } from 'astro:middleware';
import { getPublishedTour } from './lib/databaseTours';

const TOUR_ROUTE = /^\/(en|tr|es)\/tours\/([^/?#]+)\/?$/;

export const onRequest = defineMiddleware(async (context, next) => {
  const match = context.url.pathname.match(TOUR_ROUTE);
  if (!match) return next();

  const [, lang, slug] = match;
  // A published admin revision always wins over the built-in static tour route.
  // The rewrite preserves the public URL while serving the database-backed page.
  try {
    const published = await getPublishedTour(slug, lang);
    if (published) {
      const response = await context.rewrite(`/${lang}/managed-tours/${slug}`);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      return response;
    }
  } catch (error) {
    console.warn('[CappadociaGo] tour override lookup failed:', error);
  }

  return next();
});
