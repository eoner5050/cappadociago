import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const aliasMap: Record<string, string[]> = {
  'goreme-standart-hot-air-balloon-tour': ['goreme-standart-hot-air-balloon-tour','goreme-standard-hot-air-balloon-tour'],
  'goreme-standard-hot-air-balloon-tour': ['goreme-standard-hot-air-balloon-tour','goreme-standart-hot-air-balloon-tour'],
};

export const GET: APIRoute = async ({ url }) => {
  const slug = (url.searchParams.get('slug') || '').trim();
  const month = (url.searchParams.get('month') || '').trim();
  if (!slug) return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: {'content-type':'application/json'} });

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables are missing' }), { status: 500, headers: {'content-type':'application/json','cache-control':'no-store'} });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const candidates = aliasMap[slug] || [slug];
  let product: any = null;
  for (const candidate of candidates) {
    const { data, error } = await db.from('products').select('id,slug,default_price,default_capacity,ask_for_price,active').eq('slug', candidate).eq('active', true).maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: {'content-type':'application/json','cache-control':'no-store'} });
    if (data) { product = data; break; }
  }

  if (!product) {
    return new Response(JSON.stringify({ product: null, availability: [], minPrice: 0 }), { status: 404, headers: {'content-type':'application/json','cache-control':'no-store'} });
  }

  let query = db.from('availability').select('date,price,capacity,booked,status').eq('product_id', product.id).order('date', { ascending: true });
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
  const { data: availability = [], error: avError } = await query;
  if (avError) return new Response(JSON.stringify({ error: avError.message }), { status: 500, headers: {'content-type':'application/json','cache-control':'no-store'} });

  const minPrice = (availability || [])
    .filter((r:any) => r.status === 'available' && Number(r.capacity || 0) - Number(r.booked || 0) > 0 && Number(r.price || 0) > 0)
    .reduce((min:number, r:any) => Math.min(min, Number(r.price)), Number.POSITIVE_INFINITY);

  return new Response(JSON.stringify({
    product,
    availability,
    minPrice: Number.isFinite(minPrice) ? minPrice : Number(product.default_price || 0),
  }), { status: 200, headers: {'content-type':'application/json','cache-control':'no-store, max-age=0'} });
};
