import { Side } from "../domain/types";

/**
 * Stop a punto de equilibrio ("breakeven") para los sleeves de scalping.
 *
 * La regla, en una frase: cuando la operación ya gana lo que arriesgaba, el
 * stop se mueve al precio de entrada y esa operación deja de poder perder.
 *
 * POR QUÉ AQUÍ Y NO EN EL CICLO. El disparo se decide con DINERO (P&L vivo
 * contra `riskAmount`) y el stop nuevo se calcula con PRECIO (la distancia
 * original al stop). Mezclar las dos unidades en el sitio equivocado es
 * exactamente el error que ya produjo tamaños mal calculados en este motor
 * ("el tamaño se calcula en unidades de IG, no de Deriv"), así que la conversión
 * vive en una función pura, medible y sin bróker delante.
 *
 * LO QUE ESTA REGLA CUESTA, porque no es gratis y conviene tenerlo escrito:
 * mover el stop a la entrada convierte perdedoras en operaciones planas, pero
 * también corta ganadoras que solo estaban respirando. En seguimiento de
 * tendencia eso resta; en scalping —horizonte de horas, objetivo cercano— la
 * literatura y el diseño del sleeve B (TP ≈ 1x el stop) lo hacen defendible.
 * Es una hipótesis a medir con la demo, no un hecho: por eso `activo` existe.
 */

export interface ParamsBreakeven {
  activo: boolean;
  /** Múltiplos de R de beneficio vivo a partir de los cuales se mueve el stop. */
  activarEnR: number;
  /**
   * Dónde queda el stop, en múltiplos de R desde la entrada. 0 = entrada exacta.
   * Un valor pequeño (0,1) deja el stop ligeramente a favor y cubre la comisión
   * de cierre, que con el stop clavado en la entrada se paga igual.
   */
  offsetR: number;
}

/** Posición viva, con lo mínimo que la regla necesita saber. */
export interface PosicionBreakeven {
  side: Side;
  entryPrice: number;
  /** Stop VIGENTE, que puede ser ya el movido en una pasada anterior. */
  stopPrice: number;
  /** Riesgo con el que se abrió, en moneda de cuenta. Define R. */
  riskAmount: number;
}

/** Distancia original al stop (R en unidades de precio) de una posición. */
export function distanciaR(entryPrice: number, stopOriginal: number): number {
  return Math.abs(entryPrice - stopOriginal);
}

/**
 * Devuelve el stop nuevo si toca moverlo, o `undefined` si no.
 *
 * `rOriginal` es la distancia al stop de la APERTURA, no la vigente: una vez
 * movido el stop, medir R contra el stop nuevo daría R≈0 y la regla se
 * dispararía sola en bucle. Es el error silencioso de esta clase de reglas.
 */
export function stopBreakeven(
  posicion: PosicionBreakeven,
  pnlVivo: number,
  rOriginal: number,
  params: ParamsBreakeven,
): number | undefined {
  if (!params.activo) return undefined;
  if (!(rOriginal > 0)) return undefined;
  if (!(posicion.riskAmount > 0)) return undefined;

  // Disparo en dinero: "ya gano lo que arriesgo" es una cuenta de euros, y así
  // no depende de la escala de precio del instrumento (IG cotiza EUR/USD en
  // 11674,8 y el oro en 4620,5 — comparar puntos entre ellos no significa nada).
  if (pnlVivo < params.activarEnR * posicion.riskAmount) return undefined;

  const desplazamiento = params.offsetR * rOriginal;
  const nuevo =
    posicion.side === "buy"
      ? posicion.entryPrice + desplazamiento
      : posicion.entryPrice - desplazamiento;

  // Solo se mueve a MEJOR. Nunca se afloja un stop: si el vigente ya protege
  // más que el punto de equilibrio, tocarlo sería aumentar el riesgo vivo.
  const mejora = posicion.side === "buy" ? nuevo > posicion.stopPrice : nuevo < posicion.stopPrice;
  return mejora ? nuevo : undefined;
}

/** Lee el bloque `salidas.breakeven` del YAML de un sleeve. Ausente = apagado. */
export function paramsBreakevenDesdeConfig(bloque: Record<string, any>): ParamsBreakeven {
  const raw = bloque?.salidas?.breakeven;
  if (!raw || raw.activo !== true) return { activo: false, activarEnR: 0, offsetR: 0 };
  const activarEnR = Number(raw.activar_en_r);
  const offsetR = Number(raw.offset_r ?? 0);
  // Fallo seguro: una config a medias apaga la regla en vez de inventar un
  // umbral. Un breakeven que salta cuando no debe cierra operaciones buenas.
  if (!Number.isFinite(activarEnR) || activarEnR <= 0) return { activo: false, activarEnR: 0, offsetR: 0 };
  if (!Number.isFinite(offsetR) || offsetR < 0) return { activo: false, activarEnR: 0, offsetR: 0 };
  return { activo: true, activarEnR, offsetR };
}
