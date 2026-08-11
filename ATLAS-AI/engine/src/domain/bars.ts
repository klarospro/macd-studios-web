/**
 * Vela intradía. Los sleeves B y C razonan sobre estas, no sobre cierres sueltos.
 *
 * `ticks` es el PROXY DE VOLUMEN: el número de ticks agregados en la vela.
 * Deriv no publica volumen real en `ticks_history` con `style: "candles"` —solo
 * OHLC—, así que el recuento de ticks es lo único disponible para medir
 * participación. Es un proxy legítimo y habitual en FX (donde tampoco existe
 * volumen centralizado), pero NO es volumen negociado: mide frecuencia de
 * actualización de precio, no dinero movido. Queda anotado para que nadie lo
 * interprete de más.
 *
 * Si `ticks` viene `undefined`, el sleeve B NO opera esa vela: la confirmación
 * de volumen es obligatoria en las tres entradas (Tarea 3).
 */
export interface Vela {
  /** Inicio de la vela en segundos UTC (epoch). */
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Nº de ticks en la vela (proxy de volumen). */
  ticks?: number;
}

const SEGUNDOS_POR_DIA = 86_400;

/** Minuto del día en UTC (0..1439) al que pertenece la vela. */
export function minutoUtc(epoch: number): number {
  return Math.floor(((epoch % SEGUNDOS_POR_DIA) + SEGUNDOS_POR_DIA) % SEGUNDOS_POR_DIA / 60);
}

/** Hora del día en UTC (0..23). */
export function horaUtc(epoch: number): number {
  return Math.floor(minutoUtc(epoch) / 60);
}

/** Día UTC como entero (nº de días desde epoch), para agrupar por jornada. */
export function diaUtc(epoch: number): number {
  return Math.floor(epoch / SEGUNDOS_POR_DIA);
}

/** Fecha ISO (YYYY-MM-DD) en UTC. */
export function fechaUtc(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

/** Convierte "HH:MM" a minuto del día. Lanza si el formato no es válido. */
export function minutoDeHora(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`hora inválida: "${hhmm}" (se esperaba HH:MM)`);
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas > 23 || minutos > 59) throw new Error(`hora fuera de rango: "${hhmm}"`);
  return horas * 60 + minutos;
}

/**
 * Rango verdadero de la vela `t`, contando el hueco contra el cierre anterior.
 * Con velas OHLC reales no hace falta el proxy sobre cierres de `tsmom.ts`.
 */
export function trueRange(velas: Vela[], t: number): number | null {
  const actual = velas[t];
  if (!actual) return null;
  const previa = velas[t - 1];
  if (!previa) return actual.high - actual.low;
  return Math.max(
    actual.high - actual.low,
    Math.abs(actual.high - previa.close),
    Math.abs(actual.low - previa.close),
  );
}

/** ATR simple sobre `periodo` velas terminando en `t`. */
export function atrVelas(velas: Vela[], t: number, periodo: number): number | null {
  if (periodo < 1 || t < periodo) return null;
  let suma = 0;
  for (let i = t - periodo + 1; i <= t; i++) {
    const tr = trueRange(velas, i);
    if (tr === null) return null;
    suma += tr;
  }
  const atr = suma / periodo;
  return atr > 0 ? atr : null;
}
