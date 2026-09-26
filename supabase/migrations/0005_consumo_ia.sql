-- MACD Studios — Consumo de APIs de IA (vista /admin/consumo)
-- Cada llamada a una API de pago (Anthropic, Higgsfield, Gemini, HeyGen, ElevenLabs…) desde
-- cualquier app del sistema (panel, Viernes, macd-content, apps nuevas) deja una fila aquí.
-- Idempotente. Solo añade tablas: no toca datos existentes.

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,              -- anthropic | higgsfield | gemini | heygen | elevenlabs | otro
  app text not null,                   -- panel | viernes | macd-content | max | <app nueva>
  feature text,                        -- agente-marketing, benchmark, plan-semanal, broll…
  model text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cache_read_tokens integer default 0,
  cache_write_tokens integer default 0,
  web_searches integer default 0,
  cost_usd numeric(12, 6) not null default 0,
  meta jsonb
);

create index if not exists ai_usage_created_idx on ai_usage (created_at desc);
create index if not exists ai_usage_provider_idx on ai_usage (provider, created_at desc);

-- Presupuesto mensual por proveedor (para las barras y el aviso de exceso).
create table if not exists ai_budgets (
  provider text primary key,
  monthly_usd numeric(10, 2) not null,
  updated_at timestamptz default now()
);

alter table ai_usage enable row level security;
alter table ai_budgets enable row level security;

drop policy if exists "authenticated_full_access" on ai_usage;
create policy "authenticated_full_access" on ai_usage
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated_full_access" on ai_budgets;
create policy "authenticated_full_access" on ai_budgets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Presupuestos iniciales del PLAN-MAESTRO §4 (se editan desde el panel).
insert into ai_budgets (provider, monthly_usd) values ('anthropic', 50), ('higgsfield', 50)
on conflict (provider) do nothing;
