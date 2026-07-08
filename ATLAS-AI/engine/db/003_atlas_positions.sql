-- atlas_positions — snapshot de las posiciones abiertas del bot por venue, para el
-- dashboard en tiempo real de Moisés. El runner reemplaza el snapshot de su venue en cada ciclo.
create table if not exists public.atlas_positions (
  id          bigint generated always as identity primary key,
  venue       text        not null,
  symbol      text        not null,
  side        text        not null,
  size        numeric     not null,
  entry_price numeric,
  stop_price  numeric,
  risk_amount numeric,
  opened_at   timestamptz,
  updated_at  timestamptz not null default now()
);
create index if not exists atlas_positions_venue_idx on public.atlas_positions (venue);

alter table public.atlas_positions enable row level security;
revoke all on public.atlas_positions from anon, authenticated;
