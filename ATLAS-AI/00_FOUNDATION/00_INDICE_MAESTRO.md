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
| 08 | TRADING | 🟡 Fase 3 (esqueleto construido + tests OK; adaptador Deriv live pendiente) | 00_RESUMEN.md, 01_DETALLE_ADAPTADOR_Y_CICLO_DE_VIDA.md, /engine |
| 09 | RISK | ✅ Fase 3 (defaults aprobados 2026-07-02, ajustables) | 00_RESUMEN.md, 01_DETALLE_FORMULAS_Y_PARAMETROS.md |
| 10 | POLYMARKET | 🟡 Fase 3 (investigación hecha 2026-07-03; BLOQUEANTE: confirmar jurisdicción antes de fondear; no hay testnet — plan paper interno pendiente de aprobación) | 00_RESUMEN.md, 01_DETALLE_API_Y_ESTRATEGIA.md |
| 11 | MT5 | ✅ Fase 3 (API Deriv investigada; usar Native API, no MT5) | 00_RESUMEN.md, 01_DETALLE_API_DERIV.md |
| 12 | EXCHANGES | ⬜ Fase 3 | — |
| 13 | BACKTESTING | 🟡 Fase 3 (catálogo de estrategias de fondos investigado 2026-07-03; recomendación: TSMOM 1º en demo. Pendiente: metodología/framework de backtesting y ejecución. ⚠️ revisar breaker de 4 pérdidas vs trend following) | 00_RESUMEN.md, 01_ESTRATEGIAS_FONDOS_REPLICABLES.md |
| 14 | PORTFOLIOS | 🟡 Fase 4 (diseño de capa de portafolio propuesto; decisiones tomadas 2026-07-03, código pendiente) | 00_RESUMEN.md, 01_DETALLE_CAPA_PORTAFOLIO.md |
| 15 | DASHBOARD | ⬜ Fase 4 | — |
| 16 | AUTOMATION | ⬜ Fase 5 | — |
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

Ver `ROADMAP_FASES.md` (raíz) para el orden de ejecución y `CLAUDE.md` (raíz) para las reglas.
