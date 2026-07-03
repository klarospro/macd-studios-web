import { derivDaily } from "./data/derivDaily";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { BacktestResult, runBacktest, returnPct } from "./tsmomBacktest";

// Datos ~1 año de días hábiles → lookback más corto que el de BTC (250 vs 731 barras).
const LOOKBACK = 60;
const INITIAL_EQUITY = 10000;
// Trend following con breaker relajado (decisión tomada: RiskConfig por venue).
const CONFIG = { ...defaultRiskConfig, maxConsecutiveLosses: 12 };

async function main(): Promise<void> {
  console.log(`Backtest TSMOM multi-instrumento · velas diarias reales de Deriv`);
  console.log(`lookback ${LOOKBACK} · ATR 14×2 · riesgo 1%/op · capital $${INITIAL_EQUITY}/instrumento · breaker relajado\n`);
  console.log("Instrumento   Barras  Ops  WinRate  Retorno   MaxDD   Breaker");
  console.log("───────────────────────────────────────────────────────────────");

  const results: Array<{ name: string; r: BacktestResult }> = [];
  for (const [name, prices] of Object.entries(derivDaily)) {
    const params: TsmomParams = { symbol: name, correlationGroup: "multi", lookback: LOOKBACK, atrPeriod: 14, atrMult: 2 };
    const r = await runBacktest(prices, CONFIG, params, INITIAL_EQUITY);
    results.push({ name, r });
    const winRate = r.trades ? (r.wins / r.trades) * 100 : 0;
    const halt = r.haltedAt !== null ? `HALT@${r.haltedAt}` : "—";
    console.log(
      `${name.padEnd(12)}  ${String(prices.length).padStart(5)}  ${String(r.trades).padStart(3)}  ` +
        `${winRate.toFixed(0).padStart(6)}%  ${(returnPct(r) >= 0 ? "+" : "") + returnPct(r).toFixed(1).padStart(6)}%  ` +
        `${(r.maxDrawdownPct * 100).toFixed(1).padStart(5)}%  ${halt}`,
    );
  }

  // Cartera equiponderada: media de retornos por instrumento (cada uno con su propio $10k).
  const avgReturn = results.reduce((s, x) => s + returnPct(x.r), 0) / results.length;
  const winners = results.filter((x) => returnPct(x.r) > 0).length;
  const avgDd = (results.reduce((s, x) => s + x.r.maxDrawdownPct, 0) / results.length) * 100;
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`Cartera equiponderada: retorno medio ${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}% · ` +
    `${winners}/${results.length} instrumentos en positivo · DD medio ${avgDd.toFixed(1)}%`);
}

main().catch((error) => {
  console.error(`FALLO backtest multi: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
