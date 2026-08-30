-- ============================================================
-- CappadociaGo — Tours schema (Supabase / PostgreSQL)
-- Run this once in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extension needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) TOURS: language-independent core data
-- ------------------------------------------------------------
create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- e.g. 'cappadocia-hot-air-balloon-tour'
  category text not null,                    -- balloon | daily | package | activity | transfer | private | safari | sunset
  price numeric not null,
  old_price numeric,
  duration_minutes integer,                  -- e.g. 60 (used for sorting/filtering; display text is per-language)
  rating numeric default 4.8,
  reviews_count integer default 0,
  hero_image text,                           -- path under /images/... or full URL
  gallery_images text[] default '{}',        -- array of image paths
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2) TOUR_TRANSLATIONS: everything text-based, per language
-- ------------------------------------------------------------
create table if not exists public.tour_translations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  lang text not null check (lang in ('tr', 'en', 'es')),

  title text not null,
  kicker text,                               -- small badge text, e.g. 'CAPPADOCIAGO'
  duration_label text,                       -- e.g. '60 Minutes' / '60 Dakika' / '60 Minutos'
  hero_desc text,

  overview_title text,
  overview_paragraphs text[] default '{}',

  price_title text,
  price_text text,

  whats_included text[] default '{}',
  important_info text[] default '{}',

  flight_details_title text,
  flight_details_paragraphs text[] default '{}',

  after_flight_title text,
  after_flight_text text,

  refund_title text,
  refund_text text,

  advance_title text,
  advance_text text,

  safety_title text,
  safety_text text,

  unique (tour_id, lang)
);

create index if not exists idx_tour_translations_tour_id on public.tour_translations(tour_id);
create index if not exists idx_tour_translations_lang on public.tour_translations(lang);
create index if not exists idx_tours_slug on public.tours(slug);
create index if not exists idx_tours_category on public.tours(category);

-- ------------------------------------------------------------
-- 3) Row Level Security
-- ------------------------------------------------------------
alter table public.tours enable row level security;
alter table public.tour_translations enable row level security;

-- Public (anon) visitors can only READ published tours
drop policy if exists "Public can read published tours" on public.tours;
create policy "Public can read published tours"
  on public.tours for select to anon
  using (is_published = true);

drop policy if exists "Public can read translations of published tours" on public.tour_translations;
create policy "Public can read translations of published tours"
  on public.tour_translations for select to anon
  using (
    exists (
      select 1 from public.tours t
      where t.id = tour_translations.tour_id
      and t.is_published = true
    )
  );

-- No public INSERT/UPDATE/DELETE policies are created on purpose.
-- Writes only happen server-side via the Astro API route using the
-- SERVICE ROLE key, which bypasses RLS. The anon/public key can never
-- add, edit or delete tours — this keeps the admin page safe even
-- though it has no login screen yet.

-- ------------------------------------------------------------
-- 4) Keep updated_at fresh automatically
-- ------------------------------------------------------------
create or replace function public.cappadociago_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tours_updated_at on public.tours;
create trigger trg_tours_updated_at
  before update on public.tours
  for each row execute function public.cappadociago_set_updated_at();


-- Explicit privileges required in addition to RLS policies.
grant usage on schema public to anon, authenticated;
grant select on public.tours, public.tour_translations to anon, authenticated;
