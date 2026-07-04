# ÍNDICE MAESTRO — ATLAS AI

Cárgalo primero. No abras carpetas enteras sin necesidad — solo el `00_RESUMEN.md` de la carpeta que toque.

| # | Carpeta | Estado | Resumen disponible |
|---|---------|--------|---------------------|
| 00 | FOUNDATION | ✅ Fase 0 hecha | 01_INTEGRACION_MACD_STUDIOS.md, 02_CLAUDE_CODE_ARQUITECTURA.md, 03_MCP_TRADING_INVESTIGADO.md |
| 01 | RESEARCH | ⬜ pendiente | — |
| 02 | ARCHITECTURE | ✅ Fase 1 hecha | 00_RESUMEN.md, 01_DETALLE_MONOLITO_VS_MICROSERVICIOS.md |
| 03 | AI | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_MODELOS_Y_CACHING.md |
| 04 | MCP | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_MCPS_RECOMENDADOS.md |
| 05 | SKILLS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_SKILLS.md |
| 06 | HOOKS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_HOOKS.md |
| 07 | AGENTS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_SUBAGENTES.md |
| 08 | TRADING | ✅ Fase 3 (adaptador Deriv demo live validado end-to-end; runner diario en vivo + auditoría WORM; 15 tests) | 00_RESUMEN.md, 01_DETALLE_ADAPTADOR_Y_CICLO_DE_VIDA.md, /engine |
| 09 | RISK | ✅ Fase 3 (defaults aprobados 2026-07-02, ajustables) | 00_RESUMEN.md, 01_DETALLE_FORMULAS_Y_PARAMETROS.md |
| 10 | POLYMARKET | 🟡 Fase 3 (investigación hecha 2026-07-03; BLOQUEANTE: confirmar jurisdicción antes de fondear; no hay testnet — plan paper interno pendiente de aprobación) | 00_RESUMEN.md, 01_DETALLE_API_Y_ESTRATEGIA.md |
| 11 | MT5 | ✅ Fase 3 (API Deriv investigada; usar Native API, no MT5) | 00_RESUMEN.md, 01_DETALLE_API_DERIV.md |
| 12 | EXCHANGES | ⬜ Fase 3 | — |
| 13 | BACKTESTING | ✅ Fase 3 (harness construido: HistoricalReplayAdapter reutiliza el motor; TSMOM sobre datos reales BTC + 5 instrumentos Deriv. Breaker resuelto: config por-venue) | 00_RESUMEN.md, 01_ESTRATEGIAS_FONDOS_REPLICABLES.md, /engine/src/backtest |
| 14 | PORTFOLIOS | ✅ Fase 4 (PortfolioManager construido + tests: gate global 4%; decisiones tomadas 2026-07-03) | 00_RESUMEN.md, 01_DETALLE_CAPA_PORTAFOLIO.md, /engine/src/portfolio |
| 15 | DASHBOARD | 🟡 Fase 4 (v1 generado: estado + backtest, HTML self-contained. Pendiente: leer de Supabase en vivo + integrar en Next.js) | /engine/dashboard/template.html |
| 16 | AUTOMATION | 🟡 Fase 5 (runner diario en vivo construido `cycle:daily`; pendiente: cron en VPS Hetzner + Supabase) | /engine/src/live |
| 17 | SAAS | ⬜ Fase 5 | — |
| 18 | SECURITY | ✅ Fase 1 hecha | 00_RESUMEN.md, 01_DETALLE_MODELO_SEGURIDAD_MULTITENANT.md |
| 19 | INFRASTRUCTURE | ✅ Fase 1 hecha | 00_RESUMEN.md, 01_DETALLE_SUPABASE_SCHEMA_VS_PROYECTO.md |
| 20-26 | DOCS/TEST/DEPLOY/MKT/CLIENTS/TEMPLATES/KB | ⬜ Fase 6 | — |

Leyenda: ✅ hecho · 🟡 parcial · ⬜ sin empezar

## Decisiones diferidas (aprobado por Moisés, 2026-07-02)
- **Plan Supabase actual del proyecto de leads** (Free/Pro): sin confirmar — se valida más adelante con datos reales, no bloquea Fase 2. Ver `19_INFRASTRUCTURE/00_RESUMEN.md`.
- **Vercel + WebSockets persistentes para el trading engine**: ✅ RESUELTO (2026-07-02) — el cliente WebSocket a Deriv corre como proceso Node.js de larga duración en el VPS Hetzner, NO en Vercel Functions (límite de duración + no garantiza misma instancia tras reconexión; Deriv cierra la sesión WS a los 2 min de inactividad). El dashboard Next.js sigue en Vercel y lee resultados vía Supabase. Ver `11_MT5/00_RESUMEN.md`.

## Pendiente de decisión (detectado 2026-07-03, Polymarket)
- **Jurisdicción legal para operar Polymarket**: la plataforma internacional bloquea ~33 países (incl. EE.UU. y jurisdicciones OFAC). Confirmar elegibilidad ANTES de fondear wallet. Ver `10_POLYMARKET/01_DETALLE_API_Y_ESTRATEGIA.md` §2.2.
- **Plan paper Polymarket** (no existe testnet oficial): simulador interno sobre feeds públicos → wallet micro-real → capital objetivo. Requiere aprobación de Moisés. Ver §2.3 del detalle.

## Pendiente de decisión (detectado 2026-07-03, Backtesting/estrategias)
- **Circuit breaker de 4 pérdidas consecutivas (09_RISK regla 5) vs trend following**: con win rate ~30-45% (por diseño de la estrategia), rachas de 4 pérdidas son estadísticamente frecuentes → el breaker parará el sistema a menudo. Decidir con Moisés: subir el umbral para esa estrategia, o aceptar los parones. Ver `13_BACKTESTING/01_ESTRATEGIAS_FONDOS_REPLICABLES.md` ficha 1.
- **Swaps/costes reales de Deriv por instrumento**: sin confirmar — determinan la viabilidad del carry FX (ficha 3) y afectan al backtest de todas las estrategias. Verificar contra docs oficiales de Deriv antes de backtestear.

## Sesión autónoma 2026-07-04 — construido + decisiones tomadas
- **Construido**: PortfolioManager (gate global 4%), estrategia TSMOM + harness de backtest (HistoricalReplayAdapter) sobre datos reales, runner diario en vivo (`cycle:daily`), auditoría WORM (fichero + Supabase env-gated), dashboard v1. 15/15 tests.
- **Resultados backtest (datos reales, ~1-2 años, sin costes)**: BTC 2a config TSMOM +9.6% (DD 8.2%); cartera 5 activos +3.8%, 3/5 positivos; EURUSD cortado por breaker de drawdown (red de seguridad OK).
- **Decisión tomada**: breaker de pérdidas consecutivas → configurable por venue (`Venue.config`); TSMOM usa umbral relajado (12). Justificado empíricamente (con 4 el sistema se paró a mitad del backtest).
- **Jurisdicción Polymarket**: España → viable; paper primero.
- **Pendiente para Moisés**: (1) credenciales Supabase + correr `engine/db/001_trading_audit_log.sql`; (2) desplegar runner en VPS Hetzner con cron diario para el mes de demo; (3) confirmar swaps/costes reales de Deriv antes de fiarse de los backtests.

Ver `ROADMAP_FASES.md` (raíz) para el orden de ejecución y `CLAUDE.md` (raíz) para las reglas.
