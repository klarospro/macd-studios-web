import { existsSync, readFileSync } from "node:fs";
import { defaultRiskConfig, RiskConfig } from "../config/riskConfig";
import { defaultIctIfvgParams, IctIfvgParams } from "../strategy/ictIfvg";
import { Candle } from "../strategy/ictIfvg/types";
import { IctIfvgBacktestResult, runIctIfvgBacktest, summarizeIctIfvg } from "./ictIfvgBacktest";

// Validación en profundidad de ICT IFVG (NQ) — mismo tratamiento de rigor que ya se le dio a
// Liquidity Grab en runLiquidityGrab.ts: edge crudo sin kill-switches, barrido de costes,
// walk-forward, y sensibilidad a los parámetros ambiguos de la spec (28_ESTRATEGIA_ICT_IFVG/
// 05_PREGUNTAS_ABIERTAS.md). Datos: Yahoo Finance NQ=F 5M (~71 días, límite gratis de Yahoo para
// intradía) + 1D/4H para el bias. Fuente aprobada explícitamente por Moisés.
//
//   node --import tsx src/backtest/runIctIfvgDeepValidation.ts

const M5_PATH = new URL("./data/nqUsdM5.csv", import.meta.url);
const DAILY_PATH = new URL("./data/nqUsdDaily.csv", import.meta.url);
const H4_PATH = new URL("./data/nqUsd4h.csv", import.meta.url);

const INITIAL = 50_000;
const COST_SWEEP = [0, 1, 2, 4, 8]; // bps por lado sobre el `size` continuo del riskGate (proxy, no calibrado a comisión real de NQ — ver 05_PREGUNTAS_ABIERTAS.md #11)
const REALISTIC = 1;

const SPEC_CONFIG: RiskConfig = {
  ...defaultRiskConfig,
  riskPerTradePct: 0.005,
  dailyDrawdownPct: 0.01,
  dailyDrawdownReducePct: 0.005,
  maxConcurrentPositions: 1,
};
// Sin kill-switches: mide el edge ANTES de que el riesgo lo acote (no operable, sirve para ver si existe).
const RAW_CONFIG: RiskConfig = { ...SPEC_CONFIG, dailyDrawdownPct: 1, totalDrawdownPct: 1 };

function params(overrides: Partial<IctIfvgParams> = {}): IctIfvgParams {
  return { symbol: "NQ", correlationGroup: "nasdaq_index", ...defaultIctIfvgParams, ...overrides };
}

function parseCandleCsv(raw: string): Candle[] {
  const lines = raw.trim().split("\n").slice(1);
  return lines.map((line) => {
    const [t, o, h, l, c] = line.split(",").map(Number);
    return { t: t!, o: o!, h: h!, l: l!, c: c! };
  });
}

function loadCandles(url: URL, label: string): Candle[] {
  if (!existsSync(url)) throw new Error(`falta ${label}: ${url.pathname}`);
  const candles = parseCandleCsv(readFileSync(url, "utf8"));
  if (candles.length === 0) throw new Error(`${label} vacío`);
  return candles;
}

function row(label: string, r: IctIfvgBacktestResult): void {
  const s = summarizeIctIfvg(r);
  const pf = s.profitFactor === Infinity ? "  inf" : s.profitFactor.toFixed(2).padStart(5);
  console.log(
    `${label.padEnd(30)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(2).padStart(7)}%  ` +
      `DD ${s.maxDdPct.toFixed(2).padStart(5)}%  ` +
      `${String(s.numTrades).padStart(3)} ops  ` +
      `win ${s.winRate.toFixed(1).padStart(5)}%  PF ${pf}  ` +
      `expect $${s.expectancy.toFixed(1).padStart(6)}` +
      (r.killSwitchDays > 0 ? `  [kill: ${r.killSwitchDays}d]` : ""),
  );
}

async function main(): Promise<void> {
  const m5 = loadCandles(M5_PATH, "NQ 5M");
  const daily = loadCandles(DAILY_PATH, "NQ 1D");
  const h4 = loadCandles(H4_PATH, "NQ 4H");

  const first = m5[0]!;
  const last = m5[m5.length - 1]!;
  const days = (last.t - first.t) / 86400;

  console.log("═".repeat(100));
  console.log("VALIDACIÓN EN PROFUNDIDAD · ICT IFVG · NQ (Yahoo Finance NQ=F) · 28_ESTRATEGIA_ICT_IFVG");
  console.log("═".repeat(100));
  console.log(
    `${m5.length} velas 5M · ${new Date(first.t * 1000).toISOString().slice(0, 10)} → ` +
      `${new Date(last.t * 1000).toISOString().slice(0, 10)} (${days.toFixed(0)} días naturales, ` +
      `límite gratis de Yahoo para 5M — NO es una muestra de años)`,
  );
  console.log("Definición de entrada usada: cierre de la vela de inversión del IFVG (NO retest) — ver pregunta abierta #1.");
  console.log("");

  console.log("── 1. CORRIDA PRINCIPAL (reglas de la spec, coste 1bp/lado) ──");
  row("  principal", await runIctIfvgBacktest(m5, daily, h4, SPEC_CONFIG, params(), INITIAL, REALISTIC));

  console.log("\n── 2. EDGE CRUDO (sin kill-switches, barrido de costes) ──");
  for (const cost of COST_SWEEP) {
    row(`  ${cost} bps/lado`, await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params(), INITIAL, cost));
  }

  console.log("\n── 3. WALK-FORWARD @ 1bp/lado (sin kill-switches) — muestra pequeña, lectura direccional únicamente ──");
  const half = Math.floor(m5.length / 2);
  row("  1ª mitad (in-sample)", await runIctIfvgBacktest(m5.slice(0, half), daily, h4, RAW_CONFIG, params(), INITIAL, REALISTIC));
  row("  2ª mitad (out-sample)", await runIctIfvgBacktest(m5.slice(half), daily, h4, RAW_CONFIG, params(), INITIAL, REALISTIC));
  const q = Math.floor(m5.length / 4);
  for (let k = 0; k < 4; k++) {
    const slice = m5.slice(k * q, (k + 1) * q);
    row(`  cuarto ${k + 1}`, await runIctIfvgBacktest(slice, daily, h4, RAW_CONFIG, params(), INITIAL, REALISTIC));
  }

  console.log("\n── 4. SENSIBILIDAD AL GAP MÍNIMO DEL IFVG (spec: rango 3-5pt, sin kill-switches, 1bp/lado) ──");
  for (const gap of [3, 4, 5]) {
    row(`  minGapPoints ${gap}`, await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ minGapPoints: gap }), INITIAL, REALISTIC));
  }

  console.log("\n── 5. SENSIBILIDAD AL MULTIPLICADOR DE ATR DEL STOP (spec: 1.5x, sin kill-switches, 1bp/lado) ──");
  for (const mult of [1.0, 1.5, 2.0]) {
    row(`  atrMultiplier ${mult}`, await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ atrMultiplier: mult }), INITIAL, REALISTIC));
  }

  console.log("\n── 6. SENSIBILIDAD AL MODO DE BIAS (pregunta abierta #4, sin kill-switches, 1bp/lado) ──");
  row("  strict (1D Y 4H de acuerdo)", await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ biasMode: "strict" }), INITIAL, REALISTIC));
  row("  daily_leads (1D manda)", await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ biasMode: "daily_leads" }), INITIAL, REALISTIC));

  console.log("\n── 6b. SENSIBILIDAD AL MODO DE ENTRADA (pregunta abierta #1, sin kill-switches, 1bp/lado) ──");
  console.log("  (retest puede tardar más en correr — escanea retroceso por día)");
  row("  close (al cierre de la inversión)", await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ entryMode: "close" }), INITIAL, REALISTIC));
  row("  retest (espera volver a la zona)", await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ entryMode: "retest" }), INITIAL, REALISTIC));
  console.log("  combinando retest + daily_leads:");
  row(
    "  retest + daily_leads",
    await runIctIfvgBacktest(m5, daily, h4, RAW_CONFIG, params({ entryMode: "retest", biasMode: "daily_leads" }), INITIAL, REALISTIC),
  );

  console.log("\n── 7. DESGLOSE DE LA CORRIDA PRINCIPAL ──");
  const main0 = await runIctIfvgBacktest(m5, daily, h4, SPEC_CONFIG, params(), INITIAL, REALISTIC);
  const byOutcome = main0.trades.reduce<Record<string, number>>((acc, t) => {
    acc[t.outcome] = (acc[t.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  operaciones: ${main0.trades.length} · salidas: ${JSON.stringify(byOutcome)}`);
  console.log(`  rechazos del risk gate: ${JSON.stringify(main0.rejections)}`);
  console.log(`  días con kill switch: ${main0.killSwitchDays}`);
  const maeAvg = main0.trades.reduce((s, t) => s + t.maePoints, 0) / Math.max(1, main0.trades.length);
  const mfeAvg = main0.trades.reduce((s, t) => s + t.mfePoints, 0) / Math.max(1, main0.trades.length);
  console.log(`  MAE medio: ${maeAvg.toFixed(1)}pt · MFE medio: ${mfeAvg.toFixed(1)}pt`);

  console.log("\n" + "═".repeat(100));
  console.log("LECTURA: 19 operaciones en ~71 días NO es una muestra estadísticamente fiable (referencia: TSMOM y");
  console.log("Liquidity Grab se validaron sobre 1-2 años). Esto es un indicio direccional, no un veredicto GO/NO-GO.");
  console.log("Antes de cualquier decisión real: repetir esto sobre más historia (Yahoo 5M solo da 60-71 días;");
  console.log("hace falta una fuente con más profundidad, o esperar y acumular más datos en vivo/paper) y confirmar");
  console.log("la definición de entrada (pregunta abierta #1) — puede cambiar el resultado por completo.");
  console.log("═".repeat(100));
}

main().catch((error) => {
  console.error(`FALLO validación ICT IFVG: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
