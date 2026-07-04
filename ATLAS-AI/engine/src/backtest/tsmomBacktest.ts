import { tsmomSignal, TsmomParams } from "../strategy/tsmom";
import { BacktestAdapter } from "./backtestAdapter";
import { evaluate } from "../risk/riskGate";
import { RiskConfig } from "../config/riskConfig";
import { AccountState, Position } from "../domain/types";

export interface BacktestResult {
  trades: number;
  wins: number;
  initialEquity: number;
  finalEquity: number;
  peakEquity: number;
  maxDrawdownPct: number;
  haltedAt: number | null;
  haltReason: string | null;
  equityCurve: number[];
}

function px(prices: number[], i: number): number {
  const v = prices[i];
  if (v === undefined) throw new Error(`índice ${i} fuera de rango`);
  return v;
}

/**
 * Backtest de una sola serie con TSMOM pasando por el risk gate REAL (evaluate).
 * Una posición a la vez; salida por stop o por cambio de tendencia. Equity realizada.
 * Simplificaciones honestas: solo cierres, sin comisiones/swaps/slippage, sin marca a
 * mercado del abierto para el drawdown. Determinista y sin red.
 */
export async function runBacktest(
  prices: number[],
  config: RiskConfig,
  params: TsmomParams,
  initialEquity: number,
  costBps = 0,
): Promise<BacktestResult> {
  const adapter = new BacktestAdapter(initialEquity);
  let open: Position | null = null;
  let consecutiveLosses = 0;
  let peakEquity = initialEquity;
  let maxDrawdownPct = 0;
  let trades = 0;
  let wins = 0;
  let haltedAt: number | null = null;
  let haltReason: string | null = null;
  const equityCurve: number[] = [];

  const closeOpen = async (): Promise<void> => {
    if (!open) return;
    const before = await adapter.getEquity();
    const exitPrice = adapter.currentPrice;
    await adapter.closePosition(open.id);
    // Coste round-trip (comisión + spread + slippage) sobre el nocional de entrada y salida.
    if (costBps > 0) adapter.charge((costBps / 10000) * open.size * (open.entryPrice + exitPrice));
    const after = await adapter.getEquity();
    if (after - before > 0) {
      wins++;
      consecutiveLosses = 0;
    } else {
      consecutiveLosses++;
    }
    trades++;
    open = null;
  };

  for (let i = 0; i < prices.length; i++) {
    adapter.currentPrice = px(prices, i);

    if (open) {
      const stopHit = open.side === "buy" ? adapter.currentPrice <= open.stopPrice : adapter.currentPrice >= open.stopPrice;
      const desired = tsmomSignal(prices, i, params);
      if (stopHit || !desired || desired.side !== open.side) await closeOpen();
    }

    const equity = await adapter.getEquity();
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peakEquity - equity) / peakEquity);
    equityCurve.push(equity);

    if (!open) {
      const signal = tsmomSignal(prices, i, params);
      if (signal) {
        const account: AccountState = {
          equity,
          startOfDayEquity: equity,
          peakEquity,
          openPositions: adapter.openPositions,
          consecutiveLosses,
          recentBrokerErrors: 0,
          tradingHalted: false,
        };
        const decision = evaluate(config, account, signal);
        if (decision.approved) {
          open = await adapter.placeOrder(decision.order);
        } else if (!haltedAt && (decision.reason === "circuit_breaker_losses" || decision.reason === "total_drawdown_reached")) {
          haltedAt = i;
          haltReason = decision.reason;
        }
      }
    }
  }

  await closeOpen();
  return {
    trades,
    wins,
    initialEquity,
    finalEquity: await adapter.getEquity(),
    peakEquity,
    maxDrawdownPct,
    haltedAt,
    haltReason,
    equityCurve,
  };
}

export function returnPct(r: BacktestResult): number {
  return ((r.finalEquity - r.initialEquity) / r.initialEquity) * 100;
}
