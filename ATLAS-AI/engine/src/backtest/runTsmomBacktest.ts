import { btcUsdDaily, btcUsdDailyRange } from "./data/btcUsdDaily";
import { tsmomSignal, TsmomParams } from "../strategy/tsmom";
import { BacktestAdapter } from "./backtestAdapter";
import { evaluate } from "../risk/riskGate";
import { defaultRiskConfig, RiskConfig } from "../config/riskConfig";
import { AccountState, Position } from "../domain/types";

const PARAMS: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 100, atrPeriod: 14, atrMult: 2 };
const INITIAL_EQUITY = 10000;

interface Result {
  label: string;
  trades: number;
  wins: number;
  finalEquity: number;
  peakEquity: number;
  maxDrawdownPct: number;
  haltedAt: string | null;
  haltReason: string | null;
}

function px(prices: number[], i: number): number {
  const v = prices[i];
  if (v === undefined) throw new Error(`índice ${i} fuera de rango`);
  return v;
}

async function runBacktest(label: string, prices: number[], config: RiskConfig): Promise<Result> {
  const adapter = new BacktestAdapter(INITIAL_EQUITY);
  let open: Position | null = null;
  let consecutiveLosses = 0;
  let peakEquity = INITIAL_EQUITY;
  let maxDrawdownPct = 0;
  let trades = 0;
  let wins = 0;
  let haltedAt: string | null = null;
  let haltReason: string | null = null;

  const closeOpen = async (): Promise<void> => {
    if (!open) return;
    const before = await adapter.getEquity();
    await adapter.closePosition(open.id);
    const after = await adapter.getEquity();
    const pnl = after - before;
    trades++;
    if (pnl > 0) {
      wins++;
      consecutiveLosses = 0;
    } else {
      consecutiveLosses++;
    }
    open = null;
  };

  for (let i = 0; i < prices.length; i++) {
    const price = px(prices, i);
    adapter.currentPrice = price;

    // 1. Gestión de la posición abierta: stop o cambio de tendencia.
    if (open) {
      const stopHit = open.side === "buy" ? price <= open.stopPrice : price >= open.stopPrice;
      const desired = tsmomSignal(prices, i, PARAMS);
      const trendFlipped = !desired || desired.side !== open.side;
      if (stopHit || trendFlipped) await closeOpen();
    }

    // Curva de equity realizada + drawdown desde máximo.
    const equity = await adapter.getEquity();
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peakEquity - equity) / peakEquity);

    // 2. Nueva entrada (solo si no hay posición abierta).
    if (!open) {
      const signal = tsmomSignal(prices, i, PARAMS);
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
          haltedAt = `barra ${i}`;
          haltReason = decision.reason;
        }
      }
    }
  }

  await closeOpen();
  const finalEquity = await adapter.getEquity();
  return { label, trades, wins, finalEquity, peakEquity, maxDrawdownPct, haltedAt, haltReason };
}

function report(r: Result): void {
  const ret = ((r.finalEquity - INITIAL_EQUITY) / INITIAL_EQUITY) * 100;
  const winRate = r.trades ? (r.wins / r.trades) * 100 : 0;
  console.log(`\n── ${r.label} ──`);
  console.log(`  Operaciones:     ${r.trades} (aciertos ${r.wins} · win rate ${winRate.toFixed(1)}%)`);
  console.log(`  Equity final:    $${r.finalEquity.toFixed(2)}  (retorno ${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%)`);
  console.log(`  Pico de equity:  $${r.peakEquity.toFixed(2)}`);
  console.log(`  Max drawdown:    ${(r.maxDrawdownPct * 100).toFixed(1)}%`);
  console.log(`  Circuit breaker: ${r.haltedAt ? `HALT en ${r.haltedAt} por ${r.haltReason}` : "no saltó"}`);
}

async function main(): Promise<void> {
  console.log(`Backtest TSMOM · BTC/USD diario · ${btcUsdDailyRange.first} → ${btcUsdDailyRange.last} (${btcUsdDaily.length} barras)`);
  console.log(`Parámetros: lookback ${PARAMS.lookback} · ATR ${PARAMS.atrPeriod}×${PARAMS.atrMult} · riesgo 1%/op · capital inicial $${INITIAL_EQUITY}`);

  report(await runBacktest("Config por defecto (breaker 4 pérdidas)", btcUsdDaily, defaultRiskConfig));
  report(await runBacktest("Config TSMOM (breaker pérdidas relajado a 12)", btcUsdDaily, { ...defaultRiskConfig, maxConsecutiveLosses: 12 }));
}

main().catch((error) => {
  console.error(`FALLO backtest: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
