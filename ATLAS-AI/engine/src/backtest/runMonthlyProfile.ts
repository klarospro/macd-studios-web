import { btcUsdDaily10y } from "./data/btcUsdDaily10y";
import { derivDaily } from "./data/derivDaily";
import { TsmomParams } from "../strategy/tsmom";
import { defaultRiskConfig } from "../config/riskConfig";
import { runBacktest } from "./tsmomBacktest";

// PERFIL MENSUAL de la estrategia validada (TSMOM). Responde a la pregunta que importa para
// hablar con inversores: ¿cuántos meses son negativos, cuánto de malos, y cuánto se tarda en
// recuperar? Ninguna estrategia real evita los meses en rojo; lo que se puede hacer es MEDIRLOS
// y contarlos por adelantado en vez de prometer que no existen.
//
//   node --import tsx src/backtest/runMonthlyProfile.ts

const CONFIG = { ...defaultRiskConfig, maxConsecutiveLosses: 12 };
const INITIAL = 10000;
const COST_BPS = 10; // mismo coste que la validación profunda ya aprobada

interface MonthlyProfile {
  months: number[];
  positive: number;
  negative: number;
  worst: number;
  best: number;
  median: number;
  avg: number;
  longestLosingStreak: number;
  maxMonthsUnderwater: number;
}

/** Convierte una curva de equity por barra en retornos mensuales (%). */
function monthlyReturns(equityCurve: number[], barsPerMonth: number): number[] {
  const out: number[] = [];
  for (let i = barsPerMonth; i < equityCurve.length; i += barsPerMonth) {
    const prev = equityCurve[i - barsPerMonth]!;
    const now = equityCurve[i]!;
    if (prev > 0) out.push(((now - prev) / prev) * 100);
  }
  return out;
}

function profile(months: number[]): MonthlyProfile {
  const sorted = [...months].sort((a, b) => a - b);
  let streak = 0;
  let longestLosingStreak = 0;
  for (const m of months) {
    streak = m < 0 ? streak + 1 : 0;
    longestLosingStreak = Math.max(longestLosingStreak, streak);
  }
  // Meses bajo el agua: desde un máximo de equity hasta recuperarlo.
  let peak = 1;
  let equity = 1;
  let underwater = 0;
  let maxMonthsUnderwater = 0;
  for (const m of months) {
    equity *= 1 + m / 100;
    if (equity >= peak) {
      peak = equity;
      underwater = 0;
    } else {
      underwater++;
      maxMonthsUnderwater = Math.max(maxMonthsUnderwater, underwater);
    }
  }
  return {
    months,
    positive: months.filter((m) => m > 0).length,
    negative: months.filter((m) => m < 0).length,
    worst: sorted[0] ?? 0,
    best: sorted[sorted.length - 1] ?? 0,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    avg: months.reduce((s, m) => s + m, 0) / Math.max(1, months.length),
    longestLosingStreak,
    maxMonthsUnderwater,
  };
}

function print(label: string, p: MonthlyProfile): void {
  const total = p.months.length;
  console.log(`\n── ${label} · ${total} meses ──`);
  console.log(
    `  meses positivos: ${p.positive} (${((p.positive / total) * 100).toFixed(0)}%) · ` +
      `negativos: ${p.negative} (${((p.negative / total) * 100).toFixed(0)}%)`,
  );
  console.log(`  mes medio ${p.avg >= 0 ? "+" : ""}${p.avg.toFixed(2)}% · mediana ${p.median >= 0 ? "+" : ""}${p.median.toFixed(2)}%`);
  console.log(`  mejor mes +${p.best.toFixed(1)}% · PEOR MES ${p.worst.toFixed(1)}%`);
  console.log(`  racha más larga de meses negativos seguidos: ${p.longestLosingStreak}`);
  console.log(`  más tiempo sin recuperar máximos (bajo el agua): ${p.maxMonthsUnderwater} meses`);
}

/** Histograma sencillo en texto, por tramos de 5%. */
function histogram(months: number[]): void {
  const buckets = new Map<number, number>();
  for (const m of months) {
    const b = Math.floor(m / 5) * 5;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  console.log("  distribución:");
  for (const k of keys) {
    const n = buckets.get(k)!;
    const label = `${k >= 0 ? "+" : ""}${k}% a ${k >= 0 ? "+" : ""}${k + 5}%`;
    console.log(`    ${label.padStart(16)} ${"█".repeat(n)} ${n}`);
  }
}

async function main(): Promise<void> {
  console.log("═".repeat(84));
  console.log("PERFIL MENSUAL · TSMOM (la única estrategia con ventaja validada en este repo)");
  console.log("═".repeat(84));
  console.log(`Coste ${COST_BPS} bps/lado · riesgo 1%/op · breaker relajado · capital ${INITIAL}`);

  // ── BTC 10 años: la muestra más larga disponible ──
  const btcParams: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 100, atrPeriod: 14, atrMult: 2 };
  const btc = await runBacktest(btcUsdDaily10y, CONFIG, btcParams, INITIAL, COST_BPS);
  const btcMonths = monthlyReturns(btc.equityCurve, 30); // BTC cotiza todos los días
  const btcProfile = profile(btcMonths);
  print("BTC/USD · 10 años · UN SOLO INSTRUMENTO", btcProfile);
  histogram(btcMonths);

  // ── Cesta multi-instrumento: ¿la diversificación suaviza la curva? ──
  const curves: number[][] = [];
  for (const [name, prices] of Object.entries(derivDaily)) {
    const p: TsmomParams = { symbol: name, correlationGroup: "multi", lookback: 60, atrPeriod: 14, atrMult: 2 };
    const r = await runBacktest(prices, CONFIG, p, INITIAL, COST_BPS);
    curves.push(r.equityCurve);
  }
  const len = Math.min(...curves.map((c) => c.length));
  // Cartera equiponderada: media de las equity normalizadas de cada instrumento.
  const basket: number[] = [];
  for (let i = 0; i < len; i++) {
    basket.push(curves.reduce((s, c) => s + c[i]! / c[0]!, 0) / curves.length);
  }
  const basketMonths = monthlyReturns(basket, 21); // días hábiles
  const basketProfile = profile(basketMonths);
  print(`CESTA DE ${curves.length} INSTRUMENTOS (Deriv, diario) · equiponderada`, basketProfile);

  // ── Comparación directa: el efecto real de diversificar ──
  console.log("\n── EFECTO DE DIVERSIFICAR (mismo motor, misma estrategia) ──");
  console.log(`  % meses negativos:   1 instrumento ${((btcProfile.negative / btcMonths.length) * 100).toFixed(0)}%  →  cesta ${((basketProfile.negative / basketMonths.length) * 100).toFixed(0)}%`);
  console.log(`  peor mes:            1 instrumento ${btcProfile.worst.toFixed(1)}%  →  cesta ${basketProfile.worst.toFixed(1)}%`);
  console.log(`  meses bajo el agua:  1 instrumento ${btcProfile.maxMonthsUnderwater}  →  cesta ${basketProfile.maxMonthsUnderwater}`);

  console.log("\n" + "═".repeat(84));
  console.log("Lectura honesta: los meses negativos NO se eliminan, se acotan. Una estrategia que");
  console.log("presume de no tenerlos está ocultando el riesgo, no gestionándolo. Lo que se puede");
  console.log("prometer a un inversor es el RANGO y la duración esperada, no un retorno mensual.");
  console.log("═".repeat(84));
}

main().catch((error) => {
  console.error(`FALLO perfil mensual: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
