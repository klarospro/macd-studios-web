# Detalle — Estrategias cuantitativas con track record de fondos, replicables por Atlas AI

Investigación (2026-07-03) para decidir QUÉ estrategias backtestear/probar en demo. NO es código de producción; todo pseudocódigo aquí es documentación de diseño. Complementa `00_RESUMEN.md`. Se apoya en 09_RISK (risk gate aprobado), 14_PORTFOLIOS (capa multi-venue, diseño) y 10_POLYMARKET.

Criterio de inclusión: solo estrategias con evidencia en **papers revisados por pares o documentación de fondos reconocidos** (AQR, Société Générale Prime Services, CBOE/academia). Nada de blogs de marketing. Cifras aproximadas solo cuando la fuente las publica; lo demás, "sin confirmar".

**Advertencia transversal (aplica a TODAS las fichas):** la evidencia citada es de mercados reales (futuros, acciones, FX interbancario). Los **índices sintéticos de Deriv (Volatility 75, etc.) son RNG del broker** — ninguna de estas estrategias tiene motivo para conservar su edge ahí. Probar SOLO sobre instrumentos reales (FX, índices bursátiles, commodities, crypto).

---

## Ficha 1 — Trend following / Time-Series Momentum (TSMOM, estilo CTA)

- **Qué es / mecanismo del edge**: comprar lo que sube y vender lo que baja, mirando solo el pasado del propio instrumento (p. ej. signo del retorno de los últimos 12 meses, o cruce de medias móviles). Edge documentado: los retornos de 12 meses predicen positivamente el retorno futuro del mismo instrumento durante ~1 año, con reversión parcial después. Mecanismos propuestos: reacción inicial insuficiente de los inversores a noticias + herding posterior + flujos de cobertura no informativos. No es "porque sí": persiste desde 1880 en muestras fuera de la original.
- **Evidencia / track record**:
  - Moskowitz, Ooi y Pedersen (2012, JFE): efecto significativo en los **58 futuros líquidos** analizados (índices, bonos, FX, commodities); cartera diversificada TSMOM con retornos anormales sustanciales y mejor comportamiento en mercados extremos ("crisis alpha").
  - Hurst, Ooi y Pedersen (2017, AQR/JPM, "A Century of Evidence on Trend-Following Investing"): rentable en **cada década desde 1880** (con costes y fees estimados).
  - Industria real: **SG Trend Index** (10 mayores CTAs trend): CAGR ~4,9–5% desde 2000, **+27,3% en 2022** (récord del índice, año de crisis para el 60/40); drawdown máximo histórico ~20,6%; drawdowns >10% cada ~18–24 meses. Fondos: AQR Managed Futures, Man AHL, Winton, Aspect, Transtrend.
- **Venue Atlas**: MT5/CFD/futuros de fondeo y Deriv CFD (estilo "institucional"). También aplicable a crypto vía 12_EXCHANGES (evidencia académica en crypto: menor y más reciente — sin confirmar al mismo nivel).
- **Datos/señales y frecuencia**: precios diarios OHLC de 10–20 instrumentos (FX majors, oro, índices, crypto). **Diario** (evaluar 1 vez al día al cierre). Lo tenemos vía Deriv API (histórico de velas) y exchanges. Sin coste de datos.
- **Perfil de riesgo / encaje 09_RISK**: win rate bajo (~30–45% típico), **skew positivo** (muchas pérdidas pequeñas, pocas ganancias grandes) — el mejor perfil posible para nuestro risk gate: el stop es parte natural de la estrategia. Sensible a régimen: sufre en mercados laterales/whipsaw (2011–2019 fue una década floja para CTAs). ⚠️ **Conflicto detectado**: el circuit breaker de 4 pérdidas consecutivas (09_RISK regla 5) saltará con frecuencia — con win rate 40%, la probabilidad de 4 pérdidas seguidas en cualquier ventana es alta (0,6⁴ ≈ 13% por bloque de 4). Revisar ese parámetro en demo o aceptar los parones.
- **Replicabilidad en cuenta pequeña: FÁCIL** (la más fácil de la lista). Reglas simples y públicas, frecuencia diaria (costes de transacción bajos), no requiere shorting de acciones ni opciones, tamaño mínimo alcanzable con CFDs/micro-lotes. Coste: spread/swap del broker (swaps de Deriv concretos: sin confirmar). Capital mínimo: el de la cuenta demo/micro. Referencia práctica para retail: Carver, *Systematic Trading* (2015) — vol targeting + carteras pequeñas.
- **Mapeo al motor**: `Signal{symbol, side = signo(retorno 12m) o cruce MA, entryPrice = mercado, stopPrice = entry ∓ k×ATR(20), correlationGroup = clase de activo}`. Sin `winProbability` al inicio (usa `riskPerTradePct` fijo = regla 1); activar Kelly solo tras muestra grande. El sizing `riskAmount/stopDistance` con stop ∝ ATR equivale al volatility targeting de los CTAs — el motor ya lo hace bien.

## Ficha 2 — Momentum cross-sectional (relativo)

- **Qué es / edge**: comprar los ganadores relativos y vender los perdedores relativos dentro de un universo (p. ej. top/bottom decil por retorno 12-1 meses). Mismo mecanismo conductual que TSMOM pero apostando a rendimiento RELATIVO, no absoluto.
- **Evidencia**: Jegadeesh y Titman (1993, JF): ~1%/mes en acciones US 1965–1989 (bruto, largo-corto); replicado globalmente. Asness, Moskowitz y Pedersen (2013, JF, "Value and Momentum Everywhere"): momentum (y value) consistentes en 8 mercados/clases de activo. Base de AQR desde 1998.
- **Venue Atlas**: CFD sobre acciones/índices (institucional). Encaje pobre hoy: exige cesta amplia (decenas de posiciones simultáneas largas y cortas).
- **Datos/frecuencia**: precios diarios de un universo grande (50+ instrumentos); rebalanceo mensual. Datos disponibles, pero el número de posiciones choca con `maxConcurrentPositions = 3` (09_RISK).
- **Perfil de riesgo**: "momentum crashes" documentados (Daniel y Moskowitz, 2016, JFE): pérdidas violentas del lado corto en rebotes tras crisis (2009). Drawdowns severos y rápidos.
- **Replicabilidad en cuenta pequeña: DIFÍCIL.** Demasiadas patas, costes de shorting en CFDs (swaps), y nuestro techo de 3 posiciones lo hace inviable sin rediseñar. Versión degradada (rotación de 2–3 índices) pierde gran parte de la evidencia.
- **Mapeo al motor**: posible como señales individuales por pata, pero el motor no modela carteras largo-corto — extensión no trivial. **Diferir.**

## Ficha 3 — Carry (FX y futuros)

- **Qué es / edge**: mantener el activo que "paga" más por mantenerlo (FX: comprar divisa de tipo de interés alto contra divisa de tipo bajo; futuros: explotar backwardation/contango). Edge = compensación por riesgo de crash de la divisa/activo de carry — es una prima de riesgo real, no anomalía gratis.
- **Evidencia**: Koijen, Moskowitz, Pedersen y Vrugt (2018, JFE 127:197-225, "Carry"): el carry predice retornos cross-section y time-series en TODAS las clases de activo; estrategia global de carry diversificada con **Sharpe ~0,9** en muestra (bruto). FX carry G10 es una de las estrategias más antiguas de macro funds.
- **Venue Atlas**: FX vía Deriv/MT5 (institucional). **Problema clave para retail**: en CFDs el carry se cobra/paga vía el **swap del broker**, que suele ser peor que el tipo interbancario — el broker captura parte o todo el edge. Swaps reales de Deriv por par: **sin confirmar** (verificar antes de backtest).
- **Datos/frecuencia**: tipos de interés (públicos, bancos centrales) + swaps del broker; posiciones de semanas/meses, evaluación diaria/semanal.
- **Perfil de riesgo**: **skew NEGATIVO fuerte** ("recoger monedas delante de una apisonadora"): años de ganancias pequeñas y crashes ocasionales (AUD/JPY 2008: caída >30%). Lo contrario del trend following. Peor encaje con drawdown 3% diario que TSMOM.
- **Replicabilidad en cuenta pequeña: MEDIA.** Mecánicamente trivial (comprar y mantener el par correcto), pero el edge neto tras swaps retail es dudoso, y el perfil de cola choca con 09_RISK.
- **Mapeo al motor**: `Signal` estándar con stop amplio; `correlationGroup` = "carry-fx" (todos los pares de carry son UNA apuesta: en risk-off caen juntos). Recomendación: solo como diversificador secundario tras validar swaps de Deriv, nunca como estrategia principal.

## Ficha 4 — Mean reversion / Pairs trading / Stat-arb

- **Qué es / edge**: dos activos económicamente ligados (misma industria, mismo subyacente) cuyo spread de precios se desvía de su relación histórica → comprar el barato, vender el caro, cerrar cuando el spread revierte. Edge: la ley del precio único + provisión de liquidez; los desvíos son ruido de flujo, no información.
- **Evidencia**: Gatev, Goetzmann y Rouwenhorst (2006, RFS 19:797-827): hasta **~11% anualizado en exceso** (antes de costes) en acciones US 1962–2002 con la regla de distancia más simple. **PERO con decaimiento documentado**: el top-20 pasó de 118 bp/mes a ~38 bp/mes tras 1988; la literatura posterior confirma la tendencia decreciente en US (crowding de fondos stat-arb). Fondos: origen en Morgan Stanley (equipo de Nunzio Tartaglia, años 80), luego D.E. Shaw, renacimiento de Renaissance (detalles de Renaissance: no públicos, sin confirmar).
- **Venue Atlas**: CFD acciones/índices o crypto (institucional / exchanges). En crypto hay pares naturales (spot vs perp del mismo activo; ETH/BTC) — evidencia académica específica en crypto: menor, sin confirmar.
- **Datos/frecuencia**: precios diarios o intradía de pares candidatos + test de cointegración/distancia. Frecuencia media (posiciones de días). Datos disponibles vía Deriv/exchanges.
- **Perfil de riesgo**: win rate alto, skew negativo moderado: el riesgo es que el spread NO revierta (ruptura estructural — el caso LTCM 1998 es el aviso canónico de stat-arb apalancado). Stop en spread necesario y respeta 09_RISK.
- **Replicabilidad en cuenta pequeña: MEDIA-DIFÍCIL.** El edge clásico está muy erosionado; costes de dos patas (spread ×2 + swaps del corto); y el motor actual no modela posiciones sintéticas de dos patas (habría que emitir 2 `Signal` con el mismo `correlationGroup` y gestionar el cierre conjunto — extensión pendiente). En crypto spot-perp es más viable pero pertenece a 12_EXCHANGES.
- **Mapeo al motor**: 2 señales opuestas, `correlationGroup` común (cuentan como una posición — regla 4 ya lo contempla). Cierre coordinado: NO soportado hoy. **Diferir hasta 12_EXCHANGES o extensión del motor.**

## Ficha 5 — Risk parity (paridad de riesgo entre activos)

- **Qué es / edge**: asignar capital para que cada clase de activo contribuya el MISMO riesgo (no el mismo dinero), apalancando los activos de baja volatilidad (bonos). Edge: aversión al apalancamiento de los inversores hace que los activos de bajo riesgo estén estructuralmente baratos por unidad de riesgo (Frazzini-Pedersen).
- **Evidencia**: Asness, Frazzini y Pedersen (2012, FAJ, "Leverage Aversion and Risk Parity"); Bridgewater **All Weather** (desde 1996, el fondo fundacional del concepto; cifras exactas del fondo: no públicas, sin confirmar). Frazzini y Pedersen (2014, JFE, "Betting Against Beta") es la base teórica.
- **Venue Atlas**: no es una estrategia de señales — es una **política de asignación**. Encaja en 14_PORTFOLIOS (ya listada allí como alternativa a la asignación fija), no como generador de `Signal`.
- **Perfil de riesgo**: depende de apalancamiento barato y de correlación negativa bonos-acciones; 2022 (inflación) fue su peor régimen: ambos cayeron juntos.
- **Replicabilidad en cuenta pequeña: MEDIA como asignador, N/A como señal.** El apalancamiento retail (CFD) es caro (swaps), lo que erosiona el mecanismo central.
- **Mapeo al motor**: ninguno directo. Reservar como candidata a política de asignación dinámica de 14_PORTFOLIOS cuando haya estimaciones de vol/correlación fiables. **No backtestear como estrategia standalone.**

## Ficha 6 — Volatility risk premium (venta de puts/covered calls)

- **Qué es / edge**: la volatilidad implícita de las opciones supera sistemáticamente la realizada (el mercado paga de más por seguro). Vender ese seguro (puts cash-secured, covered calls) cobra la prima.
- **Evidencia**: CBOE **PUT Index** (venta mensual de puts ATM SPX cash-secured): retorno compuesto ~6%/año con mejor Sharpe/Sortino que el S&P y otros índices comparados (Bondarenko 2019, estudio para CBOE); VIX medio 19,3% vs volatilidad realizada 15,1% (1990–2018) = prima ~4,2 pts. Israelov y Nielsen (AQR, "Covered Calls Uncovered", FAJ 2015): la exposición corta a volatilidad de las covered calls tuvo Sharpe realizado cercano a 1,0.
- **Venue Atlas**: requiere **opciones vanilla líquidas** (SPX/ES). Deriv no las ofrece de forma comparable; los brokers de opciones (IBKR, Tastytrade) están fuera de la infraestructura actual. Las opciones digitales de Deriv NO son equivalentes (pricing del broker, no mercado).
- **Perfil de riesgo**: **cola izquierda extrema** (short gamma): años tranquilos y luego un −X% brutal en un crash (feb-2018 "Volmageddon" liquidó fondos short-vol). Incompatible con nuestro drawdown 10% total y con cuentas de fondeo.
- **Replicabilidad en cuenta pequeña: DIFÍCIL — DESCARTADA por ahora.** Mínimos de capital altos (1 put SPX cash-secured ≈ decenas de miles $; hay micros, pero los costes relativos suben), venue inexistente en nuestra infra, y perfil de riesgo frontalmente opuesto a la prioridad nº1 (preservación de capital).
- **Mapeo al motor**: no aplica hoy. Documentada solo para el roadmap SaaS de largo plazo.

## Ficha 7 — Factor investing estilo AQR (value, quality, low-vol, multifactor)

- **Qué es / edge**: sobreponderar sistemáticamente acciones baratas (value), rentables/estables (quality), de baja beta (low-vol/BAB) — primas de riesgo + errores conductuales persistentes.
- **Evidencia**: Fama y French (1992/1993); Asness et al. "Value and Momentum Everywhere" (2013, JF); "Quality Minus Junk" (Asness, Frazzini, Pedersen, 2019, Review of Accounting Studies); Frazzini-Pedersen BAB (2014, JFE). AQR gestiona decenas de miles de millones sobre estas primas desde 1998.
- **Venue Atlas**: acciones al contado/ETFs — fuera de nuestros venues actuales. Horizonte de años, rebalanceo trimestral: no es "trading automatizado de cuenta pequeña", es inversión.
- **Replicabilidad: DIFÍCIL para el caso de uso de Atlas** (fácil comprando un ETF multifactor, pero eso no es lo que Atlas vende). Universo amplio + datos fundamentales de pago.
- **Mapeo al motor**: no aplica. Documentada para el módulo de "gestión patrimonial" futuro del SaaS, no para la demo.

## Ficha 8 — Polymarket: calibración probabilística / value betting (edge = p̂ vs precio)

- **Qué es / edge**: el precio de un contrato binario ES una probabilidad. Si nuestro modelo estima `p̂` y el mercado cotiza `p_m`, con `p̂ − p_m > fees + slippage` hay EV+. Fuentes de edge documentadas en la literatura: **favorite-longshot bias en horizontes largos** (precios comprimidos hacia 0,50 lejos de la resolución), descalibración por dominio, y sobrerreacción a noticias. Es apuesta de valor clásica aplicada a mercados de predicción.
- **Evidencia**: Berg, Nelson y Rietz ("Prediction Market Accuracy in the Long Run", Int. J. Forecasting 2008): los Iowa Electronic Markets baten a las encuestas en la mayoría de comparaciones a >100 días — los mercados son buenos pero NO perfectos. Estudios recientes (2025-26, preprints — sin revisión por pares aún): Polymarket globalmente bien calibrado (sin longshot bias general) pero con **descalibración sistemática por dominio, horizonte y tamaño** (arXiv 2602.19520: 4 componentes explican ~87% de la variación de calibración en Kalshi; underconfidence política; compresión hacia 0,50 en horizontes largos). Kalshi sí muestra favorite-longshot bias claro (Whelan, UCD WP 2025). Implicación honesta: **el edge existe en bolsillos específicos, no en general** — hay que medirlo mercado a mercado.
- **Venue Atlas**: Polymarket (estilo "estadístico"). Es EL caso de uso para el que se investigó 10_POLYMARKET.
- **Datos/frecuencia**: Gamma + CLOB APIs (gratis, sin auth para lectura) + fuente externa para estimar p̂ (modelos, encuestas, datos deportivos/macro). Intradía a diario. Lo tenemos.
- **Perfil de riesgo**: pérdida máxima acotada al stake (stop natural en 0) — perfecto para el gate. Riesgos: resolución UMA, liquidez fina, y el riesgo REAL es de modelo (p̂ mal calibrada = edge negativo creyendo que es positivo). Capacidad pequeña (libros finos), irrelevante para cuenta pequeña.
- **Replicabilidad en cuenta pequeña: FÁCIL mecánicamente, MEDIA en generar el p̂.** Fees ~0–1,8% taker según categoría, maker 0; capital mínimo: decenas de USDC. Bloqueantes vigentes: jurisdicción + plan paper (índice maestro, fila 10).
- **Mapeo al motor**: el ÚNICO caso que usa el camino Kelly ya implementado tal cual: `winProbability = p̂`, `payoffRatio = (1−p_m)/p_m`, `stopPrice = 0`, `riskAmount = stake`, `correlationGroup = event id`. Ya documentado con ejemplo numérico en 10_POLYMARKET/00_RESUMEN.md.

## Ficha 9 — Polymarket: arbitraje de mercados de predicción

- **Qué es / edge**: (a) **intra-mercado**: comprar YES+NO del mismo mercado si suman <\$1 (beneficio cierto al resolver); (b) **inter-mercados lógicamente ligados**: conjuntos de resultados mutuamente excluyentes que suman ≠100%, o mercados condicionales incoherentes entre sí; (c) **cross-platform** (Polymarket vs Kalshi, mismo evento a precios distintos). Edge: pura violación de la ley del precio único; no requiere opinión sobre el evento.
- **Evidencia**: documentado académicamente en preprints sobre Polymarket (arXiv 2508.03474, ya citado en 10_POLYMARKET; estudios 2025-26 sobre mispricing entre mercados correlacionados — preprints, sin confirmar al nivel de journal). La literatura señala que el arbitraje de longshots extremos conlleva riesgo real (capital bloqueado hasta resolución, riesgo de resolución) — no todo lo que parece arb lo es.
- **Venue Atlas**: Polymarket (estadístico); cross-platform exigiría cuenta Kalshi (EE.UU./regulado — probablemente inviable por jurisdicción, sin confirmar).
- **Datos/frecuencia**: order books en tiempo real (WSS) de todos los mercados de un evento; **intradía/latencia importa** — los bots compiten por lo obvio.
- **Perfil de riesgo**: casi delta-neutral si la lógica del evento es correcta; riesgos residuales = reglas de resolución ambiguas (el "arb" se rompe si los dos mercados no resuelven como crees), fills parciales (una pata entra y la otra no), capital bloqueado hasta resolución.
- **Replicabilidad en cuenta pequeña: MEDIA.** Técnicamente simple de detectar, pero capacidad diminuta y competencia de bots; rentabilidad esperada en cuenta pequeña: modesta y decreciente. Útil sobre todo como estrategia de "suelo" de bajo riesgo durante la fase paper.
- **Mapeo al motor**: par de órdenes con `correlationGroup` = event id y `winProbability = 1` efectiva para la cesta completa — pero el motor no modela cestas atómicas multi-pata (mismo gap que pairs trading, ficha 4). Versión simple (solo YES+NO del mismo mercado, dos órdenes secuenciales con verificación) sí es viable con extensión pequeña.

---

## Comparativa final y recomendación de secuencia

| Orden demo | Estrategia | Venue | Por qué en este orden |
|---|---|---|---|
| 1º | TSMOM/trend (F1) | Deriv demo (institucional) | Mejor evidencia (145 años), reglas simples, skew positivo compatible con 09_RISK, datos gratis, motor ya la soporta sin cambios |
| 2º | Value betting Polymarket (F8) | Polymarket (paper interno) | Único uso nativo del Kelly implementado; bloqueada por jurisdicción — el simulador paper no lo está |
| 3º | Arb intra-mercado Poly (F9) | Polymarket (paper) | Bajo riesgo, buen banco de pruebas del adaptador; capacidad pequeña |
| 4º | Carry FX (F3) | Deriv demo | Solo si los swaps de Deriv no destruyen el edge (verificar primero) |
| Diferidas | F2, F4, F5, F6, F7 | — | Motivos en cada ficha: capacidad del motor (3 posiciones), costes retail, venue inexistente o perfil de cola inaceptable |

## Tabla de fuentes

| Fuente | Tipo | Qué confirma | Enlace |
|---|---|---|---|
| Moskowitz, Ooi, Pedersen (2012), "Time Series Momentum", JFE 104:228-250 | Paper peer-reviewed | TSMOM en 58 futuros; crisis alpha | [NYU Stern PDF](https://w4.stern.nyu.edu/facdir/lpederse/papers/TimeSeriesMomentum.pdf) · [AQR](https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum) |
| Hurst, Ooi, Pedersen (2017), "A Century of Evidence on Trend-Following" | Paper de fondo (AQR)/JPM | Rentable cada década desde 1880 | aqr.com (Insights) |
| SG Trend Index (Société Générale Prime Services) | Índice de industria | CAGR ~5% desde 2000; +27,3% en 2022; maxDD ~20,6% | [SG Prime Services Indices](https://wholesale.banking.societegenerale.com/en/prime-services-indices/) |
| Jegadeesh, Titman (1993), JF | Paper peer-reviewed | Momentum cross-sectional ~1%/mes (bruto, 1965-89) | JSTOR/SSRN |
| Asness, Moskowitz, Pedersen (2013), "Value and Momentum Everywhere", JF | Paper peer-reviewed | Value+momentum en 8 mercados | AQR/SSRN |
| Daniel, Moskowitz (2016), "Momentum Crashes", JFE | Paper peer-reviewed | Crashes del momentum | SSRN |
| Koijen, Moskowitz, Pedersen, Vrugt (2018), "Carry", JFE 127:197-225 | Paper peer-reviewed | Carry en todas las clases; Sharpe global ~0,9 (bruto, en muestra) | [PDF](https://spinup-000d1a-wp-offload-media.s3.amazonaws.com/faculty/wp-content/uploads/sites/3/2019/04/Carry.pdf) · [SSRN](https://www.ssrn.com/abstract=2298565) |
| Gatev, Goetzmann, Rouwenhorst (2006), RFS 19:797-827 | Paper peer-reviewed | Pairs ~11% anual bruto 1962-2002; decaimiento post-1988 (118→38 bp/mes) | [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=141615) · [NBER](https://www.nber.org/papers/w7032) |
| Asness, Frazzini, Pedersen (2012), "Leverage Aversion and Risk Parity", FAJ | Paper peer-reviewed | Fundamento de risk parity | AQR/SSRN |
| Frazzini, Pedersen (2014), "Betting Against Beta", JFE | Paper peer-reviewed | Prima low-beta | SSRN |
| Bondarenko (2019), "Historical Performance of Put-Writing Strategies" (CBOE) | Estudio académico para CBOE | PUT ~6% CAGR; VIX 19,3 vs realizada 15,1 (1990-2018) | [CBOE PDF](https://cdn.cboe.com/resources/education/research_publications/PutWriteCBOE19_v14_by_Prof_Oleg_Bondarenko_as_of_June_14.pdf) |
| Israelov, Nielsen (2015), "Covered Calls Uncovered", FAJ | Paper de fondo (AQR) peer-reviewed | Sharpe ~1,0 del componente short-vol | [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2444999) · [AQR PDF](https://images.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Covered-Calls-Uncovered.pdf) |
| Berg, Nelson, Rietz (2008), "Prediction Market Accuracy in the Long Run", IJF | Paper peer-reviewed | IEM bate encuestas a >100 días | [ResearchGate](https://www.researchgate.net/publication/222541752_Prediction_Market_Accuracy_in_the_Long_Run) |
| Whelan (2025), "The Economics of the Kalshi Prediction Market", UCD WP | Working paper (sin peer review) | Favorite-longshot bias en Kalshi | [UCD PDF](https://www.ucd.ie/economics/t4media/WP2025_19.pdf) |
| arXiv 2602.19520 (2026), calibración por dominio en prediction markets | Preprint — **sin confirmar** | Descalibración sistemática por dominio/horizonte | [arXiv](https://arxiv.org/html/2602.19520v1) |
| arXiv 2508.03474, arbitraje en Polymarket | Preprint — **sin confirmar** | Oportunidades de arb intra/inter-mercado | Ya citado en 10_POLYMARKET |
| Carver, *Systematic Trading* (2015); Chan, *Algorithmic Trading* (2013) | Libros reconocidos | Implementación práctica retail (vol targeting, mean reversion) | — |
| Kelly (1956); Thorp | Paper + práctica | Base del sizing ya en 09_RISK | Ya citado en 09_RISK |

**Sin confirmar (explícito):** swaps/costes reales de Deriv por instrumento; retornos de fondos privados concretos (Renaissance, Bridgewater All Weather); evidencia TSMOM/pairs específica de crypto al nivel de las fuentes anteriores; viabilidad legal de Kalshi para cross-platform arb; preprints 2025-26 sobre Polymarket (aún sin peer review).
