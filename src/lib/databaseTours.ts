import { createClient } from '@supabase/supabase-js';

export async function getPublishedTour(slug: string, lang: string) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || '';
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: tour, error } = await db.from('tours').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (error || !tour) return null;
  let { data: translation } = await db.from('tour_translations').select('*').eq('tour_id', tour.id).eq('lang', lang).maybeSingle();
  if (!translation) {
    const fallback = await db.from('tour_translations').select('*').eq('tour_id', tour.id).eq('lang', 'en').maybeSingle();
    translation = fallback.data;
  }
  return translation ? { tour, translation } : null;
}
