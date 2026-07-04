-- trading_audit_log — auditoría WORM del motor (18_SECURITY). Ejecutar en Supabase (SQL editor).
-- INSERT solo desde backend de confianza (service role); UPDATE/DELETE revocados para todos.
create table if not exists public.trading_audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null,
  kind        text        not null,
  venue_id    text,
  symbol      text,
  reason      text,
  event       jsonb       not null,
  inserted_at timestamptz not null default now()
);

create index if not exists trading_audit_log_at_idx on public.trading_audit_log (at desc);
create index if not exists trading_audit_log_kind_idx on public.trading_audit_log (kind);

-- Patrón WORM: nadie puede modificar ni borrar el histórico.
alter table public.trading_audit_log enable row level security;
revoke update, delete on public.trading_audit_log from anon, authenticated;

-- equity_log — curva de equity por cuenta para el dashboard.
create table if not exists public.equity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null,
  venue_id    text        not null,
  equity      numeric     not null,
  inserted_at timestamptz not null default now()
);
create index if not exists equity_log_at_idx on public.equity_log (at desc);
alter table public.equity_log enable row level security;
revoke update, delete on public.equity_log from anon, authenticated;
