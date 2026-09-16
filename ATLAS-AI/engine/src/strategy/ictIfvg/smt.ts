import { Candle } from "./types";

/**
 * Divergencia SMT (Smart Money Technique) entre NQ y un activo correlacionado (ES) —
 * 01_REGLAS_ENTRADA.md §6. OPCIONAL en v1 (la spec la marca "obligatoria en A+"): esta función
 * existe y está testeada, pero `index.ts` NO la usa por defecto todavía — `IctIfvgParams`
 * reserva un flag `useSmtConfluence` sin conectar.
 *
 * Definición usada: en el último par de swings confirmados de cada serie, el activo primario
 * marca un nuevo extremo (HH o LL) que el correlacionado NO confirma (mismo tipo de swing pero
 * sin superar su propio extremo previo).
 */

interface SwingPoint {
  index: number;
  price: number;
  type: "high" | "low";
}

function findSwings(candles: Candle[], wing: number): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = wing; i < candles.length - wing; i++) {
    const bar = candles[i]!;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= wing; k++) {
      const left = candles[i - k]!;
      const right = candles[i + k]!;
      if (bar.h <= left.h || bar.h <= right.h) isHigh = false;
      if (bar.l >= left.l || bar.l >= right.l) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: bar.h, type: "high" });
    if (isLow) swings.push({ index: i, price: bar.l, type: "low" });
  }
  return swings;
}

export interface SmtDivergence {
  /** "bullish" = el primario marca LL que el correlacionado no confirma (señal de posible giro alcista). */
  type: "bullish" | "bearish";
  primaryIndex: number;
  correlatedIndex: number;
}

/**
 * `swingWing` por defecto: 6 (punto medio del rango 5-8 dado en la spec, sin confirmar cuál
 * exacto — ver 05_PREGUNTAS_ABIERTAS.md).
 */
export function detectSmtDivergence(primary: Candle[], correlated: Candle[], swingWing = 6): SmtDivergence | null {
  const primarySwings = findSwings(primary, swingWing);
  const correlatedSwings = findSwings(correlated, swingWing);

  const primaryHighs = primarySwings.filter((s) => s.type === "high");
  const primaryLows = primarySwings.filter((s) => s.type === "low");
  const correlatedHighs = correlatedSwings.filter((s) => s.type === "high");
  const correlatedLows = correlatedSwings.filter((s) => s.type === "low");

  if (primaryHighs.length >= 2 && correlatedHighs.length >= 2) {
    const lastPrimary = primaryHighs[primaryHighs.length - 1]!;
    const prevPrimary = primaryHighs[primaryHighs.length - 2]!;
    const lastCorrelated = correlatedHighs[correlatedHighs.length - 1]!;
    const prevCorrelated = correlatedHighs[correlatedHighs.length - 2]!;
    const primaryMadeHH = lastPrimary.price > prevPrimary.price;
    const correlatedFailedHH = lastCorrelated.price <= prevCorrelated.price;
    if (primaryMadeHH && correlatedFailedHH) {
      return { type: "bearish", primaryIndex: lastPrimary.index, correlatedIndex: lastCorrelated.index };
    }
  }

  if (primaryLows.length >= 2 && correlatedLows.length >= 2) {
    const lastPrimary = primaryLows[primaryLows.length - 1]!;
    const prevPrimary = primaryLows[primaryLows.length - 2]!;
    const lastCorrelated = correlatedLows[correlatedLows.length - 1]!;
    const prevCorrelated = correlatedLows[correlatedLows.length - 2]!;
    const primaryMadeLL = lastPrimary.price < prevPrimary.price;
    const correlatedFailedLL = lastCorrelated.price >= prevCorrelated.price;
    if (primaryMadeLL && correlatedFailedLL) {
      return { type: "bullish", primaryIndex: lastPrimary.index, correlatedIndex: lastCorrelated.index };
    }
  }

  return null;
}
