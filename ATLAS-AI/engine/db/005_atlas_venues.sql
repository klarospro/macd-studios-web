-- Plantilla de VENUES (conexiones de broker/exchange) de Atlas.
-- Guarda SOLO metadatos de configuración, NUNCA la clave/secreto de la API:
-- el secreto vive en el .env.local del VPS (columna env_var = NOMBRE de la variable, no su valor).
-- Patrón: multi-broker "plantilla maestra" (Deriv/Polymarket/MT5/otros) — el cerebro es el
-- activo; cada venue es un enchufe que se da de alta rellenando esta ficha.

create table if not exists public.atlas_venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- nombre visible: "Deriv demo", "Polymarket wallet 1"...
  kind        text not null,                 -- deriv | polymarket | mt5 | otro
  market      text,                          -- Forex / Cripto / Predicción / Índices...
  capital     numeric not null default 0,    -- capital asignado a este venue (moneda de la cuenta)
  currency    text not null default 'USD',
  symbols     text,                          -- lista libre: "BTCUSD, XAUUSD, EURUSD"
  env_var     text,                          -- NOMBRE de la env con el secreto (p.ej. DERIV_API_TOKEN). Sin valor.
  status      text not null default 'sin_conectar', -- activo | pausado | sin_conectar
  is_demo     boolean not null default true, -- demo/paper vs real (real requiere aprobación explícita)
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Solo el backend (service_role) toca esta tabla; el panel pasa por el API con gate de admin.
alter table public.atlas_venues enable row level security;

comment on table public.atlas_venues is
  'Fichas de conexión de venues (metadatos, sin secretos). El secreto va en env_var dentro del .env del VPS.';
