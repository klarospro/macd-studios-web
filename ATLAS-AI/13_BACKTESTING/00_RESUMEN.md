# Backtesting — Estrategias de fondos replicables (Fase 3)

Estado: investigación de estrategias hecha (2026-07-03). Detalle completo + tabla de fuentes: `01_ESTRATEGIAS_FONDOS_REPLICABLES.md`. Pendiente: metodología de backtesting (framework, datos, walk-forward) y ejecución de los backtests — siguiente paso de esta carpeta.

## Sesión 2026-09-15 — Oro (2 datasets)/Nasdaq/US30 con datos MT5 retail reales

🔴 **NO-GO en los 4 datasets.** Detalle completo: `04_ANALISIS_ORO_NASDAQ_US30.md`. Script:
`engine/src/backtest/analisisOroNasdaqUs30.py`. Llena el hueco de `27_SCALPING` (Nasdaq/US30 no
existían antes en Deriv) con CSV reales M1/M15 de un bróker retail: Oro (`XAUUSDm`, ~3,5 meses,
M1→M5), Oro (`XAUUSD247m`, ~9 meses, M15 nativo, dataset separado — no se mezcla), Nasdaq
(`USTEC`, ~4 meses, M1→M5) y US30 (~3,5 meses, M1→M5).

Se probaron 5 setups de lógica de mercado real (ruptura de rango+volumen, sweep de liquidez,
continuación de impulso, mean-reversion por extensión, reacción a apertura de "sesión") × un
grid de 96 combinaciones de salida (TP/SL en múltiplos de ATR, con/sin trailing, con/sin
breakeven, con/sin time-stop) = 1.084 combinaciones evaluadas con coste real de spread por
barra y walk-forward por mitades. **0 de 1.084 pasa los filtros** (≥100 trades, PF>1,3, PF≥1,0
en ambas mitades). Mejor combo: Oro (m1→M5) continuación de impulso, PF 1,197 — bajo el umbral,
único con walk-forward positivo en ambas mitades. Nasdaq y US30 rondan PF ~1,0 o peor.

Coincide con el patrón ya documentado en `27_SCALPING` y `03_COMPARATIVA_ORO_1A.md`: en
intradía M5/M15 sobre estos activos, con costes reales, no aparece edge suficiente. Limitación
honesta: muestra corta (3,5-9 meses, un solo régimen), TZ del servidor sin confirmar, sin
comisión real (solo spread), y `XAUUSD247m` tiene 92% de barras con spread=0 (probable
artefacto del feed). No se recomienda avanzar a demo con ninguno de estos setups.

## Qué es
Catálogo de estrategias cuantitativas con track record documentado en fondos o literatura peer-reviewed (AQR, SG Trend Index, CBOE, RFS/JFE/JF), evaluadas por replicabilidad automatizada en cuenta pequeña y mapeadas a los venues de Atlas (Polymarket "estadístico" / Deriv-MT5-fondeo "institucional") y al motor (`Signal`/`riskAmount`/Kelly).

## Por qué existe
Regla de oro del proyecto: no se opera nada sin edge documentado. Esto define QUÉ se backtesteará y en qué orden, en vez de improvisar estrategias de blog.

## Tabla-índice de estrategias

| # | Estrategia | Evidencia clave | Venue Atlas | Replicabilidad | Veredicto |
|---|---|---|---|---|---|
| F1 | Trend following / TSMOM (CTA) | Moskowitz-Ooi-Pedersen 2012 (JFE); 145 años (AQR 2017); SG Trend +27,3% en 2022 | Deriv/MT5/fondeo | **FÁCIL** | **Probar 1º en demo** |
| F8 | Value betting Polymarket (p̂ vs precio) | Berg et al. 2008 (IEM); calibración por dominio (preprints 2025-26, sin confirmar) | Polymarket | FÁCIL mecánica / MEDIA el modelo p̂ | Probar 2º (paper interno; jurisdicción bloqueante) |
| F9 | Arbitraje mercados de predicción | arXiv 2508.03474 (preprint, sin confirmar) | Polymarket | MEDIA | 3º, bajo riesgo, capacidad diminuta |
| F3 | Carry FX | Koijen et al. 2018 (JFE), Sharpe ~0,9 bruto | Deriv/MT5 | MEDIA | Solo si swaps de Deriv no comen el edge (sin confirmar); skew negativo |
| F4 | Pairs trading / stat-arb | Gatev et al. 2006 (RFS), ~11% bruto pero decayendo | CFD/exchanges | MEDIA-DIFÍCIL | Diferida (motor no soporta multi-pata; edge erosionado) |
| F2 | Momentum cross-sectional | Jegadeesh-Titman 1993; AQR 2013 | CFD acciones | DIFÍCIL | Diferida (necesita cesta amplia; choca con máx. 3 posiciones) |
| F5 | Risk parity | Asness-Frazzini-Pedersen 2012; Bridgewater | 14_PORTFOLIOS | N/A como señal | Candidata a política de asignación futura, no estrategia |
| F6 | Volatility risk premium (short puts) | CBOE PUT Index; Israelov-Nielsen (AQR) | Sin venue en infra | DIFÍCIL | **Descartada**: cola izquierda incompatible con preservación de capital |
| F7 | Factor investing (value/quality/low-vol) | Fama-French; AQR QMJ/BAB | Sin venue (ETFs) | DIFÍCIL para Atlas | Solo roadmap SaaS largo plazo |

## Cuándo usar / cuándo NO
- Usar este catálogo para elegir qué backtestear y en demo; NO operar en real nada sin backtest + demo previos (regla del proyecto).
- NO aplicar ninguna estrategia a los índices sintéticos de Deriv (RNG del broker — la evidencia es de mercados reales).

## Riesgos y avisos clave
- ⚠️ Conflicto detectado: el circuit breaker de 4 pérdidas consecutivas (09_RISK) saltará a menudo con trend following (win rate ~30-45% por diseño) — revisar parámetro con Moisés antes de la demo.
- Backtest ≠ garantía: sobreajuste, decaimiento de edges por crowding (documentado en pairs trading), costes retail (swaps) mayores que los institucionales de los papers.

## Mejores prácticas + ejemplo mínimo
Empezar con F1 (TSMOM diario, 5–10 instrumentos reales, stop = k×ATR, `riskPerTradePct` fijo sin Kelly hasta muestra grande); `correlationGroup` por clase de activo. Ejemplo: EUR/USD retorno 12m > 0 → `Signal{side: buy, stop: entry − 2×ATR(20)}` → gate 09_RISK dimensiona.

## Fuentes
Ver tabla completa con enlaces en `01_ESTRATEGIAS_FONDOS_REPLICABLES.md` (papers JFE/JF/RFS, AQR, CBOE, SG Prime Services; preprints marcados "sin confirmar").
