import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

export const prerender = false;

const canonical = (slug:string) => slug === 'goreme-standard-hot-air-balloon-tour' ? 'goreme-standart-hot-air-balloon-tour' : slug;

export const GET: APIRoute = async ({ url }) => {
  try {
    const raw = String(url.searchParams.get('slugs') || '');
    const slugs = [...new Set(raw.split(',').map(x => canonical(x.trim().toLowerCase())).filter(Boolean))].slice(0, 100);
    if (!slugs.length) {
      return new Response(JSON.stringify({ deleted: [], inactive: [] }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store, max-age=0' }
      });
    }

    const admin = getSupabaseAdmin();
    const aliases = [...new Set(slugs.flatMap(s => s === 'goreme-standart-hot-air-balloon-tour'
      ? [s, 'goreme-standard-hot-air-balloon-tour']
      : [s]))];

    const [tourRes, productRes] = await Promise.all([
      admin.from('tours').select('slug,category,is_published').in('slug', aliases),
      admin.from('products').select('slug,active').in('slug', aliases),
    ]);

    if (tourRes.error) throw tourRes.error;
    if (productRes.error) throw productRes.error;

    const deleted = new Set<string>();
    for (const row of tourRes.data || []) {
      if (row.category === '__deleted__') deleted.add(canonical(String(row.slug)));
    }

    const inactive = new Set<string>();
    for (const row of productRes.data || []) {
      if (row.active === false) inactive.add(canonical(String(row.slug)));
    }

    return new Response(JSON.stringify({ deleted: [...deleted], inactive: [...inactive] }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
};
