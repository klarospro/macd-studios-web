# Comparativa de estrategias sobre ORO — 1 año

**Fecha:** 2026-08-13 · **Activo:** frxXAUUSD (Deriv) · **Runner:** `engine/src/backtest/runComparativaOro.ts`

## Condiciones (idénticas para todas)

| Parámetro | Valor |
|---|---|
| Capital inicial | $10.000 |
| Riesgo por operación | 1% |
| Coste | 10 bps por lado (el validado a 10 años) |
| Apalancamiento máx. | 1:20 (clase `oro` de `atlas.yaml`) |
| Parámetros de estrategia | Los de `config/atlas.yaml` — **no** valores afinados para el backtest |

Los datos salen del feed público de Deriv (`ticks_history`), que sigue vivo pese a la
caída de la capa de ofertas del 2026-08-12.

## Resultados — estrategias DIARIAS (258 velas, año completo)

| Estrategia | Rent. | CAGR | Sharpe | MaxDD | Ops | Acierto | P.Factor | Costes |
|---|---|---|---|---|---|---|---|---|
| **Comprar y mantener** | **+32,0%** | +31,2% | **1,09** | 27,7% | 1 | 100% | — | $0 |
| AtlasCore (pesos + vol-target) | +6,9% | +6,8% | 0,71 | **7,4%** | 9 | — | — | $18 |
| TSMOM (momentum 100d) | −2,8% | −2,7% | −0,12 | 16,6% | 7 | 29% | 0,25 | $58 |
| Sleeve Core (EWMA 50/100/200) | −1,2% | −1,2% | −1,41 | 1,4% | 3 | 0% | 0,00 | $10 |

## Resultados — estrategias INTRADÍA (3.399 velas M15, ~7 semanas)

| Estrategia | Rent. | Sharpe | MaxDD | Ops | Acierto | P.Factor | Costes |
|---|---|---|---|---|---|---|---|
| Comprar y mantener | +6,3% | 1,02 | 6,1% | 1 | 100% | — | $0 |
| Sleeve Intradía (ruptura) | **−93,3%** | −18,23 | 93,3% | 193 | 42% | 0,17 | **$8.046** |
| Liquidity Grab | **−99,0%** | −21,11 | 99,0% | 150 | 15% | 0,04 | **$8.976** |

## Conclusiones

1. **Ninguna estrategia batió a comprar y mantener oro este año.** Ni en rentabilidad
   (32% vs 6,9% del mejor) ni ajustado por riesgo (Sharpe 1,09 vs 0,71). El oro subió
   de 3.350 a 4.424: un año excepcionalmente alcista, en el que un sistema que alterna
   largo y corto está estructuralmente en desventaja.

2. **AtlasCore es la única que ganó dinero**, y con el menor drawdown de las que operan
   (7,4%). Su ventaja no es el retorno: es que sobrevive.

3. **Las dos intradía destruyen la cuenta.** −93% y −99% en siete semanas. La causa está
   en la columna de costes: $8.046 y $8.976 sobre un capital de $10.000. **Se pagan casi
   dos veces la cuenta entera en comisiones.** El acierto del 42% del Sleeve Intradía es
   irrelevante cuando cada operación nace debiendo el coste. Confirma, con otro activo y
   otro periodo, el NO-GO del scalping ya documentado en `27_SCALPING`.

4. **El Sleeve Core (EWMA) hizo 3 operaciones y perdió las 3.** Muestra demasiado pequeña
   para condenarlo, pero no aporta nada medible en oro.

## Límites de esta prueba (leer antes de decidir)

- **Un año es UNA muestra.** Un Sharpe de 0,71 sobre 258 velas no distingue habilidad de suerte.
- **El bloque intradía cubre ~7 semanas**, no un año: Deriv no da más profundidad en M15.
  Sirve para **descartar**, nunca para aprobar.
- **Un solo activo.** Estas estrategias se diseñaron para cartera diversificada; juzgar
  un sistema de tendencia por un instrumento en un año alcista le es desfavorable por diseño.
- **Backtest ≠ real:** sin huecos de apertura, sin rechazos por liquidez, sin
  deslizamiento variable. La realidad siempre es peor.

## Dos errores propios corregidos durante la ejecución

Se documentan porque afectan a la credibilidad de cualquier cifra futura:

1. **Mapeo de velas incorrecto** para Liquidity Grab (`time/open/...` en vez de `t/o/h/l/c`):
   producía 0 operaciones, que parecía un resultado y era un bug.
2. **El banco de pruebas no aplicaba el tope de apalancamiento.** Con el stop pegado al
   precio, `size = riesgo/distancia` se disparaba y salía −65.096% con $6,6 M de costes.
   Se replicó la regla de `verificarEsma` (nocional ≤ capital × apalancamiento) y una
   parada por ruina.

## Siguiente paso recomendado

- **Desactivar el Sleeve Intradía** antes de cualquier prueba con dinero real.
- Repetir la comparativa sobre la cartera completa, no un solo activo.
- Para índices (US30/Nasdaq) hace falta otro venue: Deriv da su precio pero **no permite
  operarlos** (medido 2026-08-11).
