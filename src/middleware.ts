import { defineMiddleware } from 'astro:middleware';
import { getTourState } from './lib/databaseTours';

const TOUR_ROUTE = /^\/(en|tr|es)\/tours\/([^/?#]+)\/?$/;

export const onRequest = defineMiddleware(async (context, next) => {
  const match = context.url.pathname.match(TOUR_ROUTE);
  if (!match) return next();

  const [, lang, slug] = match;
  // A published admin revision always wins over the built-in static tour route.
  // The rewrite preserves the public URL while serving the database-backed page.
  try {
    const state = await getTourState(slug, lang);
    if (state.deleted) return new Response('Not Found', { status: 404, headers: { 'Cache-Control':'no-store' } });
    if (state.published) {
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
