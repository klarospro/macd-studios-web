/**
 * ¿Cuál de las estrategias de Atlas sirve para el ORO?
 *
 * Corre las cinco backtesteables sobre la misma serie de precios, con el mismo
 * capital, riesgo y coste. La sexta (EventScalp) queda fuera a propósito: sin
 * calendario macro cargado no tiene nada que operar, y simular sus eventos
 * sería inventarse el resultado.
 *
 * Los PARÁMETROS salen de `config/atlas.yaml`, no de valores elegidos aquí:
 * se mide lo que el bot hace en producción, no una versión afinada para lucir.
 *
 * Uso: npm run backtest:oro
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cargarConfig } from "../config/sleeveConfig";
import { Vela } from "../domain/bars";
import { defaultAtlasCoreParams, momentumSignal, realizedVol } from "../strategy/atlasCore";
import { Candle, defaultLiquidityGrabParams, detectGrab, detectSwings, LiquidityGrabParams } from "../strategy/liquidityGrab";
import { debeCerrarCore, paramsCoreDesdeConfig, senalCore } from "../strategy/sleeveCore";
import { paramsIntradiaDesdeConfig, senalIntradia } from "../strategy/sleeveIntradia";
import { tsmomSignal } from "../strategy/tsmom";
import { Barra, CONFIG_BASE, ConfigBacktest, comprarYMantener, Estrategia, metricas, Operacion, Resultado, simular } from "./comparativaOro";

const DATA = new URL("./data/", import.meta.url);
const SIMBOLO = "frxXAUUSD";
const GRUPO = "metales";

function cargar(fichero: string): Barra[] {
  const crudo = JSON.parse(readFileSync(fileURLToPath(new URL(fichero, DATA)), "utf8")) as Barra[];
  return crudo.filter((b) => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

const cierres = (barras: Barra[]) => barras.map((b) => b.close);
const aVelas = (barras: Barra[]): Vela[] => barras.map((b) => ({ epoch: b.epoch, open: b.open, high: b.high, low: b.low, close: b.close }));
const aCandles = (barras: Barra[]): Candle[] => barras.map((b) => ({ t: b.epoch, o: b.open, h: b.high, l: b.low, c: b.close }));

/**
 * Simulador de PESOS para AtlasCore, que no usa stops sino exposición continua
 * con vol-target y rebalanceo periódico. Meterlo en el motor de operaciones
 * discretas le añadiría un stop que no tiene: sería medir otra estrategia.
 */
function simularPesos(nombre: string, barras: Barra[], cfg: ConfigBacktest): Resultado {
  const p = defaultAtlasCoreParams;
  const precios = cierres(barras);
  let equity = cfg.capitalInicial;
  let pesoActual = 0;
  let costes = 0;
  const curva: number[] = [];
  const operaciones: Operacion[] = [];
  let ultimoCambio = 0;

  for (let t = 0; t < barras.length; t++) {
    const precio = precios[t]!;
    if (t > 0) {
      // El peso vigente cabalga el movimiento del precio.
      const ret = precio / precios[t - 1]! - 1;
      equity *= 1 + pesoActual * ret;
    }

    if (t % p.rebalanceEvery === 0) {
      const vol = realizedVol(precios, t, p.volWindow);
      const senal = momentumSignal(precios, t, p, vol);
      let objetivo = 0;
      if (senal !== null && vol && vol > 0) {
        objetivo = p.useVolTargeting ? (senal * p.targetVol) / vol : senal;
        objetivo = Math.max(-p.maxWeightPerAsset, Math.min(p.maxWeightPerAsset, objetivo));
      }
      // Banda de no-negociación: sin ella, el ruido se convierte en comisiones.
      if (Math.abs(objetivo - pesoActual) >= p.noTradeBand) {
        const rotacion = Math.abs(objetivo - pesoActual) * equity;
        const c = rotacion * (cfg.costeBps / 10_000);
        equity -= c;
        costes += c;
        operaciones.push({
          entradaIdx: ultimoCambio, salidaIdx: t, side: objetivo >= 0 ? "buy" : "sell",
          precioEntrada: precios[ultimoCambio]!, precioSalida: precio,
          size: Math.abs(objetivo), pnl: 0, motivo: "giro",
        });
        pesoActual = objetivo;
        ultimoCambio = t;
      }
    }
    curva.push(equity);
  }

  // El P&L por operación no aplica a un sistema de pesos: el acierto se mide
  // en la curva, no trade a trade. Se anota el nº de rebalanceos como "operaciones".
  const r = metricas(nombre, curva, [], costes, cfg);
  return { ...r, operaciones: operaciones.length, aciertosPct: NaN, profitFactor: NaN };
}

function tabla(titulo: string, periodo: string, resultados: Resultado[]): void {
  console.log(`\n${"═".repeat(104)}`);
  console.log(`${titulo}`);
  console.log(`${periodo}`);
  console.log("═".repeat(104));
  console.log(
    `${"Estrategia".padEnd(26)}${"Rent.".padStart(9)}${"CAGR".padStart(9)}${"Sharpe".padStart(9)}` +
      `${"MaxDD".padStart(9)}${"Ops".padStart(7)}${"Acierto".padStart(10)}${"P.Factor".padStart(10)}${"Costes".padStart(11)}`,
  );
  console.log("─".repeat(104));
  for (const r of [...resultados].sort((a, b) => b.sharpe - a.sharpe)) {
    const pf = Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "—";
    const ac = Number.isFinite(r.aciertosPct) ? `${r.aciertosPct.toFixed(0)}%` : "—";
    console.log(
      `${r.nombre.padEnd(26)}${`${r.rentabilidadPct.toFixed(1)}%`.padStart(9)}${`${r.cagrPct.toFixed(1)}%`.padStart(9)}` +
        `${r.sharpe.toFixed(2).padStart(9)}${`${r.maxDrawdownPct.toFixed(1)}%`.padStart(9)}${String(r.operaciones).padStart(7)}` +
        `${ac.padStart(10)}${pf.padStart(10)}${`$${r.costesTotales.toFixed(0)}`.padStart(11)}`,
    );
  }
}

function main(): void {
  const config = cargarConfig();
  const diario = cargar("oroDiario1y.json");
  const m15 = cargar("oroM15_1y.json");

  const fecha = (b?: Barra) => (b ? new Date(b.epoch * 1000).toISOString().slice(0, 10) : "?");

  // ── DIARIO ──
  const cierresD = cierres(diario);
  const { trend, volTarget } = paramsCoreDesdeConfig(config.core as Record<string, any>, SIMBOLO, GRUPO);

  const tsmomParams = { symbol: SIMBOLO, correlationGroup: GRUPO, lookback: 100, atrPeriod: 14, atrMult: 2 };
  const estTsmom: Estrategia = (_b, t) => {
    const s = tsmomSignal(cierresD, t, tsmomParams);
    return s ? { side: s.side, stopPrice: s.stopPrice } : null;
  };

  const estCore: Estrategia = (_b, t) => {
    const s = senalCore(cierresD, t, trend, volTarget);
    if (!s) return null;
    // El Core cierra por su propia regla de tendencia, no solo por stop.
    if (debeCerrarCore(cierresD, t, trend, s.side)) return null;
    return { side: s.side, stopPrice: s.stopPrice, escalaRiesgo: s.escalaVolTarget ?? 1 };
  };

  const resultadosDiario = [
    simular("TSMOM (momentum 100d)", diario, estTsmom),
    simular("Sleeve Core (EWMA)", diario, estCore),
    simularPesos("AtlasCore (pesos+volTgt)", diario, CONFIG_BASE),
    comprarYMantener(diario),
  ];
  tabla(
    "ORO (frxXAUUSD) · ESTRATEGIAS DIARIAS",
    `${diario.length} velas diarias · ${fecha(diario[0])} → ${fecha(diario[diario.length - 1])} · ` +
      `capital $${CONFIG_BASE.capitalInicial.toLocaleString()} · riesgo ${(CONFIG_BASE.riesgoPorTrade * 100).toFixed(0)}%/op · coste ${CONFIG_BASE.costeBps} bps/lado`,
    resultadosDiario,
  );

  // ── INTRADÍA (M15) ──
  const cfgM15: ConfigBacktest = { ...CONFIG_BASE, barrasPorAno: 252 * 26 };
  const velasM15 = aVelas(m15);
  const candlesM15 = aCandles(m15);

  const lgParams: LiquidityGrabParams = { ...defaultLiquidityGrabParams, symbol: SIMBOLO, correlationGroup: GRUPO };
  const swings = detectSwings(candlesM15, lgParams.swingWing);
  const estGrab: Estrategia = (barras, t) => {
    const g = detectGrab(candlesM15, swings, t, lgParams);
    if (!g) return null;
    const precio = barras[t]!.close;
    const side = g.type === "BULLISH_GRAB" ? "buy" : "sell";
    const distancia = Math.abs(precio - g.level) * lgParams.stopBufferMult;
    if (!(distancia > 0)) return null;
    return {
      side,
      stopPrice: side === "buy" ? precio - distancia : precio + distancia,
      takeProfit: side === "buy" ? precio + distancia * lgParams.rewardRatio : precio - distancia * lgParams.rewardRatio,
    };
  };

  const { params: intraParams } = paramsIntradiaDesdeConfig(config.intradia as Record<string, any>, SIMBOLO, GRUPO);
  const estIntradia: Estrategia = (barras, t) => {
    const s = senalIntradia(velasM15, t, intraParams);
    if (!s) return null;
    const precio = barras[t]!.close;
    const distancia = Math.abs(precio - s.stopPrice);
    if (!(distancia > 0)) return null;
    return {
      side: s.side,
      stopPrice: s.stopPrice,
      takeProfit: s.side === "buy" ? precio + distancia * intraParams.salidas.tpXStop : precio - distancia * intraParams.salidas.tpXStop,
    };
  };

  const resultadosIntra = [
    simular("Liquidity Grab", m15, estGrab, cfgM15),
    simular("Sleeve Intradía (ruptura)", m15, estIntradia, cfgM15),
    comprarYMantener(m15, cfgM15),
  ];
  tabla(
    "ORO (frxXAUUSD) · ESTRATEGIAS INTRADÍA (M15)",
    `${m15.length} velas M15 · ${fecha(m15[0])} → ${fecha(m15[m15.length - 1])} · ` +
      `[!] SOLO ~${(m15.length / 26 / 21).toFixed(1)} MESES: Deriv no da más histórico intradía. No comparable con el bloque anual.`,
    resultadosIntra,
  );

  console.log(`\n${"─".repeat(104)}`);
  console.log("Lecturas obligadas antes de sacar conclusiones:");
  console.log("  · Un año es UNA muestra. Sharpe < 0,5 sobre 258 velas no distingue habilidad de suerte.");
  console.log("  · El bloque intradía cubre ~7 semanas: sirve para descartar, no para aprobar.");
  console.log("  · Si nadie bate a 'Comprar y mantener' ajustado por riesgo, la estrategia no aporta.");
  console.log("  · Backtest ≠ real: no hay huecos de apertura, ni rechazos, ni deslizamiento variable.");
}

main();
