import { createClient } from '@supabase/supabase-js';

function tourSlugCandidates(slug: string) {
  const clean = String(slug || '').trim().toLowerCase();
  const aliases: Record<string,string[]> = {
    'goreme-standart-hot-air-balloon-tour': ['goreme-standart-hot-air-balloon-tour','goreme-standard-hot-air-balloon-tour'],
    'goreme-standard-hot-air-balloon-tour': ['goreme-standard-hot-air-balloon-tour','goreme-standart-hot-air-balloon-tour'],
  };
  return aliases[clean] || [clean];
}

function getDb() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  const noStoreFetch: typeof fetch = (input, init = {}) => fetch(input, { ...init, cache: 'no-store' });
  return createClient(url, key, { auth:{persistSession:false,autoRefreshToken:false}, global:{fetch:noStoreFetch} });
}

export async function getTourState(slug: string, lang: string) {
  const db = getDb(); if (!db) return { deleted:false, published:null };
  const candidates = tourSlugCandidates(slug);
  const { data: tours, error } = await db.from('tours').select('*').in('slug', candidates);
  if (error) return { deleted:false, published:null };
  const ordered=(tours||[]).sort((a:any,b:any)=>candidates.indexOf(a.slug)-candidates.indexOf(b.slug));
  const tombstone=ordered.find((x:any)=>x.category==='__deleted__');
  if(tombstone) return { deleted:true, published:null };
  const tour=ordered.find((x:any)=>x.is_published===true) || null;
  if(!tour) return { deleted:false, published:null };
  let { data: translation } = await db.from('tour_translations').select('*').eq('tour_id',tour.id).eq('lang',lang).maybeSingle();
  if(!translation){const fallback=await db.from('tour_translations').select('*').eq('tour_id',tour.id).eq('lang','en').maybeSingle();translation=fallback.data;}
  return { deleted:false, published:translation?{tour,translation}:null };
}

export async function getPublishedTour(slug:string,lang:string){
  const state=await getTourState(slug,lang); return state.published;
}
