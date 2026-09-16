import { Bias, Candle } from "./types";

/**
 * Daily Bias por estructura (01_REGLAS_ENTRADA.md §2).
 *
 * Funciones puras: reciben exactamente las velas ya conocidas hasta el momento a evaluar. El
 * caller (runner de backtest o ciclo en vivo) es responsable de no pasar velas del futuro
 * respecto al día que se está evaluando — igual que `liquidityGrab.ts` delega el anti-lookahead
 * en cómo se invoca, no en la función misma.
 */

interface SwingPoint {
  index: number;
  price: number;
  type: "high" | "low";
}

/** Swings fractales simples: ala `wing` barras a cada lado, sin marca de confirmación por barra
 *  (a diferencia de `liquidityGrab.ts`) porque aquí el caller ya trunca la serie de antemano. */
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

/**
 * Bias de un único timeframe a partir de los dos últimos swing highs y los dos últimos swing
 * lows confirmados. `NONE` si no hay suficiente estructura o si no hay HH+HL ni LL+LH.
 */
export function dailyBiasFromStructure(candles: Candle[], wing = 2): Bias {
  const swings = findSwings(candles, wing);
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");
  if (highs.length < 2 || lows.length < 2) return "NONE";

  const lastHigh = highs[highs.length - 1]!;
  const prevHigh = highs[highs.length - 2]!;
  const lastLow = lows[lows.length - 1]!;
  const prevLow = lows[lows.length - 2]!;

  const higherHigh = lastHigh.price > prevHigh.price;
  const higherLow = lastLow.price > prevLow.price;
  const lowerHigh = lastHigh.price < prevHigh.price;
  const lowerLow = lastLow.price < prevLow.price;

  if (higherHigh && higherLow) return "UP";
  if (lowerHigh && lowerLow) return "DOWN";
  return "NONE";
}

/**
 * Bias combinado 1D+4H (01_REGLAS_ENTRADA.md §2): SUPUESTO DECLARADO — se exige que ambos
 * timeframes coincidan; si difieren o cualquiera de los dos no tiene estructura clara, `NONE`.
 * Ver 05_PREGUNTAS_ABIERTAS.md — puede que Moisés prefiera que 1D mande solo.
 */
export function combinedDailyBias(daily: Candle[], h4: Candle[], wing = 2): Bias {
  const dailyBias = dailyBiasFromStructure(daily, wing);
  const h4Bias = dailyBiasFromStructure(h4, wing);
  if (dailyBias === "NONE" || h4Bias === "NONE") return "NONE";
  return dailyBias === h4Bias ? dailyBias : "NONE";
}

/**
 * Variante alternativa (pregunta abierta #4, 05_PREGUNTAS_ABIERTAS.md): 1D MANDA. El 4H solo
 * puede VETAR (si tiene estructura propia y contradice claramente al 1D -> NONE), pero no hace
 * falta que el 4H tenga su propia estructura confirmada para operar. Mucho menos estricta que
 * `combinedDailyBias` — se añadió para medir sensibilidad al supuesto, no reemplaza al default.
 */
export function dailyLeadsBias(daily: Candle[], h4: Candle[], wing = 2): Bias {
  const dailyBias = dailyBiasFromStructure(daily, wing);
  if (dailyBias === "NONE") return "NONE";
  const h4Bias = dailyBiasFromStructure(h4, wing);
  if (h4Bias !== "NONE" && h4Bias !== dailyBias) return "NONE"; // 4H contradice claramente -> skip
  return dailyBias;
}
