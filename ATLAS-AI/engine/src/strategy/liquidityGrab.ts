import { Signal } from "../domain/types";

/**
 * Estrategia "Liquidity Grab" (barrido de liquidez) — atribuida a Pranam Ghagare.
 *
 * Idea: un barrido de stops ocurre cuando el precio rompe un nivel de soporte/resistencia
 * (activando los stops que se acumulan justo detrás) y acto seguido vuelve al otro lado.
 * La ruptura fallida se interpreta como trampa de liquidez y se opera la reversión.
 *
 * IMPLEMENTADA TAL CUAL SE ESPECIFICÓ, sin retoques para mejorar el resultado.
 *
 * ── Nota crítica sobre LOOKAHEAD ────────────────────────────────────────────────────────
 * Un swing fractal en el índice i con ala `swingWing = w` NO se puede conocer hasta la barra
 * i + w, porque su definición exige que las w barras POSTERIORES no lo superen. Una
 * implementación ingenua (calcular todos los swings sobre la serie completa y consultarlos en
 * la barra i) le da al backtest información del futuro e infla los resultados.
 *
 * Aquí cada swing lleva `confirmedAt = index + wing`, y `detectGrab` descarta cualquier swing
 * cuyo `confirmedAt` sea posterior a la barra actual. Es la diferencia entre medir la
 * estrategia y medir el propio bug.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

export interface Candle {
  t: number; // epoch en segundos
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface Swing {
  index: number;
  price: number;
  type: "high" | "low";
  /** Primera barra en la que este swing es observable sin mirar al futuro. */
  confirmedAt: number;
}

export interface LiquidityGrabParams {
  symbol: string;
  correlationGroup: string;
  /** Barras a cada lado que definen un swing fractal. Spec: 2. */
  swingWing: number;
  /** Antigüedad máxima (en barras) de un nivel para seguir siendo válido. Spec: 50. */
  lookback: number;
  /** Margen sobre la distancia al nivel para colocar el stop. Spec: 1.1 (10%). */
  stopBufferMult: number;
  /** Ratio riesgo/beneficio. Spec: 1.0 (1:1). */
  rewardRatio: number;
  /** Periodo de la EMA de filtro de tendencia. Spec: 30, marcado como OPCIONAL. */
  emaPeriod: number;
  /** Si true, solo se operan grabs a favor de la EMA. */
  useEmaFilter: boolean;
  /**
   * Barras de retardo entre la vela que recupera el nivel y la entrada.
   * 0 = entrar al cierre de la vela que recupera (lectura de la "Variante 1" del enunciado).
   * 1 = entrar a la vela siguiente (lectura literal de los índices [2]/[1]/[0] del enunciado).
   * El enunciado original es ambiguo entre ambas: se prueban las dos.
   */
  entryDelay: number;
}

export const defaultLiquidityGrabParams: Omit<LiquidityGrabParams, "symbol" | "correlationGroup"> = {
  swingWing: 2,
  lookback: 50,
  stopBufferMult: 1.1,
  rewardRatio: 1.0,
  emaPeriod: 30,
  useEmaFilter: false,
  entryDelay: 0,
};

/**
 * Detecta swings fractales sobre toda la serie, anotando en qué barra se confirma cada uno.
 * Se calcula una sola vez; el filtro anti-lookahead se aplica al consultar, no al calcular.
 */
export function detectSwings(candles: Candle[], wing: number): Swing[] {
  const swings: Swing[] = [];
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
    // `>` estricto a ambos lados: una barra no puede ser máximo y mínimo local a la vez.
    if (isHigh) swings.push({ index: i, price: bar.h, type: "high", confirmedAt: i + wing });
    if (isLow) swings.push({ index: i, price: bar.l, type: "low", confirmedAt: i + wing });
  }
  return swings;
}

/** EMA calculada de forma causal (solo con datos hasta `upTo`). */
export function ema(candles: Candle[], upTo: number, period: number): number | null {
  if (upTo + 1 < period) return null;
  const k = 2 / (period + 1);
  let value = candles[0]!.c;
  for (let i = 1; i <= upTo; i++) value = candles[i]!.c * k + value * (1 - k);
  return value;
}

export interface Grab {
  type: "BULLISH_GRAB" | "BEARISH_GRAB";
  level: number;
  levelIndex: number;
}

/**
 * Busca un barrido de liquidez que se complete en la barra `now`.
 *
 * BULLISH: la barra anterior cerró POR DEBAJO del último soporte y la barra `now` cierra POR
 * ENCIMA → los stops bajistas fueron barridos y el precio ha vuelto: se compra.
 * BEARISH: espejo sobre la última resistencia.
 *
 * Solo se consideran swings ya confirmados en `now` (sin lookahead) y con antigüedad ≤ lookback.
 */
export function detectGrab(candles: Candle[], swings: Swing[], now: number, params: LiquidityGrabParams): Grab | null {
  if (now < 1) return null;
  const prev = candles[now - 1]!;
  const current = candles[now]!;

  let support: Swing | null = null;
  let resistance: Swing | null = null;
  for (const swing of swings) {
    if (swing.confirmedAt > now) break; // swings van ordenados por índice → confirmedAt creciente
    if (now - swing.index > params.lookback) continue;
    // El nivel debe existir ANTES de la ruptura que estamos evaluando.
    if (swing.index >= now - 1) continue;
    if (swing.type === "low") support = swing;
    else resistance = swing;
  }

  if (support && prev.c < support.price && current.c > support.price) {
    return { type: "BULLISH_GRAB", level: support.price, levelIndex: support.index };
  }
  if (resistance && prev.c > resistance.price && current.c < resistance.price) {
    return { type: "BEARISH_GRAB", level: resistance.price, levelIndex: resistance.index };
  }
  return null;
}

export interface GrabLevels {
  side: "buy" | "sell";
  entry: number;
  stop: number;
  target: number;
  stopDistance: number;
}

/**
 * Entrada al cierre actual; stop al otro lado del nivel barrido con un margen `stopBufferMult`;
 * objetivo a `rewardRatio` veces la distancia al stop.
 */
export function calculateLevels(grab: Grab, entryPrice: number, params: LiquidityGrabParams): GrabLevels | null {
  if (grab.type === "BULLISH_GRAB") {
    const stopDistance = (entryPrice - grab.level) * params.stopBufferMult;
    if (stopDistance <= 0) return null;
    return {
      side: "buy",
      entry: entryPrice,
      stop: entryPrice - stopDistance,
      target: entryPrice + stopDistance * params.rewardRatio,
      stopDistance,
    };
  }
  const stopDistance = (grab.level - entryPrice) * params.stopBufferMult;
  if (stopDistance <= 0) return null;
  return {
    side: "sell",
    entry: entryPrice,
    stop: entryPrice + stopDistance,
    target: entryPrice - stopDistance * params.rewardRatio,
    stopDistance,
  };
}

/**
 * Señal lista para el risk gate del motor (que hace el sizing a partir de entry/stop).
 * Devuelve además el objetivo, que el gate no modela pero el backtest necesita.
 */
export function liquidityGrabSignal(
  candles: Candle[],
  swings: Swing[],
  now: number,
  params: LiquidityGrabParams,
): { signal: Signal; levels: GrabLevels } | null {
  const grabBar = now - params.entryDelay;
  if (grabBar < 1) return null;

  const grab = detectGrab(candles, swings, grabBar, params);
  if (!grab) return null;

  if (params.useEmaFilter) {
    const trend = ema(candles, now, params.emaPeriod);
    if (trend === null) return null;
    const price = candles[now]!.c;
    if (grab.type === "BULLISH_GRAB" && price < trend) return null;
    if (grab.type === "BEARISH_GRAB" && price > trend) return null;
  }

  const levels = calculateLevels(grab, candles[now]!.c, params);
  if (!levels) return null;

  return {
    signal: {
      symbol: params.symbol,
      side: levels.side,
      entryPrice: levels.entry,
      stopPrice: levels.stop,
      correlationGroup: params.correlationGroup,
    },
    levels,
  };
}
