-- MACD Studios — Redes sociales + Motor de Contenido (Fase A del PLAN-MAESTRO)
-- Pega este archivo en el SQL Editor de Supabase (mismo proyecto que 0001/0002) y ejecútalo.
-- Antes: backup (Database → Backups, o `supabase db dump`). Es idempotente: se puede re-ejecutar.

-- ── Cuentas conectadas (Instagram / TikTok) ─────────────────────────────
-- Datos públicos de la cuenta: los ve el panel con la sesión del admin.
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  external_id text not null,
  username text,
  display_name text,
  avatar_url text,
  followers integer,
  following integer,
  posts_count integer,
  likes_total bigint,
  last_synced_at timestamptz,
  last_error text,
  connected_at timestamptz default now(),
  unique (platform)
);

-- Tokens OAuth: tabla aparte, con RLS activado y SIN políticas → solo el service role
-- (servidor) puede leerla. El navegador y la sesión del admin nunca ven un token.
create table if not exists social_tokens (
  platform text primary key check (platform in ('instagram', 'tiktok')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text,
  updated_at timestamptz default now()
);

-- Foto diaria de la cuenta → gráficas de crecimiento.
create table if not exists social_metrics_daily (
  platform text not null check (platform in ('instagram', 'tiktok')),
  date date not null,
  followers integer,
  reach integer,
  views integer,
  profile_views integer,
  engagement integer,
  primary key (platform, date)
);

-- Publicaciones de la cuenta (propias o importadas) con sus métricas.
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok')),
  external_id text not null,
  media_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz,
  views integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  duration_s numeric,
  content_item_id uuid,
  synced_at timestamptz default now(),
  unique (platform, external_id)
);

-- Análisis de perfil hechos por el agente (historial).
create table if not exists social_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  platforms text[],
  summary text not null,
  data_snapshot jsonb
);

-- ── Motor de Contenido ──────────────────────────────────────────────────
-- Estados: idea → guion → produccion → revision → aprobado → publicado (o descartado / error)
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text not null default 'idea'
    check (status in ('idea', 'guion', 'produccion', 'revision', 'aprobado', 'publicado', 'descartado', 'error')),
  format text not null default 'reel' check (format in ('reel', 'carrusel')),
  platforms text[] not null default array['instagram', 'tiktok'],
  pillar text,
  title text not null,
  hook text,
  script text,
  slides jsonb,
  caption text,
  hashtags text,
  cta text,
  media_url text,
  media_urls text[],
  scheduled_for date,
  published_at timestamptz,
  instagram_media_id text,
  tiktok_publish_id text,
  last_error text,
  notes text,
  created_by text default 'agente'
);

create index if not exists content_items_status_idx on content_items (status, scheduled_for);

alter table social_accounts enable row level security;
alter table social_tokens enable row level security;
alter table social_metrics_daily enable row level security;
alter table social_posts enable row level security;
alter table social_analyses enable row level security;
alter table content_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['social_accounts', 'social_metrics_daily', 'social_posts', 'social_analyses', 'content_items']
  loop
    execute format('drop policy if exists "authenticated_full_access" on %I', t);
    execute format(
      'create policy "authenticated_full_access" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;
-- social_tokens: sin política a propósito (solo service role).

-- Bucket público para los videos/imágenes renderizados: Instagram y TikTok exigen una URL
-- pública para descargar el archivo al publicar.
insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

-- ── Cuentas de referencia (benchmark de crecimiento) ────────────────────
-- Cuentas de Instagram que crecieron bien en el nicho: se escanean con Business Discovery
-- y el agente extrae los patrones (ganchos, formatos, frecuencia) que alimentan al estratega.
create table if not exists social_references (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  niche text,
  followers integer,
  media_count integer,
  posts jsonb,
  analysis text,
  scanned_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);

alter table social_references enable row level security;
drop policy if exists "authenticated_full_access" on social_references;
create policy "authenticated_full_access" on social_references
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Generación con IA (Higgsfield) ──────────────────────────────────────
-- visual_prompt: descripción del plano de fondo que escribe el estratega (en inglés).
-- broll_url: clip generado y copiado a Storage. ai_cost_usd: coste estimado de la generación.
alter table content_items add column if not exists visual_prompt text;
alter table content_items add column if not exists broll_url text;
alter table content_items add column if not exists ai_cost_usd numeric;
