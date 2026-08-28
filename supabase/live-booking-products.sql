-- Run once in Supabase SQL Editor after uploading this package.
-- Adds the new products and keeps public calendar data read-only.

grant usage on schema public to anon;
grant select on public.products to anon;
grant select on public.availability to anon;

drop policy if exists "public_read_active_products" on public.products;
create policy "public_read_active_products"
on public.products for select to anon
using (active = true);

drop policy if exists "public_read_availability" on public.availability;
create policy "public_read_availability"
on public.availability for select to anon
using (true);

insert into public.products(slug,name,category,default_price,default_capacity) values
('goreme-standart-hot-air-balloon-tour','Göreme Standard Hot Air Balloon Tour','balloon',150,24),
('soganli-valley-balloon-tour','Soğanlı Valley Balloon Tour','balloon',160,16),
('ihlara-valley-balloons-tour','Ihlara Valley Sunrise Balloon Tour','balloon',60,16),
('pamukkale-balloons-tour','Pamukkale Hot Air Balloon Tour','balloon',90,16),
('balloons-watching-tour-cappadocia','Balloons Watching Tour Cappadocia','activity',35,20),
('turkish-night-with-cave-dinner-cappadocia','Turkish Night With Cave Dinner Cappadocia','activity',50,40)
on conflict (slug) do update set
  name=excluded.name,
  category=excluded.category,
  default_price=excluded.default_price,
  default_capacity=excluded.default_capacity,
  active=true;
