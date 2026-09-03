import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { existingTourCatalog } from '../../../data/existingTourCatalog';

export const prerender = false;

const aliasMap: Record<string, string[]> = {
  'goreme-standart-hot-air-balloon-tour': ['goreme-standart-hot-air-balloon-tour','goreme-standard-hot-air-balloon-tour'],
  'goreme-standard-hot-air-balloon-tour': ['goreme-standard-hot-air-balloon-tour','goreme-standart-hot-air-balloon-tour'],
};

const json = (body:any, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate, max-age=0',
    'pragma':'no-cache',
  }
});

export const GET: APIRoute = async ({ url }) => {
  const slug = (url.searchParams.get('slug') || '').trim();
  const month = (url.searchParams.get('month') || '').trim();
  if (!slug) return json({ error: 'Missing slug' }, 400);

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase environment variables are missing' }, 500);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const candidates = aliasMap[slug] || [slug];
  let product:any = null;

  // Do not use maybeSingle here. Old installs can contain duplicate product rows,
  // and maybeSingle turns that harmless situation into a 500/PGRST116 error.
  for (const candidate of candidates) {
    const { data, error } = await db
      .from('products')
      .select('id,slug,default_price,default_capacity,ask_for_price,active')
      .eq('slug', candidate)
      .eq('active', true)
      .limit(20);
    if (error) return json({ error: error.message }, 500);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length) {
      // Prefer the newest active row with a positive default price. If Ask For Price
      // is enabled, newest row still wins.
      product = rows.find((r:any) => r.ask_for_price || Number(r.default_price || 0) > 0) || rows[0];
      break;
    }
  }

  // Some older static tours may not yet have a products row. Fall back to the
  // editable tours table so their admin-controlled default price still appears.
  // In this fallback there is no product_id, so calendar dates inherit the same
  // default price/capacity until a products row is created.
  if (!product) {
    for (const candidate of candidates) {
      const { data: rows, error } = await db
        .from('tours')
        .select('slug,price,default_capacity,ask_for_price,is_published,category')
        .eq('slug', candidate)
        .eq('is_published', true)
        .neq('category', '__deleted__')
        .limit(1);
      if (!error && Array.isArray(rows) && rows.length) {
        const t:any = rows[0];
        product = {
          id: null, slug: t.slug, default_price: Number(t.price || 0),
          default_capacity: Math.max(0, Number(t.default_capacity || 20)),
          ask_for_price: Boolean(t.ask_for_price), active: true, _tourFallback: true
        };
        break;
      }
    }
  }

  // Final fallback for untouched built-in pages that have never been saved in
  // Admin yet. This keeps their original default price/capacity visible.
  if (!product) {
    const builtIn:any = existingTourCatalog.find((t:any) => candidates.includes(String(t.slug)));
    if (builtIn && builtIn.is_published !== false) {
      product = {
        id: null, slug: builtIn.slug, default_price: Number(builtIn.price || 0),
        default_capacity: Math.max(0, Number(builtIn.default_capacity || 20)),
        ask_for_price: Boolean(builtIn.ask_for_price), active: true, _catalogFallback: true
      };
    }
  }

  if (!product) return json({ product: null, availability: [], defaultPrice: 0, minPrice: 0 }, 404);

  const defaultPrice = Math.max(0, Number(product.default_price || 0));
  const defaultCapacity = Math.max(0, Number(product.default_capacity || 0));

  let rawAvailability:any[] = [];
  if (product.id) {
    let query = db
      .from('availability')
      .select('date,price,capacity,booked,status')
      .eq('product_id', product.id)
      .order('date', { ascending: true });

    if (/^\d{4}-\d{2}$/.test(month)) {
    const [y,m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    query = query.gte('date', start).lte('date', end);
    } else {
      const today = new Date().toISOString().slice(0,10);
      query = query.gte('date', today).limit(365);
    }

    const { data, error: avError } = await query;
    if (avError) return json({ error: avError.message }, 500);
    rawAvailability = Array.isArray(data) ? data : [];
  }

  // A date row with blank/0 price or capacity should inherit the product defaults.
  // This restores the original calendar behaviour: every available date shows
  // both a price and the remaining capacity.
  const availability = (rawAvailability || []).map((r:any) => ({
    ...r,
    price: Number(r.price || 0) > 0 ? Number(r.price) : defaultPrice,
    capacity: Number(r.capacity || 0) > 0 ? Number(r.capacity) : defaultCapacity,
    booked: Math.max(0, Number(r.booked || 0)),
    status: r.status || 'available',
  }));

  return json({
    product: { ...product, default_price: defaultPrice, default_capacity: defaultCapacity },
    availability,
    // The visible main price must always be the product's admin-controlled default price.
    defaultPrice,
    minPrice: defaultPrice,
  });
};
