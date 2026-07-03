import { btcUsdDaily, btcUsdDailyRange } from "./data/btcUsdDaily";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { BacktestResult, runBacktest, returnPct } from "./tsmomBacktest";

const PARAMS: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 100, atrPeriod: 14, atrMult: 2 };
const INITIAL_EQUITY = 10000;

function report(label: string, r: BacktestResult): void {
  const winRate = r.trades ? (r.wins / r.trades) * 100 : 0;
  console.log(`\n── ${label} ──`);
  console.log(`  Operaciones:     ${r.trades} (aciertos ${r.wins} · win rate ${winRate.toFixed(1)}%)`);
  console.log(`  Equity final:    $${r.finalEquity.toFixed(2)}  (retorno ${returnPct(r) >= 0 ? "+" : ""}${returnPct(r).toFixed(1)}%)`);
  console.log(`  Max drawdown:    ${(r.maxDrawdownPct * 100).toFixed(1)}%`);
  console.log(`  Circuit breaker: ${r.haltedAt !== null ? `HALT en barra ${r.haltedAt} por ${r.haltReason}` : "no saltó"}`);
}

async function main(): Promise<void> {
  console.log(`Backtest TSMOM · BTC/USD diario · ${btcUsdDailyRange.first} → ${btcUsdDailyRange.last} (${btcUsdDaily.length} barras)`);
  console.log(`Parámetros: lookback ${PARAMS.lookback} · ATR ${PARAMS.atrPeriod}×${PARAMS.atrMult} · riesgo 1%/op · capital $${INITIAL_EQUITY}`);

  report("Config por defecto (breaker 4 pérdidas)", await runBacktest(btcUsdDaily, defaultRiskConfig, PARAMS, INITIAL_EQUITY));
  report(
    "Config TSMOM (breaker relajado a 12)",
    await runBacktest(btcUsdDaily, { ...defaultRiskConfig, maxConsecutiveLosses: 12 }, PARAMS, INITIAL_EQUITY),
  );
}

main().catch((error) => {
  console.error(`FALLO backtest: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
