# Validación con datos reales — NQ vía Yahoo Finance (2026-09-09, noche)

**Addendum**: se intentó IG (`engine/src/scripts/fetchNqIctDataIG.ts`, construido pero sin credenciales configuradas esta noche — `IG_API_KEY`/`IG_USERNAME`/`IG_PASSWORD` no estaban en `.env.local`). Moisés decidió seguir con Yahoo por ahora. Se re-descargaron los datos (72 días, 13.663 velas 5M) y se repitió la validación completa: **resultado idéntico al de la primera corrida** (19 operaciones, mismas métricas) — reproducible, no fue un fluke de la corrida anterior. IG queda pendiente para cuando haya credenciales, como vía a más profundidad histórica (pregunta abierta #3).

Primer backtest real de la Estrategia A (ICT IFVG). Datos reales, aprobados explícitamente por Moisés esta noche tras confirmar que no había ninguna fuente conectada al proyecto (`05_PREGUNTAS_ABIERTAS.md` #3). **Veredicto: NI GO NI NO-GO — muestra insuficiente para decidir, con señales de alerta que hay que resolver antes de operar dinero, ni siquiera en demo.**

## 0. Bug encontrado y corregido antes de poder correr esto
La primera corrida del backtest (con los datos ya descargados) dio **0 operaciones**. Diagnóstico: `runIctIfvgBacktest` (`engine/src/backtest/ictIfvgBacktest.ts`) le pasaba a `findIctIfvgSignal` los arrays de velas 1D/4H COMPLETOS en cada vela 5M, sin recortarlos a "solo lo cerrado antes de hoy". El bias combinado (1D+4H) se calculaba una única vez sobre TODO el histórico (2021-2026) y salía `NONE` — así que quedaba fijo en `NONE` durante los 71 días enteros del backtest, bloqueando cualquier entrada. Corregido: ahora se recorta `dailyCandles`/`h4Candles` a velas con día NY estrictamente anterior al día en curso, recalculado una vez por día (no por vela). Se verificó con `npm run typecheck` (limpio) y `npm test` (80/80, 0 regresiones) antes de volver a correr el backtest.

## 1. Datos usados
- Fuente: Yahoo Finance, endpoint público de gráficos (`query1.finance.yahoo.com`), símbolo `NQ=F` (E-mini Nasdaq futures) y `ES=F` (E-mini S&P, sin usar todavía — SMT no está activo en v1).
- NQ 5M: **13.548 velas, 2026-06-30 → 2026-09-09 (71 días naturales)** — límite gratis de Yahoo para intradía 5M (~60-71 días), NO años de historia.
- NQ 1D: 1.258 velas (2021-2026). NQ 4H: 3.430 velas, agregadas de 1H (Yahoo no ofrece 4H nativo — 4 velas de 1H consecutivas por vela 4H, sin alinear a un reloj de sesión específico; supuesto declarado).
- Script de descarga: `engine/src/scripts/fetchNqIctData.ts` (nuevo, no estaba en la lista de FASE 2 original — se añadió esta noche con aprobación explícita para conseguir datos reales).

## 2. Resultado principal (reglas exactas de la spec, 1bp/lado de coste)
19 operaciones · **+0,02% de retorno · DD 0,75% · win rate 47,4% · profit factor 1,52 · expectancy $12,2/operación**. Salidas: 10 `tp1_then_stop_be`, 6 `tp1_then_tp2`, 3 `stop_full`. MAE medio 47,7pt, MFE medio 62,5pt.

## 3. Edge crudo y barrido de costes (sin kill-switches)

| Coste | Retorno | PF | Win rate | Operaciones |
|---|---|---|---|---|
| 0 bps/lado | +0,64% | 1,81 | 57,9% | 19 |
| 1 bp/lado | +0,02% | 1,52 | 47,4% | 19 |
| 2 bps/lado | -0,60% | 1,28 | 42,1% | 19 |
| 4 bps/lado | -1,83% | 0,94 | 42,1% | 19 |
| 8 bps/lado | -1,44% | 0,00 | 0,0% | **4** (breaker) |

**El edge se muere entre 2 y 4 bps/lado de coste** — parecido de orden de magnitud al breakeven que mató a Liquidity Grab en oro (~0,2 bps), aunque aquí el margen es algo mayor. El coste REAL de NQ (comisión + spread + slippage) no se verificó esta noche contra ninguna fuente oficial (regla dura de anoche: sin navegador; y esta noche no se llegó a comprobarlo tampoco) — sigue siendo la pregunta abierta #7/#11.

**Nota metodológica importante**: a 8 bps/lado, el número de operaciones CAE de 19 a 4. Verificado con un diagnóstico aparte: no es que la estrategia deje de encontrar señales — es que el circuit breaker de `maxConsecutiveLosses` (4, valor por defecto heredado de `defaultRiskConfig`, sin ajustar para esta estrategia) se dispara tras 4 pérdidas seguidas y bloquea 31 señales posteriores (`rejections: {"circuit_breaker_losses":31}`). Esto es exactamente el aviso que ya estaba anotado en `02_GESTION_RIESGO.md` §7 ("con un win rate bajo, el breaker de pérdidas consecutivas puede parar el sistema a menudo") — confirmado empíricamente, no solo en teoría.

## 4. Walk-forward — la señal de alerta más importante
| Tramo | Retorno | PF | Win rate | Operaciones |
|---|---|---|---|---|
| 1ª mitad (in-sample) | +0,61% | **5,23** | 53,3% | 15 |
| 2ª mitad (out-sample) | -0,58% | **0,33** | 25,0% | 4 |
| Cuarto 1 | -0,14% | 1,08 | 33,3% | 6 |
| Cuarto 2 | +0,54% | **8,97** | 66,7% | 9 |
| Cuarto 3 | 0,00% | 0,00 | — | **0** |
| Cuarto 4 | -0,58% | 0,35 | 25,0% | 4 |

El resultado NO es estable fuera de muestra: casi todo el beneficio de la corrida principal viene del cuarto 2 (9 de las 19 operaciones, PF 8,97). El cuarto 3 no tuvo NINGUNA operación. La segunda mitad del periodo es claramente negativa (PF 0,33). Con 19 operaciones en total, cada tramo tiene 0-9 operaciones — no es estadísticamente interpretable con rigor, pero el patrón (todo el edge concentrado en una ventana corta) es la misma bandera roja que ya se documentó como método en `27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md` ("el 26,9% de las operaciones tocan stop y objetivo en la misma vela... todo backtest debe declarar y acotar ese supuesto, o no está midiendo la estrategia" — aquí el supuesto que más pesa es la MUESTRA, no un empate de vela).

## 5. Sensibilidad a los parámetros ambiguos de la spec
- **Gap mínimo del IFVG (3 vs. 4 vs. 5 puntos)**: prácticamente sin efecto (PF 1,52 / 1,44 / 1,44). Bien — no es un parámetro que esté haciendo trampa con el resultado.
- **Multiplicador de ATR del stop (1,0 / 1,5 / 2,0)**: SÍ importa — 1,0x da PF 0,91 (perdedor), 1,5x (spec) da PF 1,52, 2,0x da PF 2,29 (mejor). Con solo 19 operaciones, no se puede distinguir "un stop más ancho evita ruido, como ya se documentó en `02_GESTION_RIESGO.md` §3" de "este parámetro concreto se ajustó a la suerte de esta muestra pequeña" — exactamente el mismo riesgo de sobreajuste que ya está anotado en `13_BACKTESTING/00_RESUMEN.md`.

## 6. Limitaciones que invalidan cualquier veredicto definitivo hoy
1. **19 operaciones es una muestra minúscula.** TSMOM y Liquidity Grab se validaron sobre 1-2 años; esto es 71 días con un filtro que limita a máx. 2 trades/día dentro de una ventana de 40 minutos. No hay forma honesta de llamar a esto "validado".
2. **La definición de entrada (pregunta abierta #1) sigue sin confirmar con Moisés.** Si la entrada real debería ser por retest en vez de al cierre de la vela de inversión, este número entero puede no significar nada — mismo riesgo que ya cambió Liquidity Grab de -61,7% a +236% con un solo supuesto.
3. **El coste real de NQ (comisión, spread, slippage) sigue sin verificar.** El backtest usa `costBps` como proxy sobre el `size` continuo del riskGate, no sobre contratos reales (`05_PREGUNTAS_ABIERTAS.md` #11) — los USD del backtest son aproximados, no exactos.
4. **Yahoo Finance 5M solo da 71 días.** No hay forma de correr un walk-forward serio (años) sin otra fuente de datos.
5. **`maxConsecutiveLosses = 4` (default) puede no ser el valor correcto para esta estrategia** — mismo aviso pendiente que TSMOM en `13_BACKTESTING/00_RESUMEN.md`, ahora confirmado empíricamente en la sección 3 de arriba.

## 6b. Diagnóstico del cuarto 3 (0 operaciones) y hallazgo sobre el modo de bias
Investigado a fondo, no es un bug: en el cuarto 3 (4-21 ago), **0 de 16 días tuvieron Daily Bias definido** (1D y 4H nunca coincidieron en HH/HL ni LL/LH). En todo el periodo, solo 13 de 62 días (21%) tuvieron bias — el cuello de botella real no es el detector de IFVG (encuentra 500-700 inversiones por cuarto, funciona bien) sino el filtro de bias `combinedDailyBias`, que exige que 1D Y 4H coincidan (supuesto declarado en `01_REGLAS_ENTRADA.md` §2, pregunta abierta #4).

Se implementó y probó la variante `dailyLeadsBias` (1D manda, 4H solo veta si CONTRADICE con estructura propia — `bias.ts`, flag `biasMode: "daily_leads"` en `IctIfvgParams`, default sigue siendo `"strict"`, no cambia el comportamiento documentado por defecto):

| Modo de bias | Retorno | PF | Win rate | DD | Operaciones |
|---|---|---|---|---|---|
| `strict` (1D Y 4H, default actual) | +0,02% | 1,52 | 47,4% | 0,75% | 19 |
| `daily_leads` (1D manda) | **+0,24%** | **1,95** | 41,9% | **0,44%** | **31** |

`daily_leads` da **63% más operaciones Y mejor profit factor Y menor drawdown** — no es un trade-off entre muestra y calidad, mejora ambas cosas en esta ventana de datos. Sigue siendo una muestra chica (31 operaciones en 71 días, no años), pero es una pista fuerte de que el filtro `strict` era más restrictivo de lo necesario. Pendiente: confirmar con Moisés cuál de los dos modos refleja lo que realmente tenía en mente (pregunta abierta #4) antes de cambiar el default.

## 6c. Sensibilidad al modo de entrada (pregunta abierta #1) — retest implementado y probado
Se implementó `detectIfvgRetestAt` (`ifvg.ts`) + `entryMode: "close" | "retest"` en `IctIfvgParams` (default sigue siendo `"close"`, no cambia el comportamiento documentado). Regla de retest: tras la inversión, se espera a que el precio VUELVA a tocar la zona (acotado al mismo día natural NY), entrada al cierre de esa vela.

| Modo | Retorno | PF | Win rate | Operaciones |
|---|---|---|---|---|
| `close` (default) | +0,02% | 1,52 | 47,4% | 19 |
| `retest` | -0,92% | 0,41 | 33,3% | 9 |
| `retest` + `daily_leads` | -0,39% | 0,18 | 20,0% | 5 |
| `close` + `daily_leads` | **+0,24%** | **1,95** | 41,9% | **31** |

**El retest empeora el resultado en toda combinación probada.** La mejor variante encontrada esta noche es la que ya estaba (`close`) combinada con `daily_leads`. Esto responde parcialmente a la pregunta abierta #1: con estos datos, esperar un retest no ayuda — pero es un resultado sobre 71 días, no una prueba definitiva de que el retest esté "mal" como concepto ICT.

**Aviso de honestidad metodológica**: en esta sesión se probaron 4 combinaciones de modo de entrada × modo de bias (más el gap mínimo y el multiplicador de ATR antes). Probar varias variantes sobre la MISMA muestra de 71 días y quedarse con la mejor es, en sí mismo, un principio de sobreajuste (multiple comparisons) — la variante ganadora (`close` + `daily_leads`, 31 ops, PF 1,95) no está más validada que la original por el simple hecho de haber ganado la comparación; necesita el mismo tratamiento de walk-forward y más muestra antes de tomarla como definitiva.

## 7. Recomendación (no es una orden, es la lectura honesta de la evidencia de esta noche)
**NO conectar cuenta demo ni real todavía.** No porque el resultado sea malo — al contrario, el edge crudo (PF 1,81 sin coste, 1,52 a 1bp) es prometedor y consistente con lo que la spec describe — sino porque la MUESTRA es demasiado pequeña y el walk-forward demasiado inestable para que signifique nada de fiar. Es exactamente el mismo estándar que ya se aplicó a TSMOM y Liquidity Grab antes de aprobar demo (regla de oro del proyecto).

**Siguiente paso concreto, en orden**:
1. Confirmar con Moisés la pregunta abierta #1 (definición de entrada) — es la que más puede cambiar todo esto.
2. Conseguir más historia de NQ 5M (otra fuente con más profundidad, o dejar correr esto en paper unas semanas más para acumular muestra real).
3. Con más datos: repetir exactamente este mismo tratamiento (`runIctIfvgDeepValidation.ts` ya está listo, no hace falta escribirlo de nuevo).
4. Solo si el resultado se sostiene con una muestra decente y fuera de muestra: demo real 1 mes con auditoría completa (regla ya aplicada a las demás estrategias).
