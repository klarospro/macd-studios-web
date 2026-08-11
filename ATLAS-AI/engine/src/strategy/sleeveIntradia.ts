import { atrVelas, diaUtc, minutoDeHora, minutoUtc, Vela } from "../domain/bars";
import { SleeveSignal } from "../risk/sleeveRiskGate";

/**
 * Sleeve B "Intradía" (Breakout) — horizonte diario. Tarea 3.
 *
 * Las tres entradas comparten una condición innegociable: CONFIRMACIÓN DE
 * FUERZA. Una ruptura sin nada detrás es justo la que se deshace, y las dos
 * estrategias intradía anteriores del proyecto murieron operando rupturas que
 * el coste se comía (27_SCALPING/02 y /03). Este filtro existe por eso.
 *
 * El diseño original pedía confirmarla con VOLUMEN. No se puede: medido contra
 * la cuenta demo el 2026-08-11 (`npm run sonda:volumen`), Deriv emite ticks a
 * cadencia fija de 1 por segundo y EUR/USD, oro y BTC devuelven estadísticas
 * idénticas —media 59/min, máximo exactamente 60—. El recuento de ticks no
 * contiene información de participación. Se sustituye por EXPANSIÓN DE RANGO,
 * que mide lo mismo con un dato que en Deriv sí es real.
 *
 * Módulo puro: detecta setups sobre un array de velas. Los topes de operaciones,
 * los breakers y el sizing los aplica `sleeveRiskGate`.
 */

export type TipoSetup = "orb" | "rango_previo" | "breakout_horario";
export type Sesion = "londres" | "ny";

export interface VentanaSesion {
  /** Minuto del día UTC en que abre y cierra la sesión. */
  abre: number;
  cierra: number;
}

export interface IntradiaParams {
  symbol: string;
  correlationGroup: string;
  /** Duración del rango de apertura en minutos (15-30). */
  minutosRangoApertura: number;
  sesiones: Record<Sesion, VentanaSesion>;
  sesionesActivas: Sesion[];
  fuerza: { multiploMinimo: number; ventanaMediaDias: number; muestrasMinimas: number };
  entradas: {
    orb: boolean;
    rangoPrevio: boolean;
    breakoutHorario: boolean;
  };
  rangoPrevio: { exigirRetest: boolean; retestToleranciaAtr: number };
  breakoutHorario: { ventanaHoras: number; exigirAtrCreciente: boolean };
  salidas: { stopAtrMin: number; stopAtrMax: number; tpXStop: number };
  atrPeriodo: number;
  /** Minutos de exclusión alrededor de un evento de alto impacto. */
  exclusionEventosMin: number;
}

/** Duración de una vela en minutos, deducida de las dos primeras. */
export function minutosPorVela(velas: Vela[]): number | null {
  const a = velas[0];
  const b = velas[1];
  if (!a || !b) return null;
  const delta = (b.epoch - a.epoch) / 60;
  return delta > 0 ? delta : null;
}

/** Recorrido de la vela: alto menos bajo. */
export function recorrido(vela: Vela): number {
  return vela.high - vela.low;
}

/**
 * Recorrido medio en la MISMA hora del día, sobre las jornadas anteriores.
 *
 * Comparar contra la media global sería un sesgo grosero: la apertura de
 * Londres siempre se mueve más que la madrugada asiática, así que cualquier
 * ruptura matinal "confirmaría" fuerza sin significar nada.
 */
export function mediaRecorridoMismaHora(
  velas: Vela[],
  t: number,
  ventanaDias: number,
): { media: number; muestras: number } {
  const actual = velas[t];
  if (!actual) return { media: 0, muestras: 0 };

  const minutoObjetivo = minutoUtc(actual.epoch);
  const diaActual = diaUtc(actual.epoch);
  const diaMinimo = diaActual - ventanaDias;

  let suma = 0;
  let muestras = 0;
  for (let i = t - 1; i >= 0; i--) {
    const vela = velas[i];
    if (!vela) continue;
    const dia = diaUtc(vela.epoch);
    if (dia <= diaMinimo) break;
    if (dia === diaActual) continue; // solo jornadas ANTERIORES
    if (minutoUtc(vela.epoch) !== minutoObjetivo) continue;
    suma += recorrido(vela);
    muestras++;
  }

  return { media: muestras > 0 ? suma / muestras : 0, muestras };
}

/**
 * ¿La vela `t` rompe con fuerza suficiente?
 *
 * Sustituye a la confirmación de volumen del diseño original. Medido contra la
 * cuenta demo el 2026-08-11: Deriv emite ticks a cadencia FIJA de 1/segundo
 * —EUR/USD, oro y BTC dan estadísticas idénticas—, así que el recuento de
 * ticks no informa de participación y el filtro de volumen nunca dispararía.
 * La expansión de rango responde a la misma pregunta con un dato que sí es
 * real. Sin histórico bastante devuelve false (fallo seguro).
 */
export function confirmaFuerza(velas: Vela[], t: number, params: IntradiaParams): boolean {
  const vela = velas[t];
  if (!vela) return false;

  const { media, muestras } = mediaRecorridoMismaHora(velas, t, params.fuerza.ventanaMediaDias);
  if (muestras < params.fuerza.muestrasMinimas || !(media > 0)) return false;

  return recorrido(vela) > media * params.fuerza.multiploMinimo;
}

/** ¿Está la vela dentro de la ventana horaria de la sesión? */
export function enSesion(epoch: number, ventana: VentanaSesion): boolean {
  const minuto = minutoUtc(epoch);
  return minuto >= ventana.abre && minuto < ventana.cierra;
}

/**
 * Rango de apertura de la sesión en la jornada de la vela `t`: máximo y mínimo
 * de las velas comprendidas en los primeros `minutosRangoApertura` minutos.
 * Devuelve null si la ventana aún no ha terminado (no se opera un rango a medias).
 */
export function rangoApertura(
  velas: Vela[],
  t: number,
  ventana: VentanaSesion,
  minutosRango: number,
): { alto: number; bajo: number } | null {
  const actual = velas[t];
  if (!actual) return null;

  const dia = diaUtc(actual.epoch);
  const fin = ventana.abre + minutosRango;
  if (minutoUtc(actual.epoch) < fin) return null; // la ventana sigue abierta

  let alto = -Infinity;
  let bajo = Infinity;
  let encontradas = 0;
  for (let i = t; i >= 0; i--) {
    const vela = velas[i];
    if (!vela || diaUtc(vela.epoch) !== dia) break;
    const minuto = minutoUtc(vela.epoch);
    if (minuto < ventana.abre || minuto >= fin) continue;
    alto = Math.max(alto, vela.high);
    bajo = Math.min(bajo, vela.low);
    encontradas++;
  }

  return encontradas > 0 ? { alto, bajo } : null;
}

/** Máximo y mínimo de la jornada ANTERIOR completa. */
export function rangoJornadaPrevia(velas: Vela[], t: number): { alto: number; bajo: number } | null {
  const actual = velas[t];
  if (!actual) return null;

  const diaActual = diaUtc(actual.epoch);
  let diaPrevio: number | undefined;
  let alto = -Infinity;
  let bajo = Infinity;
  let encontradas = 0;

  for (let i = t - 1; i >= 0; i--) {
    const vela = velas[i];
    if (!vela) continue;
    const dia = diaUtc(vela.epoch);
    if (dia === diaActual) continue;
    if (diaPrevio === undefined) diaPrevio = dia;
    if (dia !== diaPrevio) break;
    alto = Math.max(alto, vela.high);
    bajo = Math.min(bajo, vela.low);
    encontradas++;
  }

  return encontradas > 0 ? { alto, bajo } : null;
}

/** Máximo y mínimo de las últimas `horas` (sin contar la vela actual). */
export function rangoHorario(velas: Vela[], t: number, horas: number): { alto: number; bajo: number } | null {
  const porVela = minutosPorVela(velas);
  if (porVela === null) return null;
  const cuantas = Math.floor((horas * 60) / porVela);
  if (cuantas < 1 || t < cuantas) return null;

  let alto = -Infinity;
  let bajo = Infinity;
  for (let i = t - cuantas; i < t; i++) {
    const vela = velas[i];
    if (!vela) return null;
    alto = Math.max(alto, vela.high);
    bajo = Math.min(bajo, vela.low);
  }
  return { alto, bajo };
}

/** ¿El ATR está creciendo respecto a hace `periodo` velas? */
export function atrCreciente(velas: Vela[], t: number, periodo: number): boolean {
  const ahora = atrVelas(velas, t, periodo);
  const antes = atrVelas(velas, t - periodo, periodo);
  if (ahora === null || antes === null) return false;
  return ahora > antes;
}

/** Un setup detectado, antes de convertirse en señal. */
export interface SetupDetectado {
  tipo: TipoSetup;
  side: "buy" | "sell";
  /** Nivel roto: base del retest y de la identidad del setup. */
  nivel: number;
  sesion?: Sesion;
}

/** ORB: ruptura del rango de apertura de Londres o NY, con volumen. */
export function detectarOrb(velas: Vela[], t: number, params: IntradiaParams): SetupDetectado | null {
  if (!params.entradas.orb) return null;
  const actual = velas[t];
  if (!actual) return null;

  for (const sesion of params.sesionesActivas) {
    const ventana = params.sesiones[sesion];
    if (!ventana || !enSesion(actual.epoch, ventana)) continue;

    const rango = rangoApertura(velas, t, ventana, params.minutosRangoApertura);
    if (!rango) continue;

    if (actual.close > rango.alto) return { tipo: "orb", side: "buy", nivel: rango.alto, sesion };
    if (actual.close < rango.bajo) return { tipo: "orb", side: "sell", nivel: rango.bajo, sesion };
  }
  return null;
}

/**
 * Ruptura del rango de la jornada previa CON RETEST del nivel roto: el precio
 * rompe, vuelve al nivel y lo respeta. Exigir el retest reduce el número de
 * señales pero descarta la ruptura falsa, que es la que paga el coste sin
 * cobrar el movimiento.
 */
export function detectarRangoPrevio(velas: Vela[], t: number, params: IntradiaParams): SetupDetectado | null {
  if (!params.entradas.rangoPrevio) return null;
  const actual = velas[t];
  if (!actual) return null;

  const rango = rangoJornadaPrevia(velas, t);
  if (!rango) return null;

  const atr = atrVelas(velas, t, params.atrPeriodo);
  if (atr === null) return null;
  const tolerancia = atr * params.rangoPrevio.retestToleranciaAtr;

  const rompioArriba = velas.slice(Math.max(0, t - 20), t).some((v) => v.close > rango.alto);
  const rompioAbajo = velas.slice(Math.max(0, t - 20), t).some((v) => v.close < rango.bajo);

  if (rompioArriba && actual.close > rango.alto) {
    if (!params.rangoPrevio.exigirRetest) return { tipo: "rango_previo", side: "buy", nivel: rango.alto };
    // Retest: alguna vela intermedia volvió a tocar el nivel por arriba sin perderlo.
    const hizoRetest = velas
      .slice(Math.max(0, t - 20), t)
      .some((v) => v.low <= rango.alto + tolerancia && v.close >= rango.alto - tolerancia);
    if (hizoRetest) return { tipo: "rango_previo", side: "buy", nivel: rango.alto };
  }

  if (rompioAbajo && actual.close < rango.bajo) {
    if (!params.rangoPrevio.exigirRetest) return { tipo: "rango_previo", side: "sell", nivel: rango.bajo };
    const hizoRetest = velas
      .slice(Math.max(0, t - 20), t)
      .some((v) => v.high >= rango.bajo - tolerancia && v.close <= rango.bajo + tolerancia);
    if (hizoRetest) return { tipo: "rango_previo", side: "sell", nivel: rango.bajo };
  }

  return null;
}

/** Breakout de máximos/mínimos de 1-4 h, solo con ATR creciente. */
export function detectarBreakoutHorario(velas: Vela[], t: number, params: IntradiaParams): SetupDetectado | null {
  if (!params.entradas.breakoutHorario) return null;
  const actual = velas[t];
  if (!actual) return null;

  if (params.breakoutHorario.exigirAtrCreciente && !atrCreciente(velas, t, params.atrPeriodo)) return null;

  const rango = rangoHorario(velas, t, params.breakoutHorario.ventanaHoras);
  if (!rango) return null;

  if (actual.close > rango.alto) return { tipo: "breakout_horario", side: "buy", nivel: rango.alto };
  if (actual.close < rango.bajo) return { tipo: "breakout_horario", side: "sell", nivel: rango.bajo };
  return null;
}

/**
 * Señal del Sleeve B en la vela `t`, o null.
 *
 * `minutosAEvento` es la distancia al evento de alto impacto más cercano; si
 * cae dentro de la ventana de exclusión NO se opera: ese territorio es del
 * Sleeve C, y solaparlos sería apostar dos veces al mismo movimiento.
 */
export function senalIntradia(
  velas: Vela[],
  t: number,
  params: IntradiaParams,
  minutosAEvento?: number,
): SleeveSignal | null {
  const actual = velas[t];
  if (!actual) return null;

  if (minutosAEvento !== undefined && Math.abs(minutosAEvento) <= params.exclusionEventosMin) return null;
  if (!confirmaFuerza(velas, t, params)) return null;

  const setup =
    detectarOrb(velas, t, params) ??
    detectarRangoPrevio(velas, t, params) ??
    detectarBreakoutHorario(velas, t, params);
  if (!setup) return null;

  const atr = atrVelas(velas, t, params.atrPeriodo);
  if (atr === null) return null;

  // Stop dentro del rango 0,5-1 ATR: se toma el punto medio del rango
  // configurado para no depender de un valor arbitrario en el extremo.
  const multStop = (params.salidas.stopAtrMin + params.salidas.stopAtrMax) / 2;
  const distancia = atr * multStop;
  if (!(distancia > 0)) return null;

  const entryPrice = actual.close;
  return {
    sleeve: "intradia",
    symbol: params.symbol,
    side: setup.side,
    entryPrice,
    stopPrice: setup.side === "buy" ? entryPrice - distancia : entryPrice + distancia,
    correlationGroup: params.correlationGroup,
    // El nivel entra en la identidad del setup: impide reentrar al MISMO nivel
    // el mismo día, pero permite otro setup distinto sobre el mismo activo.
    setupId: `${setup.tipo}:${params.symbol}:${setup.nivel.toFixed(5)}`,
  };
}

/** Objetivo de beneficio derivado del stop, según el diseño de expectancy. */
export function objetivoIntradia(signal: SleeveSignal, tpXStop: number): number {
  const distancia = Math.abs(signal.entryPrice - signal.stopPrice);
  return signal.side === "buy"
    ? signal.entryPrice + distancia * tpXStop
    : signal.entryPrice - distancia * tpXStop;
}

/** Lee los parámetros del Sleeve B desde el bloque `intradia` del YAML. */
export function paramsIntradiaDesdeConfig(
  bloque: Record<string, any>,
  symbol: string,
  correlationGroup: string,
): { params: IntradiaParams; activo: boolean; limites: Record<string, any> } {
  const entradas = bloque.entradas ?? {};
  const sesionesRaw = bloque.sesiones ?? {};
  const orb = entradas.orb ?? {};

  const ventana = (nombre: string) => ({
    abre: minutoDeHora(sesionesRaw[nombre]?.abre ?? "00:00"),
    cierra: minutoDeHora(sesionesRaw[nombre]?.cierra ?? "23:59"),
  });

  return {
    activo: bloque.activo === true,
    limites: bloque.limites ?? {},
    params: {
      symbol,
      correlationGroup,
      minutosRangoApertura: orb.minutos_rango ?? 30,
      sesiones: { londres: ventana("londres"), ny: ventana("ny") },
      sesionesActivas: (orb.sesiones ?? ["londres", "ny"]) as Sesion[],
      fuerza: {
        multiploMinimo: bloque.fuerza?.multiplo_minimo ?? 1.5,
        ventanaMediaDias: bloque.fuerza?.ventana_media_dias ?? 20,
        muestrasMinimas: bloque.fuerza?.muestras_minimas ?? 10,
      },
      entradas: {
        orb: orb.activo === true,
        rangoPrevio: entradas.rango_previo?.activo === true,
        breakoutHorario: entradas.breakout_horario?.activo === true,
      },
      rangoPrevio: {
        exigirRetest: entradas.rango_previo?.exigir_retest !== false,
        retestToleranciaAtr: entradas.rango_previo?.retest_tolerancia_atr ?? 0.25,
      },
      breakoutHorario: {
        ventanaHoras: entradas.breakout_horario?.ventana_horas ?? 4,
        exigirAtrCreciente: entradas.breakout_horario?.exigir_atr_creciente !== false,
      },
      salidas: {
        stopAtrMin: bloque.salidas?.stop_atr_min ?? 0.5,
        stopAtrMax: bloque.salidas?.stop_atr_max ?? 1,
        tpXStop: bloque.salidas?.tp_x_stop ?? 1,
      },
      atrPeriodo: 14,
      exclusionEventosMin: bloque.exclusion_eventos_min ?? 15,
    },
  };
}
