import type { TransaccionIg } from "../broker/igClient";

/**
 * Reconstrucción de los cierres que hizo EL BRÓKER, no el motor.
 *
 * EL AGUJERO QUE ESTO TAPA, porque es el más caro que ha tenido el sistema:
 * cuando salta un stop o se toca el objetivo, quien cierra es IG. El motor se
 * entera en la pasada siguiente, al reconciliar, y hasta hoy se limitaba a
 * borrar la posición de su estado. Consecuencias medidas sobre la demo del
 * 2026-08/09: 56 operaciones abiertas y UNA sola con cierre y P&L registrados,
 * y —mucho peor— el P&L de esas salidas nunca llegaba a `registrarCierre`, así
 * que los contadores del día y de la semana no lo veían. Los breakers de
 * pérdida diaria y semanal vigilaban un P&L que ignoraba justo las pérdidas
 * que un stop materializa: por eso la cuenta pudo caer un 16,1% sin que
 * saltara ninguno.
 *
 * IG no dice "esta posición se cerró por el stop". Da un extracto de
 * transacciones: nivel de apertura, nivel de cierre, tamaño y P&L cobrado. Hay
 * que emparejar cada posición desaparecida con su transacción, y ese
 * emparejamiento es lo que vive aquí — puro y con tests, porque equivocarlo
 * significa atribuir el P&L de una operación a otra.
 */

/** Lo que el emparejador necesita saber de una posición desaparecida. */
export interface PosicionCerrada {
  entryPrice: number;
  size: number;
}

/** Tolerancia relativa al comparar precios de instrumentos de escalas muy distintas. */
const TOLERANCIA_PRECIO = 1e-4;
/** El tamaño puede venir con signo (IG marca la dirección) y con redondeos. */
const TOLERANCIA_TAMANO = 1e-3;

function pareceIgual(a: number, b: number, tolerancia: number): boolean {
  const escala = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / escala <= tolerancia;
}

/**
 * Busca la transacción de IG que corresponde a una posición desaparecida.
 *
 * La clave es NIVEL DE APERTURA + TAMAÑO, no la referencia: la referencia que
 * IG devuelve en el extracto es la del cierre, no la del `dealId` con el que
 * abrimos, así que casarlas directamente falla. El nivel de apertura sí lo
 * conocemos con exactitud porque lo guardamos al abrir.
 *
 * Devuelve `undefined` si no hay candidata o si hay VARIAS: ante la duda no se
 * atribuye un P&L, porque un P&L asignado a la operación equivocada ensucia la
 * muestra de forma invisible y es peor que un hueco declarado.
 */
export function emparejarCierre(
  transacciones: readonly TransaccionIg[],
  posicion: PosicionCerrada,
): TransaccionIg | undefined {
  const candidatas = transacciones.filter(
    (t) =>
      t.nivelApertura != null &&
      pareceIgual(t.nivelApertura, posicion.entryPrice, TOLERANCIA_PRECIO) &&
      pareceIgual(Math.abs(t.tamano), Math.abs(posicion.size), TOLERANCIA_TAMANO),
  );
  return candidatas.length === 1 ? candidatas[0] : undefined;
}

/** Lo que hace falta para deducir POR QUÉ se cerró. */
export interface ContextoMotivo {
  side: "buy" | "sell";
  /** Stop vigente en el momento del cierre (puede ser el movido por breakeven). */
  stopPrice: number;
  /** Stop con el que se abrió, si se conoce: distingue "stop" de "breakeven". */
  stopInicial?: number;
}

/**
 * Deduce el motivo de salida a partir del nivel al que IG cerró.
 *
 * Es una DEDUCCIÓN, no un dato del bróker, y los nombres lo dicen: nada aquí
 * afirma más de lo que se puede sostener. Un motivo inventado con seguridad
 * falsa es peor que uno que admite no saberlo, porque las métricas de la Fase 1
 * se leen creyéndolo.
 */
export function motivoDeCierre(ctx: ContextoMotivo, nivelCierre: number | null, pnl: number): string {
  if (nivelCierre == null) return pnl >= 0 ? "cierre_broker_ganador" : "cierre_broker_perdedor";

  if (pareceIgual(nivelCierre, ctx.stopPrice, 2e-3)) {
    // Si el stop vigente ya no es el de apertura, lo que saltó fue el breakeven.
    const movido = ctx.stopInicial !== undefined && !pareceIgual(ctx.stopPrice, ctx.stopInicial, 2e-3);
    return movido ? "breakeven" : "stop";
  }
  // Sin `limitPrice` guardado en la posición no se puede afirmar que fuera el
  // objetivo, aunque sea lo más probable en un cierre ganador lejos del stop.
  return pnl >= 0 ? "objetivo_o_cierre_broker" : "cierre_broker_perdedor";
}
