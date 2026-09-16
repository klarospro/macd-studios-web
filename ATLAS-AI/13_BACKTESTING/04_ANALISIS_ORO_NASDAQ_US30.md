# Análisis exploratorio — Oro (2 datasets), Nasdaq (USTEC) y US30 sobre datos reales de bróker retail

**Fecha:** 2026-09-15 · **Veredicto general: 🔴 NO-GO en los 4 datasets** (5 setups × grid de
salidas, ningún combo pasa los filtros mínimos) · **Script:** `engine/src/backtest/analisisOroNasdaqUs30.py`
· **Outputs:** `engine/src/backtest/out/04_analisis_oro_nasdaq_us30/`

Este análisis llena el hueco que dejó `27_SCALPING` (Nasdaq/US30 no existían antes en Deriv):
ahora hay CSV reales de un bróker retail (plataforma MT5) para los 4 instrumentos. Es
investigación pura — no se ha tocado `engine/src/live/`, no hay conexión a bróker real, no se
ha hecho commit.

## 1. Datos usados

| Dataset | Símbolo/broker | Timeframe | Barras | Rango |
|---|---|---|---|---|
| Oro (m1) | `XAUUSDm` | M1 → resampleado a M5 | 100.003 → 20.034 (M5) | 2026-06-04 → 2026-09-15 (~3,5 meses) |
| Oro (247) | `XAUUSD247m` | M15 nativo | 26.701 | 2025-12-11 → 2026-09-15 (~9 meses) |
| Nasdaq | `USTEC_x100m` | M1 → resampleado a M5 | 100.001 → 20.002 (M5) | 2026-05-21 → 2026-09-15 (~4 meses) |
| US30 | `US30_x10m` | M1 → resampleado a M5 | 100.001 → 20.020 (M5) | 2026-06-04 → 2026-09-15 (~3,5 meses) |

**Por qué M5 y no M1 puro:** siguiendo la conclusión ya documentada en
`27_SCALPING/01_DETALLE_SCALPING_MULTIACTIVO.md` (M1 exige libro de órdenes que no está
disponible; el edge a precios bid/ask reales se erosiona), el Oro-247 se testeó en su M15
nativo y los otros tres se agregaron de M1 a M5 antes de generar cualquier señal. El Oro-247
es un dataset **separado y no se mezcla** con el Oro-m1 (broker/cuenta distinta, probablemente
24/7 — confirmado por actividad de sábado/domingo con volumen bajo, ver §2).

**Zona horaria del servidor: sin confirmar.** Todas las horas de este documento son "hora de
servidor de la plataforma" tal cual viene en el CSV; no se ha podido verificar el offset
respecto a UTC. Cualquier lectura por hora/sesión debe tratarse como relativa, no como hora de
mercado real.

**Coste:** no hay comisión explícita en los CSV, solo `SPREAD` (puntos) por barra. Se usó el
spread real de cada barra — medio spread al abrir + medio spread al cerrar (spread completo
ida y vuelta) — convertido a precio con el tick size detectado de los propios datos
(Oro 0,001; Nasdaq 0,01; US30 0,1). **No incluye comisión de bróker/prop firm real, ni
slippage adicional en huecos.** Esto hace que los resultados de este documento sean, si acaso,
optimistas en costes, nunca pesimistas.

⚠️ **Hallazgo de calidad de datos:** en `XAUUSD247m_M15` el **92,15%** de las barras traen
`SPREAD = 0`. Esto no es un mercado sin coste real: es casi con certeza un artefacto de ese
feed (probablemente un símbolo "247" sintético o mal instrumentado). Los resultados de ese
dataset específico deben leerse como el escenario de coste **más optimista posible**, no como
una medición fiable del spread real de esa cuenta.

## 2. Perfil estadístico

| Activo | % alcista | % bajista | Rango medio | ATR14 medio | ATR14 mediana | Spread medio (pts) | % spread=0 | Eficiencia 20b (media) |
|---|---|---|---|---|---|---|---|---|
| Oro m1→M5 | 48,9% | 51,1% | 5,11 | 5,13 | 4,59 | 252,6 | 0,0% | 0,112 |
| Oro 247 M15 | 50,2% | 48,8% | 8,31 | 8,31 | 7,23 | 76,5 | 92,2% | 0,112 |
| USTEC M5 | 50,0% | 49,8% | 31,19 | 31,30 | 25,81 | 234,6 | 0,0% | 0,117 |
| US30 M5 | 48,7% | 49,6% | 29,09 | 29,20 | 24,11 | 20,9 | 0,0% | 0,116 |

- **Direccionalidad:** los 4 activos están esencialmente equilibrados (48-51% alcista/bajista
  por barra) — no hay sesgo direccional estructural detectable a este nivel.
- **Eficiencia del movimiento** (net move / suma de rangos, ventana 20 barras): ~0,11-0,12 en
  los 4, es decir el precio recorre ~6-9x más distancia bruta que su desplazamiento neto. Es
  un mercado que **oscila mucho más de lo que avanza** — favorece mean-reversion en teoría,
  pero también implica que romper rango y "seguir" (breakout/momentum) tiene que lidiar con
  ese ruido, y así se confirma en los resultados (§4-6).
- **Oro-247 muestra actividad de fin de semana** (rango y tickvol de sábado/domingo ~3-5x más
  bajos que entre semana, pero no cero) — consistente con un feed "24/7", como anticipaba el
  nombre del dataset. Los otros tres solo tienen una muestra mínima de domingo (n≈360, ~1 día),
  no suficiente para conclusión.

## 3. Patrones por hora del día y día de semana (hora de servidor, TZ sin confirmar)

| Activo | Hora más volátil (rango medio) | Hora menos volátil | Mejor hora (retorno medio) | Peor hora (retorno medio) |
|---|---|---|---|---|
| Oro m1→M5 | 13h (8,56) | 20h (2,84) | 13h (+0,69 bps) | 2h (−0,54 bps) |
| Oro 247 M15 | 14h (12,21) | 21h (4,71) | 6h (+0,69 bps) | 2h (−1,09 bps) |
| USTEC M5 | 14h (66,14) | 4h (19,78) | 22h (+0,47 bps) | 19h (−0,49 bps) |
| US30 M5 | 13h (67,05) | 4h (12,73) | 12h (+0,14 bps) | 19h (−0,34 bps) |

- **Volatilidad:** las horas 13-14 (servidor) concentran el rango más alto en los 4 activos —
  compatible con una apertura de sesión relevante, probablemente EE. UU., pero **sin
  confirmar el offset horario del servidor** no se puede afirmar cuál sesión es.
- **Retorno medio por hora:** las diferencias son pequeñas (fracciones de bps) y con ~850-1.150
  observaciones por hora — **no hay un sesgo direccional por hora fuerte ni consistente** que
  se pueda operar de forma fiable; son diferencias del orden de ruido estadístico, no un edge.
- **Día de semana:** sin patrón consistente entre los 4 activos (el "mejor" y "peor" día
  cambian de activo a activo); ninguno muestra un sesgo de 3+ meses que sobreviva a inspección
  simple. Tablas completas en `out/04_analisis_oro_nasdaq_us30/hourly_all.csv` y `dow_all.csv`.

## 4. Setups testeados

5 setups con lógica de mercado real (dentro del rango pedido de 4-6), reglas exactas, sin
lookahead: toda señal se calcula con datos hasta el cierre de la barra `i`; la entrada ejecuta
al **open de la barra `i+1`**.

| Setup | Regla de entrada exacta |
|---|---|
| **Ruptura de rango + volumen** | `close[i] > max(high, 20 barras previas)` (o `<` mínimo) **y** `tickvol[i] > 1,5× media(tickvol, 20 previas)` → entra en dirección de la ruptura |
| **Sweep de liquidez** | `high[i] > max(high, 20 previas)` pero `close[i]` vuelve a cerrar por **debajo** de ese máximo (mecha de rechazo) → corto. Simétrico con mínimos → largo |
| **Continuación de impulso** | Vela `i` con cuerpo `|close-open| > 1,2× ATR14` **y** `tickvol > 1,3× media(20)` → entra en la misma dirección del impulso |
| **Mean-reversion por extensión** | Distancia `(close - SMA50) / ATR14` cruza por encima de `+2` → corto (reversión esperada); cruza por debajo de `-2` → largo |
| **Reacción a apertura de "sesión"** | Rango de las 2 primeras barras de cada día calendario (servidor); ruptura de ese rango dentro de las 6 barras siguientes → entra en dirección de la ruptura (solo la primera ruptura del día) |

Cribado inicial (salida fija SL=1×ATR / TP=1,5×ATR, sin trailing/BE, time-stop del setup) —
tabla completa en `out/screen_all.csv`; resumen del profit factor (PF) por setup:

| Setup | Oro m1→M5 | Oro 247 M15 | USTEC M5 | US30 M5 |
|---|---|---|---|---|
| Ruptura de rango | 0,946 | 1,001 | 0,963 | 0,893 |
| Sweep de liquidez | 0,855 | 0,987 | 0,921 | 0,830 |
| Continuación de impulso | **1,002** | 0,854 | 0,854 | 0,763 |
| Mean-reversion | 0,777 | 0,957 | 0,838 | 0,906 |
| Apertura de sesión | 0,989 | 0,945 | 0,923 | **1,063** |

Con la salida fija de referencia, **ningún setup supera PF 1,1** en ningún activo — confirma
que la señal de entrada sola no es suficiente y hace falta el grid de salidas para ver si
alguna combinación de TP/SL/gestión rescata algo.

## 5. Grid de salidas

Sobre los 2-3 setups más prometedores por activo (score = PF acotado × log(nº señales) del
cribado, ver tabla anterior), se corrió un grid de:

- **TP:** 1,0 / 1,5 / 2,0 / 2,5 × ATR14 (en la entrada)
- **SL:** 0,5 / 0,75 / 1,0 / 1,5 × ATR14
- **Modo:** `plain` (sin gestión) / `be` (mueve stop a breakeven tras +1×ATR de favor) /
  `trail` (trailing chandelier de 1×ATR tras activarse con +1×ATR de favor)
- **Time-stop:** on/off (cierra a mercado tras N barras: 24 en M5 ≈2h, 16 en M15 ≈4h)

= 4×4×3×2 = 96 combinaciones por setup-activo, ~270-290 combinaciones por activo, **1.084
combinaciones en total** (`out/grid_<dataset>.csv`, una fila por combinación).

**Supuesto sobre ambigüedad SL/TP en la misma vela** (hallazgo clave de
`27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md`, controlado explícitamente aquí): el
resultado BASE de todo este documento asume el **caso pesimista** (si una vela toca SL y TP a
la vez, se asume que el SL se tocó primero). A diferencia de la Liquidity Grab en Oro M15
(26,9% de operaciones ambiguas, con stops menores al spread), aquí los stops son mucho más
anchos (0,5-1,5×ATR) y **la ambigüedad es marginal**: 0,1-1,0% de las operaciones resueltas en
los 4 mejores combos verificados (detalle en §7). No es el factor que decide el resultado en
este análisis, pero se declara igual por rigor metodológico.

## 6. Filtros aplicados y resultado

Filtros exigidos (regla de oro del proyecto + honestidad ante muestra corta):
mín. **100 operaciones**, **profit factor > 1,3**, y **walk-forward simplificado por mitades**
(primera mitad / segunda mitad de cada serie, ≥10 operaciones por mitad, PF ≥ 1,0 en AMBAS
mitades — no basta con ganar en una).

**Resultado: 0 de 1.084 combinaciones pasa los tres filtros a la vez, en ninguno de los 4
datasets.** No se rellena con setups débiles: el resultado honesto es que, con esta muestra,
estos 5 setups y este grid de salidas, **no hay un setup accionable**.

Los mejores combos por PF puro (con ≥100 operaciones), para transparencia total:

| Activo | Setup | TP/SL (×ATR) | Modo | Trades | Winrate | PF | Expectancy (R) | Retorno acum. (R) | PF 1ª mitad | PF 2ª mitad |
|---|---|---|---|---|---|---|---|---|---|---|
| Oro m1→M5 | Continuación de impulso | 2,5 / 1,5 | trail | 679 | 62,7% | **1,197** | +0,073 | +49,5 | 1,280 | 1,115 |
| Oro 247 M15 | Ruptura de rango | 2,5 / 1,0 | trail | 1.449 | 48,8% | **1,109** | +0,057 | +82,5 | 1,269 | 0,986 |
| USTEC M5 | Ruptura de rango | 2,5 / 1,0 | plain | 660 | 29,9% | **1,009** | +0,007 | +4,4 | 1,133 | 0,893 |
| US30 M5 | Ruptura de rango | 2,5 / 1,0 | trail | 707 | 46,8% | **0,983** | −0,009 | −6,3 | 0,979 | 0,987 |

Ninguno llega a PF 1,3. El más cercano — **Continuación de impulso en Oro (m1→M5)**, PF 1,197,
walk-forward positivo en ambas mitades (1,280 / 1,115) — falla solo por el umbral de PF, no
por trades ni por walk-forward. Es la única combinación que vale la pena vigilar si aparece más
historia (ver §8), pero **hoy no pasa el filtro y no se recomienda construir sobre ella**.

## 7. Tabla comparativa final

**No hay setups ganadores que reportar** — ninguno pasó los filtros del §6. Se omite la tabla
de "top setups" pedida en el encargo porque forzarla con candidatos que no pasan el umbral
contradiría la regla de honestidad del propio encargo ("no rellenar para llegar a un número").

Como referencia de la sensibilidad al supuesto de ambigüedad SL/TP (§5), para los 4 combos de
la tabla anterior, el caso optimista (TP se resuelve primero en velas ambiguas) da:

| Activo | Setup | % operaciones ambiguas mismo-bar | PF pesimista (base) | PF optimista |
|---|---|---|---|---|
| Oro m1→M5 | Continuación de impulso | 0,1% | 1,197 | 1,293 |
| Oro 247 M15 | Ruptura de rango | 1,0% | 1,109 | 1,211 |
| USTEC M5 | Ruptura de rango | 0,2% | 1,009 | 1,016 |
| US30 M5 | Ruptura de rango | 0,3% | 0,983 | 1,015 |

El supuesto pesimista vs. optimista mueve el PF en ±0,01-0,10 aquí (frente a moverlo de −61,7%
a +236% en la Liquidity Grab) — confirma que la causa del NO-GO no es la ambigüedad de vela,
sino que la señal de entrada, con estos costes reales, no tiene edge suficiente.

## 8. Limitaciones y sesgos (leer antes de decidir)

- **Muestra corta:** 3,5-4 meses (Oro m1, USTEC, US30) y 9 meses (Oro 247) — probablemente un
  solo régimen de mercado. El walk-forward por mitades es **un control mínimo, no un
  walk-forward robusto**; no distingue régimen de mala suerte con esta historia.
- **Zona horaria del servidor sin confirmar** — todo hallazgo por hora en §3 es relativo, no
  verificado contra una sesión de mercado real.
- **Coste = spread real de cada barra, sin comisión de bróker/prop firm real** ni slippage en
  huecos — los resultados de este documento son, si acaso, optimistas en costes.
- **Oro-247 tiene 92,2% de barras con spread=0** — probable artefacto del feed, no un mercado
  sin coste real; ese dataset en particular debe tratarse con cautela adicional.
- **Ambigüedad SL/TP en la misma vela:** supuesto pesimista declarado como base (§5); impacto
  medido y marginal en este análisis (a diferencia de la Liquidity Grab en Oro, §7).
- **Riesgo de sobreajuste (data snooping):** los 5 setups y el grid se diseñaron y evaluaron
  sobre la misma muestra que decide el veredicto — no hay un tramo out-of-sample "nuevo"
  reservado fuera de las 2 mitades del walk-forward. Con solo 3,5-9 meses de historia, cualquier
  futuro backtest de estos mismos setups sobre este mismo periodo ya no sería independiente.
- **Look-ahead evitado explícitamente en el código:** señal calculada con datos hasta la barra
  de decisión (`i`), ejecución en el open de `i+1`; verificado leyendo `analisisOroNasdaqUs30.py`
  (`_signals_from_bool`, `simulate_exits`).
- **Un solo bróker/feed por activo** (excepto Oro, con 2 datasets no mezclados) — otro bróker
  tendría spreads y ticks distintos; no se puede generalizar el veredicto a "todo bróker retail".

## 9. Conclusión y recomendación

**Oro (m1→M5): 🔴 NO-GO** (mejor combo PF 1,197, bajo el umbral 1,3; único caso con
walk-forward positivo en ambas mitades — vigilar si hay más historia, no construir hoy).
**Oro (247, M15): 🔴 NO-GO** (mejor combo PF 1,109; además dataset con calidad de spread
cuestionable). **USTEC (Nasdaq, M5): 🔴 NO-GO** (mejor combo PF 1,009, esencialmente breakeven).
**US30 (M5): 🔴 NO-GO** (mejor combo PF 0,983, pérdida).

Esto es consistente con el patrón ya documentado en `27_SCALPING` (scalping momentum NO-GO) y
`03_VALIDACION_LIQUIDITY_GRAB_ORO.md` (Liquidity Grab NO-GO): en intradía M5/M15, con costes
reales y sin forzar el resultado, **los 5 setups de lógica de mercado "clásica" probados no
muestran edge suficiente** para superar el umbral mínimo de profit factor con esta muestra.

**No se recomienda avanzar a demo con ninguno de estos setups.** Si se quiere seguir esta línea:
(1) acumular más meses de historia antes de repetir el grid (la serie más larga, Oro-247, es
también la que tiene calidad dudosa de spread); (2) si aparece apetito por Nasdaq/US30 en real,
resolver primero el veredicto de infraestructura ya documentado en `27_SCALPING` (bloqueo del
puente de ejecución/VPS Windows), independientemente de este resultado de estrategia;
(3) considerar timeframes mayores (H1+) donde el coste relativo pesa menos, en línea con la
recomendación general del proyecto de preferir marcos más lentos para preservación de capital.
