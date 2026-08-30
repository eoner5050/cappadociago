import { defineMiddleware } from 'astro:middleware';
import { getPublishedTour } from './lib/databaseTours';

const TOUR_ROUTE = /^\/(en|tr|es)\/tours\/([^/?#]+)\/?$/;

export const onRequest = defineMiddleware(async (context, next) => {
  const match = context.url.pathname.match(TOUR_ROUTE);
  if (!match) return next();

  const [, lang, slug] = match;
  // If a tour has been revised/published from the admin panel, render the
  // database version even when an older static .astro route exists.
  try {
    const published = await getPublishedTour(slug, lang);
    if (published) {
      return context.rewrite(`/${lang}/managed-tours/${slug}`);
    }
  } catch (error) {
    console.warn('[CappadociaGo] tour override lookup failed:', error);
  }

  return next();
});
