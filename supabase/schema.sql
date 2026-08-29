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

drop policy if exists "admins can insert products" on public.products;
create policy "admins can insert products"
on public.products for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

drop policy if exists "admins can delete products" on public.products;
create policy "admins can delete products"
on public.products for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())));

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
