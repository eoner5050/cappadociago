import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase';

// This route must run on the server (not prerendered) since it writes
// to the database using the service role key.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const {
      slug,
      category,
      price,
      old_price,
      duration_minutes,
      hero_image,
      gallery_images,
      translations, // { tr: {...}, en: {...}, es: {...} }
    } = body;

    if (!slug || !category || !price || !translations?.tr || !translations?.en || !translations?.es) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (slug, category, price, and all 3 translations are required).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Insert the language-independent tour row
    const { data: tour, error: tourError } = await supabaseAdmin
      .from('tours')
      .insert({
        slug,
        category,
        price,
        old_price: old_price || null,
        duration_minutes: duration_minutes || null,
        hero_image: hero_image || null,
        gallery_images: gallery_images || [],
      })
      .select()
      .single();

    if (tourError) {
      return new Response(JSON.stringify({ error: tourError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2) Insert the 3 translation rows (tr / en / es)
    const langs = ['tr', 'en', 'es'] as const;
    const translationRows = langs.map((lang) => ({
      tour_id: tour.id,
      lang,
      ...translations[lang],
    }));

    const { error: translationsError } = await supabaseAdmin
      .from('tour_translations')
      .insert(translationRows);

    if (translationsError) {
      // Roll back the tour row so we don't leave an orphaned/incomplete tour
      await supabaseAdmin.from('tours').delete().eq('id', tour.id);
      return new Response(JSON.stringify({ error: translationsError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, tour_id: tour.id, slug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
