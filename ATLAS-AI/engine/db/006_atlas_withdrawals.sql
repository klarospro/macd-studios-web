-- 006_atlas_withdrawals.sql
-- Solicitudes de retiro de ganancias (trimestral / anual) — modelo "como un fondo".
-- MODO SOLO-SOLICITUD: registra la petición y notifica; NO mueve dinero automáticamente.
-- El pago lo ejecuta y confirma Moisés manualmente (audit trail en la columna status).
--
-- RLS activado SIN políticas => solo la service_role (backend) puede leer/escribir.
-- Correr una vez en el SQL Editor del proyecto Atlas.

create table if not exists public.atlas_withdrawals (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  period_type  text not null default 'trimestral',   -- 'trimestral' | 'anual'
  period_label text,                                  -- p.ej. 'Q3 2026' o '2026'
  amount       numeric,                               -- importe solicitado (aprox.)
  currency     text not null default 'USD',
  notes        text,
  status       text not null default 'pending',       -- pending | approved | paid | rejected
  constraint atlas_withdrawals_period_type_chk check (period_type in ('trimestral','anual')),
  constraint atlas_withdrawals_status_chk check (status in ('pending','approved','paid','rejected'))
);

create index if not exists atlas_withdrawals_status_idx on public.atlas_withdrawals (status, created_at desc);

alter table public.atlas_withdrawals enable row level security;
-- (Sin políticas: acceso solo vía service_role desde el backend.)
