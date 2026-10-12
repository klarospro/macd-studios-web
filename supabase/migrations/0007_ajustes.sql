-- MACD Studios — Ajustes del negocio editables sin tocar código
-- Clave/valor en jsonb para lo que hoy está escrito a mano en lib/admin/business-context.ts
-- (plazo de entrega, garantía, teléfono de contacto…). Idempotente: no borra ni pisa valores
-- ya existentes, solo crea lo que falte.

create table if not exists settings (
  key        text primary key,
  value      jsonb       not null,
  nota       text,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'settings' and policyname = 'authenticated_full_access'
  ) then
    create policy "authenticated_full_access" on settings for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Plazo de puesta en marcha — decisión de Moisés (12/10/2026): 15 días naturales como máximo,
-- y mejor si se entrega antes. El contador arranca cuando el cliente entrega sus datos
-- (textos, logo, accesos), no el día de la firma.
insert into settings (key, value, nota) values (
  'plazo_entrega',
  jsonb_build_object(
    'dias_maximo', 15,
    'cuenta_desde', 'datos_del_cliente',
    'garantia_publica', 'funcionando en 15 días o el primer mes es gratis'
  ),
  'Techo de entrega y garantía pública. Lo usan la web, los anuncios y los agentes.'
)
on conflict (key) do nothing;
