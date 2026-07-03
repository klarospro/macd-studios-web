import { Signal } from "../domain/types";

/**
 * Time-Series Momentum (TSMOM / trend following) — la estrategia con evidencia más sólida
 * del catálogo (13_BACKTESTING ficha 1: Moskowitz/Ooi/Pedersen 2012, AQR). Regla simple:
 * largo si el momentum de `lookback` barras es positivo, corto si es negativo. El stop se fija
 * a `atrMult` × ATR — el stop es PARTE de la estrategia (skew positivo), encaja con el riskGate.
 * Solo señales; el sizing y la aprobación los hace 09_RISK.
 */
export interface TsmomParams {
  symbol: string;
  correlationGroup: string;
  lookback: number; // barras para el signo del momentum
  atrPeriod: number; // ventana del proxy de ATR
  atrMult: number; // múltiplo de ATR para la distancia al stop
}

function at(prices: number[], k: number): number {
  const value = prices[k];
  if (value === undefined) throw new Error(`índice fuera de rango: ${k}`);
  return value;
}

/** Proxy de ATR con solo cierres: media de |Δcierre| en la ventana. */
export function atrProxy(prices: number[], i: number, period: number): number {
  if (i < period) return 0;
  let sum = 0;
  for (let k = i - period + 1; k <= i; k++) sum += Math.abs(at(prices, k) - at(prices, k - 1));
  return sum / period;
}

/** Devuelve la señal deseada en la barra i, o null si no hay datos suficientes / momentum nulo. */
export function tsmomSignal(prices: number[], i: number, p: TsmomParams): Signal | null {
  if (i < p.lookback || i < p.atrPeriod) return null;
  const momentum = at(prices, i) - at(prices, i - p.lookback);
  if (momentum === 0) return null;

  const side = momentum > 0 ? "buy" : "sell";
  const entryPrice = at(prices, i);
  const range = atrProxy(prices, i, p.atrPeriod) * p.atrMult;
  if (range <= 0) return null;
  const stopPrice = side === "buy" ? entryPrice - range : entryPrice + range;

  return { symbol: p.symbol, side, entryPrice, stopPrice, correlationGroup: p.correlationGroup };
}
