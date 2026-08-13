/**
 * ¿El motor de order flow tiene ventaja estadística, o solo suena bien?
 *
 * La pregunta que responde este runner NO es "cuánto gana". Es más dura:
 * **¿la puntuación predice el resultado?** Si los setups de nota 80 no rinden
 * mejor que los de nota 40, el score es decoración y la confluencia no aporta
 * nada, por muy bien construida que esté.
 *
 * Por eso el informe principal es la tabla por TRAMOS DE PUNTUACIÓN: si la
 * expectativa no crece con la nota, el motor está descartado y hay que decirlo.
 *
 * Se mide con el spread REAL de IG en cada vela, no con un coste asumido.
 *
 * Uso: npm run backtest:flujo
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PESOS_INICIALES, puntuarSetup, VelaFlujo } from "../strategy/orderFlow";
import { Barra, CONFIG_BASE, ConfigBacktest, Estrategia, simular } from "./comparativaOro";

interface VelaGuardada {
  epoch: number;
  mid: { open: number; high: number; low: number; close: number };
  spread: number;
  volumen: number | null;
}

const DATA = new URL("./data/ig/", import.meta.url);

function cargar(fichero: string): { barras: Barra[]; flujo: VelaFlujo[] } {
  const crudo = JSON.parse(readFileSync(fileURLToPath(new URL(fichero, DATA)), "utf8")) as VelaGuardada[];
  const barras = crudo.map((v) => ({
    epoch: v.epoch, open: v.mid.open, high: v.mid.high, low: v.mid.low, close: v.mid.close, spread: v.spread,
  }));
  const flujo = crudo.map((v) => ({
    epoch: v.epoch, open: v.mid.open, high: v.mid.high, low: v.mid.low, close: v.mid.close, volumen: v.volumen,
  }));
  return { barras, flujo };
}

/** Distancia del stop: al otro lado del nivel barrido, con un margen. */
const MARGEN_STOP = 1.15;
const R_OBJETIVO = 2;

function main(): void {
  const { barras, flujo } = cargar("oro-m15.json");
  const cfg: ConfigBacktest = { ...CONFIG_BASE, barrasPorAno: 252 * 26, apalancamientoMax: 20 };

  console.log(`Motor de order flow · ORO M15 · ${barras.length} velas con volumen real`);
  console.log(`Stop al otro lado del nivel barrido (x${MARGEN_STOP}) · objetivo ${R_OBJETIVO}R · spread real de IG\n`);

  // ── 1. Rendimiento por umbral de puntuación ──
  console.log("═".repeat(88));
  console.log("RENDIMIENTO SEGÚN EL MÍNIMO DE PUNTUACIÓN EXIGIDO");
  console.log("═".repeat(88));
  console.log(`${"Umbral".padStart(7)}${"Rent.".padStart(10)}${"Ops".padStart(7)}${"Acierto".padStart(10)}${"P.Factor".padStart(10)}${"MaxDD".padStart(9)}${"Costes".padStart(10)}`);
  console.log("─".repeat(88));

  for (const umbral of [0, 40, 50, 60, 70, 80]) {
    const estrategia: Estrategia = (b, t) => {
      const p = puntuarSetup(flujo, t, PESOS_INICIALES);
      if (!p || p.total < umbral) return null;
      const precio = b[t]!.close;
      // El stop va al otro lado del extremo barrido: si el precio vuelve ahí,
      // la lectura del barrido era falsa y la idea está invalidada.
      const nivel = p.side === "buy" ? b[t]!.low : b[t]!.high;
      const d = Math.abs(precio - nivel) * MARGEN_STOP;
      if (!(d > 0)) return null;
      return {
        side: p.side,
        stopPrice: p.side === "buy" ? precio - d : precio + d,
        takeProfit: p.side === "buy" ? precio + d * R_OBJETIVO : precio - d * R_OBJETIVO,
      };
    };
    const r = simular(`umbral ${umbral}`, barras, estrategia, cfg);
    const pf = Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "—";
    console.log(
      `${String(umbral).padStart(7)}${`${r.rentabilidadPct.toFixed(1)}%`.padStart(10)}${String(r.operaciones).padStart(7)}` +
        `${`${r.aciertosPct.toFixed(0)}%`.padStart(10)}${pf.padStart(10)}${`${r.maxDrawdownPct.toFixed(1)}%`.padStart(9)}` +
        `${`$${r.costesTotales.toFixed(0)}`.padStart(10)}`,
    );
  }

  // ── 2. LA PRUEBA DE VERDAD: ¿la nota predice el resultado? ──
  // Se mide el recorrido futuro a favor de la señal, sin lógica de salida de por
  // medio: así se aísla la CALIDAD DE LA SEÑAL de la calidad de la gestión.
  const HORIZONTE = 8; // velas M15 = 2 horas
  const tramos: Record<string, { n: number; suma: number; sumaCuadrados: number; ganadoras: number }> = {};

  for (let t = 30; t < flujo.length - HORIZONTE; t++) {
    const p = puntuarSetup(flujo, t, PESOS_INICIALES);
    if (!p) continue;
    const entrada = barras[t]!.close;
    const futuro = barras[t + HORIZONTE]!.close;
    const signo = p.side === "buy" ? 1 : -1;
    // Recorrido en puntos básicos, a favor de la dirección de la señal.
    const resultado = (signo * (futuro - entrada) / entrada) * 10_000;

    const tramo = p.total < 40 ? "  0-39" : p.total < 55 ? " 40-54" : p.total < 70 ? " 55-69" : "70-100";
    tramos[tramo] ??= { n: 0, suma: 0, sumaCuadrados: 0, ganadoras: 0 };
    tramos[tramo].n++;
    tramos[tramo].suma += resultado;
    tramos[tramo].sumaCuadrados += resultado * resultado;
    if (resultado > 0) tramos[tramo].ganadoras++;
  }

  console.log(`\n${"═".repeat(88)}`);
  console.log(`¿LA PUNTUACIÓN PREDICE? · recorrido medio ${HORIZONTE} velas después (2 h), en bps`);
  console.log("═".repeat(88));
  console.log(
    `${"Tramo".padStart(7)}${"Señales".padStart(10)}${"Media (bps)".padStart(14)}${"Error est.".padStart(13)}` +
      `${"t".padStart(8)}${"% a favor".padStart(12)}`,
  );
  console.log("─".repeat(88));

  const orden = ["  0-39", " 40-54", " 55-69", "70-100"];
  const medias: number[] = [];
  const tsMax: number[] = [];
  for (const k of orden) {
    const d = tramos[k];
    if (!d || d.n < 2) {
      console.log(`${k.padStart(7)}${String(d?.n ?? 0).padStart(10)}${"—".padStart(14)}${"—".padStart(13)}${"—".padStart(8)}${"—".padStart(12)}`);
      continue;
    }
    const media = d.suma / d.n;
    // Desviación típica muestral y error estándar de la media. Sin esto, una
    // diferencia entre tramos puede ser pura casualidad y parecer una ventaja.
    const varianza = Math.max(0, (d.sumaCuadrados - d.n * media * media) / (d.n - 1));
    const errorEstandar = Math.sqrt(varianza / d.n);
    const t = errorEstandar > 0 ? media / errorEstandar : 0;
    medias.push(media);
    tsMax.push(Math.abs(t));
    console.log(
      `${k.padStart(7)}${String(d.n).padStart(10)}${media.toFixed(2).padStart(14)}${errorEstandar.toFixed(2).padStart(13)}` +
        `${t.toFixed(2).padStart(8)}${`${((d.ganadoras / d.n) * 100).toFixed(0)}%`.padStart(12)}`,
    );
  }

  console.log(`\n${"─".repeat(88)}`);
  const creciente = medias.length >= 2 && medias[medias.length - 1]! > medias[0]!;
  // Umbrales deliberadamente exigentes: con |t| < 2 no se distingue de la
  // casualidad, y con menos de 100 señales por tramo tampoco. Un veredicto
  // que ignore esto es peor que no tener veredicto: da falsa confianza.
  const MIN_SENALES = 100;
  const significativo = tsMax.some((t) => t >= 2);
  const muestraSuficiente = orden.every((k) => !tramos[k] || tramos[k]!.n === 0 || tramos[k]!.n >= MIN_SENALES);

  if (creciente && !muestraSuficiente) {
    console.log("VEREDICTO: la expectativa parece crecer con la puntuación, PERO LA MUESTRA NO LLEGA.");
    console.log(`           Hacen falta >=${MIN_SENALES} señales por tramo y hay bastantes menos.`);
    console.log("           Con estos tamaños, la diferencia entre tramos es indistinguible del azar.");
    console.log("           NO es una ventaja demostrada: es una hipótesis que merece más datos.");
    if (!significativo) console.log("           Ningún tramo alcanza |t| >= 2: ninguna media se separa del cero.");
  } else if (creciente && !significativo) {
    console.log("VEREDICTO: la expectativa crece, pero ningún tramo alcanza |t| >= 2.");
    console.log("           Sin significación estadística no hay ventaja que explotar todavía.");
  } else if (creciente) {
    console.log("VEREDICTO: la expectativa CRECE con la puntuación y hay significación.");
    console.log("           Siguiente paso obligatorio: validar fuera de muestra y walk-forward.");
  } else {
    console.log("VEREDICTO: la expectativa NO crece con la puntuación.");
    console.log("           El score no distingue setups buenos de malos: no hay ventaja que explotar");
    console.log("           con estos pesos y este activo. Cambiar los pesos para que salga bien sería");
    console.log("           sobreajustar sobre la misma muestra con la que se evalúa.");
  }
  console.log("\nMuestra pequeña (900 velas ≈ 7 semanas). Sirve para DESCARTAR, no para aprobar.");
}

main();
