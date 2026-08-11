import { CarteraConfig, SleeveId, SLEEVE_IDS } from "../config/sleeveConfig";
import { Position, Side } from "../domain/types";

/**
 * Asignación de margen entre sleeves (Tarea 1, 27_SCALPING/04).
 *
 * Tres reglas innegociables que este módulo hace cumplir:
 *  1. Cada sleeve opera SOLO su porcentaje del margen (Core 40 / Intradía 30 /
 *     EventScalp 30). El reparto es sobre el equity total de la cuenta.
 *  2. El margen de un sleeve en reposo NO se reasigna a otro: queda como
 *     colchón. Por eso `presupuestoDisponible` mira exclusivamente al propio
 *     sleeve y nunca al margen libre de los demás.
 *  3. Nunca dos sleeves con posición en el mismo instrumento y la misma
 *     dirección — sería apostar dos veces a lo mismo con el riesgo contado una.
 *     Si ocurre, se cierra la del sleeve de menor prioridad.
 *
 * Es deliberadamente puro (sin E/S): el ciclo en vivo decide qué hacer con lo
 * que aquí se calcula, y los tests pueden cubrirlo entero sin broker.
 */

/** Posición etiquetada con el sleeve que la abrió. */
export interface SleevePosition extends Position {
  sleeve: SleeveId;
}

/** Estado operativo de un sleeve dentro del día/semana en curso. */
export interface SleeveState {
  id: SleeveId;
  openPositions: SleevePosition[];
  /** P&L realizado del día, en moneda de cuenta (negativo = pérdida). */
  pnlDia: number;
  /** P&L realizado de la semana en curso. */
  pnlSemana: number;
  /** Pérdidas consecutivas de hoy (breaker del Sleeve B). */
  perdidasConsecutivasHoy: number;
  /** Operaciones cerradas hoy y esta semana (topes de los Sleeves B y C). */
  tradesHoy: number;
  tradesSemana: number;
  /** Setups ya intentados hoy: impide la reentrada al mismo nivel el mismo día. */
  setupsUsadosHoy: string[];
  /** Si está pausado por un breaker propio, hasta cuándo (ISO date, exclusivo). */
  pausadoHasta?: string;
}

export function estadoSleeveVacio(id: SleeveId): SleeveState {
  return {
    id,
    openPositions: [],
    pnlDia: 0,
    pnlSemana: 0,
    perdidasConsecutivasHoy: 0,
    tradesHoy: 0,
    tradesSemana: 0,
    setupsUsadosHoy: [],
  };
}

export type CarteraSleeves = Record<SleeveId, SleeveState>;

export function carteraVacia(): CarteraSleeves {
  return {
    core: estadoSleeveVacio("core"),
    intradia: estadoSleeveVacio("intradia"),
    eventscalp: estadoSleeveVacio("eventscalp"),
  };
}

/**
 * Capital asignado a un sleeve = equity total × su porcentaje de margen.
 * Es la base de TODO el sizing del sleeve: el riesgo por trade es un porcentaje
 * de esta cifra, no del equity total (Tarea 5).
 */
export function capitalDeSleeve(cartera: CarteraConfig, equityTotal: number, sleeve: SleeveId): number {
  if (!(equityTotal > 0)) return 0;
  return equityTotal * cartera.margenPorSleeve[sleeve];
}

/** Riesgo abierto de un sleeve: suma del riesgo comprometido en sus posiciones. */
export function riesgoAbierto(estado: SleeveState): number {
  return estado.openPositions.reduce((total, position) => total + position.riskAmount, 0);
}

/**
 * Margen todavía utilizable por el sleeve.
 *
 * Nota deliberada: NO se consulta el margen ocioso de los otros sleeves. Esa
 * omisión es la regla 2 — el colchón es colchón, no munición.
 */
export function presupuestoDisponible(
  cartera: CarteraConfig,
  equityTotal: number,
  estado: SleeveState,
): number {
  const capital = capitalDeSleeve(cartera, equityTotal, estado.id);
  return Math.max(0, capital - riesgoAbierto(estado));
}

/** Margen que queda sin usar en toda la cartera (colchón agregado, informativo). */
export function colchonTotal(cartera: CarteraConfig, equityTotal: number, sleeves: CarteraSleeves): number {
  return SLEEVE_IDS.reduce(
    (total, id) => total + presupuestoDisponible(cartera, equityTotal, sleeves[id]),
    0,
  );
}

/** Una posición que debe cerrarse por solapar con otra de mayor prioridad. */
export interface Solapamiento {
  symbol: string;
  side: Side;
  /** Sleeve cuya posición se conserva. */
  conservar: SleeveId;
  /** Sleeve cuya posición se cierra (el de menor prioridad). */
  cerrar: SleeveId;
  positionId: string;
}

/**
 * Prioridad de conservación derivada de `prioridadCierre`: el primero de esa
 * lista es el primero en cerrarse, luego el que MENOS se conserva. Devolver un
 * índice permite comparar dos sleeves con un simple `<`.
 */
function rangoDeConservacion(cartera: CarteraConfig, sleeve: SleeveId): number {
  return cartera.prioridadCierre.indexOf(sleeve);
}

/**
 * Detecta posiciones simultáneas de dos sleeves sobre el mismo instrumento Y la
 * misma dirección, y decide cuál se cierra.
 *
 * Direcciones OPUESTAS no son solapamiento: son una cobertura involuntaria pero
 * no duplican la apuesta, así que se dejan pasar (el prompt acota la regla a
 * "la misma direccion").
 */
export function detectarSolapamientos(
  cartera: CarteraConfig,
  sleeves: CarteraSleeves,
): Solapamiento[] {
  const porClave = new Map<string, SleevePosition[]>();

  for (const id of SLEEVE_IDS) {
    for (const position of sleeves[id].openPositions) {
      const clave = `${position.symbol}|${position.side}`;
      const grupo = porClave.get(clave);
      if (grupo) grupo.push(position);
      else porClave.set(clave, [position]);
    }
  }

  const solapamientos: Solapamiento[] = [];
  for (const grupo of porClave.values()) {
    if (grupo.length < 2) continue;

    // El de mayor rango en `prioridadCierre` es el último en cerrarse: se conserva.
    const conservada = grupo.reduce((mejor, actual) =>
      rangoDeConservacion(cartera, actual.sleeve) > rangoDeConservacion(cartera, mejor.sleeve) ? actual : mejor,
    );

    for (const position of grupo) {
      if (position.id === conservada.id) continue;
      solapamientos.push({
        symbol: position.symbol,
        side: position.side,
        conservar: conservada.sleeve,
        cerrar: position.sleeve,
        positionId: position.id,
      });
    }
  }

  return solapamientos;
}

/**
 * ¿Abrir esta señal crearía un solapamiento? Se consulta ANTES de mandar la
 * orden: es más barato no abrir que abrir y cerrar pagando dos veces el spread.
 */
export function crearIaSolapamiento(
  sleeves: CarteraSleeves,
  sleeve: SleeveId,
  symbol: string,
  side: Side,
): SleeveId | undefined {
  for (const id of SLEEVE_IDS) {
    if (id === sleeve) continue;
    const choque = sleeves[id].openPositions.some(
      (position) => position.symbol === symbol && position.side === side,
    );
    if (choque) return id;
  }
  return undefined;
}
