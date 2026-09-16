import { BacktestAdapter } from "./backtestAdapter";
import { evaluate } from "../risk/riskGate";
import { RiskConfig } from "../config/riskConfig";
import { AccountState, Position } from "../domain/types";
import { Candle, GrabLevels, LiquidityGrabParams, detectSwings, liquidityGrabSignal } from "../strategy/liquidityGrab";

/**
 * Backtest de la estrategia Liquidity Grab sobre velas OHLC reales, pasando por el risk gate
 * REAL del motor (`evaluate`) — el mismo que valida las órdenes en vivo.
 *
 * Reglas de simulación (declaradas para que los números sean interpretables):
 * - Entrada al CIERRE de la barra de señal (no al precio del nivel: no se puede rellenar en el pasado).
 * - Salida por stop o por objetivo, resuelta DENTRO de la barra con high/low reales.
 * - Si en la MISMA barra se tocan stop y objetivo, se asume que se tocó primero el STOP.
 *   Es el supuesto conservador estándar: sin datos de tick no se puede saber el orden, y
 *   asumir lo contrario es la forma más común de inflar un backtest de SL/TP ajustados.
 * - Huecos de apertura: si la barra abre ya más allá del nivel, se rellena al OPEN (peor precio
 *   para el stop, mejor para el objetivo) — no al nivel teórico.
 * - Coste `costBps` por LADO sobre el nocional, cobrado en la entrada y en la salida.
 * - Una posición simultánea (la spec entra solo si no hay posiciones abiertas).
 */

export interface GrabTrade {
  entryTime: number;
  exitTime: number;
  side: "buy" | "sell";
  entry: number;
  stop: number;
  target: number;
  exit: number;
  size: number;
  pnl: number;
  outcome: "target" | "stop" | "end_of_data";
}

export interface GrabBacktestResult {
  trades: GrabTrade[];
  wins: number;
  losses: number;
  initialEquity: number;
  finalEquity: number;
  maxDrawdownPct: number;
  grossProfit: number;
  grossLoss: number;
  haltReason: string | null;
  rejections: Record<string, number>;
  bars: number;
  spanDays: number;
  /** Veces que stop y objetivo se tocaron en la MISMA vela (resueltas por `tieBreak`). */
  ambiguousBars: number;
  /** Distancias de stop en unidades de precio, para diagnosticar stops microscópicos. */
  stopDistances: number[];
}

/**
 * Cómo resolver una vela en la que se tocan stop y objetivo. Sin datos de tick es indecidible;
 * "stop" es el supuesto conservador y "target" el optimista. Correr ambos acota el resultado real.
 */
export type TieBreak = "stop" | "target";

const dayKey = (epoch: number): number => Math.floor(epoch / 86400);

export async function runLiquidityGrabBacktest(
  candles: Candle[],
  config: RiskConfig,
  params: LiquidityGrabParams,
  initialEquity: number,
  costBps = 0,
  maxTradesPerDay = 12,
  tieBreak: TieBreak = "stop",
): Promise<GrabBacktestResult> {
  const adapter = new BacktestAdapter(initialEquity);
  const swings = detectSwings(candles, params.swingWing);

  let open: { position: Position; levels: GrabLevels; entryTime: number } | null = null;
  let consecutiveLosses = 0;
  let peakEquity = initialEquity;
  let maxDrawdownPct = 0;
  let haltReason: string | null = null;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let currentDay = dayKey(candles[0]!.t);
  let startOfDayEquity = initialEquity;
  let tradesToday = 0;
  const trades: GrabTrade[] = [];
  const rejections: Record<string, number> = {};
  let ambiguousBars = 0;
  const stopDistances: number[] = [];

  const costOf = (size: number, price: number): number => (costBps / 10000) * size * price;

  const closeAt = async (price: number, time: number, outcome: GrabTrade["outcome"]): Promise<void> => {
    if (!open) return;
    const { position, levels, entryTime } = open;
    const before = await adapter.getEquity();
    adapter.currentPrice = price;
    await adapter.closePosition(position.id);
    if (costBps > 0) adapter.charge(costOf(position.size, price));
    const pnl = (await adapter.getEquity()) - before;

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      consecutiveLosses = 0;
    } else {
      losses++;
      grossLoss += Math.abs(pnl);
      consecutiveLosses++;
    }
    trades.push({
      entryTime,
      exitTime: time,
      side: position.side,
      entry: position.entryPrice,
      stop: levels.stop,
      target: levels.target,
      exit: price,
      size: position.size,
      pnl,
      outcome,
    });
    open = null;
  };

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i]!;

    // Reinicio diario: equity de referencia y contador de operaciones.
    const day = dayKey(bar.t);
    if (day !== currentDay) {
      currentDay = day;
      startOfDayEquity = await adapter.getEquity();
      tradesToday = 0;
    }

    // ── Resolución de la posición abierta dentro de ESTA barra ──
    if (open) {
      const { levels } = open;
      const long = open.position.side === "buy";
      const stopGap = long ? bar.o <= levels.stop : bar.o >= levels.stop;
      const targetGap = long ? bar.o >= levels.target : bar.o <= levels.target;
      const stopTouched = long ? bar.l <= levels.stop : bar.h >= levels.stop;
      const targetTouched = long ? bar.h >= levels.target : bar.l <= levels.target;

      if (stopTouched && targetTouched) ambiguousBars++;

      if (stopGap) await closeAt(bar.o, bar.t, "stop");
      else if (targetGap) await closeAt(bar.o, bar.t, "target");
      else if (stopTouched && targetTouched) {
        // Indecidible sin ticks: se resuelve según el supuesto elegido.
        if (tieBreak === "stop") await closeAt(levels.stop, bar.t, "stop");
        else await closeAt(levels.target, bar.t, "target");
      } else if (stopTouched) await closeAt(levels.stop, bar.t, "stop");
      else if (targetTouched) await closeAt(levels.target, bar.t, "target");
    }

    adapter.currentPrice = bar.c;
    const equity = await adapter.getEquity();
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peakEquity - equity) / peakEquity);

    // ── Búsqueda de nueva entrada ──
    if (open || tradesToday >= maxTradesPerDay) continue;

    const found = liquidityGrabSignal(candles, swings, i, params);
    if (!found) continue;

    const account: AccountState = {
      equity,
      startOfDayEquity,
      peakEquity,
      openPositions: adapter.openPositions,
      consecutiveLosses,
      recentBrokerErrors: 0,
      tradingHalted: false,
    };
    const decision = evaluate(config, account, found.signal);
    if (!decision.approved) {
      rejections[decision.reason] = (rejections[decision.reason] ?? 0) + 1;
      if (decision.reason === "total_drawdown_reached" && !haltReason) haltReason = decision.reason;
      continue;
    }

    const position = await adapter.placeOrder(decision.order);
    if (costBps > 0) adapter.charge(costOf(position.size, position.entryPrice));
    open = { position, levels: found.levels, entryTime: bar.t };
    stopDistances.push(found.levels.stopDistance);
    tradesToday++;
  }

  // Cierre forzado al final de los datos (no cuenta como señal de la estrategia).
  if (open) {
    const last = candles[candles.length - 1]!;
    await closeAt(last.c, last.t, "end_of_data");
  }

  const spanDays = (candles[candles.length - 1]!.t - candles[0]!.t) / 86400;
  return {
    trades,
    wins,
    losses,
    initialEquity,
    finalEquity: await adapter.getEquity(),
    maxDrawdownPct,
    grossProfit,
    grossLoss,
    haltReason,
    rejections,
    bars: candles.length,
    spanDays,
    ambiguousBars,
    stopDistances,
  };
}

export function summarize(r: GrabBacktestResult): {
  returnPct: number;
  annualizedPct: number;
  winRate: number;
  profitFactor: number;
  maxDdPct: number;
  trades: number;
} {
  const returnPct = ((r.finalEquity - r.initialEquity) / r.initialEquity) * 100;
  const years = r.spanDays / 365;
  return {
    returnPct,
    annualizedPct: years > 0 ? returnPct / years : 0,
    winRate: r.trades.length ? (r.wins / r.trades.length) * 100 : 0,
    profitFactor: r.grossLoss > 0 ? r.grossProfit / r.grossLoss : r.grossProfit > 0 ? Infinity : 0,
    maxDdPct: r.maxDrawdownPct * 100,
    trades: r.trades.length,
  };
}
