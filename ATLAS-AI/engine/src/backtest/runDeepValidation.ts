import { btcUsdDaily10y } from "./data/btcUsdDaily10y";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { BacktestResult, runBacktest, returnPct } from "./tsmomBacktest";

// Validación profunda de la estrategia institucional (trend following / TSMOM) sobre 10 años
// de BTC diario real, con costes de trading y separación in-sample / out-of-sample (walk-forward
// simple): los MISMOS parámetros genéricos se prueban en la 2ª mitad, que la estrategia "no vio".
const PARAMS: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 100, atrPeriod: 14, atrMult: 2 };
const CONFIG = { ...defaultRiskConfig, maxConsecutiveLosses: 12 };
const INITIAL = 10000;
const COST_BPS = 10; // 0.10% por lado (comisión + spread + slippage), round-trip 0.20%

function cagr(r: BacktestResult, bars: number): number {
  const years = bars / 365;
  return (Math.pow(r.finalEquity / r.initialEquity, 1 / years) - 1) * 100;
}

function report(label: string, r: BacktestResult, bars: number): void {
  const wr = r.trades ? (r.wins / r.trades) * 100 : 0;
  console.log(
    `${label.padEnd(34)} ${(returnPct(r) >= 0 ? "+" : "") + returnPct(r).toFixed(1).padStart(7)}%  ` +
      `CAGR ${(cagr(r, bars) >= 0 ? "+" : "") + cagr(r, bars).toFixed(1).padStart(5)}%  ` +
      `DD ${(r.maxDrawdownPct * 100).toFixed(1).padStart(5)}%  ` +
      `${String(r.trades).padStart(3)} ops  win ${wr.toFixed(0).padStart(2)}%`,
  );
}

async function main(): Promise<void> {
  const n = btcUsdDaily10y.length;
  const half = Math.floor(n / 2);
  const inSample = btcUsdDaily10y.slice(0, half);
  const outSample = btcUsdDaily10y.slice(half);

  console.log(`Validación profunda TSMOM · BTC/USD diario · ${n} barras (~${(n / 365).toFixed(1)} años)`);
  console.log(`lookback ${PARAMS.lookback} · ATR 14×2 · riesgo 1%/op · breaker relajado · coste ${COST_BPS}bps/lado\n`);
  console.log(`${"".padEnd(34)} ${"Retorno".padStart(8)}  ${"".padStart(10)} ${"".padStart(9)}`);

  report("10 años · SIN costes", await runBacktest(btcUsdDaily10y, CONFIG, PARAMS, INITIAL, 0), n);
  report("10 años · CON costes", await runBacktest(btcUsdDaily10y, CONFIG, PARAMS, INITIAL, COST_BPS), n);
  console.log("");
  report("In-sample (1ª mitad, ~5a)", await runBacktest(inSample, CONFIG, PARAMS, INITIAL, COST_BPS), half);
  report("Out-of-sample (2ª mitad, ~5a)", await runBacktest(outSample, CONFIG, PARAMS, INITIAL, COST_BPS), n - half);

  console.log("\nLectura: si el out-of-sample (datos que la estrategia no 'vio' al fijar parámetros)");
  console.log("sigue positivo y con drawdown controlado, el edge es más creíble (no curve-fitting).");
}

main().catch((error) => {
  console.error(`FALLO validación: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
