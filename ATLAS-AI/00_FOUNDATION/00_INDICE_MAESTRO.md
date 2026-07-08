# ÍNDICE MAESTRO — ATLAS AI

Cárgalo primero. No abras carpetas enteras sin necesidad — solo el `00_RESUMEN.md` de la carpeta que toque.

| # | Carpeta | Estado | Resumen disponible |
|---|---------|--------|---------------------|
| 00 | FOUNDATION | ✅ Fase 0 hecha | 01_INTEGRACION_MACD_STUDIOS.md, 02_CLAUDE_CODE_ARQUITECTURA.md, 03_MCP_TRADING_INVESTIGADO.md |
| 01 | RESEARCH | ⬜ pendiente | — |
| 02 | ARCHITECTURE | ✅ Fase 1 hecha (+ nota multi-venue operador único 2026-07-07) | 00_RESUMEN.md, 01_DETALLE_MONOLITO_VS_MICROSERVICIOS.md |
| 03 | AI | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_MODELOS_Y_CACHING.md |
| 04 | MCP | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_MCPS_RECOMENDADOS.md |
| 05 | SKILLS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_SKILLS.md |
| 06 | HOOKS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_HOOKS.md |
| 07 | AGENTS | ✅ Fase 2 hecha | 00_RESUMEN.md, 01_DETALLE_SUBAGENTES.md |
| 08 | TRADING | ✅ Fase 3 (adaptador Deriv demo live validado end-to-end; runner diario en vivo + auditoría WORM; 15 tests; + investigación fondeos/prop firms 2026-07-07) | 00_RESUMEN.md, 01_DETALLE_ADAPTADOR_Y_CICLO_DE_VIDA.md, 02_DETALLE_FONDEOS_PROP_FIRMS.md, /engine |
| 09 | RISK | ✅ Fase 3 (defaults aprobados 2026-07-02, ajustables) | 00_RESUMEN.md, 01_DETALLE_FORMULAS_Y_PARAMETROS.md |
| 10 | POLYMARKET | 🟡 Fase 3 (investigación hecha 2026-07-03; BLOQUEANTE: confirmar jurisdicción antes de fondear; no hay testnet — plan paper interno pendiente de aprobación; + nota fan-out multi-wallet y venue principal de predicción 2026-07-07) | 00_RESUMEN.md, 01_DETALLE_API_Y_ESTRATEGIA.md |
| 11 | MT5 | ✅ Fase 3 (API Deriv investigada; usar Native API para CFD propio; + investigación 2026-07-07: fondeos SÍ requieren MT5/Windows, matiz importante) | 00_RESUMEN.md, 01_DETALLE_API_DERIV.md, 02_DETALLE_FONDEOS_MT5_MULTICUENTA.md |
| 12 | EXCHANGES | 🟡 (investigación 2026-07-07: venue principal por mercado — acciones/forex/predicción + TradingView aclarado; exchanges cripto Binance/Bybit sigue ⬜ sin empezar) | 00_RESUMEN.md, 01_DETALLE_COMPARATIVA_VENUES_PRINCIPALES.md |
| 13 | BACKTESTING | ✅ Fase 3 (harness construido: HistoricalReplayAdapter reutiliza el motor; TSMOM sobre datos reales BTC + 5 instrumentos Deriv. Breaker resuelto: config por-venue) | 00_RESUMEN.md, 01_ESTRATEGIAS_FONDOS_REPLICABLES.md, /engine/src/backtest |
| 14 | PORTFOLIOS | ✅ Fase 4 (PortfolioManager construido + tests: gate global 4%; + diseño de fan-out a N cuentas propias por venue 2026-07-07, pendiente aprobación) | 00_RESUMEN.md, 01_DETALLE_CAPA_PORTAFOLIO.md, 02_DETALLE_FANOUT_MULTICUENTA.md, /engine/src/portfolio |
| 15 | DASHBOARD | 🟡 Fase 4 (v1 generado: estado + backtest, HTML self-contained. Pendiente: leer de Supabase en vivo + integrar en Next.js) | /engine/dashboard/template.html |
| 16 | AUTOMATION | ✅ Fase 5 — BOT 24/7 EN VIVO (2026-07-08): systemd `atlas-cycle.timer` en VPS Hetzner dispara el ciclo `--execute` cada día 00:05 UTC; 1ª corrida abrió 3 posiciones demo verificadas en Supabase. Pendiente menor: Telegram + publish timer opcional | 00_RESUMEN.md, deploy/*, /engine/src/live |
| 17 | SAAS | 🟡 Fase 5 (investigación inicial 2026-07-07: regulatorio de captación de fondos — BLOQUEANTE legal para el producto "ahorro", consultar abogado — y modelo de datos de dashboards multi-tenant RLS) | 00_RESUMEN.md, 01_DETALLE_REGULATORIO_CAPTACION_FONDOS.md, 02_DETALLE_DASHBOARDS_MULTITENANT_SUPABASE.md |
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

## Sesión de investigación 2026-07-07 — modelo operador único, fondeos, regulatorio, dashboards
Investigación pura (no se tocó código de producción). 6 archivos nuevos + 5 resúmenes existentes actualizados con referencias cruzadas.

**Documentado:**
- `14_PORTFOLIOS/02_DETALLE_FANOUT_MULTICUENTA.md`: mecánica de fan-out de una señal aprobada a N cuentas propias por venue (Deriv: N tokens + N `DerivAdapter`, trivial; Polymarket: N wallets, trivial pero riesgo de auto-impacto de precio si se reparte mal en el mismo mercado; MT5-fondeo: SIN equivalente a Native API, requiere N terminales Windows + EA — ver siguiente punto).
- `08_TRADING/02_DETALLE_FONDEOS_PROP_FIRMS.md`: reglas oficiales de FTMO (profit target 10%/5%, daily loss 3-5%, max drawdown 10% trailing/estático según fase, ≥4 días mínimos, EA sí permitido con restricciones confirmadas) + diseño de estrategia agresiva compatible con drawdown (buffer interno 50-70% del límite del firm, drawdown estático preferible para trend-following, sizing más conservador, atención a la "Best Day Rule").
- `11_MT5/02_DETALLE_FONDEOS_MT5_MULTICUENTA.md`: hallazgo clave — el plugin oficial MAMM de MetaQuotes es solo para brókeres/gestores licenciados, NO para un trader retail con cuentas de fondeo; escalar a N cuentas de fondeo reabre (con justificación real) el bloqueo de VPS Windows ya anotado en `00_FOUNDATION/03`.
- `17_SAAS/00_RESUMEN.md` + `01_DETALLE_REGULATORIO_CAPTACION_FONDOS.md` (**SIN CONFIRMAR — consultar abogado**): el producto "ahorro" (depósito + retorno prometido 2-5% mensual) coincide con el patrón que Banco de España/CNMV identifican públicamente como propio de entidades no autorizadas (captación de fondos reembolsables, Art. 9 Directiva 2013/36/UE); "accionista" (50/50 real sin retorno garantizado) es más defendible pero requiere estructura societaria correcta; "plantilla" (licencia) es el de menor riesgo. **BLOQUEANTE: no lanzar "ahorro" a clientes reales sin abogado.**
- `17_SAAS/02_DETALLE_DASHBOARDS_MULTITENANT_SUPABASE.md`: modelo de datos — tablas agregadas por tenant (`tenant_portfolio_snapshot`, `tenant_statements`, `tenant_capital_movements`) separadas de las tablas crudas del motor; RLS 100% solo lectura para clientes; `tenant_id`/`rol` en `app_metadata` del JWT (mismo patrón que `18_SECURITY`).
- Actualizados con referencias cruzadas (sin cambiar sus decisiones previas): `02_ARCHITECTURE/00_RESUMEN.md`, `14_PORTFOLIOS/00_RESUMEN.md`, `08_TRADING/00_RESUMEN.md`, `11_MT5/00_RESUMEN.md`, `10_POLYMARKET/00_RESUMEN.md`.

**Recomendaciones accionables (para Moisés):**
1. **No lanzar el producto "ahorro" (2-5% mensual prometido) a clientes reales sin consultar a un abogado especializado en derecho bancario/de valores** — coincide con el patrón público de "entidades no autorizadas" de Banco de España/CNMV. Fuente: `bde.es/wbe/es/punto-informacion/contenidos/advertencias-publico/las-entidades-no-autorizadas-intrusos/`, Art. 9 Directiva 2013/36/UE.
2. **Elegir el/los prop firm(s) de fondeo ANTES de diseñar nada más de esa pieza** — casi todo lo demás (coste, si permite EA, si exige VPS Windows, naturaleza real del capital financiado) depende de esa elección. Empezar con el firm cuyas reglas oficiales se puedan verificar por escrito (ejemplo confirmado en esta sesión: FTMO). Fuente: `ftmo.com/en/trading-objectives/`, `ftmo.com/en/forbidden-trading-practices/`.
3. **Para trend-following en cuenta de fondeo, preferir firms con drawdown ESTÁTICO (no trailing)** y fijar un buffer interno propio al 50-70% del límite de pérdida diaria del firm — el trailing erosiona el colchón justo cuando la estrategia empieza a ganar, y operar "al límite exacto" arriesga perder la cuenta entera por un slippage puntual. Fuente: comparativas de mercado 2026 (the5ers.com, thepropfirmguide.com — no oficiales, verificar contra el firm elegido).
4. **No construir el puente MT5 para fondeos todavía**: no hay vía oficial de MetaQuotes para automatizar N cuentas de fondeo sin terminal Windows por cuenta — esperar a elegir firm y confirmar si ofrece alternativa (algunos firms de futuros sí tienen webhook/API propio) antes de invertir en una VPS Windows. Fuente: `metatrader5.com/en/news/1383` (MAMM es para brókeres, no retail).
5. **Construir los dashboards de solo lectura (plantilla/accionista/ahorro-informe) ya**, pues el diseño con RLS 100% lectura y tablas agregadas separadas del motor es de bajo riesgo técnico y encaja con decisiones de infraestructura ya tomadas (`18_SECURITY`, `19_INFRASTRUCTURE`) — pero mantener el producto "ahorro" fuera de producción hasta resolver el punto 1.

## Pregunta de Moisés 2026-07-07 (misma sesión) — venue principal por mercado
Investigado y documentado en `12_EXCHANGES/00_RESUMEN.md` + `01_DETALLE_COMPARATIVA_VENUES_PRINCIPALES.md`.
- **TradingView aclarado con fuente oficial**: NO es broker ni fondeo — solo charting + webhooks de alerta (HTTP POST). No ejecuta, no custodia. "Hacer fondeos con TradingView" no existe como operación; TradingView como mucho es origen de señal, la ejecución la hace siempre el broker/EA real.
- **Recomendación de venue PRINCIPAL por mercado**: Acciones/índices → **MT5** (con broker retail a cotizar; alternativa sin fondeo: Interactive Brokers, API oficial headless, acciones reales, sin ecosistema de fondeo). Forex → **Deriv Native API** (ya headless y validado) para cuenta propia; MT5 queda solo como vehículo de fondeo forex. Predicción → **Polymarket** (API/CLOB oficial, el más headless-nativo de los tres).
- **Hub técnico**: VPS Linux Hetzner (ya en uso) sigue sirviendo a Deriv + Polymarket sin cambios; una VPS Windows nueva (aún no construida) sería necesaria SOLO si se activan fondeos MT5 (forex y/o acciones comparten el mismo hub Windows).
- **Sin confirmar**: bróker MT5 concreto a elegir, si la Native API de Deriv cubre acciones reales o solo Deriv X/MT5 las tiene, si el prop firm elegido para acciones ofrece drawdown estático.

Ver `ROADMAP_FASES.md` (raíz) para el orden de ejecución y `CLAUDE.md` (raíz) para las reglas.
