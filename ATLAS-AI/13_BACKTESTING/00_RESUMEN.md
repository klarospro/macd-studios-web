# Backtesting — Estrategias de fondos replicables (Fase 3)

Estado: investigación de estrategias hecha (2026-07-03). Detalle completo + tabla de fuentes: `01_ESTRATEGIAS_FONDOS_REPLICABLES.md`. Pendiente: metodología de backtesting (framework, datos, walk-forward) y ejecución de los backtests — siguiente paso de esta carpeta.

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
