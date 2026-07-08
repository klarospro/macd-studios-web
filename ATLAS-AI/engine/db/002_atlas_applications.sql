-- atlas_applications — inscripciones de inversores/accionistas de Atlas AI.
-- Flujo: formulario público (self-signup) → estado 'pending' → admin aprueba/rechaza.
-- RLS activo SIN políticas para anon/authenticated → solo el service_role (backend
-- server-side) puede leer/escribir. El formulario inserta vía server action con service key.
create table if not exists public.atlas_applications (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  phone        text,
  address      text,
  capital      numeric,
  currency     text default 'USD',
  account_type text not null default 'inversor',   -- inversor | accionista | plantilla
  agenda       text,                                -- fecha/hora preferida para la llamada
  message      text,
  status       text not null default 'pending',     -- pending | approved | rejected
  notes        text,
  updated_at   timestamptz not null default now()
);
create index if not exists atlas_applications_status_idx on public.atlas_applications (status);
create index if not exists atlas_applications_created_idx on public.atlas_applications (created_at desc);

alter table public.atlas_applications enable row level security;
revoke all on public.atlas_applications from anon, authenticated;
