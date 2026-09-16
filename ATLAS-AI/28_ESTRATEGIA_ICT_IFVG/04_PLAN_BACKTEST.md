# Plan de backtest — Estrategia A (ICT IFVG en NQ)

## Estado
Runner completo y funcional en `engine/src/backtest/runIctIfvg.ts` + `ictIfvgBacktest.ts`. Probado esta noche solo en el sentido de: compila (`npm run typecheck`), no rompe la suite existente (`npm test`, 80/80 en verde), y falla de forma clara y controlada cuando no hay datos (exit code 1, mensaje explícito, sin generar nada). **No se ejecutó contra ningún dato real ni sintético** — no hay datos de NQ en el repo y la regla dura de esta tarea prohíbe inventarlos o descargarlos. Por tanto no hay NINGUNA cifra de rentabilidad, win rate, drawdown, etc. que reportar todavía.

## Datos que hacen falta (ninguno existe hoy en `engine/src/backtest/data/`)

| Archivo esperado | Timeframe | Uso |
|---|---|---|
| `engine/src/backtest/data/nqUsdM5.csv` | 5M | Entrada (IFVG, ATR, stop, TP1/TP2) |
| `engine/src/backtest/data/nqUsdDaily.csv` | 1D | Daily Bias |
| `engine/src/backtest/data/nqUsd4h.csv` | 4H | Daily Bias (confirmación) |
| `engine/src/backtest/data/esUsdM5.csv` (opcional, para SMT) | 5M | Confluencia SMT (NQ vs ES) — no se usa en v1 |

**Formato exacto** (el parser de `runIctIfvg.ts` es literal, no tolera variaciones): CSV con cabecera `t,o,h,l,c`, separador coma, sin espacios extra necesarios pero se toleran. `t` = epoch en SEGUNDOS UTC (NO milisegundos, NO ISO string) — misma convención que `Candle` en el resto del motor (`liquidityGrab.ts`, `goldOhlcM15.json`). Ejemplo de las dos primeras filas:

```
t,o,h,l,c
1700000000,15234.5,15240.25,15230.0,15238.75
1700000300,15238.75,15245.0,15236.5,15242.0
```

Las velas 5M deben cubrir TODAS las horas del día (no solo la ventana 9:30-10:10 NY) porque la gestión de la posición (stop/TP1/TP2/BE) sigue corriendo después de la ventana de entrada — ver supuesto declarado en `ictIfvgBacktest.ts` y en `03_INTEGRACION_ENGINE.md`.

## De dónde podrían salir estos datos (sin descargar nada esta noche)
- El motor ya tiene scripts de descarga para OTROS instrumentos (`engine/src/scripts/fetchDerivHistory.ts`, `fetchGoldOhlc.ts`, `fetchLongHistory.ts`) — pero Deriv (el único broker con API ya integrada, ver `11_MT5/00_RESUMEN.md`) **no ofrece Nasdaq/US30 en su Native API/Multipliers**, solo vía Deriv MT5/Deriv X — el mismo bloqueo de infraestructura ya documentado en `27_SCALPING/00_RESUMEN.md` ("Nasdaq / US30: NO existe hoy... requeriría el puente MT5/Windows"). Esto es un hallazgo IMPORTANTE que ya estaba anotado antes de esta tarea y sigue sin resolverse: **no hay ninguna fuente de datos NQ ya conectada al proyecto**.
- Alternativas no exploradas esta noche (regla dura: sin navegador): un proveedor de datos de futuros con historial 5M de NQ (ej. un CSV exportado de TradingView/plataforma del propio Moisés, o un dataset ya licenciado). Esto requiere que Moisés aporte el archivo o apruebe una fuente concreta — no es una decisión técnica que se pueda tomar sola esta noche.

## Métricas que produce el runner (ya implementadas en `summarizeIctIfvg()`)
- `returnPct`, `maxDdPct`, `numTrades`, `winRate`, `profitFactor`
- `expectancy` (valor esperado en USD por operación)
- `avgWin`, `avgLoss`
- `avgMaePoints`, `avgMfePoints` (excursión adversa/favorable media, en puntos del índice, por operación)
- Desglose de `outcome` por operación (`stop_full`, `tp1_then_stop_be`, `tp1_then_tp2`, `tp1_then_day_end`, `day_end_no_tp1`, `daily_kill_switch`, `end_of_data`) — para diagnosticar SI el problema es el stop, la falta de TP2, o el kill switch, no solo el resultado agregado.
- Rechazos del risk gate por motivo (`rejections`) y número de días con kill switch activado.

## Criterios GO / NO-GO (propuestos, siguiendo el mismo estándar que `13_BACKTESTING/00_RESUMEN.md` y el NO-GO de Liquidity Grab en `27_SCALPING`)
1. **Edge crudo primero, sin kill-switches** (igual que `runLiquidityGrab.ts` hace con su `RAW_CONFIG`): si ni siquiera sin restricciones de riesgo hay profit factor > 1, no hay nada que backtestear con más detalle.
2. **Walk-forward obligatorio**: partir los datos en mitades/cuartos. Si el resultado solo existe en una parte de la muestra, es ajuste, no ventaja (mismo criterio que el NO-GO de Liquidity Grab).
3. **Barrido de costes**: NQ tiene comisión y spread reales sin confirmar esta noche (regla dura sin navegador) — correr el backtest a 0/1/2/4/8 bps/lado para ver a qué coste se muere el edge, exactamente como se hizo con oro.
4. **Sensibilidad a la definición de IFVG**: dado que la definición de entrada usada es una interpretación propia (ver `01_REGLAS_ENTRADA.md` §3 y `05_PREGUNTAS_ABIERTAS.md` pregunta #1), CONFIRMAR con Moisés antes de sacar cualquier conclusión — si la definición real es distinta (por ejemplo, entrada por retest en vez de al cierre de la vela de inversión), el resultado puede cambiar tanto como cambió el de Liquidity Grab con un solo supuesto (-61,7% → +236%, ver `27_SCALPING/03_VALIDACION_LIQUIDITY_GRAB_ORO.md`).
5. **Mínimo de operaciones**: con máx. 2 trades/día y una ventana de 40 min, la muestra crece lento — se necesitan varios meses de datos 5M para tener una muestra mínimamente confiable (referencia: TSMOM y Liquidity Grab usaron ~1-2 años).
6. Solo si 1-4 pasan: demo real 1 mes con auditoría completa + aprobación explícita de Moisés (regla de oro del proyecto, misma barra que toda estrategia anterior en `13_BACKTESTING`).

## Siguiente paso concreto
En cuanto exista `nqUsdM5.csv` + `nqUsdDaily.csv` + `nqUsd4h.csv` en el path de arriba: `node --import tsx src/backtest/runIctIfvg.ts` desde `engine/`. El runner ya calcula la corrida principal; el barrido de costes/walk-forward/sensibilidad (puntos 1-4 de arriba) se puede añadir siguiendo el patrón exacto de `runLiquidityGrab.ts` (que ya lo hace) en cuanto haya un primer resultado que valga la pena examinar más a fondo.
