import { derivIntradayM5 } from "./data/derivIntradayM5";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { BacktestResult, runBacktest, returnPct } from "./tsmomBacktest";

// Backtest de SCALPING (momentum intradía / TSMOM sobre velas M5 y M15) para EUR/USD, Oro y BTC.
// Objetivo: comprobar si queda ventaja NETA de costes ANTES de construir nada de ejecución.
// Mismo motor y risk gate REAL que el TSMOM diario; reutiliza runBacktest con barrido de costes.
//   node --import tsx src/backtest/runScalpBacktest.ts
//
// Nota honesta: el punto crítico del scalping es el coste por trade. El investigador estimó
// ~2 bps/lado en Deriv Multipliers + spread implícito no cuantificado. Barremos 0..8 bps/lado
// para ver DÓNDE se muere la ventaja. Breaker de rachas relajado para medir el edge crudo
// (en producción el kill-switch de 09_RISK lo acota).

const CORR: Record<string, string> = { EURUSD: "fx", Oro: "metal", BTCUSD: "crypto" };
// Parámetros de scalping: momentum corto sobre M5 (24 barras = 2h), stop más ajustado que TSMOM.
const SCALP = { lookback: 24, atrPeriod: 14, atrMult: 1.2 };
const CONFIG = { ...defaultRiskConfig, riskPerTradePct: 0.0025, maxConsecutiveLosses: 100000, totalDrawdownPct: 0.25 };
const INITIAL = 10000;
const COST_SWEEP = [0, 1, 2, 3, 4, 6, 8]; // bps por lado
const REALISTIC = 3; // bps/lado usado para el walk-forward in/out-sample

/** Downsample M5 -> M15 tomando cada 3ª vela de cierre. */
function toM15(m5: number[]): number[] {
  const out: number[] = [];
  for (let i = 2; i < m5.length; i += 3) out.push(m5[i]!);
  return out;
}

function params(symbol: string): TsmomParams {
  return { symbol, correlationGroup: CORR[symbol] ?? "misc", ...SCALP };
}

function row(label: string, r: BacktestResult, barsPerDay: number): void {
  const wr = r.trades ? (r.wins / r.trades) * 100 : 0;
  const days = r.equityCurve.length / barsPerDay;
  const perYear = returnPct(r) / (days / 365);
  console.log(
    `${label.padEnd(24)} ${(returnPct(r) >= 0 ? "+" : "") + returnPct(r).toFixed(1).padStart(7)}%  ` +
      `anualiz ${(perYear >= 0 ? "+" : "") + perYear.toFixed(0).padStart(5)}%  ` +
      `DD ${(r.maxDrawdownPct * 100).toFixed(1).padStart(5)}%  ` +
      `${String(r.trades).padStart(4)} ops  win ${wr.toFixed(0).padStart(2)}%`,
  );
}

async function runTF(asset: string, prices: number[], tf: string, barsPerDay: number): Promise<void> {
  console.log(`\n── ${asset} · ${tf} · ${prices.length} velas (~${(prices.length / barsPerDay).toFixed(0)} días) · lookback ${SCALP.lookback} · ATR ${SCALP.atrPeriod}×${SCALP.atrMult} ──`);
  console.log("Barrido de costes (bps/lado):");
  for (const cost of COST_SWEEP) {
    const r = await runBacktest(prices, CONFIG, params(asset), INITIAL, cost);
    row(`  ${cost} bps/lado`, r, barsPerDay);
  }
  // walk-forward a coste realista
  const half = Math.floor(prices.length / 2);
  const inS = prices.slice(0, half);
  const outS = prices.slice(half);
  console.log(`Walk-forward @ ${REALISTIC} bps/lado:`);
  row("  In-sample (1ª mitad)", await runBacktest(inS, CONFIG, params(asset), INITIAL, REALISTIC), barsPerDay);
  row("  Out-sample (2ª mitad)", await runBacktest(outS, CONFIG, params(asset), INITIAL, REALISTIC), barsPerDay);
}

async function main(): Promise<void> {
  console.log("BACKTEST SCALPING · momentum intradía M5/M15 · Deriv real · risk gate REAL");
  console.log(`riesgo ${(CONFIG.riskPerTradePct * 100).toFixed(2)}%/op · breaker relajado (mide edge crudo) · capital ${INITIAL}`);
  console.log("LEE: si a ~2-4 bps/lado el retorno ya es NEGATIVO o el out-sample no aguanta, los costes matan el edge → NO-GO.");

  for (const asset of Object.keys(derivIntradayM5)) {
    const m5 = derivIntradayM5[asset] ?? [];
    if (m5.length < 500) {
      console.log(`\n${asset}: datos insuficientes (${m5.length})`);
      continue;
    }
    await runTF(asset, m5, "M5", 288);
    await runTF(asset, toM15(m5), "M15", 96);
  }

  console.log("\nRecordatorio: esto es SOLO backtest sobre ~3-5 meses (muestra corta). Un GO real exige");
  console.log("más histórico + demo ≥4-6 semanas y ≥300 ops con edge neto positivo (criterio 09_RISK/27_SCALPING).");
}

main().catch((error) => {
  console.error(`FALLO backtest scalping: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
