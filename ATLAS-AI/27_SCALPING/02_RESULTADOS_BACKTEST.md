# 27_SCALPING · Resultados del backtest (2026-07-17)

Backtest ejecutado con `engine/src/backtest/runScalpBacktest.ts` sobre velas **M5 reales de Deriv**
(`engine/src/backtest/data/derivIntradayM5.ts`, ~3-5 meses): EURUSD 20.826, Oro 19.938, BTC 30.000 velas.
Señal: momentum intradía (TSMOM, `tsmomSignal`) M5 y M15, lookback 24, ATR 14×1.2. Risk gate REAL,
riesgo 0.25%/op, breaker relajado para medir edge crudo, tope de drawdown 25%. Barrido de costes 0–8 bps/lado.

## Veredicto: NO-GO con este enfoque (momentum intradía en Deriv)

| Activo · TF | Sin costes | 2 bps/lado | 3 bps/lado (walk-fwd out) |
|---|---|---|---|
| EURUSD M5 | −24% | −25% | −25% |
| EURUSD M15 | (neg) | (neg) | (neg) |
| Oro M5 | −25% | −25% | −24% |
| **Oro M15** | **+48%** | **−25%** | **−23%** |
| BTC M5 | −25% | −25% | −23% |
| BTC M15 | −16% | −22% | −25% |

## Lectura honesta
- **El único destello de ventaja (Oro M15 +48% sin costes) desaparece con solo 1-2 bps/lado** → a
  1 bps ya es −2,5%, a 2 bps −25%. Es el problema clásico del scalping: hay señal bruta pero **el coste
  se la come entera**.
- El resto es negativo incluso SIN costes. Win rates 5-30%.
- El "−25%" es el tope de drawdown: la estrategia sangra hasta el freno y se detiene.
- El coste realista estimado en Deriv Multipliers (~2 bps/lado + spread implícito no cuantificado)
  cae **dentro de la zona donde la ventaja ya es negativa**.

## Limitaciones (para no sobre-concluir)
1. Un solo tipo de señal (momentum). Reversión a la media u otras podrían diferir (sin garantía).
2. Muestra corta (~3-5 meses). 3. Coste modelado como bps planos; el spread real de Deriv Multipliers
podría ser peor. 4. No prueba brókers de costes más bajos (ECN/order book real).

## Recomendación
NO construir ejecución de scalping momentum en Deriv. Si se quiere insistir en scalping: exige (a) un
bróker de costes bajos reales y (b) explorar otras familias de señal, SIEMPRE con backtest+demo primero.
Alternativa de mayor evidencia: **diversificar el TSMOM diario a una cesta** (ya señalado en la validación
de 10 años como el camino con edge más creíble). Ver [[27_SCALPING/00_RESUMEN]] y `09_RISK`.
