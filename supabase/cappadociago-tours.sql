-- ============================================================
-- CappadociaGo — Tours schema (Supabase / PostgreSQL)
-- Run this once in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extension needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) TOURS: language-independent core data
-- ------------------------------------------------------------
create table if not exists tours (
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
create table if not exists tour_translations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
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

create index if not exists idx_tour_translations_tour_id on tour_translations(tour_id);
create index if not exists idx_tour_translations_lang on tour_translations(lang);
create index if not exists idx_tours_slug on tours(slug);
create index if not exists idx_tours_category on tours(category);

-- ------------------------------------------------------------
-- 3) Row Level Security
-- ------------------------------------------------------------
alter table tours enable row level security;
alter table tour_translations enable row level security;

-- Public (anon) visitors can only READ published tours
create policy "Public can read published tours"
  on tours for select
  using (is_published = true);

create policy "Public can read translations of published tours"
  on tour_translations for select
  using (
    exists (
      select 1 from tours
      where tours.id = tour_translations.tour_id
      and tours.is_published = true
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
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tours_updated_at on tours;
create trigger trg_tours_updated_at
  before update on tours
  for each row execute function set_updated_at();
