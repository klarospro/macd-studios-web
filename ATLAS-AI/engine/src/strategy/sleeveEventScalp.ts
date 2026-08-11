import { atrVelas, fechaUtc, Vela } from "../domain/bars";
import { SleeveSignal } from "../risk/sleeveRiskGate";

/**
 * Sleeve C "EventScalp" (Noticias macro). Tarea 4 de 27_SCALPING/04.
 *
 * Reparto de responsabilidades, que es lo que este módulo protege: la IA
 * PUNTÚA la sorpresa (actual vs consenso: magnitud y dirección); el MOTOR
 * decide con reglas fijas. Ninguna función de aquí llama a un modelo ni acepta
 * una decisión de uno: recibe una puntuación numérica y la compara con un
 * umbral del YAML. Si mañana la IA se equivoca, el daño está acotado por el
 * mismo riesgo por operación que todo lo demás.
 *
 * La ventana de entrada (60-120 s tras el dato) no es un detalle: en el
 * instante de la publicación el spread se abre varias veces y el precio da
 * latigazos. Entrar ahí es pagar el peor spread del día — el error estructural
 * que ya mató al liquidity grab (27_SCALPING/03). Se espera a que el spread
 * vuelva a la normalidad Y a que el movimiento se confirme.
 */

export type TipoEvento = "CPI" | "NFP" | "FOMC" | "ECB" | "BOE" | "PIB" | "PMI_FLASH";

export interface EventoMacro {
  id: string;
  tipo: TipoEvento;
  /** Momento de la publicación, epoch en segundos UTC. */
  epoch: number;
  /** 1-3; solo se opera el 3 (alto impacto). */
  impacto: number;
  /** Símbolo sobre el que se operaría la reacción. */
  symbol: string;
  /** Dato publicado y consenso previo. Sin ambos no hay sorpresa medible. */
  actual?: number;
  consenso?: number;
  /**
   * Signo del efecto de una sorpresa AL ALZA sobre el activo: +1 si un dato
   * por encima del consenso empuja el precio arriba, -1 si lo empuja abajo.
   * Se declara en el calendario porque depende del par y del indicador.
   */
  signoEfecto: 1 | -1;
}

/** Fuente de eventos macro. Implementable con YAML manual o con una API. */
export interface EconomicCalendar {
  /** Eventos cuya publicación cae en [desdeEpoch, hastaEpoch). */
  eventos(desdeEpoch: number, hastaEpoch: number): EventoMacro[];
}

export interface EventScalpParams {
  correlationGroup: string;
  eventosPermitidos: TipoEvento[];
  impactoMinimo: number;
  esperaMinSeg: number;
  esperaMaxSeg: number;
  momentumVentanaSeg: number;
  momentumMinAtr: number;
  stopAtr: number;
  tpR: number;
  puntuacionMinima: number;
  noOperarSiCoinciden: boolean;
  coincidenciaVentanaMin: number;
  atrPeriodo: number;
}

/**
 * Puntúa la sorpresa: magnitud relativa al consenso, con signo según la
 * dirección esperada del efecto. Devuelve null si falta el dato o el consenso
 * —sin ambos no hay sorpresa que medir— o si el consenso es 0 (la sorpresa
 * relativa sería infinita).
 */
export function puntuarSorpresa(evento: EventoMacro): { puntuacion: number; side: "buy" | "sell" } | null {
  const { actual, consenso } = evento;
  if (actual === undefined || consenso === undefined) return null;
  if (consenso === 0) return null;

  const desvio = (actual - consenso) / Math.abs(consenso);
  if (desvio === 0) return null;

  const dirigido = desvio * evento.signoEfecto;
  return { puntuacion: Math.abs(dirigido), side: dirigido > 0 ? "buy" : "sell" };
}

/** ¿Es un evento operable: alto impacto y de la lista permitida? */
export function esOperable(evento: EventoMacro, params: EventScalpParams): boolean {
  return evento.impacto >= params.impactoMinimo && params.eventosPermitidos.includes(evento.tipo);
}

/**
 * ¿Coincide este evento con otro de alto impacto? Si sí, no se opera ninguno:
 * dos datos a la vez hacen indistinguible qué mueve el precio, y el stop de
 * 0,5 ATR no sobrevive a dos latigazos superpuestos.
 */
export function coincideConOtro(
  evento: EventoMacro,
  todos: EventoMacro[],
  params: EventScalpParams,
): boolean {
  if (!params.noOperarSiCoinciden) return false;
  const ventana = params.coincidenciaVentanaMin * 60;
  return todos.some(
    (otro) =>
      otro.id !== evento.id &&
      esOperable(otro, params) &&
      Math.abs(otro.epoch - evento.epoch) <= ventana,
  );
}

/** ¿Estamos dentro de la ventana de entrada (60-120 s tras la publicación)? */
export function enVentanaEntrada(evento: EventoMacro, ahoraEpoch: number, params: EventScalpParams): boolean {
  const transcurrido = ahoraEpoch - evento.epoch;
  return transcurrido >= params.esperaMinSeg && transcurrido <= params.esperaMaxSeg;
}

/**
 * Momentum confirmado: el precio se movió más de `momentumMinAtr` × ATR en los
 * primeros segundos tras el dato, y EN LA MISMA DIRECCIÓN que la sorpresa.
 *
 * `precioPublicacion` es el último precio antes del dato; `precioActual` el de
 * ahora. Un movimiento fuerte en dirección contraria a la sorpresa NO confirma
 * —significa que el mercado leyó otra cosa— y se descarta la operación.
 */
export function confirmaMomentum(
  precioPublicacion: number,
  precioActual: number,
  side: "buy" | "sell",
  atr: number,
  params: EventScalpParams,
): boolean {
  if (!(atr > 0)) return false;
  const movimiento = precioActual - precioPublicacion;
  const umbral = atr * params.momentumMinAtr;
  return side === "buy" ? movimiento >= umbral : movimiento <= -umbral;
}

/** Contexto de mercado en el instante de decidir. */
export interface ContextoEvento {
  ahoraEpoch: number;
  precioPublicacion: number;
  precioActual: number;
  /** Spread actual y su línea base, para la regla de 1.5x del gate. */
  spreadActual?: number;
  spreadNormal?: number;
  spreadMuestras?: number;
}

export type MotivoDescarte =
  | "no_operable"
  | "coincide_con_otro_evento"
  | "fuera_de_ventana"
  | "sorpresa_no_medible"
  | "sorpresa_insuficiente"
  | "momentum_no_confirma"
  | "atr_no_disponible";

export type ResultadoEventScalp =
  | { operar: true; signal: SleeveSignal; puntuacion: number }
  | { operar: false; motivo: MotivoDescarte };

/**
 * Decide si operar un evento. Devuelve el motivo del descarte en vez de un
 * simple null: en un sleeve que solo verá ~20 eventos en toda la Fase 1, saber
 * POR QUÉ no se operó cada uno es la mitad de la información.
 */
export function evaluarEvento(
  evento: EventoMacro,
  todosLosEventos: EventoMacro[],
  velas: Vela[],
  t: number,
  ctx: ContextoEvento,
  params: EventScalpParams,
): ResultadoEventScalp {
  if (!esOperable(evento, params)) return { operar: false, motivo: "no_operable" };
  if (coincideConOtro(evento, todosLosEventos, params)) {
    return { operar: false, motivo: "coincide_con_otro_evento" };
  }
  if (!enVentanaEntrada(evento, ctx.ahoraEpoch, params)) {
    return { operar: false, motivo: "fuera_de_ventana" };
  }

  const sorpresa = puntuarSorpresa(evento);
  if (!sorpresa) return { operar: false, motivo: "sorpresa_no_medible" };
  if (sorpresa.puntuacion < params.puntuacionMinima) {
    return { operar: false, motivo: "sorpresa_insuficiente" };
  }

  const atr = atrVelas(velas, t, params.atrPeriodo);
  if (atr === null) return { operar: false, motivo: "atr_no_disponible" };

  if (!confirmaMomentum(ctx.precioPublicacion, ctx.precioActual, sorpresa.side, atr, params)) {
    return { operar: false, motivo: "momentum_no_confirma" };
  }

  const distancia = atr * params.stopAtr;
  const entryPrice = ctx.precioActual;

  return {
    operar: true,
    puntuacion: sorpresa.puntuacion,
    signal: {
      sleeve: "eventscalp",
      symbol: evento.symbol,
      side: sorpresa.side,
      entryPrice,
      stopPrice: sorpresa.side === "buy" ? entryPrice - distancia : entryPrice + distancia,
      correlationGroup: params.correlationGroup,
      // Un solo trade por evento: el id del evento ES la identidad del setup.
      setupId: `evento:${evento.id}`,
      spreadActual: ctx.spreadActual,
      spreadNormal: ctx.spreadNormal,
      spreadMuestras: ctx.spreadMuestras,
    },
  };
}

/** Objetivo en múltiplos de R (riesgo) desde la entrada. */
export function objetivoEventScalp(signal: SleeveSignal, tpR: number): number {
  const distancia = Math.abs(signal.entryPrice - signal.stopPrice);
  return signal.side === "buy"
    ? signal.entryPrice + distancia * tpR
    : signal.entryPrice - distancia * tpR;
}

/**
 * Calendario leído del YAML (`eventscalp.sorpresa.eventos_programados`).
 * Suficiente para las 4 semanas de Fase 1 y sin dependencias externas. La
 * interfaz permite sustituirlo por una API sin tocar la estrategia.
 */
export class CalendarioManual implements EconomicCalendar {
  constructor(private readonly programados: EventoMacro[]) {}

  eventos(desdeEpoch: number, hastaEpoch: number): EventoMacro[] {
    return this.programados.filter((e) => e.epoch >= desdeEpoch && e.epoch < hastaEpoch);
  }

  /** Eventos de una fecha UTC concreta (YYYY-MM-DD). */
  delDia(fecha: string): EventoMacro[] {
    return this.programados.filter((e) => fechaUtc(e.epoch) === fecha);
  }
}

/** Construye el calendario manual desde el bloque YAML, validando lo mínimo. */
export function calendarioDesdeConfig(bloque: Record<string, any>): CalendarioManual {
  const crudos = (bloque.sorpresa?.eventos_programados ?? []) as Array<Record<string, any>>;
  const eventos: EventoMacro[] = crudos.map((e, i) => {
    if (typeof e.epoch !== "number") {
      throw new Error(`eventscalp.sorpresa.eventos_programados[${i}]: falta "epoch" numérico`);
    }
    if (e.signo_efecto !== 1 && e.signo_efecto !== -1) {
      throw new Error(`eventscalp.sorpresa.eventos_programados[${i}]: "signo_efecto" debe ser 1 o -1`);
    }
    return {
      id: String(e.id ?? `${e.tipo}-${e.epoch}`),
      tipo: e.tipo as TipoEvento,
      epoch: e.epoch,
      impacto: e.impacto ?? 3,
      symbol: String(e.symbol),
      actual: e.actual,
      consenso: e.consenso,
      signoEfecto: e.signo_efecto,
    };
  });
  return new CalendarioManual(eventos);
}

/** Lee los parámetros del Sleeve C desde el bloque `eventscalp` del YAML. */
export function paramsEventScalpDesdeConfig(
  bloque: Record<string, any>,
  correlationGroup: string,
): { params: EventScalpParams; activo: boolean; limites: Record<string, any> } {
  const entrada = bloque.entrada ?? {};
  const salidas = bloque.salidas ?? {};
  const limites = bloque.limites ?? {};

  return {
    activo: bloque.activo === true,
    limites,
    params: {
      correlationGroup,
      eventosPermitidos: (bloque.eventos_permitidos ?? []) as TipoEvento[],
      impactoMinimo: bloque.impacto_minimo ?? 3,
      esperaMinSeg: entrada.espera_min_seg ?? 60,
      esperaMaxSeg: entrada.espera_max_seg ?? 120,
      momentumVentanaSeg: entrada.momentum_ventana_seg ?? 30,
      momentumMinAtr: entrada.momentum_min_atr ?? 0.3,
      stopAtr: salidas.stop_atr ?? 0.5,
      tpR: salidas.tp_r ?? 1.2,
      puntuacionMinima: bloque.sorpresa?.puntuacion_minima ?? 0.5,
      noOperarSiCoinciden: limites.no_operar_si_coinciden !== false,
      coincidenciaVentanaMin: limites.coincidencia_ventana_min ?? 30,
      atrPeriodo: 14,
    },
  };
}
