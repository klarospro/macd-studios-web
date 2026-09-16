# Validación — Liquidity Grab (Pranam Ghagare) en XAU/USD M15

Fecha: 2026-08-10 · Estado: **NO-GO** · Decisión: no construir ejecución.
Código: `engine/src/strategy/liquidityGrab.ts`, `engine/src/backtest/liquidityGrabBacktest.ts`,
`engine/src/backtest/runLiquidityGrab.ts`, `engine/src/scripts/fetchGoldOhlc.ts`. 14 tests.

## Qué se probó
Estrategia de barrido de liquidez propuesta externamente: se detectan swings fractales, y cuando
el precio cierra al otro lado de un swing tras haberlo roto, se opera la reversión con RR 1:1.
Parámetros de la fuente: `swingWing 2`, `lookback 50`, stop = distancia al nivel × 1,1, riesgo
0,5%/operación, kill-switch diario 1% y total 8%, máx. 12 operaciones/día.

**Afirmaciones de la fuente**: win rate ~76%, profit factor ~2,1, **+20-30% mensual**, DD <5%.

## Datos
23.028 velas M15 OHLC **reales** de Deriv (`frxXAUUSD`), 2025-08-11 → 2026-08-10 (12 meses
exactos). Oro de 3.387 a 4.355 USD (+28,6%: año de tendencia alcista fuerte).

## Metodología (y por qué importa)
- **Sin lookahead**: un swing fractal con ala 2 no es observable hasta 2 barras después. Cada swing
  lleva `confirmedAt = index + wing` y se descarta si no está confirmado en la barra evaluada.
  Hay un test que falla si alguien reintroduce el bug.
- **Risk gate real** del motor (`evaluate`), no una gestión de riesgo paralela.
- **SL/TP resueltos intrabar** con high/low reales; huecos de apertura rellenados al open.
- **Barrido de costes** en bps por lado, sobre el nocional.
- La especificación original venía con un backtest que **asumía un 76% de aciertos por constante
  hardcodeada** sobre precios generados aleatoriamente. Eso no mide nada; se descartó por completo.

## Resultado

| Escenario | Retorno 12m | Win rate | PF | Operaciones |
|---|---|---|---|---|
| Reglas exactas de la spec, coste 2 bps/lado | **-8,8%** (kill-switch a las 9 ops) | 33,3% | 0,13 | 9 |
| Edge crudo, desempate pesimista, 0 coste | -61,7% | 38,2% | 0,62 | 933 |
| Edge crudo, desempate **optimista**, 0 coste | **+236,0%** | 63,9% | 1,68 | 933 |
| Edge crudo, desempate optimista, 2 bps/lado | -100% | 49,0% | 0,22 | 933 |

### Hallazgo 1 — el resultado es indeterminado sin datos de tick
En el **26,9%** de las operaciones, stop y objetivo se tocan en la MISMA vela M15. Con velas es
imposible saber cuál se tocó primero. Ese supuesto solo mueve el resultado de **-61,7% a +236%**.
Cualquier backtest de esta estrategia sobre velas que no declare este supuesto no está midiendo
la estrategia: está midiendo su propia suposición. Causa: los stops son minúsculos (§ siguiente).

### Hallazgo 2 — los stops obligan a un nocional insostenible
El sizing es `riesgo / distancia_al_stop`. Distancias medidas: mediana **2,89 USD**, p10 0,43 USD,
mínimo **0,011 USD**; el **21,3%** de las operaciones tiene stop < 1 USD, por debajo del spread
típico del oro (0,20-0,50 USD). Nocional implícito resultante: **7,5× el capital** con el stop
mediano, **50×** en el p10, **1.967×** en el mínimo.

Consecuencia: **1 bp/lado de coste ≈ 0,15% del capital por operación**, con 933 operaciones al año.

### Hallazgo 3 — el breakeven de costes está fuera del mercado real
Sobre el mejor caso posible (desempate optimista, que es el único que da beneficio):

| Coste/lado | 0 | 0,1 | **0,2** | 0,3 | 0,5 | 1 | 2 bps |
|---|---|---|---|---|---|---|---|
| Retorno 12m | +236% | +85% | **+3%** | -41% | -76% | -98% | -100% |

Breakeven ≈ **0,2 bps/lado ≈ 0,087 USD** con el oro a 4.327. El spread real del oro es
**0,20-0,50 USD**, es decir **2,5-6× el coste que la estrategia puede soportar**. No es un margen
estrecho: es un orden de magnitud.

### Hallazgo 4 — dispara su propio kill-switch
Con las reglas de riesgo de la propia especificación, el sistema alcanza el DD total del 8% tras
**9 operaciones** y se detiene: 958 señales posteriores rechazadas. Un año de operativa = 9 trades.

### Hallazgo 5 — ninguna variante lo salva
11 variantes probadas (entrada +1 vela, filtro EMA(30), RR 1:1,5 y 1:2, swingWing 3 y 5, lookback
20 y 100, stop ×1,0 y ×1,5): **todas negativas**. Walk-forward por mitades y por los 4 cuartos del
año: **los 6 tramos negativos**. No es una racha mala ni un régimen concreto.

## Conclusión
**NO-GO.** No por un fallo de implementación ni por mala suerte de muestra, sino por una razón
estructural: la estrategia coloca stops más pequeños que el propio spread del instrumento, lo que
la obliga a un apalancamiento que convierte cualquier fricción en pérdida. Las cifras afirmadas
(+20-30% mensual, 76% de aciertos) no se reproducen en ningún escenario con datos reales; el único
escenario positivo exige coste cero y el supuesto de resolución más favorable a la vez.

Coincide con el veredicto ya documentado en `02_RESULTADOS_BACKTEST.md` para el scalping momentum:
en intradía sobre Deriv, **los costes se comen la ventaja antes que la estrategia la genere**.

## Limitaciones honestas
- 12 meses, un activo, un régimen (oro en tendencia alcista fuerte — el peor entorno posible para
  una estrategia contra-tendencia). Los 4 cuartos son negativos, pero 1 año no es prueba definitiva.
- Datos y spreads de Deriv; otro bróker tendría costes distintos (no mejores en un orden de magnitud).
- Se implementó una lectura de una especificación ambigua en los índices de vela; se probaron las
  dos lecturas posibles (`entryDelay` 0 y 1) y ambas pierden.
- El coste se modela como bps sobre nocional; no se modela slippage adicional en huecos, que
  empeoraría el resultado, no lo mejoraría.

## Pendiente
**US30**: no probado. Deriv Native API no ofrece US30 (ni datos ni ejecución) — requiere fuente de
datos externa, y la ejecución seguiría bloqueada por el puente MT5/VPS Windows (`11_MT5`). Dado
que el fallo es estructural (stops por debajo del spread) y no específico del oro, no se recomienda
invertir en esa tubería para esta estrategia.
