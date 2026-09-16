import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { defaultRiskConfig, RiskConfig } from "../config/riskConfig";
import { Candle, LiquidityGrabParams, defaultLiquidityGrabParams } from "../strategy/liquidityGrab";
import { GrabBacktestResult, runLiquidityGrabBacktest, summarize } from "./liquidityGrabBacktest";

// Backtest honesto de la estrategia Liquidity Grab (Pranam Ghagare) sobre XAU/USD M15 con velas
// OHLC REALES de Deriv. Sin datos simulados, sin win rate asumido, sin ajustar la estrategia
// hasta que dé el número deseado.
//
//   node --import tsx src/backtest/runLiquidityGrab.ts
//
// Lo que afirma la fuente original: win rate ~76%, profit factor ~2.1, +20-30% MENSUAL, DD <5%.
// Este script mide esas cuatro cifras contra el mercado real y reporta lo que salga.

const DATA = new URL("./data/goldOhlcM15.json", import.meta.url);
const INITIAL = 10000;
const COST_SWEEP = [0, 1, 2, 3, 4, 6, 8]; // bps por lado (0 = mundo sin fricción, imposible)
const REALISTIC = 2; // bps/lado ≈ 0,48 USD de coste por lado con el oro a ~2400

// Reglas de riesgo EXACTAS de la especificación recibida.
const SPEC_CONFIG: RiskConfig = {
  ...defaultRiskConfig,
  riskPerTradePct: 0.005, // 0,5% por operación
  dailyDrawdownPct: 0.01, // kill-switch diario 1%
  dailyDrawdownReducePct: 0.005,
  totalDrawdownPct: 0.08, // kill-switch total 8%
  maxConcurrentPositions: 1, // "solo si no hay posiciones abiertas"
  maxConsecutiveLosses: 1e9, // la spec no define breaker de rachas
};

// Config para medir el EDGE CRUDO: sin kill-switches que corten la muestra a la mitad.
// No es operable — sirve para saber si la ventaja existe antes de que el riesgo la acote.
const RAW_CONFIG: RiskConfig = { ...SPEC_CONFIG, dailyDrawdownPct: 1, totalDrawdownPct: 1 };

function params(overrides: Partial<LiquidityGrabParams> = {}): LiquidityGrabParams {
  return { symbol: "XAUUSD", correlationGroup: "metal", ...defaultLiquidityGrabParams, ...overrides };
}

function row(label: string, r: GrabBacktestResult): void {
  const s = summarize(r);
  const pf = s.profitFactor === Infinity ? "  inf" : s.profitFactor.toFixed(2).padStart(5);
  console.log(
    `${label.padEnd(26)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1).padStart(7)}%  ` +
      `anual ${(s.annualizedPct >= 0 ? "+" : "") + s.annualizedPct.toFixed(0).padStart(5)}%  ` +
      `DD ${s.maxDdPct.toFixed(1).padStart(5)}%  ` +
      `${String(s.trades).padStart(4)} ops  ` +
      `win ${s.winRate.toFixed(1).padStart(4)}%  PF ${pf}` +
      (r.haltReason ? `  [HALT: ${r.haltReason}]` : ""),
  );
}

function loadCandles(): Candle[] {
  const raw = JSON.parse(readFileSync(DATA, "utf8")) as Candle[];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("goldOhlcM15.json vacío o inválido");
  return raw;
}

async function main(): Promise<void> {
  const candles = loadCandles();
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  const days = (last.t - first.t) / 86400;

  console.log("═".repeat(96));
  console.log("BACKTEST · LIQUIDITY GRAB (Pranam Ghagare) · XAU/USD M15 · DATOS REALES DE DERIV");
  console.log("═".repeat(96));
  console.log(
    `${candles.length} velas M15 · ${new Date(first.t * 1000).toISOString().slice(0, 10)} → ` +
      `${new Date(last.t * 1000).toISOString().slice(0, 10)} (${days.toFixed(0)} días naturales, ${(days / 365).toFixed(2)} años)`,
  );
  console.log(`Riesgo 0,5%/op · RR 1:1 · swingWing 2 · lookback 50 · stop×1,1 · capital ${INITIAL}`);
  console.log("Swings confirmados con retardo (SIN lookahead) · empate stop/objetivo en la misma vela → STOP");
  console.log("");
  console.log("Afirmación a verificar: win rate ~76% · PF ~2,1 · +20-30% MENSUAL · DD <5%");

  // ── 1. Barrido de costes con las reglas exactas de la spec ──
  console.log("\n── 1. BARRIDO DE COSTES (reglas de riesgo de la spec: 0,5%/op, DD diario 1%, DD total 8%) ──");
  for (const cost of COST_SWEEP) {
    row(`  ${cost} bps/lado`, await runLiquidityGrabBacktest(candles, SPEC_CONFIG, params(), INITIAL, cost));
  }

  // ── 2. Edge crudo sin kill-switches (¿existe ventaja antes de que el riesgo la acote?) ──
  console.log("\n── 2. EDGE CRUDO (sin kill-switches, para ver la ventaja bruta — NO operable) ──");
  for (const cost of COST_SWEEP) {
    row(`  ${cost} bps/lado`, await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, cost));
  }

  // ── 3. Sensibilidad: variantes que el enunciado deja ambiguas o marca como opcionales ──
  console.log(`\n── 3. SENSIBILIDAD A LAS VARIANTES (todas a ${REALISTIC} bps/lado, sin kill-switches) ──`);
  const variants: Array<[string, Partial<LiquidityGrabParams>]> = [
    ["base (entrada inmediata)", {}],
    ["entrada +1 vela", { entryDelay: 1 }],
    ["con filtro EMA(30)", { useEmaFilter: true }],
    ["RR 1:2", { rewardRatio: 2 }],
    ["RR 1:1.5", { rewardRatio: 1.5 }],
    ["swingWing 3", { swingWing: 3 }],
    ["swingWing 5", { swingWing: 5 }],
    ["lookback 20", { lookback: 20 }],
    ["lookback 100", { lookback: 100 }],
    ["stop ×1.0 (sin margen)", { stopBufferMult: 1.0 }],
    ["stop ×1.5", { stopBufferMult: 1.5 }],
  ];
  for (const [label, over] of variants) {
    row(`  ${label}`, await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(over), INITIAL, REALISTIC));
  }

  // ── 4. Walk-forward: ¿aguanta fuera de muestra? ──
  console.log(`\n── 4. WALK-FORWARD @ ${REALISTIC} bps/lado (sin kill-switches) ──`);
  const half = Math.floor(candles.length / 2);
  row("  1ª mitad (in-sample)", await runLiquidityGrabBacktest(candles.slice(0, half), RAW_CONFIG, params(), INITIAL, REALISTIC));
  row("  2ª mitad (out-sample)", await runLiquidityGrabBacktest(candles.slice(half), RAW_CONFIG, params(), INITIAL, REALISTIC));
  const q = Math.floor(candles.length / 4);
  for (let k = 0; k < 4; k++) {
    row(`  cuarto ${k + 1}`, await runLiquidityGrabBacktest(candles.slice(k * q, (k + 1) * q), RAW_CONFIG, params(), INITIAL, REALISTIC));
  }

  // ── 5. Referencia: ¿qué haría una moneda al aire con las mismas reglas de salida? ──
  // Con RR 1:1 y stop simétrico, cualquier entrada aleatoria da ~50% de aciertos ANTES de costes.
  // Sirve para saber si el 76% afirmado es señal o es ruido.
  console.log("\n── 5. DESGLOSE DE LA CORRIDA PRINCIPAL (spec, coste realista) ──");
  const main0 = await runLiquidityGrabBacktest(candles, SPEC_CONFIG, params(), INITIAL, REALISTIC);
  const s = summarize(main0);
  const byOutcome = main0.trades.reduce<Record<string, number>>((acc, t) => {
    acc[t.outcome] = (acc[t.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  operaciones: ${s.trades} · ganadoras ${main0.wins} · perdedoras ${main0.losses}`);
  console.log(`  salidas: ${JSON.stringify(byOutcome)}`);
  console.log(`  win rate: ${s.winRate.toFixed(2)}%   (afirmado: 76%)`);
  console.log(`  profit factor: ${s.profitFactor === Infinity ? "inf" : s.profitFactor.toFixed(2)}   (afirmado: 2,1)`);
  console.log(`  retorno: ${s.returnPct.toFixed(2)}% en ${(main0.spanDays / 30.4).toFixed(1)} meses → ${(s.returnPct / (main0.spanDays / 30.4)).toFixed(2)}%/mes   (afirmado: +20-30%/mes)`);
  console.log(`  max drawdown: ${s.maxDdPct.toFixed(2)}%   (afirmado: <5%)`);
  console.log(`  rechazos del risk gate: ${JSON.stringify(main0.rejections)}`);

  // ── 6. ¿Cuánto del resultado lo decide MI supuesto de desempate? Acotamos con el caso optimista ──
  console.log("\n── 6. SENSIBILIDAD AL SUPUESTO DE DESEMPATE (stop vs objetivo en la misma vela) ──");
  const pess = await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, REALISTIC, 12, "stop");
  const opti = await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, REALISTIC, 12, "target");
  row(`  pesimista @${REALISTIC}bps`, pess);
  row(`  optimista @${REALISTIC}bps`, opti);
  // Sin costes y con el desempate más favorable posible: es el techo absoluto de la estrategia.
  // Si aquí no hay ventaja clara, no la hay en ningún sitio.
  row("  pesimista @0bps", await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, 0, 12, "stop"));
  row("  optimista @0bps (TECHO)", await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, 0, 12, "target"));
  console.log(
    `  velas ambiguas (se tocan ambos): ${pess.ambiguousBars} de ${pess.trades.length} operaciones ` +
      `(${((pess.ambiguousBars / Math.max(1, pess.trades.length)) * 100).toFixed(1)}%)`,
  );

  // ── 6b. El supuesto optimista es el ÚNICO que da beneficio: ¿a qué coste se muere? ──
  // Importa porque los stops minúsculos obligan a un nocional enorme, y sobre ese nocional
  // hasta una comisión diminuta pesa muchísimo en relación al riesgo asumido.
  console.log("\n── 6b. BREAKEVEN DE COSTES sobre el mejor caso posible (desempate optimista) ──");
  for (const cost of [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2]) {
    row(`  ${cost} bps/lado`, await runLiquidityGrabBacktest(candles, RAW_CONFIG, params(), INITIAL, cost, 12, "target"));
  }

  // ── 7. Tamaño real de los stops: un stop microscópico es ruido, no una tesis ──
  const dists = [...pess.stopDistances].sort((a, b) => a - b);
  const pct = (p: number): number => dists[Math.floor((dists.length - 1) * p)] ?? 0;
  const avgPrice = candles.reduce((s, c) => s + c.c, 0) / candles.length;
  console.log("\n── 7. DISTANCIA AL STOP (USD sobre el oro; precio medio del periodo ≈ " + avgPrice.toFixed(0) + ") ──");
  console.log(
    `  mediana ${pct(0.5).toFixed(2)} · p10 ${pct(0.1).toFixed(2)} · p90 ${pct(0.9).toFixed(2)} · ` +
      `mínimo ${(dists[0] ?? 0).toFixed(3)} · máximo ${(dists[dists.length - 1] ?? 0).toFixed(2)}`,
  );
  const tiny = dists.filter((d) => d < 1).length;
  console.log(`  operaciones con stop < 1 USD: ${tiny}/${dists.length} (${((tiny / Math.max(1, dists.length)) * 100).toFixed(1)}%)`);
  console.log("  Referencia: el spread típico del oro ronda 0,20-0,50 USD. Un stop de ese orden lo salta el ruido.");

  // Apalancamiento implícito: el sizing sale de riesgo/distancia_al_stop, así que un stop diminuto
  // obliga a un nocional gigante. Es la razón mecánica de que un coste minúsculo sea letal.
  const lev = (d: number): number => (SPEC_CONFIG.riskPerTradePct / d) * avgPrice;
  console.log("\n── 7b. NOCIONAL IMPLÍCITO (veces el capital de la cuenta) ──");
  console.log(
    `  con stop mediano (${pct(0.5).toFixed(2)} USD): ${lev(pct(0.5)).toFixed(1)}× · ` +
      `con stop p10 (${pct(0.1).toFixed(2)} USD): ${lev(pct(0.1)).toFixed(1)}× · ` +
      `con el stop mínimo (${(dists[0] ?? 0).toFixed(3)} USD): ${lev(dists[0] ?? 1).toFixed(0)}×`,
  );
  console.log(`  Coste de 1 bp/lado sobre el nocional mediano ≈ ${(2 * 0.0001 * lev(pct(0.5)) * 100).toFixed(2)}% del capital POR OPERACIÓN.`);

  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const csv = [
    "entry_time,exit_time,side,entry,stop,target,exit,size,pnl,outcome",
    ...main0.trades.map((t) =>
      [
        new Date(t.entryTime * 1000).toISOString(),
        new Date(t.exitTime * 1000).toISOString(),
        t.side,
        t.entry.toFixed(2),
        t.stop.toFixed(2),
        t.target.toFixed(2),
        t.exit.toFixed(2),
        t.size.toFixed(4),
        t.pnl.toFixed(2),
        t.outcome,
      ].join(","),
    ),
  ].join("\n");
  const csvPath = new URL("./out/liquidity_grab_trades.csv", import.meta.url);
  writeFileSync(csvPath, csv);
  console.log(`\n  CSV de operaciones → ${csvPath.pathname}`);

  console.log("\n" + "═".repeat(96));
  console.log("Cómo leer esto: si el edge crudo (bloque 2) ya es negativo a 2-4 bps/lado, los costes matan");
  console.log("la estrategia. Si el bloque 4 no aguanta fuera de muestra, lo que hubo fue ajuste, no ventaja.");
  console.log("═".repeat(96));
}

main().catch((error) => {
  console.error(`FALLO backtest liquidity grab: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
