/**
 * ¿Existe ALGUNA calibración que haga rentable el Sleeve Intradía en oro?
 *
 * El backtest base dio −93,3% con 193 operaciones y $8.046 de costes. Antes de
 * descartar la estrategia hay que separar dos causas posibles:
 *   (a) los parámetros están mal puestos → se arregla calibrando;
 *   (b) la estructura no da de sí → no se arregla con ningún parámetro.
 *
 * Se barren las dos palancas que gobiernan la relación coste/beneficio:
 *   - ancho del stop: stops ceñidos ⇒ tamaño grande ⇒ nocional grande ⇒ coste
 *     grande. Es el motor del desastre, y es aritmético.
 *   - objetivo (TP × stop): con 42% de acierto medido, un TP igual al stop da
 *     expectativa negativa ANTES de comisiones.
 *
 * Se informa también del coste medio por operación frente al riesgo por
 * operación: si el coste se come una fracción grande del riesgo, ninguna
 * calibración lo salva y hay que decirlo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cargarConfig } from "../config/sleeveConfig";
import { Vela } from "../domain/bars";
import { paramsIntradiaDesdeConfig, senalIntradia } from "../strategy/sleeveIntradia";
import { Barra, CONFIG_BASE, ConfigBacktest, Estrategia, simular } from "./comparativaOro";

const SIMBOLO = "frxXAUUSD";
const GRUPO = "metales";

const barras: Barra[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./data/oroM15_1y.json", import.meta.url)), "utf8"),
).filter((b: Barra) => Number.isFinite(b.close));

const velas: Vela[] = barras.map((b) => ({ epoch: b.epoch, open: b.open, high: b.high, low: b.low, close: b.close }));
const cfg: ConfigBacktest = { ...CONFIG_BASE, barrasPorAno: 252 * 26 };

const config = cargarConfig();
const { params: base } = paramsIntradiaDesdeConfig(config.intradia as Record<string, any>, SIMBOLO, GRUPO);

/** Multiplicadores del stop: 1 = el configurado; 2 = el doble de ancho, etc. */
const ANCHOS_STOP = [1, 2, 4, 8];
const OBJETIVOS = [1, 1.5, 2, 3];

console.log(`Sweep Sleeve Intradía · ${SIMBOLO} · ${barras.length} velas M15`);
console.log(`Base: stop ${base.salidas.stopAtrMin}-${base.salidas.stopAtrMax} ATR · TP ${base.salidas.tpXStop}x stop\n`);
console.log(
  `${"stop×".padStart(6)}${"TP×stop".padStart(9)}${"Rent.".padStart(11)}${"Ops".padStart(7)}` +
    `${"Acierto".padStart(9)}${"P.Factor".padStart(10)}${"Costes".padStart(11)}${"Coste/op".padStart(10)}${"Riesgo/op".padStart(11)}`,
);
console.log("─".repeat(84));

let mejor: { etiqueta: string; rent: number } | null = null;

for (const ancho of ANCHOS_STOP) {
  for (const tp of OBJETIVOS) {
    const params = {
      ...base,
      salidas: {
        ...base.salidas,
        stopAtrMin: base.salidas.stopAtrMin * ancho,
        stopAtrMax: base.salidas.stopAtrMax * ancho,
        tpXStop: tp,
      },
    };

    const estrategia: Estrategia = (b, t) => {
      const s = senalIntradia(velas, t, params);
      if (!s) return null;
      const precio = b[t]!.close;
      const distancia = Math.abs(precio - s.stopPrice);
      if (!(distancia > 0)) return null;
      return {
        side: s.side,
        stopPrice: s.stopPrice,
        takeProfit: s.side === "buy" ? precio + distancia * tp : precio - distancia * tp,
      };
    };

    const r = simular(`stop×${ancho} tp${tp}`, barras, estrategia, cfg);
    const costePorOp = r.operaciones > 0 ? r.costesTotales / r.operaciones : 0;
    const riesgoPorOp = cfg.capitalInicial * cfg.riesgoPorTrade;
    const pf = Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "—";

    console.log(
      `${String(ancho).padStart(6)}${String(tp).padStart(9)}${`${r.rentabilidadPct.toFixed(1)}%`.padStart(11)}` +
        `${String(r.operaciones).padStart(7)}${`${r.aciertosPct.toFixed(0)}%`.padStart(9)}${pf.padStart(10)}` +
        `${`$${r.costesTotales.toFixed(0)}`.padStart(11)}${`$${costePorOp.toFixed(2)}`.padStart(10)}${`$${riesgoPorOp.toFixed(2)}`.padStart(11)}`,
    );

    if (!mejor || r.rentabilidadPct > mejor.rent) mejor = { etiqueta: `stop×${ancho} · TP ${tp}x`, rent: r.rentabilidadPct };
  }
}

console.log("─".repeat(84));
console.log(`Mejor combinación: ${mejor?.etiqueta} → ${mejor?.rent.toFixed(1)}%`);
console.log(
  `\nSi NINGUNA combinación es positiva, el problema no son los parámetros:\n` +
    `es que el coste por operación no cabe dentro del recorrido que captura la señal.`,
);
