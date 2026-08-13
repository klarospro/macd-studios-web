/**
 * Comparativa de estrategias sobre datos de IG con SPREADS REALES.
 *
 * Repite el ejercicio de `runComparativaOro.ts` corrigiendo su única debilidad
 * grave: allí el coste era un supuesto (10 bps por lado, heredado de la
 * validación con Deriv). Aquí cada vela trae su propio ask−bid medido, y el
 * simulador cobra medio spread por lado. La diferencia es de un orden de
 * magnitud —el spread real de IG está entre 0,8 y 2,2 bps— y eso puede cambiar
 * el veredicto de cualquier estrategia que opere mucho.
 *
 * Cinco instrumentos, no uno: juzgar un sistema de tendencia diversificado por
 * un solo activo le es desfavorable por diseño.
 *
 * Uso: npm run backtest:ig
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultAtlasCoreParams, momentumSignal, realizedVol } from "../strategy/atlasCore";
import { Candle, defaultLiquidityGrabParams, detectGrab, detectSwings, LiquidityGrabParams } from "../strategy/liquidityGrab";
import { debeCerrarCore, CoreTrendParams, CoreVolTargetParams, senalCore } from "../strategy/sleeveCore";
import { tsmomSignal } from "../strategy/tsmom";
import { Barra, CONFIG_BASE, ConfigBacktest, comprarYMantener, Estrategia, metricas, Operacion, Resultado, simular } from "./comparativaOro";

interface VelaIgGuardada {
  epoch: number;
  mid: { open: number; high: number; low: number; close: number };
  spread: number;
  volumen: number | null;
}

const DATA = new URL("./data/ig/", import.meta.url);

/** Apalancamiento ESMA por instrumento, de `config/atlas.yaml`. */
const APALANCAMIENTO: Record<string, number> = {
  eurusd: 30, usdjpy: 30, oro: 20, us30: 20, nasdaq: 20,
};

function cargar(fichero: string): Barra[] {
  const crudo = JSON.parse(readFileSync(fileURLToPath(new URL(fichero, DATA)), "utf8")) as VelaIgGuardada[];
  return crudo
    .map((v) => ({
      epoch: v.epoch,
      open: v.mid.open, high: v.mid.high, low: v.mid.low, close: v.mid.close,
      spread: v.spread,
    }))
    .filter((b) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

const cierres = (b: Barra[]) => b.map((x) => x.close);
const aCandles = (b: Barra[]): Candle[] => b.map((x) => ({ t: x.epoch, o: x.open, h: x.high, l: x.low, c: x.close }));

/** Parámetros del Core equivalentes a los de `atlas.yaml`, sin depender del YAML. */
const trend = (symbol: string): CoreTrendParams => ({
  symbol, correlationGroup: "mixto", metodo: "ewma",
  ewmaPeriodos: [50, 100, 200], donchianPeriodo: 100, atrPeriodo: 14, atrMultStop: 2,
});
const volTarget: CoreVolTargetParams = { activo: true, objetivoAnual: 0.12, ventanaDias: 60, escalaMaxima: 1 };

/** AtlasCore trabaja con pesos, no con stops: se simula aparte (ver comparativaOro). */
function simularPesos(nombre: string, barras: Barra[], cfg: ConfigBacktest): Resultado {
  const p = defaultAtlasCoreParams;
  const precios = cierres(barras);
  let equity = cfg.capitalInicial;
  let pesoActual = 0;
  let costes = 0;
  const curva: number[] = [];
  let rebalanceos = 0;

  for (let t = 0; t < barras.length; t++) {
    const precio = precios[t]!;
    if (t > 0) equity *= 1 + pesoActual * (precio / precios[t - 1]! - 1);

    if (t % p.rebalanceEvery === 0) {
      const vol = realizedVol(precios, t, p.volWindow);
      const senal = momentumSignal(precios, t, p, vol);
      let objetivo = 0;
      if (senal !== null && vol && vol > 0) {
        objetivo = Math.max(-p.maxWeightPerAsset, Math.min(p.maxWeightPerAsset, (senal * p.targetVol) / vol));
      }
      if (Math.abs(objetivo - pesoActual) >= p.noTradeBand) {
        // Coste de rotación con el spread medido de esa vela.
        const barra = barras[t]!;
        const unidades = (Math.abs(objetivo - pesoActual) * equity) / precio;
        const c = barra.spread != null ? (barra.spread / 2) * unidades : Math.abs(objetivo - pesoActual) * equity * (cfg.costeBps / 10_000);
        equity -= c;
        costes += c;
        pesoActual = objetivo;
        rebalanceos++;
      }
    }
    curva.push(equity);
  }
  const r = metricas(nombre, curva, [] as Operacion[], costes, cfg);
  return { ...r, operaciones: rebalanceos, aciertosPct: NaN, profitFactor: NaN };
}

function tabla(titulo: string, sub: string, res: Resultado[]): void {
  console.log(`\n${"═".repeat(100)}`);
  console.log(titulo);
  console.log(sub);
  console.log("═".repeat(100));
  console.log(
    `${"Estrategia".padEnd(26)}${"Rent.".padStart(9)}${"Sharpe".padStart(9)}${"MaxDD".padStart(9)}` +
      `${"Ops".padStart(7)}${"Acierto".padStart(10)}${"P.Factor".padStart(10)}${"Costes".padStart(11)}`,
  );
  console.log("─".repeat(100));
  for (const r of [...res].sort((a, b) => b.sharpe - a.sharpe)) {
    const pf = Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "—";
    const ac = Number.isFinite(r.aciertosPct) ? `${r.aciertosPct.toFixed(0)}%` : "—";
    console.log(
      `${r.nombre.padEnd(26)}${`${r.rentabilidadPct.toFixed(1)}%`.padStart(9)}${r.sharpe.toFixed(2).padStart(9)}` +
        `${`${r.maxDrawdownPct.toFixed(1)}%`.padStart(9)}${String(r.operaciones).padStart(7)}${ac.padStart(10)}` +
        `${pf.padStart(10)}${`$${r.costesTotales.toFixed(0)}`.padStart(11)}`,
    );
  }
}

function main(): void {
  const instrumentos = ["eurusd", "oro", "usdjpy", "us30", "nasdaq"];
  const resumenGlobal: Array<{ inst: string; mejor: string; rent: number }> = [];

  for (const inst of instrumentos) {
    let barras: Barra[];
    try {
      barras = cargar(`${inst}-diario.json`);
    } catch {
      console.log(`\n[!] Sin datos para ${inst}: ejecuta antes \`npm run fetch:ig\`.`);
      continue;
    }
    if (barras.length < 210) {
      console.log(`\n[!] ${inst}: solo ${barras.length} velas. El Core necesita 200 para la EWMA lenta. Se omite.`);
      continue;
    }

    const cfg: ConfigBacktest = { ...CONFIG_BASE, apalancamientoMax: APALANCAMIENTO[inst] ?? 20 };
    const cs = cierres(barras);
    const t = trend(inst);

    const estTsmom: Estrategia = (_b, i) => {
      const s = tsmomSignal(cs, i, { symbol: inst, correlationGroup: "mixto", lookback: 100, atrPeriod: 14, atrMult: 2 });
      return s ? { side: s.side, stopPrice: s.stopPrice } : null;
    };
    const estCore: Estrategia = (_b, i) => {
      const s = senalCore(cs, i, t, volTarget);
      if (!s || debeCerrarCore(cs, i, t, s.side)) return null;
      return { side: s.side, stopPrice: s.stopPrice, escalaRiesgo: s.escalaVolTarget ?? 1 };
    };

    const res = [
      simular("TSMOM (100d)", barras, estTsmom, cfg),
      simular("Sleeve Core (EWMA)", barras, estCore, cfg),
      simularPesos("AtlasCore (pesos+vol)", barras, cfg),
      comprarYMantener(barras, cfg),
    ];

    const spreadMedio = barras.reduce((a, b) => a + (b.spread ?? 0), 0) / barras.length;
    const bps = (spreadMedio / barras[barras.length - 1]!.close) * 10_000;
    const f = (b?: Barra) => (b ? new Date(b.epoch * 1000).toISOString().slice(0, 10) : "?");

    tabla(
      `${inst.toUpperCase()} · velas diarias · SPREAD REAL DE IG`,
      `${barras.length} velas · ${f(barras[0])}→${f(barras[barras.length - 1])} · spread medio ${bps.toFixed(2)} bps · apalanc. máx ${cfg.apalancamientoMax}:1`,
      res,
    );

    const mejor = [...res].filter((r) => r.nombre !== "Comprar y mantener").sort((a, b) => b.rentabilidadPct - a.rentabilidadPct)[0]!;
    resumenGlobal.push({ inst, mejor: mejor.nombre, rent: mejor.rentabilidadPct });
  }

  // ── Intradía sobre oro: la prueba de fuego del coste ──
  try {
    const m15 = cargar("oro-m15.json");
    const cfg: ConfigBacktest = { ...CONFIG_BASE, barrasPorAno: 252 * 26, apalancamientoMax: 20 };
    const candles = aCandles(m15);
    const lg: LiquidityGrabParams = { ...defaultLiquidityGrabParams, symbol: "oro", correlationGroup: "metales" };
    const swings = detectSwings(candles, lg.swingWing);
    const estGrab: Estrategia = (b, i) => {
      const g = detectGrab(candles, swings, i, lg);
      if (!g) return null;
      const precio = b[i]!.close;
      const side = g.type === "BULLISH_GRAB" ? "buy" : "sell";
      const d = Math.abs(precio - g.level) * lg.stopBufferMult;
      if (!(d > 0)) return null;
      return {
        side,
        stopPrice: side === "buy" ? precio - d : precio + d,
        takeProfit: side === "buy" ? precio + d * lg.rewardRatio : precio - d * lg.rewardRatio,
      };
    };
    const spreadMedio = m15.reduce((a, b) => a + (b.spread ?? 0), 0) / m15.length;
    tabla(
      "ORO · M15 · SPREAD REAL DE IG",
      `${m15.length} velas · spread medio ${((spreadMedio / m15[m15.length - 1]!.close) * 10_000).toFixed(2)} bps ` +
        `(el backtest con Deriv asumía 10 bps: aquí se mide)`,
      [simular("Liquidity Grab", m15, estGrab, cfg), comprarYMantener(m15, cfg)],
    );
  } catch {
    console.log("\n[!] Sin M15 de oro.");
  }

  console.log(`\n${"─".repeat(100)}`);
  console.log("MEJOR ESTRATEGIA ACTIVA POR INSTRUMENTO:");
  for (const r of resumenGlobal) console.log(`  ${r.inst.padEnd(8)} ${r.mejor.padEnd(24)} ${r.rent.toFixed(1)}%`);
  console.log("\nRecordatorio: ~1 año es UNA muestra y estos parámetros no se han validado fuera de muestra.");
}

main();
