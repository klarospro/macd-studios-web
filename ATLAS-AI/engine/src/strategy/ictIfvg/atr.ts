import { Candle } from "./types";

/**
 * ATR(14) puro TypeScript, suavizado de Wilder (el estándar de la mayoría de plataformas).
 * Causal: `atrAt(candles, i, period)` solo usa velas hasta `i`, nunca del futuro.
 */

export function trueRange(prev: Candle | null, current: Candle): number {
  if (!prev) return current.h - current.l;
  return Math.max(current.h - current.l, Math.abs(current.h - prev.c), Math.abs(current.l - prev.c));
}

/** Serie completa de ATR sobre `candles`. `null` en los índices donde aún no hay suficientes
 *  barras (`index < period - 1`). */
export function atrSeries(candles: Candle[], period = 14): Array<number | null> {
  const result: Array<number | null> = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  const trs: number[] = candles.map((c, i) => trueRange(i > 0 ? candles[i - 1]! : null, c));

  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i]!;
  let prevAtr = sum / period;
  result[period - 1] = prevAtr;

  for (let i = period; i < candles.length; i++) {
    prevAtr = (prevAtr * (period - 1) + trs[i]!) / period;
    result[i] = prevAtr;
  }
  return result;
}

/** ATR en la barra `index`, o `null` si no hay suficiente historia (serie corta). Recalcula la
 *  serie completa hasta `index` en cada llamada — simple y correcto; si el volumen de datos del
 *  backtest lo justifica, optimizar a una versión incremental queda como mejora futura, no
 *  bloqueante para v1. */
export function atrAt(candles: Candle[], index: number, period = 14): number | null {
  if (index < 0 || index >= candles.length) return null;
  if (index < period - 1) return null;
  const series = atrSeries(candles.slice(0, index + 1), period);
  return series[index] ?? null;
}
