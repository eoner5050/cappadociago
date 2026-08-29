-- CAPPADOCIAGO - MANUEL REZERVASYON DETAYLARI
-- Supabase > SQL Editor içinde çalıştırabilirsiniz; script tekrar çalıştırılabilir.

create extension if not exists pgcrypto;

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
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "admins can insert reservations" on public.reservations;
create policy "admins can insert reservations"
on public.reservations for insert
to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "admins can update reservations" on public.reservations;
create policy "admins can update reservations"
on public.reservations for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "admins can delete reservations" on public.reservations;
create policy "admins can delete reservations"
on public.reservations for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
