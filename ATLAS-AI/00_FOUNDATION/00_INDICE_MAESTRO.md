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
| 08 | TRADING | ✅ Fase 3 (adaptador Deriv demo live validado end-to-end; runner diario en vivo + auditoría WORM; 15 tests; + investigación fondeos forex/CFD FTMO 2026-07-07; + investigación fondeos de FUTUROS Apex/Topstep/Lucid 2026-09-15) | 00_RESUMEN.md, 01_DETALLE_ADAPTADOR_Y_CICLO_DE_VIDA.md, 02_DETALLE_FONDEOS_PROP_FIRMS.md, 03_DETALLE_FONDEOS_FUTUROS_APEX_TOPSTEP_LUCID.md, /engine |
| 09 | RISK | ✅ Fase 3 (defaults aprobados 2026-07-02, ajustables) | 00_RESUMEN.md, 01_DETALLE_FORMULAS_Y_PARAMETROS.md |
| 10 | POLYMARKET | 🟡 Fase 3 (investigación hecha 2026-07-03; BLOQUEANTE: confirmar jurisdicción antes de fondear; no hay testnet — plan paper interno pendiente de aprobación; + nota fan-out multi-wallet y venue principal de predicción 2026-07-07) | 00_RESUMEN.md, 01_DETALLE_API_Y_ESTRATEGIA.md |
| 11 | MT5 | ✅ Fase 3 (API Deriv investigada; usar Native API para CFD propio; + investigación 2026-07-07: fondeos SÍ requieren MT5/Windows, matiz importante) | 00_RESUMEN.md, 01_DETALLE_API_DERIV.md, 02_DETALLE_FONDEOS_MT5_MULTICUENTA.md |
| 12 | EXCHANGES | 🟡 (investigación 2026-07-07: venue principal por mercado — acciones/forex/predicción + TradingView aclarado; exchanges cripto Binance/Bybit sigue ⬜ sin empezar) | 00_RESUMEN.md, 01_DETALLE_COMPARATIVA_VENUES_PRINCIPALES.md |
| 13 | BACKTESTING | ✅ Fase 3 (harness construido: HistoricalReplayAdapter reutiliza el motor; TSMOM sobre datos reales BTC + 5 instrumentos Deriv. Breaker resuelto: config por-venue) + 🔴 NO-GO validado (2026-09-15): Oro (2 datasets)/Nasdaq/US30 con datos MT5 retail reales, 5 setups × grid de 1.084 combos de salida → 0 pasa filtros (PF>1,3, ≥100 trades, walk-forward por mitades); mejor combo PF 1,197 (Oro, continuación de impulso), resto ≤1,11 | 00_RESUMEN.md, 01_ESTRATEGIAS_FONDOS_REPLICABLES.md, 04_ANALISIS_ORO_NASDAQ_US30.md, /engine/src/backtest |
| 14 | PORTFOLIOS | ✅ Fase 4 (PortfolioManager construido + tests: gate global 4%; + diseño de fan-out a N cuentas propias por venue 2026-07-07, pendiente aprobación) | 00_RESUMEN.md, 01_DETALLE_CAPA_PORTAFOLIO.md, 02_DETALLE_FANOUT_MULTICUENTA.md, /engine/src/portfolio |
| 15 | DASHBOARD | 🟡 Fase 4 (v1 generado: estado + backtest, HTML self-contained. Pendiente: leer de Supabase en vivo + integrar en Next.js) | /engine/dashboard/template.html |
| 16 | AUTOMATION | ✅ Fase 5 — BOT 24/7 EN VIVO (2026-07-08): systemd `atlas-cycle.timer` en VPS Hetzner dispara el ciclo `--execute` cada día 00:05 UTC; 1ª corrida abrió 3 posiciones demo verificadas en Supabase. Pendiente menor: Telegram + publish timer opcional | 00_RESUMEN.md, deploy/*, /engine/src/live |
| 17 | SAAS | 🟡 Fase 5 (investigación inicial 2026-07-07: regulatorio de captación de fondos — BLOQUEANTE legal para el producto "ahorro", consultar abogado — y modelo de datos de dashboards multi-tenant RLS) | 00_RESUMEN.md, 01_DETALLE_REGULATORIO_CAPTACION_FONDOS.md, 02_DETALLE_DASHBOARDS_MULTITENANT_SUPABASE.md |
| 18 | SECURITY | ✅ Fase 1 hecha | 00_RESUMEN.md, 01_DETALLE_MODELO_SEGURIDAD_MULTITENANT.md |
| 19 | INFRASTRUCTURE | ✅ Fase 1 hecha | 00_RESUMEN.md, 01_DETALLE_SUPABASE_SCHEMA_VS_PROYECTO.md |
| 20-26 | DOCS/TEST/DEPLOY/MKT/CLIENTS/TEMPLATES/KB | ⬜ Fase 6 | — |
| 27 | SCALPING | 🔴 NO-GO validado (2026-08-10): backtest de Liquidity Grab en Oro M15 con datos reales → pierde en las 11 variantes y en los 6 tramos de walk-forward; breakeven de costes 0,2 bps/lado vs spread real 0,5-1,2 bps. Antes: investigación 2026-07-17 y NO-GO de scalping momentum. Confirmado 2026-09-15 con datos MT5 retail reales (llena el hueco Nasdaq/US30 no disponible antes en Deriv): ver `13_BACKTESTING/04_ANALISIS_ORO_NASDAQ_US30.md`, 🔴 NO-GO en Oro/Nasdaq/US30 M5-M15 | 00_RESUMEN.md, 01_DETALLE_SCALPING_MULTIACTIVO.md, 02_RESULTADOS_BACKTEST.md, 03_VALIDACION_LIQUIDITY_GRAB_ORO.md |

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

## Sesión de investigación 2026-07-17 — scalping multi-activo (convive con TSMOM diario)
Investigación pura (no se tocó código de producción). Documentado en `27_SCALPING/00_RESUMEN.md` + `01_DETALLE_SCALPING_MULTIACTIVO.md`, ancla en el motor real (`engine/src`) y en `08_TRADING`/`09_RISK`/`13_BACKTESTING`/`14_PORTFOLIOS`/`16_AUTOMATION` ya documentados.
- **Timeframe recomendado**: M5-M15, NO M1 puro — el M1 clásico exige acceso a libro de órdenes que Deriv Multipliers no expone, y la literatura de momentum intradía advierte que a precios bid/ask realistas el efecto se erosiona demasiado para ser rentable. Implica pasar del `systemd timer` oneshot diario actual a un **proceso de larga duración nuevo** (`atlas-scalp.service`), sin tocar el `atlas-cycle.timer` existente.
- **Hallazgo clave de venue**: Nasdaq/US30 **NO están disponibles hoy** en el adaptador Deriv Native API/Multipliers ya integrado — solo vía Deriv MT5/Deriv X, lo que reabre el bloqueo de VPS Windows ya señalado en `11_MT5`. **NO-GO para estos dos activos hasta resolver esa infraestructura** (no es un tema de estrategia).
- **Modelo de costes (parcialmente confirmado)**: comisión de Deriv Multipliers en Forex ≈ 0,000199 del nocional (documentación KID/afiliados, no verificada línea a línea) → breakeven estimado ~2-4 pips en EUR/USD antes de sumar el spread implícito (no cuantificado) entre `spot` y `ask_price` que el propio código ya distingue. Oro tiene spreads de mercado general más anchos (15-25 "pips"); BTC sin datos de coste confirmados.
- **Veredicto por activo**: EUR/USD 🟢 GO condicionado; Oro y BTC 🟡 GO condicionado con más cautela (verificar coste real en demo antes de backtestear); Nasdaq/US30 🔴 NO-GO por infraestructura.
- **Gap de diseño detectado**: `PortfolioManager` hoy modela 1 `Venue` = 1 cuenta física; para que TSMOM y scalping convivan en la MISMA cuenta Deriv sin duplicar riesgo, hace falta diseñar un reparto de sub-presupuestos por-estrategia dentro de una cuenta física — extensión nueva, no trivial, pendiente de diseño y aprobación antes de construir.
- **Pendiente para Moisés**: aprobar (o no) construir el script de datos intradía + backtest con costes antes de escribir cualquier código de ejecución; decidir si merece la pena resolver el bloqueo MT5/Windows para habilitar Nasdaq/US30.

## Sesión 2026-08-10 — validación de la estrategia Liquidity Grab en Oro (NO-GO)
Estrategia externa propuesta para XAU/USD M15 con afirmaciones de +20-30% mensual y 76% de aciertos.
Probada con 23.028 velas OHLC reales de Deriv (12 meses) contra el risk gate real del motor.
Documentado en `27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md`.
- **Veredicto: NO-GO.** Las cifras afirmadas no se reproducen en ningún escenario. Con las reglas
  exactas de la fuente: -8,8%, 33% de aciertos, y kill-switch disparado tras 9 operaciones.
- **Razón estructural (no de implementación)**: la estrategia coloca stops con mediana de 2,89 USD
  y el 21% por debajo de 1 USD — por debajo del spread del oro. Eso fuerza un nocional de 7,5×-50×
  el capital, de modo que 1 bp/lado cuesta 0,15% del capital por operación. Breakeven de costes
  ≈0,2 bps/lado frente a un spread real de 0,5-1,2 bps: un orden de magnitud fuera.
- **Nota metodológica reutilizable**: el 26,9% de las operaciones tocan stop y objetivo en la misma
  vela M15. Ese único supuesto mueve el resultado de -61,7% a +236%. Todo backtest de SL/TP ajustados
  sobre velas debe declarar y acotar ese supuesto, o no está midiendo la estrategia.
- **Precaución detectada**: el material recibido incluía un "backtest" que fijaba el win rate del 76%
  como constante sobre precios aleatorios, y recomendaba ajustar el detector si el resultado no
  gustaba. No usar backtests que no operen sobre datos de mercado reales.
- **US30 pendiente**: no probado (Deriv no ofrece el instrumento; requiere datos externos + puente
  MT5). No recomendado para esta estrategia por ser el fallo estructural, no específico del oro.

## Sesión 2026-08-11 — ATLAS CORE: estrategia propia diseñada y medida
Encargo: dejar de validar propuestas ajenas y diseñar una estrategia propia. Documentado en
`13_BACKTESTING/02_ATLAS_CORE_ESTRATEGIA_PROPIA.md`. 28 instrumentos, 7 clases de activo, 25 años
de datos diarios reales (Yahoo; Deriv solo sirve ~1 año de diario y se descartó como fuente).
- **Diseño**: no busca mejor señal sino mejor construcción de cartera — ensemble de horizontes
  (63/126/252d), dimensionamiento por volatilidad inversa, señal continua ajustada por riesgo,
  banda de no-negociación y rebalanceo mensual.
- **Resultado (25 años, coste 2 bps sobre rotación)**: CAGR +6,8%, vol 14,1%, **Sharpe 0,42**,
  caída máxima 33,7%, 46% de meses negativos, peor mes -12,0%, hasta **80 meses sin recuperar
  máximos**. **No bate a comprar y mantener el S&P 500** (CAGR 8,6%, Sharpe 0,45).
- **Su valor real es la correlación -0,03 con el S&P 500**: flujo de retorno independiente, útil
  como diversificador de cartera, no como sustituto ni como fuente de rentabilidad mensual.
- **Walk-forward: los últimos ~8 años son NEGATIVOS** (2017-2021 y 2021-2026, ambos -2,7% CAGR),
  coherente con la sequía documentada del seguimiento de tendencia.
- **La ablación refuta parte de mi propia tesis**: el ensemble no mejora el Sharpe (solo la caída
  máxima) y la versión concentrada de 5 instrumentos da MEJOR Sharpe (0,65) que las 28 — no puedo
  afirmar que los datos respalden la diversificación en esta muestra.
- **Dos bugs propios detectados y corregidos**: calendarios sin normalizar (39.305 "días" en vez
  de 8.428, porque cada mercado marca su hora de apertura local) y rotación del 52% diario por
  usar señal de signo. Ambos habrían dado un veredicto falso; el detector fue la cifra de rotación.
- **No ejecutable hoy**: no pasa por `riskGate` (que es por-orden con stop, no por-peso) y Deriv
  no ofrece la mayoría de esos 28 mercados. Llevarlo a real exige elegir venue y adaptar la capa
  de riesgo. Cero capital real hasta validación en demo (`09_RISK`).

## Sesión de investigación 2026-09-15 — fondeos de FUTUROS: Apex, Topstep, Lucid Trading
Investigación pura (no se tocó código de producción). Documentado en
`08_TRADING/03_DETALLE_FONDEOS_FUTUROS_APEX_TOPSTEP_LUCID.md` + `08_TRADING/00_RESUMEN.md` actualizado.
- **Diferencia de partida**: los tres son firms de futuros CME (no forex/CFD como FTMO) y ejecutan
  sobre Rithmic/Tradovate/TopstepX, no sobre MT5 — el bloqueo de VPS Windows de `11_MT5` era
  específico de fondeos MT5/forex-CFD y no se traslada automáticamente a estos tres.
- **Apex Trader Funding**: permite automatización/EA solo en la fase de Evaluación; la
  **prohíbe explícitamente en la cuenta financiada (PA/Live)** — cierre de cuenta y pérdida de
  saldo si se detecta. Descartado para un bot 24/7 real. VPS permitido para trading, prohibido
  solo si se usa para ocultar identidad/ubicación.
- **Topstep**: tiene la mejor API oficial y documentada (TopstepX/ProjectX, REST+WebSocket,
  headless, permitida en evaluación y financiada) pero sus **Términos de Uso prohíben
  textualmente ejecutar desde VPS/VPN/servidor remoto** — el tráfico de órdenes debe originarse
  del "dispositivo personal" del trader. Bloqueante contractual, no técnico ni de GUI.
- **Lucid Trading**: permite automatización completa en evaluación y financiada, sobre
  Tradovate/Rithmic (headless), y no se encontró prohibición de VPS equivalente a la de Topstep
  — pero su web bloqueó todo intento de verificación directa (403 Cloudflare), así que es
  confianza media, **pendiente de confirmar por escrito con su soporte** antes de fondear capital
  real.
- **Recomendación de infraestructura**: ninguna de las tres confirma la necesidad de una VPS
  Windows nueva con GUI (todas exponen APIs headless); el obstáculo real es contractual, distinto
  por firm. Orden sugerido: Lucid primero (tras confirmar VPS por escrito) → Topstep en paralelo
  solo para trading manual/equipo propio → Apex descartado para el bot.
- **Pendiente para Moisés**: decidir si se contacta a soporte de Lucid Trading para confirmar la
  política de VPS por escrito antes de comprar cualquier evaluación; ninguna cuenta de fondeo de
  futuros se ha comprado todavía.

Ver `ROADMAP_FASES.md` (raíz) para el orden de ejecución y `CLAUDE.md` (raíz) para las reglas.
