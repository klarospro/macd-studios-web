-- =============================================================================
-- Cartera multi-sleeve — registro de operaciones y resúmenes semanales
-- Tarea 6 de 27_SCALPING/04. Aplicar con: npm run migrate -- db/007_atlas_sleeve_trades.sql
-- =============================================================================
-- Va APARTE de `trading_audit_log`: aquella es el registro WORM de eventos del
-- motor (orden colocada, rechazada, fallida); esta es la ficha de la OPERACIÓN,
-- con lo que la Fase 1 necesita medir sin reconstruir nada.
--
-- RLS activo y SIN políticas: solo `service_role` (el motor) puede leer y
-- escribir. Mismo patrón que `atlas_venues` y `atlas_applications`.
-- =============================================================================

create table if not exists public.atlas_sleeve_trades (
  id                   text primary key,
  sleeve               text not null check (sleeve in ('core', 'intradia', 'eventscalp')),
  symbol               text not null,
  side                 text not null check (side in ('buy', 'sell')),
  setup_id             text,
  abierto_en           timestamptz not null,
  cerrado_en           timestamptz,
  precio_entrada       double precision not null,
  precio_salida        double precision,
  size                 double precision not null,
  risk_amount          double precision not null,
  nocional             double precision not null,
  apalancamiento_usado double precision not null,
  -- Spread y slippage: las dos cifras que decidieron el NO-GO de las
  -- estrategias intradía anteriores. Sin medirlas en demo, la decisión de
  -- Fase 2 se tomaría otra vez a ciegas.
  spread_entrada       double precision,
  slippage             double precision,
  pnl                  double precision,
  -- Puntuación de la sorpresa que dio la IA (solo Sleeve C).
  puntuacion_ia        double precision,
  motivo_salida        text,
  -- true en dry-run: permite excluirlas de las métricas de Fase 1.
  simulada             boolean not null default false,
  creado_en            timestamptz not null default now()
);

comment on table public.atlas_sleeve_trades is
  'Ficha de cada operación de la cartera multi-sleeve (Core/Intradía/EventScalp). Base de los criterios de paso de Fase 1.';

-- Consultas típicas: por sleeve y por fecha de cierre (resumen semanal),
-- y las abiertas (cerrado_en null) al arrancar cada pasada del ciclo.
create index if not exists atlas_sleeve_trades_sleeve_cerrado_idx
  on public.atlas_sleeve_trades (sleeve, cerrado_en desc);
create index if not exists atlas_sleeve_trades_abiertas_idx
  on public.atlas_sleeve_trades (sleeve) where cerrado_en is null;

alter table public.atlas_sleeve_trades enable row level security;

-- =============================================================================
-- Resumen semanal por sleeve y de cartera
-- =============================================================================
create table if not exists public.atlas_sleeve_weekly (
  id             bigserial primary key,
  semana_inicio  date not null,
  semana_fin     date not null,
  -- 'cartera' agrega los tres sleeves.
  sleeve         text not null check (sleeve in ('core', 'intradia', 'eventscalp', 'cartera')),
  trades         integer not null,
  win_rate       double precision not null,
  expectancy     double precision not null,
  expectancy_r   double precision not null,
  profit_factor  double precision,
  pnl_total      double precision not null,
  drawdown_max   double precision not null,
  drawdown_pct   double precision not null,
  spread_medio   double precision,
  slippage_medio double precision,
  -- Estado de los criterios de paso en el momento del resumen.
  criterios      jsonb,
  pasa_fase1     boolean not null default false,
  creado_en      timestamptz not null default now(),
  unique (semana_inicio, sleeve)
);

comment on table public.atlas_sleeve_weekly is
  'Resumen semanal automático por sleeve y de cartera, con el estado de los criterios de paso de Fase 1.';

create index if not exists atlas_sleeve_weekly_semana_idx
  on public.atlas_sleeve_weekly (semana_inicio desc);

alter table public.atlas_sleeve_weekly enable row level security;
