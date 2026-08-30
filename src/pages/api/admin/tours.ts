import type { APIRoute } from 'astro';
import { requireAdmin, adminErrorResponse } from '../../../lib/adminAuth';

export const prerender = false;

const langs = ['tr','en','es'] as const;
const textArray = (v: unknown) => Array.isArray(v) ? v.map(String).map(x=>x.trim()).filter(Boolean) : [];
const cleanTranslation = (t: any) => ({
  title: String(t?.title || '').trim(),
  kicker: String(t?.kicker || 'CAPPADOCIAGO').trim(),
  duration_label: String(t?.duration_label || '').trim(),
  hero_desc: String(t?.hero_desc || '').trim(),
  overview_title: String(t?.overview_title || '').trim(),
  overview_paragraphs: textArray(t?.overview_paragraphs),
  price_title: String(t?.price_title || '').trim(),
  price_text: String(t?.price_text || '').trim(),
  whats_included: textArray(t?.whats_included),
  not_included: textArray(t?.not_included),
  highlights: textArray(t?.highlights),
  important_info: textArray(t?.important_info),
  itinerary: textArray(t?.itinerary),
  flight_details_title: String(t?.flight_details_title || '').trim(),
  flight_details_paragraphs: textArray(t?.flight_details_paragraphs),
  pickup_info: String(t?.pickup_info || '').trim(),
  meeting_point: String(t?.meeting_point || '').trim(),
  after_flight_title: String(t?.after_flight_title || '').trim(),
  after_flight_text: String(t?.after_flight_text || '').trim(),
  refund_title: String(t?.refund_title || '').trim(),
  refund_text: String(t?.refund_text || '').trim(),
  advance_title: String(t?.advance_title || '').trim(),
  advance_text: String(t?.advance_text || '').trim(),
  safety_title: String(t?.safety_title || '').trim(),
  safety_text: String(t?.safety_text || '').trim(),
  seo_title: String(t?.seo_title || '').trim(),
  seo_description: String(t?.seo_description || '').trim(),
});

export const GET: APIRoute = async ({ request }) => {
  try {
    const { admin } = await requireAdmin(request);
    const { data: tours, error } = await admin.from('tours').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (tours || []).map((x:any)=>x.id);
    let translations:any[] = [];
    if (ids.length) {
      const res = await admin.from('tour_translations').select('*').in('tour_id', ids);
      if (res.error) throw res.error;
      translations = res.data || [];
    }
    const rows = (tours || []).map((tour:any)=>({
      ...tour,
      translations: Object.fromEntries(translations.filter((x:any)=>x.tour_id===tour.id).map((x:any)=>[x.lang,x]))
    }));
    return new Response(JSON.stringify({ tours: rows }), { headers: { 'Content-Type':'application/json' } });
  } catch (err) { return adminErrorResponse(err); }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const id = body.id ? String(body.id) : null;
    const slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const category = String(body.category || '').trim();
    if (!slug || !category) return new Response(JSON.stringify({error:'Slug and category are required.'}), {status:400,headers:{'Content-Type':'application/json'}});
    const translations = body.translations || {};
    if (!translations.en?.title && !translations.tr?.title && !translations.es?.title) {
      return new Response(JSON.stringify({error:'At least one language title is required.'}), {status:400,headers:{'Content-Type':'application/json'}});
    }

    const tourPayload:any = {
      slug,
      category,
      price: Number(body.price || 0),
      old_price: body.old_price === '' || body.old_price == null ? null : Number(body.old_price),
      duration_minutes: body.duration_minutes ? Number(body.duration_minutes) : null,
      rating: Number(body.rating || 4.9),
      reviews_count: Number(body.reviews_count || 0),
      hero_image: String(body.hero_image || '').trim() || null,
      gallery_images: textArray(body.gallery_images),
      is_published: Boolean(body.is_published),
      price_mode: ['perPerson','perGroup'].includes(body.price_mode) ? body.price_mode : 'perPerson',
      ask_for_price: Boolean(body.ask_for_price),
      default_capacity: Math.max(1, Number(body.default_capacity || 20)),
    };

    let tour:any;
    if (id) {
      const res = await admin.from('tours').update(tourPayload).eq('id', id).select().single();
      if (res.error) throw res.error; tour=res.data;
    } else {
      const res = await admin.from('tours').insert(tourPayload).select().single();
      if (res.error) throw res.error; tour=res.data;
    }

    for (const lang of langs) {
      const raw = translations[lang];
      if (!raw?.title) continue;
      const row = { tour_id: tour.id, lang, ...cleanTranslation(raw) };
      const res = await admin.from('tour_translations').upsert(row, { onConflict:'tour_id,lang' });
      if (res.error) throw res.error;
    }

    // Keep the live booking product catalog in sync with newly published tours.
    const fallbackName = translations.en?.title || translations.tr?.title || translations.es?.title || slug;
    const product = {
      slug,
      name: fallbackName,
      category,
      default_price: Number(body.price || 0),
      default_capacity: Math.max(1, Number(body.default_capacity || 20)),
      active: Boolean(body.is_published),
      ask_for_price: Boolean(body.ask_for_price),
    };
    const productRes = await admin.from('products').upsert(product, { onConflict:'slug' });
    if (productRes.error) console.warn('Product sync failed:', productRes.error.message);

    return new Response(JSON.stringify({ success:true, tour }), { headers:{'Content-Type':'application/json'} });
  } catch (err) { return adminErrorResponse(err); }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { admin } = await requireAdmin(request);
    const url = new URL(request.url); const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({error:'Tour id is required.'}), {status:400,headers:{'Content-Type':'application/json'}});
    const { data: tour } = await admin.from('tours').select('slug').eq('id',id).maybeSingle();
    const res = await admin.from('tours').delete().eq('id',id); if (res.error) throw res.error;
    if (tour?.slug) await admin.from('products').update({active:false}).eq('slug',tour.slug);
    return new Response(JSON.stringify({success:true}), {headers:{'Content-Type':'application/json'}});
  } catch (err) { return adminErrorResponse(err); }
};
