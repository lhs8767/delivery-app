create table if not exists public.warehouse_waybills (
  id uuid primary key default gen_random_uuid(),
  saved_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.warehouse_waybills enable row level security;

drop policy if exists "warehouse_waybills_select" on public.warehouse_waybills;
drop policy if exists "warehouse_waybills_insert" on public.warehouse_waybills;
drop policy if exists "warehouse_waybills_delete" on public.warehouse_waybills;

create policy "warehouse_waybills_select"
on public.warehouse_waybills
for select
to anon
using (true);

create policy "warehouse_waybills_insert"
on public.warehouse_waybills
for insert
to anon
with check (true);

create policy "warehouse_waybills_delete"
on public.warehouse_waybills
for delete
to anon
using (true);
