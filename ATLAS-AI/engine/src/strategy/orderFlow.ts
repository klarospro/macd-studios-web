/**
 * Motor de microestructura sobre OHLCV.
 *
 * QUÉ ES MEDIBLE Y QUÉ ES APROXIMACIÓN — leer antes de usar nada de aquí.
 *
 * IG entrega, por vela: apertura, máximo, mínimo, cierre (en bid y en ask) y
 * `lastTradedVolume`. NO entrega libro de órdenes ni trades con su agresor.
 * Eso parte las señales del brief de microestructura en dos grupos:
 *
 *   MEDIBLE DE VERDAD
 *     · volumen y volumen relativo
 *     · VWAP y distancia al VWAP        (necesitan volumen: ahora existe)
 *     · spread real                     (bid/ask por vela)
 *     · expansión de rango, régimen de volatilidad
 *     · barrido de liquidez             (geometría de precio + volumen)
 *     · esfuerzo contra resultado       (absorción de manual: mucho volumen,
 *                                        poco recorrido)
 *
 *   APROXIMACIÓN — se nombra `Proxy` en el código para que nadie lo confunda
 *     · presión compradora/vendedora    (dónde cierra dentro del rango, no quién
 *                                        cruzó el spread)
 *     · delta y delta acumulado         (derivados de lo anterior)
 *
 * El delta REAL exige clasificar cada operación por agresor, y eso necesita
 * datos tick a tick con bid/ask del momento. Con velas es imposible: dos velas
 * idénticas pueden tener delta real opuesto. La aproximación por posición del
 * cierre en el rango (Close Location Value) correlaciona con el delta pero NO
 * es el delta. Tratarla como si lo fuera es el error que convierte un sistema
 * de order flow en un indicador con nombre elegante.
 */

export interface VelaFlujo {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumen: number | null;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Rango de la vela. Cero cuando apertura, máximo, mínimo y cierre coinciden. */
export function rango(v: VelaFlujo): number {
  return v.high - v.low;
}

/**
 * Close Location Value: dónde cierra el precio dentro de su rango, en [-1, +1].
 * +1 = cierra en máximos (compradores mandaron), −1 = en mínimos.
 * Es la base de la aproximación de presión, NO una medida de agresión real.
 */
export function clv(v: VelaFlujo): number {
  const r = rango(v);
  if (!(r > 0)) return 0;
  return ((v.close - v.low) - (v.high - v.close)) / r;
}

/**
 * Delta aproximado de una vela: volumen firmado por la posición del cierre.
 * `Proxy` en el nombre a propósito: ver la cabecera del fichero.
 */
export function deltaProxy(v: VelaFlujo): number {
  return (v.volumen ?? 0) * clv(v);
}

/** Delta acumulado sobre una ventana. Mide desequilibrio sostenido, no puntual. */
export function deltaAcumuladoProxy(velas: VelaFlujo[], hasta: number, ventana: number): number {
  let suma = 0;
  for (let i = Math.max(0, hasta - ventana + 1); i <= hasta; i++) {
    const v = velas[i];
    if (v) suma += deltaProxy(v);
  }
  return suma;
}

/** VWAP de la ventana. Necesita volumen: con Deriv no se podía calcular. */
export function vwap(velas: VelaFlujo[], hasta: number, ventana: number): number | null {
  let pv = 0;
  let vol = 0;
  for (let i = Math.max(0, hasta - ventana + 1); i <= hasta; i++) {
    const v = velas[i];
    if (!v || v.volumen == null) continue;
    const tipico = (v.high + v.low + v.close) / 3;
    pv += tipico * v.volumen;
    vol += v.volumen;
  }
  return vol > 0 ? pv / vol : null;
}

/** Media simple de una serie extraída de las velas. */
function media(velas: VelaFlujo[], hasta: number, ventana: number, f: (v: VelaFlujo) => number): number | null {
  const desde = hasta - ventana + 1;
  if (desde < 0) return null;
  let s = 0;
  let n = 0;
  for (let i = desde; i <= hasta; i++) {
    const v = velas[i];
    if (!v) continue;
    s += f(v);
    n++;
  }
  return n > 0 ? s / n : null;
}

/** Volumen de la vela frente a su media reciente. 2 = el doble de lo normal. */
export function volumenRelativo(velas: VelaFlujo[], t: number, ventana = 20): number | null {
  const actual = velas[t]?.volumen;
  if (actual == null) return null;
  const m = media(velas, t - 1, ventana, (v) => v.volumen ?? 0);
  return m && m > 0 ? actual / m : null;
}

/** Rango de la vela frente a su media reciente. Mide expansión o compresión. */
export function rangoRelativo(velas: VelaFlujo[], t: number, ventana = 20): number | null {
  const v = velas[t];
  if (!v) return null;
  const m = media(velas, t - 1, ventana, rango);
  return m && m > 0 ? rango(v) / m : null;
}

/**
 * ESFUERZO CONTRA RESULTADO — la absorción de manual, y sí es medible con OHLCV.
 *
 * Mucho volumen moviendo poco precio significa que alguien está absorbiendo la
 * agresión: hay órdenes pasivas comiéndose todo lo que entra. Es una de las
 * pocas lecturas de microestructura que no necesita libro de órdenes.
 *
 * Devuelve volumen relativo dividido por rango relativo. Por encima de ~2, el
 * esfuerzo no se está traduciendo en movimiento.
 */
export function esfuerzoVsResultado(velas: VelaFlujo[], t: number, ventana = 20): number | null {
  const vr = volumenRelativo(velas, t, ventana);
  const rr = rangoRelativo(velas, t, ventana);
  if (vr == null || rr == null || !(rr > 0)) return null;
  return vr / rr;
}

// ---------------------------------------------------------------------------
// Barrido de liquidez con confirmación de volumen
// ---------------------------------------------------------------------------

export interface Barrido {
  tipo: "alcista" | "bajista";
  /** Nivel barrido (mínimo o máximo previo). */
  nivel: number;
  /** Índice de la vela donde estaba el nivel. */
  indiceNivel: number;
  /** Volumen relativo de la vela que barrió. */
  volumenRelativo: number;
  /** Esfuerzo/resultado en el barrido: alto = absorción. */
  absorcion: number;
}

/**
 * Barrido de liquidez: el precio perfora un extremo reciente y VUELVE dentro.
 *
 * Alcista: se pierde el mínimo previo (se barren stops de largos) y la vela
 * cierra por encima de él → los vendedores que entraron quedan atrapados.
 *
 * La diferencia con `liquidityGrab.ts`, que solo mira geometría de precio: aquí
 * se exige que el barrido venga con volumen. Un barrido sin volumen es ruido;
 * uno con volumen y poco recorrido posterior es absorción, que es la firma que
 * el brief pedía y que sin `lastTradedVolume` era imposible de ver.
 */
export function detectarBarrido(
  velas: VelaFlujo[],
  t: number,
  opciones: { lookback?: number; volumenMinimo?: number; ventanaMedia?: number } = {},
): Barrido | null {
  const { lookback = 20, volumenMinimo = 1.3, ventanaMedia = 20 } = opciones;
  const actual = velas[t];
  if (!actual || t < lookback + 1) return null;

  const vr = volumenRelativo(velas, t, ventanaMedia);
  if (vr == null || vr < volumenMinimo) return null; // sin volumen no hay barrido
  const abs = esfuerzoVsResultado(velas, t, ventanaMedia) ?? 0;

  // Extremos del tramo ANTERIOR a la vela actual: nunca se mira hacia delante.
  let minimo = Infinity;
  let maximo = -Infinity;
  let idxMin = -1;
  let idxMax = -1;
  for (let i = t - lookback; i < t; i++) {
    const v = velas[i];
    if (!v) continue;
    if (v.low < minimo) { minimo = v.low; idxMin = i; }
    if (v.high > maximo) { maximo = v.high; idxMax = i; }
  }
  if (idxMin < 0 || idxMax < 0) return null;

  // Alcista: perfora el mínimo y RECUPERA (cierra por encima).
  if (actual.low < minimo && actual.close > minimo) {
    return { tipo: "alcista", nivel: minimo, indiceNivel: idxMin, volumenRelativo: vr, absorcion: abs };
  }
  // Bajista: perfora el máximo y lo pierde.
  if (actual.high > maximo && actual.close < maximo) {
    return { tipo: "bajista", nivel: maximo, indiceNivel: idxMax, volumenRelativo: vr, absorcion: abs };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Régimen
// ---------------------------------------------------------------------------

export type Regimen = "tendencia_alcista" | "tendencia_bajista" | "rango" | "alta_volatilidad";

/**
 * Régimen de mercado a partir de precio y volatilidad.
 *
 * El brief pedía que el sistema NO se comporte igual en todos los regímenes.
 * Esta es la clasificación mínima honesta con OHLCV: pendiente de la media
 * para la dirección, y expansión de rango para la volatilidad.
 */
export function detectarRegimen(velas: VelaFlujo[], t: number, ventana = 50): Regimen {
  const rr = rangoRelativo(velas, t, 20) ?? 1;
  if (rr > 2.5) return "alta_volatilidad";

  const actual = velas[t]?.close;
  const m = media(velas, t, ventana, (v) => v.close);
  const mPrevia = media(velas, t - Math.floor(ventana / 2), ventana, (v) => v.close);
  if (actual == null || m == null || mPrevia == null) return "rango";

  const pendiente = (m - mPrevia) / mPrevia;
  // 0,5% de desplazamiento de la media en media ventana: por debajo es lateral.
  if (pendiente > 0.005 && actual > m) return "tendencia_alcista";
  if (pendiente < -0.005 && actual < m) return "tendencia_bajista";
  return "rango";
}

// ---------------------------------------------------------------------------
// Puntuación por confluencia
// ---------------------------------------------------------------------------

export interface PesosSenal {
  barrido: number;
  volumen: number;
  absorcion: number;
  delta: number;
  vwap: number;
  regimen: number;
}

/**
 * Pesos de partida. Son EXPLÍCITOS y configurables a propósito: el brief exige
 * no inventarlos y validarlos históricamente. Estos son un punto de partida
 * neutro (reparto casi uniforme), no un resultado de optimización — usarlos
 * como si estuvieran validados sería justo el autoengaño que hay que evitar.
 */
export const PESOS_INICIALES: PesosSenal = {
  barrido: 30, volumen: 15, absorcion: 20, delta: 15, vwap: 10, regimen: 10,
};

export interface Puntuacion {
  total: number;
  side: "buy" | "sell";
  /** Desglose: por qué obtuvo esa nota. Sin esto no se puede auditar nada. */
  componentes: Record<string, number>;
  regimen: Regimen;
}

/**
 * Puntúa un setup de barrido por CONFLUENCIA, en 0-100.
 *
 * Ningún componente por sí solo genera señal: sin barrido no hay puntuación en
 * absoluto, y el resto solo suma. Es la regla del brief —"la señal debe surgir
 * de la confluencia"— hecha código.
 */
export function puntuarSetup(
  velas: VelaFlujo[],
  t: number,
  pesos: PesosSenal = PESOS_INICIALES,
  opciones: { ventanaDelta?: number; ventanaVwap?: number } = {},
): Puntuacion | null {
  const { ventanaDelta = 10, ventanaVwap = 30 } = opciones;
  const barrido = detectarBarrido(velas, t);
  if (!barrido) return null; // sin el setup base no hay nada que puntuar

  const side: "buy" | "sell" = barrido.tipo === "alcista" ? "buy" : "sell";
  const signo = side === "buy" ? 1 : -1;
  const componentes: Record<string, number> = {};

  // 1. El barrido en sí: puntúa completo por existir.
  componentes.barrido = pesos.barrido;

  // 2. Volumen: cuanto más por encima de lo normal, mejor. Se satura en 3x.
  componentes.volumen = pesos.volumen * Math.min(1, (barrido.volumenRelativo - 1) / 2);

  // 3. Absorción: esfuerzo alto sin resultado. Se satura en 3.
  componentes.absorcion = pesos.absorcion * Math.min(1, Math.max(0, (barrido.absorcion - 1) / 2));

  // 4. Delta acumulado a favor de la dirección del barrido.
  const delta = deltaAcumuladoProxy(velas, t, ventanaDelta);
  const volTotal = velas.slice(Math.max(0, t - ventanaDelta + 1), t + 1).reduce((a, v) => a + (v.volumen ?? 0), 0);
  const deltaNorm = volTotal > 0 ? delta / volTotal : 0;
  componentes.delta = pesos.delta * Math.max(0, Math.min(1, signo * deltaNorm * 2));

  // 5. VWAP: comprar por debajo del VWAP y vender por encima es la posición
  //    favorable; hacerlo al revés es perseguir el precio.
  const vw = vwap(velas, t, ventanaVwap);
  const cierre = velas[t]?.close;
  if (vw != null && cierre != null && vw > 0) {
    const distancia = (cierre - vw) / vw;
    componentes.vwap = pesos.vwap * Math.max(0, Math.min(1, -signo * distancia * 200));
  } else {
    componentes.vwap = 0;
  }

  // 6. Régimen: un barrido con reversión pide rango o alta volatilidad. En
  //    tendencia contraria pierde valor, porque el "barrido" suele ser
  //    continuación y no vuelta.
  const regimen = detectarRegimen(velas, t);
  const favorable =
    regimen === "rango" || regimen === "alta_volatilidad" ||
    (regimen === "tendencia_alcista" && side === "buy") ||
    (regimen === "tendencia_bajista" && side === "sell");
  componentes.regimen = favorable ? pesos.regimen : 0;

  const total = Object.values(componentes).reduce((a, b) => a + b, 0);
  return { total: Math.round(total * 100) / 100, side, componentes, regimen };
}
