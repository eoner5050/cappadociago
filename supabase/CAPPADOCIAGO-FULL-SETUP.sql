-- CAPPADOCIAGO - ADMIN CALENDAR MVP
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  default_price numeric(10,2) not null default 0,
  default_capacity integer not null default 0 check (default_capacity >= 0),
  active boolean not null default true,
  ask_for_price boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  date date not null,
  price numeric(10,2) not null check (price >= 0),
  capacity integer not null default 0 check (capacity >= 0),
  booked integer not null default 0 check (booked >= 0 and booked <= capacity),
  status text not null default 'available' check (status in ('available','sold_out','closed')),
  updated_at timestamptz not null default now(),
  unique(product_id,date)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','manager')),
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists ask_for_price boolean not null default false;

create index if not exists idx_availability_product_date on public.availability(product_id,date);
create index if not exists idx_products_active_category on public.products(active,category);

alter table public.products enable row level security;
alter table public.availability enable row level security;
alter table public.admin_users enable row level security;

-- Admin membership can only be read by the logged-in admin themself.
drop policy if exists "admin users can read own membership" on public.admin_users;
create policy "admin users can read own membership"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

-- Products: authenticated admins/managers only.
drop policy if exists "admins can read products" on public.products;
create policy "admins can read products"
on public.products for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can update products" on public.products;
create policy "admins can update products"
on public.products for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

-- Availability: authenticated admins/managers only for MVP.
drop policy if exists "admins can read availability" on public.availability;
create policy "admins can read availability"
on public.availability for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can insert availability" on public.availability;
create policy "admins can insert availability"
on public.availability for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can update availability" on public.availability;
create policy "admins can update availability"
on public.availability for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));


-- Public storefront read access: visitors may read active products and availability only.
grant usage on schema public to anon;
grant select on public.products to anon;
grant select on public.availability to anon;

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
on public.products for select to anon
using (active = true);

drop policy if exists "public can read availability" on public.availability;
create policy "public can read availability"
on public.availability for select to anon
using (true);

-- Seed products. Update defaults whenever needed.
insert into public.products(slug,name,category,default_price,default_capacity) values
('goreme-standart-hot-air-balloon-tour','Göreme Standard Hot Air Balloon Tour','balloon',150,24),
('goreme-comfort-hot-air-balloon-tour','Göreme Comfort Hot Air Balloon Tour','balloon',180,16),
('red-tour-cappadocia','Red Tour Cappadocia','daily',50,18),
('green-tour-cappadocia','Green Tour Cappadocia','daily',60,18),
('private-cappadocia-mix-tour','Private Cappadocia Mix Tour','private',150,8),
('cappadocia-pottery-making-experience','Cappadocia Pottery Making Experience','activity',15,20),
('cappadocia-classic-car-tour','Cappadocia Classic Car Tour','activity',60,4),
('photo-shoot-flying-dress-experience','Photo Shoot & Flying Dress Experience','activity',0,6),
('jeep-safari-cappadocia','Jeep Safari Cappadocia','activity',40,20),
('atv-tour-with-goreme-valleys','ATV Tour With Göreme Valleys','activity',30,30),
('sunrise-sunset-horse-riding-cappadocia','Sunrise or Sunset Horse Riding Cappadocia','activity',35,16),
('cappadocia-sunset-camel-riding-tour','Cappadocia Sunset Camel Riding Tour','activity',55,14),
('kayseri-airport-shuttle-transfer','Kayseri Airport Shuttle Transfer','transfer',15,40),
('nevsehir-airport-shuttle-transfer','Nevşehir Airport Shuttle Transfer','transfer',15,40),
('private-airport-transfer','Cappadocia Private VIP Airport Transfer','transfer',90,8),
('soganli-valley-balloon-tour','Soğanlı Valley Balloon Tour','balloon',160,16),
('ihlara-valley-balloons-tour','Ihlara Valley Balloons Tour','balloon',60,20),
('pamukkale-balloons-tour','Pamukkale Balloons Tour','balloon',90,20),
('turkish-night-with-cave-dinner-cappadocia','Turkish Night With Cave Dinner Cappadocia','activity',50,30),
('balloons-watching-tour-cappadocia','Balloons Watching Tour Cappadocia','activity',35,20)
on conflict (slug) do update set
name=excluded.name, category=excluded.category,
default_price=excluded.default_price, default_capacity=excluded.default_capacity;
-- CAPPADOCIAGO - MANUEL REZERVASYON DETAYLARI
-- Supabase > SQL Editor içinde SADECE BIR KEZ çalıştırın.

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  product_id uuid null references public.products(id) on delete set null,
  tour_name text not null,
  customer_name text not null,
  customer_count integer not null default 1 check (customer_count > 0),
  hotel text,
  phone text,
  email text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_date_idx on public.reservations(reservation_date desc);
create index if not exists reservations_product_idx on public.reservations(product_id);

alter table public.reservations enable row level security;

drop policy if exists "admins can read reservations" on public.reservations;
create policy "admins can read reservations"
on public.reservations for select
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "admins can insert reservations" on public.reservations;
create policy "admins can insert reservations"
on public.reservations for insert
to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "admins can update reservations" on public.reservations;
create policy "admins can update reservations"
on public.reservations for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "admins can delete reservations" on public.reservations;
create policy "admins can delete reservations"
on public.reservations for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
-- CAPPADOCIAGO - LIVE BOOKING UPDATE
-- Existing Supabase project: run this once in SQL Editor.

grant usage on schema public to anon;
grant select on public.products to anon;
grant select on public.availability to anon;

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
on public.products for select to anon
using (active = true);

drop policy if exists "public can read availability" on public.availability;
create policy "public can read availability"
on public.availability for select to anon
using (true);

insert into public.products(slug,name,category,default_price,default_capacity) values
('soganli-valley-balloon-tour','Soğanlı Valley Balloon Tour','balloon',160,16),
('ihlara-valley-balloons-tour','Ihlara Valley Balloons Tour','balloon',60,20),
('pamukkale-balloons-tour','Pamukkale Balloons Tour','balloon',90,20),
('turkish-night-with-cave-dinner-cappadocia','Turkish Night With Cave Dinner Cappadocia','activity',50,30),
('balloons-watching-tour-cappadocia','Balloons Watching Tour Cappadocia','activity',35,20)
on conflict (slug) do update set
name=excluded.name,
category=excluded.category,
default_price=excluded.default_price,
default_capacity=excluded.default_capacity;

-- New private/custom tours
insert into public.products(slug,name,category,default_price,default_capacity) values
('private-red-tour-cappadocia','Private Red Tour Cappadocia','private',140,18),
('private-green-tour-cappadocia','Private Green Tour Cappadocia','private',160,18),
('cappadocia-mix-tour','Cappadocia Mix Tour','private',120,18),
('cappadocia-custom-package-tour','Cappadocia Custom Package Tour','private',0,18)
on conflict (slug) do update set
name=excluded.name,
category=excluded.category,
default_price=excluded.default_price,
default_capacity=excluded.default_capacity,
active=true;

-- ============================================================
-- FINAL SAFETY / IDEMPOTENCY PATCH — 2026-08-30
-- Safe to run repeatedly after the base setup above.
-- ============================================================

-- Admins may also insert/delete products when managing the catalog.
drop policy if exists "admins can insert products" on public.products;
create policy "admins can insert products"
on public.products for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can delete products" on public.products;
create policy "admins can delete products"
on public.products for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

-- Keep timestamps accurate.
create or replace function public.cappadociago_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_availability_updated_at on public.availability;
create trigger trg_availability_updated_at
before update on public.availability
for each row execute function public.cappadociago_touch_updated_at();

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function public.cappadociago_touch_updated_at();

-- Explicit privileges. RLS still controls which rows each role can see/change.
grant usage on schema public to anon, authenticated;
grant select on public.products, public.availability to anon;
grant select, insert, update, delete on public.products, public.availability, public.reservations to authenticated;
grant select on public.admin_users to authenticated;

-- ============================================================
-- CappadociaGo Tour Content Panel (admin/tours)
-- ============================================================
create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null,
  price numeric not null default 0,
  old_price numeric,
  duration_minutes integer,
  rating numeric default 4.9,
  reviews_count integer default 0,
  hero_image text,
  gallery_images text[] default '{}',
  is_published boolean default false,
  price_mode text not null default 'perPerson',
  ask_for_price boolean not null default false,
  default_capacity integer not null default 20,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.tour_translations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  lang text not null check (lang in ('tr','en','es')),
  title text not null,
  kicker text,
  duration_label text,
  hero_desc text,
  overview_title text,
  overview_paragraphs text[] default '{}',
  price_title text,
  price_text text,
  whats_included text[] default '{}',
  not_included text[] default '{}',
  highlights text[] default '{}',
  important_info text[] default '{}',
  itinerary text[] default '{}',
  flight_details_title text,
  flight_details_paragraphs text[] default '{}',
  pickup_info text,
  meeting_point text,
  after_flight_title text,
  after_flight_text text,
  refund_title text,
  refund_text text,
  advance_title text,
  advance_text text,
  safety_title text,
  safety_text text,
  seo_title text,
  seo_description text,
  unique(tour_id,lang)
);
alter table public.tours add column if not exists price_mode text not null default 'perPerson';
alter table public.tours add column if not exists ask_for_price boolean not null default false;
alter table public.tours add column if not exists default_capacity integer not null default 20;
alter table public.tour_translations add column if not exists not_included text[] default '{}';
alter table public.tour_translations add column if not exists highlights text[] default '{}';
alter table public.tour_translations add column if not exists itinerary text[] default '{}';
alter table public.tour_translations add column if not exists pickup_info text;
alter table public.tour_translations add column if not exists meeting_point text;
alter table public.tour_translations add column if not exists seo_title text;
alter table public.tour_translations add column if not exists seo_description text;
alter table public.tours enable row level security;
alter table public.tour_translations enable row level security;
drop policy if exists "Public can read published tours" on public.tours;
create policy "Public can read published tours" on public.tours for select to anon using (is_published=true);
drop policy if exists "Public can read translations of published tours" on public.tour_translations;
create policy "Public can read translations of published tours" on public.tour_translations for select to anon using (exists(select 1 from public.tours t where t.id=tour_translations.tour_id and t.is_published=true));
grant select on public.tours, public.tour_translations to anon, authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('tour-images','tour-images',true,12582912,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public can view tour images" on storage.objects;
create policy "Public can view tour images" on storage.objects for select to public using (bucket_id='tour-images');
