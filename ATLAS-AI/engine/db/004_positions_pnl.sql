-- Añade P&L en vivo al snapshot de posiciones (para ver ganancias/pérdidas en el dashboard).
alter table public.atlas_positions add column if not exists profit numeric;
alter table public.atlas_positions add column if not exists current_spot numeric;
