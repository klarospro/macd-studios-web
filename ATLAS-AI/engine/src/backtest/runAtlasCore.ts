import { readFileSync } from "node:fs";
import { AtlasCoreParams, defaultAtlasCoreParams } from "../strategy/atlasCore";
import {
  AlignedUniverse,
  Metrics,
  PortfolioResult,
  UniverseEntry,
  alignUniverse,
  correlation,
  metrics,
  monthlyReturns,
  runPortfolioBacktest,
} from "./atlasCoreBacktest";

// Validación de ATLAS CORE sobre 25 años de datos diarios reales, 28 instrumentos, 7 clases de
// activo. Incluye ESTUDIO DE ABLACIÓN: se apaga cada decisión de diseño por separado para ver
// cuál aporta de verdad y cuál es adorno. Sin eso, "funciona" no significa nada.
//
//   node --import tsx src/backtest/runAtlasCore.ts

const DATA = new URL("./data/longUniverse.json", import.meta.url);
const COST_BPS = 2; // sobre rotación; los futuros líquidos están en este orden o por debajo

function load(): AlignedUniverse {
  const raw = JSON.parse(readFileSync(DATA, "utf8")) as Record<string, UniverseEntry>;
  return alignUniverse(raw);
}

function params(over: Partial<AtlasCoreParams> = {}): AtlasCoreParams {
  return { ...defaultAtlasCoreParams, ...over };
}

function header(): void {
  console.log(
    `${"".padEnd(30)} ${"CAGR".padStart(7)} ${"Vol".padStart(6)} ${"Sharpe".padStart(7)} ` +
      `${"MaxDD".padStart(7)} ${"Calmar".padStart(7)} ${"MesNeg".padStart(7)} ${"PeorMes".padStart(8)}`,
  );
  console.log("─".repeat(92));
}

function row(label: string, m: Metrics): void {
  console.log(
    `${label.padEnd(30)} ${(m.cagr >= 0 ? "+" : "") + m.cagr.toFixed(1).padStart(6)}% ${m.vol.toFixed(1).padStart(5)}% ` +
      `${m.sharpe.toFixed(2).padStart(7)} ${m.maxDd.toFixed(1).padStart(6)}% ${m.calmar.toFixed(2).padStart(7)} ` +
      `${m.negativeMonthsPct.toFixed(0).padStart(6)}% ${m.worstMonth.toFixed(1).padStart(7)}%`,
  );
}

/** Comprar y mantener un instrumento, como referencia honesta. */
function buyAndHold(u: AlignedUniverse, name: string, from: number): PortfolioResult {
  const prices = u.series[name]!;
  const start = Math.max(from, u.startIndex[name] ?? 0);
  const equityCurve: number[] = [];
  const dailyReturns: number[] = [];
  const dates: number[] = [];
  let equity = 1;
  for (let t = start; t < prices.length - 1; t++) {
    const p0 = prices[t]!;
    const p1 = prices[t + 1]!;
    if (p0 <= 0) continue;
    const r = p1 / p0 - 1;
    equity *= 1 + r;
    equityCurve.push(equity);
    dailyReturns.push(r);
    dates.push(u.dates[t + 1]!);
  }
  return { equityCurve, dates, dailyReturns, avgTurnover: 0, avgPositions: 1, avgGrossExposure: 1 };
}

function main(): void {
  const u = load();
  const names = Object.keys(u.series);
  const byGroup = new Map<string, string[]>();
  for (const [name, group] of Object.entries(u.groups)) {
    byGroup.set(group, [...(byGroup.get(group) ?? []), name]);
  }

  console.log("═".repeat(92));
  console.log("ATLAS CORE · momentum multi-horizonte + dimensionamiento por volatilidad · CARTERA");
  console.log("═".repeat(92));
  console.log(
    `${names.length} instrumentos · ${byGroup.size} clases · ${u.dates.length} días · ` +
      `${new Date(u.dates[0]! * 1000).toISOString().slice(0, 10)} → ${new Date(u.dates[u.dates.length - 1]! * 1000).toISOString().slice(0, 10)}`,
  );
  for (const [group, list] of byGroup) console.log(`  ${group.padEnd(8)}: ${list.join(", ")}`);
  console.log(`\nHorizontes ${defaultAtlasCoreParams.lookbacks.join("/")} días · vol objetivo ${(defaultAtlasCoreParams.targetVol * 100).toFixed(0)}% · coste ${COST_BPS} bps sobre rotación`);

  // ── 1. Estudio de ablación: ¿qué decisión de diseño aporta realmente? ──
  console.log("\n── 1. ABLACIÓN: se apaga una pieza cada vez para aislar su aporte ──");
  header();

  const full = runPortfolioBacktest(u, params(), COST_BPS);
  const mFull = metrics(full);
  row("ATLAS CORE (completo)", mFull);
  row("  sin ensemble (1 horizonte)", metrics(runPortfolioBacktest(u, params({ useEnsemble: false }), COST_BPS)));
  row("  sin vol targeting", metrics(runPortfolioBacktest(u, params({ useVolTargeting: false }), COST_BPS)));
  row("  señal de signo (±1)", metrics(runPortfolioBacktest(u, params({ signalMode: "sign" }), COST_BPS)));
  row("  sin banda de no-negociación", metrics(runPortfolioBacktest(u, params({ noTradeBand: 0 }), COST_BPS)));
  console.log("  · frecuencia de rebalanceo ·");
  for (const every of [1, 5, 10, 21, 42, 63]) {
    const r = runPortfolioBacktest(u, params({ rebalanceEvery: every }), COST_BPS);
    const label = every === 1 ? "diario" : every === 21 ? "mensual" : every === 63 ? "trimestral" : `cada ${every}d`;
    console.log(
      `${`    rebal. ${label}`.padEnd(30)} ${(metrics(r).cagr >= 0 ? "+" : "") + metrics(r).cagr.toFixed(1).padStart(6)}% ` +
        `${metrics(r).vol.toFixed(1).padStart(5)}% ${metrics(r).sharpe.toFixed(2).padStart(7)} ` +
        `${metrics(r).maxDd.toFixed(1).padStart(6)}% ${metrics(r).calmar.toFixed(2).padStart(7)} ` +
        `${metrics(r).negativeMonthsPct.toFixed(0).padStart(6)}% ${metrics(r).worstMonth.toFixed(1).padStart(7)}%` +
        `   rot.${(r.avgTurnover * 100).toFixed(1)}%/día`,
    );
  }

  // Solo los 5 instrumentos que Atlas usa hoy: aísla el efecto de diversificar.
  const currentFive = ["BTCUSD", "Oro", "US30", "Nasdaq", "EURUSD"].filter((n) => names.includes(n));
  row(`  solo ${currentFive.length} instrumentos (Atlas hoy)`, metrics(runPortfolioBacktest(u, params(), COST_BPS, currentFive)));

  // ── 2. Referencia pasiva ──
  console.log("\n── 2. REFERENCIA: comprar y mantener ──");
  header();
  const firstDay = Math.max(...defaultAtlasCoreParams.lookbacks, defaultAtlasCoreParams.volWindow);
  const bh = buyAndHold(u, "SP500", firstDay);
  row("S&P 500 (comprar y mantener)", metrics(bh));
  row("Oro (comprar y mantener)", metrics(buyAndHold(u, "Oro", firstDay)));

  // ── 3. Sensibilidad a costes ──
  console.log("\n── 3. SENSIBILIDAD A COSTES (bps sobre rotación) ──");
  header();
  for (const cost of [0, 1, 2, 5, 10, 20]) {
    row(`  ${cost} bps`, metrics(runPortfolioBacktest(u, params(), cost)));
  }

  // ── 4. Walk-forward por periodos de 5 años ──
  console.log("\n── 4. WALK-FORWARD: mismos parámetros en cada tramo de ~5 años ──");
  header();
  const total = u.dates.length;
  const chunk = Math.floor(total / 5);
  for (let k = 0; k < 5; k++) {
    const slice: AlignedUniverse = {
      dates: u.dates.slice(k * chunk, (k + 1) * chunk),
      series: Object.fromEntries(Object.entries(u.series).map(([n, s]) => [n, s.slice(k * chunk, (k + 1) * chunk)])),
      startIndex: Object.fromEntries(Object.entries(u.startIndex).map(([n, i]) => [n, Math.max(0, i - k * chunk)])),
      groups: u.groups,
    };
    const r = runPortfolioBacktest(slice, params(), COST_BPS);
    if (r.dailyReturns.length < 100) continue;
    const from = new Date(slice.dates[0]! * 1000).toISOString().slice(0, 4);
    const to = new Date(slice.dates[slice.dates.length - 1]! * 1000).toISOString().slice(0, 4);
    row(`  ${from}-${to}`, metrics(r));
  }

  // ── 5. Perfil mensual: lo que un inversor pregunta de verdad ──
  console.log("\n── 5. PERFIL MENSUAL DE ATLAS CORE (25 años) ──");
  const months = monthlyReturns(full.dates, full.dailyReturns);
  const negatives = months.filter((m) => m < 0);
  console.log(`  meses totales: ${months.length} · positivos ${months.length - negatives.length} (${(((months.length - negatives.length) / months.length) * 100).toFixed(0)}%) · negativos ${negatives.length} (${((negatives.length / months.length) * 100).toFixed(0)}%)`);
  console.log(`  mejor mes +${mFull.bestMonth.toFixed(1)}% · peor mes ${mFull.worstMonth.toFixed(1)}%`);
  console.log(`  máximo tiempo sin recuperar máximos: ${mFull.maxMonthsUnderwater} meses`);
  console.log(`  retorno total 25 años: ${mFull.totalReturn >= 0 ? "+" : ""}${mFull.totalReturn.toFixed(0)}%`);

  // ── 6. Diagnóstico operativo ──
  console.log("\n── 6. DIAGNÓSTICO OPERATIVO ──");
  console.log(`  rotación diaria media: ${(full.avgTurnover * 100).toFixed(2)}% del capital`);
  console.log(`  posiciones abiertas de media: ${full.avgPositions.toFixed(1)}`);
  console.log(`  exposición bruta media: ${full.avgGrossExposure.toFixed(2)}× el capital`);
  const corr = correlation(full.dailyReturns.slice(-bh.dailyReturns.length), bh.dailyReturns.slice(-full.dailyReturns.length));
  console.log(`  correlación con el S&P 500: ${corr.toFixed(2)}  (cerca de 0 = flujo de retorno independiente)`);

  console.log("\n" + "═".repeat(92));
}

main();
