import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { btcUsdDaily, btcUsdDailyRange } from "./data/btcUsdDaily";
import { derivDaily } from "./data/derivDaily";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { runBacktest, returnPct } from "./tsmomBacktest";

const INITIAL = 10000;
const TUNED = { ...defaultRiskConfig, maxConsecutiveLosses: 12 };

// Submuestrea una curva larga a ~120 puntos para el gráfico.
function downsample(curve: number[], target = 120): number[] {
  if (curve.length <= target) return curve;
  const step = curve.length / target;
  const out: number[] = [];
  for (let k = 0; k < target; k++) out.push(curve[Math.floor(k * step)] ?? curve[curve.length - 1]!);
  out.push(curve[curve.length - 1]!);
  return out;
}

async function main(): Promise<void> {
  const btcParams: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 100, atrPeriod: 14, atrMult: 2 };
  const btcDefault = await runBacktest(btcUsdDaily, defaultRiskConfig, btcParams, INITIAL);
  const btcTuned = await runBacktest(btcUsdDaily, TUNED, btcParams, INITIAL);

  const instruments: Array<Record<string, unknown>> = [];
  const curves: Record<string, number[]> = {};
  for (const [name, prices] of Object.entries(derivDaily)) {
    const params: TsmomParams = { symbol: name, correlationGroup: "multi", lookback: 60, atrPeriod: 14, atrMult: 2 };
    const r = await runBacktest(prices, TUNED, params, INITIAL);
    instruments.push({
      name,
      bars: prices.length,
      trades: r.trades,
      wins: r.wins,
      winRate: r.trades ? (r.wins / r.trades) * 100 : 0,
      returnPct: returnPct(r),
      maxDrawdownPct: r.maxDrawdownPct * 100,
      halted: r.haltedAt !== null,
    });
    curves[name] = downsample(r.equityCurve);
  }

  const avgReturn = instruments.reduce((s, x) => s + (x.returnPct as number), 0) / instruments.length;
  const winners = instruments.filter((x) => (x.returnPct as number) > 0).length;
  const avgDd = instruments.reduce((s, x) => s + (x.maxDrawdownPct as number), 0) / instruments.length;

  const data = {
    generatedAt: new Date().toISOString(),
    range: btcUsdDailyRange,
    btc: {
      default: { returnPct: returnPct(btcDefault), trades: btcDefault.trades, winRate: (btcDefault.wins / btcDefault.trades) * 100, maxDd: btcDefault.maxDrawdownPct * 100, haltedAt: btcDefault.haltedAt, curve: downsample(btcDefault.equityCurve) },
      tuned: { returnPct: returnPct(btcTuned), trades: btcTuned.trades, winRate: (btcTuned.wins / btcTuned.trades) * 100, maxDd: btcTuned.maxDrawdownPct * 100, haltedAt: btcTuned.haltedAt, curve: downsample(btcTuned.equityCurve) },
    },
    portfolio: { avgReturn, winners, total: instruments.length, avgDd },
    instruments,
    curves,
  };

  const outDir = fileURLToPath(new URL("../../runtime/", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  const outPath = fileURLToPath(new URL("../../runtime/dashboard.json", import.meta.url));
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Escrito ${outPath}`);
  console.log(JSON.stringify({ btcTuned: data.btc.tuned.returnPct, portfolio: data.portfolio }, null, 2));
}

main().catch((error) => {
  console.error(`FALLO export: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
