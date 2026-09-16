import { existsSync, readFileSync } from "node:fs";
import { defaultRiskConfig, RiskConfig } from "../config/riskConfig";
import { defaultIctIfvgParams, IctIfvgParams } from "../strategy/ictIfvg";
import { Candle } from "../strategy/ictIfvg/types";
import { IctIfvgBacktestResult, runIctIfvgBacktest, summarizeIctIfvg } from "./ictIfvgBacktest";

// Runner de backtest de ICT IFVG (NQ) — 28_ESTRATEGIA_ICT_IFVG.
//
//   node --import tsx src/backtest/runIctIfvg.ts
//
// NO descarga ni inventa datos. Si los CSV de abajo no existen en el repo, lo dice explícitamente
// y termina con exit code 1 (regla dura de la tarea nocturna: no simular con datos sintéticos).
// Formato de CSV esperado, mismo por archivo: cabecera `t,o,h,l,c` con `t` en epoch SEGUNDOS UTC
// (igual convención que el resto del motor — ver 04_PLAN_BACKTEST.md para el detalle completo).

const M5_PATH = new URL("./data/nqUsdM5.csv", import.meta.url);
const DAILY_PATH = new URL("./data/nqUsdDaily.csv", import.meta.url);
const H4_PATH = new URL("./data/nqUsd4h.csv", import.meta.url);

const INITIAL_EQUITY = 50_000;
const REALISTIC_COST_BPS = 1; // placeholder documentado — coste real de NQ sin confirmar, ver 05_PREGUNTAS_ABIERTAS.md

const SPEC_CONFIG: RiskConfig = {
  ...defaultRiskConfig,
  riskPerTradePct: 0.005,
  dailyDrawdownPct: 0.01,
  dailyDrawdownReducePct: 0.005,
  maxConcurrentPositions: 1,
};

function params(overrides: Partial<IctIfvgParams> = {}): IctIfvgParams {
  return { symbol: "NQ", correlationGroup: "nasdaq_index", ...defaultIctIfvgParams, ...overrides };
}

/** Parser de CSV mínimo, sin dependencias nuevas: cabecera `t,o,h,l,c`, separador coma. */
function parseCandleCsv(raw: string): Candle[] {
  const lines = raw.trim().split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((h) => h.trim());
  const col = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`columna requerida ausente en el CSV: "${name}" (cabecera: ${header.join(",")})`);
    return idx;
  };
  const iT = col("t");
  const iO = col("o");
  const iH = col("h");
  const iL = col("l");
  const iC = col("c");

  return lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(",");
    const t = Number(cells[iT]);
    const o = Number(cells[iO]);
    const h = Number(cells[iH]);
    const l = Number(cells[iL]);
    const c = Number(cells[iC]);
    if ([t, o, h, l, c].some((v) => Number.isNaN(v))) {
      throw new Error(`fila ${rowIndex + 2} con valor no numérico: "${line}"`);
    }
    return { t, o, h, l, c };
  });
}

function loadCandles(url: URL, label: string): Candle[] | null {
  if (!existsSync(url)) return null;
  const raw = readFileSync(url, "utf8");
  const candles = parseCandleCsv(raw);
  if (candles.length === 0) throw new Error(`${label} existe pero está vacío o sin filas válidas: ${url.pathname}`);
  return candles;
}

function row(label: string, r: IctIfvgBacktestResult): void {
  const s = summarizeIctIfvg(r);
  const pf = s.profitFactor === Infinity ? "  inf" : s.profitFactor.toFixed(2).padStart(5);
  console.log(
    `${label.padEnd(28)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1).padStart(7)}%  ` +
      `DD ${s.maxDdPct.toFixed(1).padStart(5)}%  ` +
      `${String(s.numTrades).padStart(4)} ops  ` +
      `win ${s.winRate.toFixed(1).padStart(4)}%  PF ${pf}  ` +
      `expect $${s.expectancy.toFixed(0)}  ` +
      `MAE/MFE avg ${s.avgMaePoints.toFixed(1)}/${s.avgMfePoints.toFixed(1)}pt` +
      (r.killSwitchDays > 0 ? `  [kill-switch: ${r.killSwitchDays} día(s)]` : ""),
  );
}

async function main(): Promise<void> {
  console.log("═".repeat(96));
  console.log("BACKTEST · ICT IFVG · NQ (E-mini Nasdaq) · 28_ESTRATEGIA_ICT_IFVG");
  console.log("═".repeat(96));

  const m5 = loadCandles(M5_PATH, "Velas 5M de NQ");
  const daily = loadCandles(DAILY_PATH, "Velas 1D de NQ");
  const h4 = loadCandles(H4_PATH, "Velas 4H de NQ");

  const missing: string[] = [];
  if (!m5) missing.push(`5M -> ${M5_PATH.pathname}`);
  if (!daily) missing.push(`1D -> ${DAILY_PATH.pathname}`);
  if (!h4) missing.push(`4H -> ${H4_PATH.pathname}`);

  if (missing.length > 0) {
    console.log("\nFaltan datos reales de NQ. NO se generan datos sintéticos ni se descarga nada (regla dura).");
    console.log("Archivos CSV esperados (cabecera `t,o,h,l,c`, t = epoch en SEGUNDOS UTC):");
    for (const m of missing) console.log(`  - ${m}`);
    console.log("\nVer 28_ESTRATEGIA_ICT_IFVG/04_PLAN_BACKTEST.md para el formato exacto y de dónde obtenerlos.");
    process.exitCode = 1;
    return;
  }

  const candlesM5 = m5!;
  const candlesDaily = daily!;
  const candlesH4 = h4!;

  const first = candlesM5[0]!;
  const last = candlesM5[candlesM5.length - 1]!;
  const days = (last.t - first.t) / 86400;
  console.log(
    `${candlesM5.length} velas 5M · ${new Date(first.t * 1000).toISOString().slice(0, 10)} → ` +
      `${new Date(last.t * 1000).toISOString().slice(0, 10)} (${days.toFixed(0)} días naturales)`,
  );
  console.log(`Riesgo 0,5%/op · ventana 9:30-10:10 NY · gap mínimo ${params().minGapPoints}pt · capital ${INITIAL_EQUITY}`);

  const result = await runIctIfvgBacktest(candlesM5, candlesDaily, candlesH4, SPEC_CONFIG, params(), INITIAL_EQUITY, REALISTIC_COST_BPS);
  row("  corrida principal", result);

  const byOutcome = result.trades.reduce<Record<string, number>>((acc, t) => {
    acc[t.outcome] = (acc[t.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n  salidas: ${JSON.stringify(byOutcome)}`);
  console.log(`  rechazos del risk gate: ${JSON.stringify(result.rejections)}`);
  console.log(`  días con kill switch activado: ${result.killSwitchDays}`);

  console.log("\n" + "═".repeat(96));
  console.log("Sin walk-forward ni barrido de sensibilidad todavía: primero verificar que el edge crudo");
  console.log("existe con los datos reales antes de invertir tiempo en variantes. Ver 05_PREGUNTAS_ABIERTAS.md.");
  console.log("═".repeat(96));
}

main().catch((error) => {
  console.error(`FALLO backtest ICT IFVG: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
