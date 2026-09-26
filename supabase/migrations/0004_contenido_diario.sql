-- MACD Studios — Contenido diario (vista /admin/hoy)
-- Pega en el SQL Editor (después de 0003). Idempotente.
-- category: problema | solucion | trabajar-conmigo | personal (reparto 50/30/10/10)
-- cta_keyword: palabra que la gente comenta ("AGENTE") para recibir el entregable por DM
-- stories: [{tipo, texto, sticker?}] — las historias del día que acompañan a la pieza
alter table content_items add column if not exists category text;
alter table content_items add column if not exists cta_keyword text;
alter table content_items add column if not exists stories jsonb;
