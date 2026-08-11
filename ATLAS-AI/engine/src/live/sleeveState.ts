import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SleeveId, SLEEVE_IDS } from "../config/sleeveConfig";
import { CarteraSleeves, carteraVacia, SleevePosition } from "../portfolio/sleeveAllocator";

/**
 * Estado persistente de la cartera multi-sleeve entre pasadas del ciclo.
 *
 * El ciclo es `oneshot`: arranca, decide y muere. Todo lo que debe sobrevivir
 * —posiciones abiertas, contadores del día y de la semana, equity de
 * referencia para los breakers— vive aquí. Sin esta persistencia los breakers
 * de "2% en el día" no significarían nada, porque cada pasada empezaría de cero.
 */

export interface EstadoCartera {
  /** Día UTC (YYYY-MM-DD) de los contadores diarios en curso. */
  fecha: string;
  /** Lunes UTC (YYYY-MM-DD) de la semana en curso. */
  semana: string;
  equityInicioDia: number;
  equityInicioSemana: number;
  picoEquity: number;
  sleeves: CarteraSleeves;
  /** Fecha del último resumen semanal enviado, para no repetirlo. */
  ultimoResumen?: string;
  /**
   * Día UTC de la última revisión del Core. El Core opera velas DIARIAS con
   * horizonte semanal: repasarlo cada pasada serían 23 peticiones por minuto
   * para releer barras que cambian una vez al día.
   */
  ultimaPasadaCore?: string;
}

/** Lunes de la semana de `fecha` (ISO, UTC). */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const dia = d.getUTCDay(); // 0 = domingo
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  d.setUTCDate(d.getUTCDate() + desplazamiento);
  return d.toISOString().slice(0, 10);
}

export function estadoInicial(fecha: string, equity: number): EstadoCartera {
  return {
    fecha,
    semana: lunesDe(fecha),
    equityInicioDia: equity,
    equityInicioSemana: equity,
    picoEquity: equity,
    sleeves: carteraVacia(),
  };
}

export function cargarEstado(ruta: string, fecha: string, equity: number): EstadoCartera {
  if (!existsSync(ruta)) return estadoInicial(fecha, equity);
  try {
    const crudo = JSON.parse(readFileSync(ruta, "utf8")) as EstadoCartera;
    // Rellena sleeves que no existieran en una versión anterior del fichero.
    const sleeves = carteraVacia();
    for (const id of SLEEVE_IDS) {
      if (crudo.sleeves?.[id]) sleeves[id] = { ...sleeves[id], ...crudo.sleeves[id] };
    }
    return { ...estadoInicial(fecha, equity), ...crudo, sleeves };
  } catch {
    // Un fichero corrupto no debe impedir operar, pero sí empezar de cero con
    // los contadores: es más seguro que heredar cifras dudosas.
    return estadoInicial(fecha, equity);
  }
}

export function guardarEstado(ruta: string, estado: EstadoCartera): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(estado, null, 2), "utf8");
}

/**
 * Aplica los cambios de jornada y de semana. Devuelve qué se ha reiniciado
 * para que el ciclo pueda registrarlo.
 */
export function rotarPeriodos(
  estado: EstadoCartera,
  fecha: string,
  equity: number,
): { diaNuevo: boolean; semanaNueva: boolean } {
  const diaNuevo = estado.fecha !== fecha;
  const semana = lunesDe(fecha);
  const semanaNueva = estado.semana !== semana;

  if (diaNuevo) {
    estado.fecha = fecha;
    estado.equityInicioDia = equity;
    for (const id of SLEEVE_IDS) {
      const sleeve = estado.sleeves[id];
      sleeve.pnlDia = 0;
      sleeve.perdidasConsecutivasHoy = 0;
      sleeve.tradesHoy = 0;
      sleeve.setupsUsadosHoy = [];
      // Una pausa que ya expiró se limpia; una vigente se respeta.
      if (sleeve.pausadoHasta && fecha >= sleeve.pausadoHasta) sleeve.pausadoHasta = undefined;
    }
  }

  if (semanaNueva) {
    estado.semana = semana;
    estado.equityInicioSemana = equity;
    for (const id of SLEEVE_IDS) {
      estado.sleeves[id].pnlSemana = 0;
      estado.sleeves[id].tradesSemana = 0;
    }
  }

  if (equity > estado.picoEquity) estado.picoEquity = equity;

  return { diaNuevo, semanaNueva };
}

/** Registra el cierre de una operación en los contadores del sleeve. */
export function registrarCierre(estado: EstadoCartera, sleeve: SleeveId, pnl: number): void {
  const s = estado.sleeves[sleeve];
  s.pnlDia += pnl;
  s.pnlSemana += pnl;
  s.tradesHoy++;
  s.tradesSemana++;
  s.perdidasConsecutivasHoy = pnl < 0 ? s.perdidasConsecutivasHoy + 1 : 0;
}

/** Registra la apertura: posición viva + setup consumido para el resto del día. */
export function registrarApertura(
  estado: EstadoCartera,
  posicion: SleevePosition,
  setupId: string | undefined,
): void {
  const s = estado.sleeves[posicion.sleeve];
  s.openPositions.push(posicion);
  if (setupId && !s.setupsUsadosHoy.includes(setupId)) s.setupsUsadosHoy.push(setupId);
}

/** Quita una posición cerrada del estado del sleeve. */
export function quitarPosicion(estado: EstadoCartera, sleeve: SleeveId, positionId: string): void {
  const s = estado.sleeves[sleeve];
  s.openPositions = s.openPositions.filter((p) => p.id !== positionId);
}

/** P&L agregado de la cartera en el día y en la semana. */
export function pnlCartera(estado: EstadoCartera): { dia: number; semana: number } {
  let dia = 0;
  let semana = 0;
  for (const id of SLEEVE_IDS) {
    dia += estado.sleeves[id].pnlDia;
    semana += estado.sleeves[id].pnlSemana;
  }
  return { dia, semana };
}
