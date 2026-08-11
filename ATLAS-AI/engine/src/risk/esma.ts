import { AssetClass, EsmaConfig } from "../config/sleeveConfig";

/**
 * Verificación de apalancamiento ESMA (España) — Tarea 5, restricción dura.
 *
 * ESMA limita el apalancamiento minorista por clase de activo: 1:30 en divisas
 * mayores y 1:20 en oro (los dos que fija el prompt), y tramos más estrictos en
 * índices, materias primas y cripto. El motor lo comprueba sobre el NOCIONAL de
 * CADA orden contra el capital del SLEEVE que la origina — no contra el equity
 * total, porque el margen de un sleeve no puede invadir el de otro (Tarea 1).
 *
 * Fallo seguro: un símbolo sin clasificar se RECHAZA. Nunca se asume un tramo
 * permisivo por defecto — un símbolo nuevo mal clasificado es exactamente el
 * camino por el que se supera el límite sin darse cuenta.
 */

export type EsmaVeredicto =
  | { permitido: true; nocional: number; nocionalMaximo: number; apalancamientoUsado: number }
  | { permitido: false; motivo: "simbolo_sin_clasificar" | "apalancamiento_excedido" | "entrada_invalida"; nocional: number; nocionalMaximo: number };

/** Nocional de una orden: tamaño × precio de entrada, siempre positivo. */
export function nocional(size: number, entryPrice: number): number {
  return Math.abs(size * entryPrice);
}

/** Clase de activo del símbolo, o `undefined` si no está clasificado. */
export function claseDe(esma: EsmaConfig, symbol: string): AssetClass | undefined {
  return esma.clasePorSimbolo[symbol];
}

/**
 * ¿Cabe esta orden dentro del apalancamiento permitido para el capital del sleeve?
 *
 * @param capitalSleeve capital asignado al sleeve (no el equity total de la cuenta)
 */
export function verificarEsma(
  esma: EsmaConfig,
  symbol: string,
  size: number,
  entryPrice: number,
  capitalSleeve: number,
): EsmaVeredicto {
  const valor = nocional(size, entryPrice);

  if (!(size > 0) || !(entryPrice > 0) || !(capitalSleeve > 0)) {
    return { permitido: false, motivo: "entrada_invalida", nocional: valor, nocionalMaximo: 0 };
  }

  const clase = claseDe(esma, symbol);
  if (!clase) {
    return { permitido: false, motivo: "simbolo_sin_clasificar", nocional: valor, nocionalMaximo: 0 };
  }

  const apalancamiento = esma.apalancamientoMax[clase];
  const nocionalMaximo = capitalSleeve * apalancamiento;

  if (valor > nocionalMaximo) {
    return { permitido: false, motivo: "apalancamiento_excedido", nocional: valor, nocionalMaximo };
  }

  return {
    permitido: true,
    nocional: valor,
    nocionalMaximo,
    apalancamientoUsado: valor / capitalSleeve,
  };
}

/**
 * Tamaño máximo que respeta ESMA para un símbolo y capital de sleeve dados.
 * Sirve para RECORTAR una orden en vez de rechazarla: si el riesgo pedido exige
 * un nocional superior al permitido, se opera el tamaño máximo legal.
 * Devuelve 0 si el símbolo no está clasificado (fallo seguro).
 */
export function sizeMaximoEsma(
  esma: EsmaConfig,
  symbol: string,
  entryPrice: number,
  capitalSleeve: number,
): number {
  const clase = claseDe(esma, symbol);
  if (!clase || !(entryPrice > 0) || !(capitalSleeve > 0)) return 0;
  return (capitalSleeve * esma.apalancamientoMax[clase]) / entryPrice;
}
