-- MACD Studios — Origen de los leads (atribución de anuncios)
-- Guarda de qué campaña/anuncio vino cada lead del embudo web. Solo añade columnas opcionales
-- a bot_leads: no modifica ni borra datos existentes. Idempotente.
alter table bot_leads add column if not exists utm_source text;
alter table bot_leads add column if not exists utm_medium text;
alter table bot_leads add column if not exists utm_campaign text;
alter table bot_leads add column if not exists utm_content text;
alter table bot_leads add column if not exists utm_term text;
alter table bot_leads add column if not exists landing text;
alter table bot_leads add column if not exists referrer text;
alter table bot_leads add column if not exists fbclid text;

create index if not exists bot_leads_campaign_idx on bot_leads (utm_campaign) where utm_campaign is not null;
