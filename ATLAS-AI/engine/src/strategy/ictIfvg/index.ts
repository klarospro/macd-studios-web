import { Signal } from "../../domain/types";
import { combinedDailyBias, dailyLeadsBias } from "./bias";
import { detectFvgZones, detectIfvgAt, detectIfvgRetestAt } from "./ifvg";
import { atrAt } from "./atr";
import { isInFirstIfvgWindow, isWeekday, nyDayKey } from "./session";
import { Candle, IfvgSignal, TradePlan } from "./types";

/**
 * Punto de entrada de la estrategia ICT IFVG — orquesta bias + IFVG + sesión + stop/objetivos en
 * una única función pura `findIctIfvgSignal`. No abre posiciones ni conoce el estado de la
 * cuenta: solo produce, para una barra `now` dada, una `Signal` apta para `riskGate.evaluate()`
 * (que NO se modifica) más un `TradePlan` con los niveles de TP1/TP2/break-even que el riskGate
 * no modela (ver 03_INTEGRACION_ENGINE.md).
 *
 * Responsabilidad del caller (backtest o ciclo en vivo): no volver a llamar a esta función
 * mientras ya haya una posición abierta ese día, y no superar `maxTradesPerDay` — igual que
 * `liquidityGrabBacktest.ts` hace con `liquidityGrabSignal`. Esta función no lleva ese estado.
 */

export interface IctIfvgParams {
  symbol: string;
  correlationGroup: string;
  /** Hueco mínimo del FVG en puntos del índice. Spec: 3-5. Default: 3 (ver 05_PREGUNTAS_ABIERTAS.md). */
  minGapPoints: number;
  atrPeriod: number;
  atrMultiplier: number;
  /** Ala de swing fractal usada para el stop estructural y los objetivos TP1/TP2. */
  swingWing: number;
  /** Reservado para v1: NO se usa todavía dentro de esta función (ver 01_REGLAS_ENTRADA.md §6). */
  useSmtConfluence: boolean;
  /**
   * "strict" (default, documentado en 01_REGLAS_ENTRADA.md §2): 1D y 4H deben coincidir, si no
   * -> skip día. "daily_leads" (pregunta abierta #4): 1D manda, 4H solo veta si CONTRADICE con
   * estructura propia — bastante menos restrictivo. Añadido para medir sensibilidad al supuesto,
   * no cambia el comportamiento por defecto ya documentado.
   */
  biasMode: "strict" | "daily_leads";
  /**
   * "close" (default, documentado en 01_REGLAS_ENTRADA.md §3): entra al cierre de la vela que
   * confirma la inversión del IFVG. "retest" (pregunta abierta #1): espera a que el precio VUELVA
   * a tocar la zona ya invertida, acotado al mismo día natural NY — si no hay retest antes de que
   * termine el día, esa inversión se descarta (no se re-intenta al día siguiente).
   */
  entryMode: "close" | "retest";
}

export const defaultIctIfvgParams: Omit<IctIfvgParams, "symbol" | "correlationGroup"> = {
  minGapPoints: 3,
  atrPeriod: 14,
  atrMultiplier: 1.5,
  swingWing: 2,
  useSmtConfluence: false,
  biasMode: "strict",
  entryMode: "close",
};

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

/** Stop estructural: swing relevante más reciente (low para compras, high para ventas) antes de `now`. */
function relevantSwingStop(candles: Candle[], now: number, side: "buy" | "sell", wing: number): number | null {
  const swings = findSwings(candles.slice(0, now + 1), wing);
  const type = side === "buy" ? "low" : "high";
  const candidates = swings.filter((s) => s.type === type);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1]!.price;
}

/** TP1 (swing interno más cercano) y TP2 (siguiente pool de liquidez externa), en la dirección
 *  de la operación. `null` cuando no hay swing suficiente — no se inventa un nivel. */
function liquidityTargets(
  candles: Candle[],
  now: number,
  side: "buy" | "sell",
  wing: number,
  entry: number,
): { tp1: number | null; tp2: number | null } {
  const swings = findSwings(candles.slice(0, now + 1), wing);
  const type = side === "buy" ? "high" : "low";
  const relevant = swings
    .filter((s) => s.type === type && (side === "buy" ? s.price > entry : s.price < entry))
    .sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));

  return { tp1: relevant[0]?.price ?? null, tp2: relevant[1]?.price ?? null };
}

export function findIctIfvgSignal(
  m5: Candle[],
  dailyCandles: Candle[],
  h4Candles: Candle[],
  now: number,
  params: IctIfvgParams,
): { signal: Signal; plan: TradePlan } | null {
  const bar = m5[now];
  if (!bar) return null;
  if (!isWeekday(bar.t)) return null;
  // En modo "close" la entrada solo puede ocurrir DENTRO de la ventana; en modo "retest" la
  // inversión debe haber ocurrido en la ventana, pero el retest (la entrada) puede llegar después.
  if (params.entryMode === "close" && !isInFirstIfvgWindow(bar.t)) return null;

  const bias =
    params.biasMode === "daily_leads"
      ? dailyLeadsBias(dailyCandles, h4Candles, params.swingWing)
      : combinedDailyBias(dailyCandles, h4Candles, params.swingWing);
  if (bias === "NONE") return null;
  const wantedSide = bias === "UP" ? "buy" : "sell";

  // Modo "retest": acota el histórico consultado a un lookback razonable (~3 días de 5M) en vez
  // de reescanear desde el principio del dataset en cada barra — sin este acotado, el coste pasa
  // de O(ventana) a O(n²) porque (a diferencia de "close") aquí SÍ hace falta mirar barras fuera
  // de la ventana de entrada. Un IFVG "de la sesión" nunca necesita mirar más atrás que esto.
  // `indexOffset` mantiene los índices de las zonas alineados con `m5` completo, no con el recorte.
  const RETEST_LOOKBACK_BARS = 900;
  const zones =
    params.entryMode === "retest"
      ? detectFvgZones(m5.slice(Math.max(0, now - RETEST_LOOKBACK_BARS + 1), now + 1), params.minGapPoints, Math.max(0, now - RETEST_LOOKBACK_BARS + 1))
      : detectFvgZones(m5.slice(0, now + 1), params.minGapPoints);

  let valid: IfvgSignal | undefined;
  if (params.entryMode === "retest") {
    // "Primer IFVG válido de la sesión a favor del bias": se busca hacia atrás SOLO dentro del
    // día natural NY de `bar` (se corta en cuanto se cruza a un día anterior) para no repetir el
    // escaneo desde el principio del dataset en cada llamada.
    const today = nyDayKey(bar.t);
    const windowInversions: IfvgSignal[] = [];
    for (let j = now - 1; j >= 0; j--) {
      const wBar = m5[j]!;
      if (nyDayKey(wBar.t) !== today) break;
      if (!isWeekday(wBar.t) || !isInFirstIfvgWindow(wBar.t)) continue;
      windowInversions.push(...detectIfvgAt(m5, zones, j).filter((inv) => inv.side === wantedSide));
    }
    windowInversions.sort((a, b) => a.invertedAt - b.invertedAt);
    const first = windowInversions[0];
    if (!first) return null;
    valid = detectIfvgRetestAt(m5, [first], now)[0];
  } else {
    valid = detectIfvgAt(m5, zones, now).find((inv) => inv.side === wantedSide);
  }
  if (!valid) return null;

  const atr = atrAt(m5, now, params.atrPeriod);
  if (atr === null) return null;

  const entry = bar.c;
  const atrStop = wantedSide === "buy" ? entry - atr * params.atrMultiplier : entry + atr * params.atrMultiplier;
  const swingStop = relevantSwingStop(m5, now, wantedSide, params.swingWing);

  // "El más lejano de los dos" (02_GESTION_RIESGO.md §3): se usa el stop candidato que queda a
  // mayor distancia del entry, sea el de ATR o el estructural.
  let stop = atrStop;
  if (swingStop !== null) {
    const atrDist = Math.abs(entry - atrStop);
    const swingDist = Math.abs(entry - swingStop);
    stop = swingDist > atrDist ? swingStop : atrStop;
  }

  const stopPoints = Math.abs(entry - stop);
  if (stopPoints <= 0) return null;

  const { tp1, tp2 } = liquidityTargets(m5, now, wantedSide, params.swingWing, entry);
  // Fallback declarado (02_GESTION_RIESGO.md §4): sin swing de TP1 disponible, se usa 1:1 sobre
  // el stop en vez de dejar la operación sin objetivo.
  const resolvedTp1 = tp1 ?? (wantedSide === "buy" ? entry + stopPoints : entry - stopPoints);

  const signal: Signal = {
    symbol: params.symbol,
    side: wantedSide,
    entryPrice: entry,
    stopPrice: stop,
    correlationGroup: params.correlationGroup,
  };

  const plan: TradePlan = {
    symbol: params.symbol,
    side: wantedSide,
    entry,
    stop,
    stopPoints,
    tp1: resolvedTp1,
    tp2: tp2 ?? null,
    breakEvenTrigger: resolvedTp1,
  };

  return { signal, plan };
}
