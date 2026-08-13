/**
 * Banco de pruebas COMÚN para comparar estrategias sobre un mismo activo.
 *
 * El objetivo no es lucir una curva bonita, es responder a una pregunta:
 * ¿cuál de las estrategias de Atlas aporta algo sobre el oro? Para que la
 * respuesta signifique algo, las cinco corren con:
 *   - el mismo capital inicial,
 *   - el mismo riesgo por operación,
 *   - el mismo coste (10 bps por lado, el validado a 10 años),
 *   - la misma serie de precios,
 *   - y las mismas métricas.
 *
 * Cambiar cualquiera de esas cinco cosas entre estrategias convertiría la
 * comparativa en propaganda.
 */

export interface Barra {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ConfigBacktest {
  capitalInicial: number;
  /** Fracción del capital arriesgada por operación (0.01 = 1%). */
  riesgoPorTrade: number;
  /** Coste por lado en puntos básicos sobre el nocional. */
  costeBps: number;
  /** Barras por año, para anualizar (252 diario, 252*26 para M15 de forex). */
  barrasPorAno: number;
  /**
   * Apalancamiento máximo de la clase del activo (ESMA). Sin este tope el
   * simulador miente: una señal con el stop pegado al precio da
   * `size = riesgo/distancia` ≈ infinito, y la curva se va a -65.000%.
   * En producción esto lo frena `verificarEsma`; aquí se replica esa regla.
   * Oro = 20 según `config/atlas.yaml`.
   */
  apalancamientoMax: number;
}

export const CONFIG_BASE: ConfigBacktest = {
  capitalInicial: 10_000,
  riesgoPorTrade: 0.01,
  costeBps: 10,
  barrasPorAno: 252,
  apalancamientoMax: 20,
};

/** Lo que una estrategia quiere hacer en la barra `t`. */
export interface Intencion {
  side: "buy" | "sell";
  stopPrice: number;
  /** Objetivo opcional. Sin él, se sale por stop o por señal contraria. */
  takeProfit?: number;
  /** Escala del riesgo (0..1). El vol-target del Core la usa. */
  escalaRiesgo?: number;
}

/**
 * Una estrategia, vista por el banco de pruebas: en la barra `t`, ¿qué quieres?
 * `null` = estar fuera. Si ya hay posición abierta y devuelve el lado contrario,
 * se cierra y se abre la nueva (giro).
 */
export type Estrategia = (barras: Barra[], t: number) => Intencion | null;

export interface Operacion {
  entradaIdx: number;
  salidaIdx: number;
  side: "buy" | "sell";
  precioEntrada: number;
  precioSalida: number;
  size: number;
  pnl: number;
  motivo: "stop" | "objetivo" | "giro" | "fin";
}

export interface Resultado {
  nombre: string;
  equityFinal: number;
  rentabilidadPct: number;
  /** Anualizada a partir del número de barras realmente simuladas. */
  cagrPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  operaciones: number;
  aciertosPct: number;
  profitFactor: number;
  costesTotales: number;
  curva: number[];
}

const coste = (nocional: number, bps: number) => Math.abs(nocional) * (bps / 10_000);

/**
 * Simula una estrategia discreta (entrada, stop, objetivo, giro).
 *
 * Reglas deliberadas, porque cada una puede inflar el resultado si se elige mal:
 *   - Se entra al CIERRE de la barra de la señal, nunca al precio intrabarra.
 *   - El stop se comprueba con el mínimo/máximo de las barras SIGUIENTES, y si
 *     una barra toca stop y objetivo a la vez se asume el STOP (el peor caso).
 *   - El tamaño sale del riesgo, no de un nocional fijo: size = riesgo/|entrada-stop|.
 */
export function simular(nombre: string, barras: Barra[], estrategia: Estrategia, cfg: ConfigBacktest = CONFIG_BASE): Resultado {
  let equity = cfg.capitalInicial;
  let costesTotales = 0;
  const curva: number[] = [];
  const operaciones: Operacion[] = [];

  let abierta: { side: "buy" | "sell"; entrada: number; stop: number; tp?: number; size: number; idx: number } | null = null;

  for (let t = 0; t < barras.length; t++) {
    const barra = barras[t]!;

    // 1. ¿Se cierra lo que hay abierto?
    if (abierta) {
      const tocaStop = abierta.side === "buy" ? barra.low <= abierta.stop : barra.high >= abierta.stop;
      const tocaTp = abierta.tp !== undefined && (abierta.side === "buy" ? barra.high >= abierta.tp : barra.low <= abierta.tp);

      // Peor caso primero: si la barra toca ambos, se asume el stop.
      if (tocaStop || tocaTp) {
        const precioSalida = tocaStop ? abierta.stop : abierta.tp!;
        const bruto = (abierta.side === "buy" ? precioSalida - abierta.entrada : abierta.entrada - precioSalida) * abierta.size;
        const c = coste(precioSalida * abierta.size, cfg.costeBps);
        equity += bruto - c;
        costesTotales += c;
        operaciones.push({
          entradaIdx: abierta.idx, salidaIdx: t, side: abierta.side,
          precioEntrada: abierta.entrada, precioSalida, size: abierta.size,
          pnl: bruto - c, motivo: tocaStop ? "stop" : "objetivo",
        });
        abierta = null;
      }
    }

    const intencion = estrategia(barras, t);

    // 2. Giro: la estrategia quiere el lado contrario al que tenemos.
    if (abierta && intencion && intencion.side !== abierta.side) {
      const bruto = (abierta.side === "buy" ? barra.close - abierta.entrada : abierta.entrada - barra.close) * abierta.size;
      const c = coste(barra.close * abierta.size, cfg.costeBps);
      equity += bruto - c;
      costesTotales += c;
      operaciones.push({
        entradaIdx: abierta.idx, salidaIdx: t, side: abierta.side,
        precioEntrada: abierta.entrada, precioSalida: barra.close, size: abierta.size,
        pnl: bruto - c, motivo: "giro",
      });
      abierta = null;
    }

    // 3. Apertura. Con los MISMOS topes que el gate de producción, o el
    //    resultado no describe al bot que se va a poner a operar.
    if (!abierta && intencion && equity > 0) {
      const distancia = Math.abs(barra.close - intencion.stopPrice);
      if (distancia > 0) {
        const riesgo = equity * cfg.riesgoPorTrade * (intencion.escalaRiesgo ?? 1);
        // Tope ESMA: el nocional no puede pasar de capital × apalancamiento.
        const sizeMaximo = (equity * cfg.apalancamientoMax) / barra.close;
        const size = Math.min(riesgo / distancia, sizeMaximo);
        if (size > 0) {
          const c = coste(barra.close * size, cfg.costeBps);
          equity -= c;
          costesTotales += c;
          abierta = { side: intencion.side, entrada: barra.close, stop: intencion.stopPrice, tp: intencion.takeProfit, size, idx: t };
        }
      }
    }

    // 4. Equity marcado a mercado (lo abierto cuenta, si no el drawdown miente).
    const flotante = abierta
      ? (abierta.side === "buy" ? barra.close - abierta.entrada : abierta.entrada - barra.close) * abierta.size
      : 0;
    curva.push(equity + flotante);

    // Ruina: una cuenta a cero no sigue operando. Dejar que la simulación
    // continúe en negativo produce cifras imposibles (-65.000%) que ocultan
    // el único dato que importa: la cuenta se acabó en la barra t.
    if (equity + flotante <= 0) {
      curva[curva.length - 1] = 0;
      break;
    }
  }

  // Cierre forzoso al final: una posición abierta no puede contarse como ganancia realizada.
  if (abierta) {
    const ultima = barras[barras.length - 1]!;
    const bruto = (abierta.side === "buy" ? ultima.close - abierta.entrada : abierta.entrada - ultima.close) * abierta.size;
    const c = coste(ultima.close * abierta.size, cfg.costeBps);
    equity += bruto - c;
    costesTotales += c;
    operaciones.push({
      entradaIdx: abierta.idx, salidaIdx: barras.length - 1, side: abierta.side,
      precioEntrada: abierta.entrada, precioSalida: ultima.close, size: abierta.size,
      pnl: bruto - c, motivo: "fin",
    });
    curva[curva.length - 1] = equity;
  }

  return metricas(nombre, curva, operaciones, costesTotales, cfg);
}

export function metricas(
  nombre: string,
  curva: number[],
  operaciones: Operacion[],
  costesTotales: number,
  cfg: ConfigBacktest,
): Resultado {
  const equityFinal = curva[curva.length - 1] ?? cfg.capitalInicial;
  const rentabilidad = equityFinal / cfg.capitalInicial - 1;

  // Rendimientos barra a barra para Sharpe y drawdown.
  const rets: number[] = [];
  for (let i = 1; i < curva.length; i++) {
    const previo = curva[i - 1]!;
    if (previo > 0) rets.push(curva[i]! / previo - 1);
  }
  const media = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const varianza = rets.length > 1 ? rets.reduce((a, r) => a + (r - media) ** 2, 0) / (rets.length - 1) : 0;
  const desv = Math.sqrt(varianza);
  const sharpe = desv > 0 ? (media / desv) * Math.sqrt(cfg.barrasPorAno) : 0;

  let pico = curva[0] ?? cfg.capitalInicial;
  let maxDd = 0;
  for (const v of curva) {
    if (v > pico) pico = v;
    if (pico > 0) maxDd = Math.max(maxDd, 1 - v / pico);
  }

  const ganadoras = operaciones.filter((o) => o.pnl > 0);
  const perdedoras = operaciones.filter((o) => o.pnl <= 0);
  const sumaG = ganadoras.reduce((a, o) => a + o.pnl, 0);
  const sumaP = Math.abs(perdedoras.reduce((a, o) => a + o.pnl, 0));

  const anos = curva.length / cfg.barrasPorAno;
  const cagr = anos > 0 && equityFinal > 0 ? (equityFinal / cfg.capitalInicial) ** (1 / anos) - 1 : 0;

  return {
    nombre,
    equityFinal,
    rentabilidadPct: rentabilidad * 100,
    cagrPct: cagr * 100,
    sharpe,
    maxDrawdownPct: maxDd * 100,
    operaciones: operaciones.length,
    aciertosPct: operaciones.length ? (ganadoras.length / operaciones.length) * 100 : 0,
    profitFactor: sumaP > 0 ? sumaG / sumaP : sumaG > 0 ? Infinity : 0,
    costesTotales,
    curva,
  };
}

/** Comprar y mantener, la vara de medir honesta: si nadie la bate, sobra el bot. */
export function comprarYMantener(barras: Barra[], cfg: ConfigBacktest = CONFIG_BASE): Resultado {
  const primera = barras[0]!;
  const size = cfg.capitalInicial / primera.close;
  const curva = barras.map((b) => size * b.close);
  const operaciones: Operacion[] = [
    {
      entradaIdx: 0, salidaIdx: barras.length - 1, side: "buy",
      precioEntrada: primera.close, precioSalida: barras[barras.length - 1]!.close,
      size, pnl: curva[curva.length - 1]! - cfg.capitalInicial, motivo: "fin",
    },
  ];
  return metricas("Comprar y mantener", curva, operaciones, 0, cfg);
}
