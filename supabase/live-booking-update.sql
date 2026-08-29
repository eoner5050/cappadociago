-- CAPPADOCIAGO - LIVE BOOKING UPDATE
-- Existing Supabase project: run this once in SQL Editor.

alter table public.products add column if not exists ask_for_price boolean not null default false;

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
