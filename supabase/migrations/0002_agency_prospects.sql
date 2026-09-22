-- MACD Studios — Panel Maestro: Propuestas
-- Pega este archivo en el SQL Editor de Supabase (mismo proyecto que 0001) y ejecútalo.
-- Pipeline de ventas de la propia agencia (clientes potenciales de MACD Studios) —
-- deliberadamente separado de `clients` (clientes ya facturables) y de cualquier tabla
-- de leads de un proyecto de cliente (esas viven en el Supabase de cada cliente, no aquí).

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  contact text,
  service text,
  amount numeric,
  currency text default 'USD',
  status text default 'prospecto',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table prospects enable row level security;

drop policy if exists "authenticated_full_access" on prospects;
create policy "authenticated_full_access" on prospects
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
