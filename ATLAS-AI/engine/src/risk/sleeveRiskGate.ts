import { AtlasConfig, SleeveId } from "../config/sleeveConfig";
import { Order, Signal } from "../domain/types";
import {
  CarteraSleeves,
  capitalDeSleeve,
  crearIaSolapamiento,
  presupuestoDisponible,
  riesgoAbierto,
} from "../portfolio/sleeveAllocator";
import { sizeMaximoEsma, verificarEsma } from "./esma";

/**
 * RiskGate compartido por los tres sleeves (Tarea 5, 27_SCALPING/04).
 *
 * Reutiliza la filosofía del `riskGate.ts` original —decisión tipada, sizing
 * derivado de la distancia al stop, rechazo con motivo auditable— pero cambia
 * tres cosas que el diseño multi-sleeve exige:
 *
 *   1. El sizing se calcula sobre el CAPITAL DEL SLEEVE, no sobre el equity de
 *      la cuenta. Un sleeve al 30% del margen no puede arriesgar como si
 *      dispusiera del 100%.
 *   2. Se comprueba el NOCIONAL contra el apalancamiento ESMA en cada orden.
 *   3. Los breakers son de dos niveles: cartera (2% día / 5% semana, paran
 *      TODO) y sleeve (pérdidas consecutivas en B, drawdown propio en C).
 *
 * El orden de las comprobaciones es intencionado: primero lo que para la
 * cartera entera, luego lo que para el sleeve, y solo al final lo que depende
 * de la señal concreta. Así el motivo del rechazo que se audita es siempre la
 * causa más general, no un síntoma.
 */

export type SleeveRechazo =
  | "modo_no_demo"
  | "breaker_cartera_diario"
  | "breaker_cartera_semanal"
  | "sleeve_pausado"
  | "breaker_sleeve_perdidas_consecutivas"
  | "breaker_sleeve_drawdown"
  | "limite_trades_dia"
  | "limite_trades_semana"
  | "limite_posiciones_sleeve"
  | "limite_posiciones_clase"
  | "reentrada_mismo_setup"
  | "solapamiento_con_otro_sleeve"
  | "spread_sin_referencia"
  | "spread_excesivo"
  | "stop_invalido"
  | "presupuesto_sleeve_agotado"
  | "esma_simbolo_sin_clasificar"
  | "esma_apalancamiento_excedido"
  | "size_no_positivo"
  /** Lo rechaza el ciclo, no el gate: exposición neta acumulada en una divisa. */
  | "exposicion_divisa";

/** Señal enriquecida con lo que el gate multi-sleeve necesita saber. */
export interface SleeveSignal extends Signal {
  sleeve: SleeveId;
  /**
   * Identifica el setup concreto (p. ej. `orb:frxEURUSD:londres`). Dos señales
   * con el mismo `setupId` en el mismo día son una reentrada y se rechazan.
   */
  setupId?: string;
  /** Spread actual del activo y su línea base, para la regla de 1.5x. */
  spreadActual?: number;
  spreadNormal?: number;
  spreadMuestras?: number;
  /**
   * Escala de vol-target (0..1) que el Sleeve A aplica cuando la volatilidad
   * realizada supera el objetivo. Multiplica el riesgo, nunca lo amplifica.
   */
  escalaVolTarget?: number;
}

/** Orden aprobada, etiquetada con su sleeve y con el nocional ya verificado. */
export interface SleeveOrder extends Order {
  sleeve: SleeveId;
  nocional: number;
  apalancamientoUsado: number;
  setupId?: string;
}

export type SleeveDecision =
  | { approved: true; order: SleeveOrder }
  | { approved: false; reason: SleeveRechazo };

/** Topes operativos de un sleeve, ya normalizados desde el YAML. */
export interface LimitesSleeve {
  tradesDiaMax?: number;
  tradesSemanaMax?: number;
  /** Para el sleeve tras N pérdidas consecutivas en el día (Sleeve B: 2). */
  pararTrasPerdidasConsecutivas?: number;
  /** Breaker de drawdown propio como fracción del capital del sleeve (Sleeve C: 2%). */
  breakerDrawdownPct?: number;
  /** Riesgo por operación como fracción del capital del sleeve. */
  riesgoPorTradePct: number;
  /** Tope de posiciones abiertas a la vez en el sleeve. */
  posicionesMax?: number;
  /**
   * Tope de posiciones abiertas en la MISMA clase de activo ESMA.
   *
   * Existe porque el presupuesto de riesgo por sí solo no ve la correlación:
   * corto EUR/USD, largo USD/JPY, largo USD/CHF y largo USD/CAD son la misma
   * apuesta —largo dólar— contada cuatro veces. Cada una pasa el gate con su
   * 0,5% y el conjunto acaba concentrado sin que ningún límite se queje.
   */
  posicionesMaxPorClase?: number;
}

/** Estado de cartera necesario para decidir. Todo en moneda de cuenta. */
export interface ContextoCartera {
  equityTotal: number;
  /** P&L de la cartera en el día y en la semana (negativo = pérdida). */
  pnlDiaCartera: number;
  pnlSemanaCartera: number;
  sleeves: CarteraSleeves;
  /** Fecha ISO (YYYY-MM-DD) para evaluar pausas vigentes. */
  fecha: string;
}

function rechazo(reason: SleeveRechazo): SleeveDecision {
  return { approved: false, reason };
}

/**
 * ¿Ha saltado un breaker de CARTERA? Se comprueba antes que nada porque para
 * los tres sleeves a la vez, y ninguna señal individual puede sobreponerse.
 */
export function breakerCartera(config: AtlasConfig, ctx: ContextoCartera): SleeveRechazo | undefined {
  if (!(ctx.equityTotal > 0)) return "breaker_cartera_diario";
  const { perdidaDiariaPct, perdidaSemanalPct } = config.cartera.breakers;

  const perdidaDia = -ctx.pnlDiaCartera / ctx.equityTotal;
  if (perdidaDia >= perdidaDiariaPct) return "breaker_cartera_diario";

  const perdidaSemana = -ctx.pnlSemanaCartera / ctx.equityTotal;
  if (perdidaSemana >= perdidaSemanalPct) return "breaker_cartera_semanal";

  return undefined;
}

/** ¿Ha saltado un breaker propio del sleeve, o está pausado? */
export function breakerSleeve(
  config: AtlasConfig,
  ctx: ContextoCartera,
  sleeve: SleeveId,
  limites: LimitesSleeve,
): SleeveRechazo | undefined {
  const estado = ctx.sleeves[sleeve];

  if (estado.pausadoHasta && ctx.fecha < estado.pausadoHasta) return "sleeve_pausado";

  if (
    limites.pararTrasPerdidasConsecutivas !== undefined &&
    estado.perdidasConsecutivasHoy >= limites.pararTrasPerdidasConsecutivas
  ) {
    return "breaker_sleeve_perdidas_consecutivas";
  }

  if (limites.breakerDrawdownPct !== undefined) {
    const capital = capitalDeSleeve(config.cartera, ctx.equityTotal, sleeve);
    if (capital > 0 && -estado.pnlDia / capital >= limites.breakerDrawdownPct) {
      return "breaker_sleeve_drawdown";
    }
  }

  if (limites.tradesDiaMax !== undefined && estado.tradesHoy >= limites.tradesDiaMax) {
    return "limite_trades_dia";
  }
  if (limites.tradesSemanaMax !== undefined && estado.tradesSemana >= limites.tradesSemanaMax) {
    return "limite_trades_semana";
  }
  if (limites.posicionesMax !== undefined && estado.openPositions.length >= limites.posicionesMax) {
    return "limite_posiciones_sleeve";
  }

  return undefined;
}

/**
 * ¿Cuántas posiciones abiertas tiene ya el sleeve en la clase de activo del
 * símbolo? Sirve para frenar la concentración por correlación.
 */
export function posicionesEnClase(
  config: AtlasConfig,
  ctx: ContextoCartera,
  sleeve: SleeveId,
  symbol: string,
): number {
  const clase = config.esma.clasePorSimbolo[symbol];
  if (!clase) return 0;
  return ctx.sleeves[sleeve].openPositions.filter(
    (p) => config.esma.clasePorSimbolo[p.symbol] === clase,
  ).length;
}

/**
 * Regla del spread (Tarea 5): rechazar si supera 1.5x lo normal del activo.
 * Sin línea base fiable se rechaza igualmente — operar sin saber el spread
 * normal es justo el error que mató a las estrategias intradía anteriores
 * (ver 27_SCALPING/03).
 */
export function comprobarSpread(config: AtlasConfig, signal: SleeveSignal): SleeveRechazo | undefined {
  if (signal.spreadActual === undefined) return undefined; // el sleeve no aporta spread: no aplica
  const { spreadNormal, spreadMuestras } = signal;

  if (spreadNormal === undefined || !(spreadNormal > 0)) return "spread_sin_referencia";
  if (spreadMuestras !== undefined && spreadMuestras < config.riesgo.spreadMuestrasMinimas) {
    return "spread_sin_referencia";
  }
  if (signal.spreadActual > spreadNormal * config.riesgo.spreadMaxXNormal) return "spread_excesivo";

  return undefined;
}

/**
 * Evalúa una señal contra todo el aparato de riesgo y, si sobrevive, la
 * convierte en una orden dimensionada.
 */
/**
 * Precio de toma de beneficio a N veces lo arriesgado (N = `riesgo.objetivo_r`).
 *
 * R es la distancia al stop: si arriesgas 100 € y el objetivo es 3R, buscas
 * 300 €. `undefined` cuando no hay objetivo configurado — entonces la salida la
 * decide la estrategia (reversión de tendencia), que es como se validaron los
 * backtests que tenemos.
 */
function objetivoDeR(config: AtlasConfig, signal: SleeveSignal, stopDistance: number): number | undefined {
  const r = config.riesgo.objetivoR;
  if (!(r > 0)) return undefined;
  // EventScalp queda fuera por decisión de Moisés (2026-08-17), y la razón es
  // aritmética: entra y sale en minutos alrededor de un dato macro. Un objetivo
  // a 8R en esa ventana no se alcanza nunca, así que ponerlo equivale a quitarle
  // la salida que sí funciona. Su cierre lo sigue decidiendo la estrategia.
  if (signal.sleeve === "eventscalp") return undefined;
  return signal.side === "buy"
    ? signal.entryPrice + stopDistance * r
    : signal.entryPrice - stopDistance * r;
}

export function evaluarSleeve(
  config: AtlasConfig,
  ctx: ContextoCartera,
  signal: SleeveSignal,
  limites: LimitesSleeve,
): SleeveDecision {
  // Restricción dura: Fase 1 es solo demo.
  if (config.modo !== "demo") return rechazo("modo_no_demo");

  const breakerGlobal = breakerCartera(config, ctx);
  if (breakerGlobal) return rechazo(breakerGlobal);

  const breakerPropio = breakerSleeve(config, ctx, signal.sleeve, limites);
  if (breakerPropio) return rechazo(breakerPropio);

  const estado = ctx.sleeves[signal.sleeve];

  // Concentración por correlación: varias posiciones de la misma clase son,
  // en la práctica, una sola apuesta repetida.
  if (
    limites.posicionesMaxPorClase !== undefined &&
    posicionesEnClase(config, ctx, signal.sleeve, signal.symbol) >= limites.posicionesMaxPorClase
  ) {
    return rechazo("limite_posiciones_clase");
  }

  // Un solo intento por setup: sin reentrada al mismo nivel el mismo día.
  if (signal.setupId && estado.setupsUsadosHoy.includes(signal.setupId)) {
    return rechazo("reentrada_mismo_setup");
  }

  // Nunca dos sleeves en el mismo instrumento y dirección (Tarea 1).
  if (crearIaSolapamiento(ctx.sleeves, signal.sleeve, signal.symbol, signal.side)) {
    return rechazo("solapamiento_con_otro_sleeve");
  }

  const problemaSpread = comprobarSpread(config, signal);
  if (problemaSpread) return rechazo(problemaSpread);

  const stopDistance = Math.abs(signal.entryPrice - signal.stopPrice);
  if (!(stopDistance > 0)) return rechazo("stop_invalido");

  // --- Sizing sobre el capital del SLEEVE ---
  const capital = capitalDeSleeve(config.cartera, ctx.equityTotal, signal.sleeve);
  const escala = signal.escalaVolTarget === undefined ? 1 : Math.min(1, Math.max(0, signal.escalaVolTarget));

  // El presupuesto sale de la ESTRATEGIA y se mide sobre el EQUITY TOTAL
  // (decisión de Moisés, 2026-08-17): 2% para el Core —largos/semanales— y 2,5%
  // para scalping. Antes era un % del capital del sleeve, y con la cuenta de
  // 8 626 € eso daba 16-35 $ por operación: menos de lo que cuesta el lote
  // mínimo de IG en oro o índices, así que el gestor los rechazaba siempre y el
  // bot solo podía operar EUR/USD. El límite no protegía de nada, solo impedía
  // probar la estrategia.
  const presupuesto = config.riesgo.presupuestoDiarioPct;
  const fraccion = (signal.sleeve === "core" ? presupuesto.semanal : presupuesto.scalping) * escala;

  // El riesgo fijo, si está configurado, MANDA sobre el porcentaje: "arriesga
  // 100 buscando 300" es una instrucción de cuánto perder, no de qué fracción
  // del capital. Y es FIJO de verdad: el ajuste por volatilidad NO lo recorta.
  // Aplicándolo, 100 € se quedaban en 47 € y el oro volvía a no caber en su
  // propio presupuesto; quien pide arriesgar 100 espera arriesgar 100.
  const fijo = config.riesgo.riesgoFijoPorOperacion;
  let riskAmount = fijo > 0 ? fijo : ctx.equityTotal * fraccion;
  const disponible = presupuestoDisponible(config.cartera, ctx.equityTotal, estado);
  if (riskAmount > disponible) {
    // El margen ocioso de OTROS sleeves no está disponible (Tarea 1, regla 2).
    if (!(disponible > 0)) return rechazo("presupuesto_sleeve_agotado");
    riskAmount = disponible;
  }

  let size = riskAmount / stopDistance;
  if (!(size > 0)) return rechazo("size_no_positivo");

  // --- Apalancamiento ESMA sobre el nocional resultante ---
  let veredicto = verificarEsma(config.esma, signal.symbol, size, signal.entryPrice, capital);
  if (!veredicto.permitido && veredicto.motivo === "simbolo_sin_clasificar") {
    return rechazo("esma_simbolo_sin_clasificar");
  }
  if (!veredicto.permitido && veredicto.motivo === "apalancamiento_excedido") {
    // Recortar al tamaño máximo legal en vez de descartar la señal: el límite
    // regulatorio acota la posición, no invalida la oportunidad.
    size = sizeMaximoEsma(config.esma, signal.symbol, signal.entryPrice, capital);
    if (!(size > 0)) return rechazo("esma_apalancamiento_excedido");
    riskAmount = size * stopDistance;
    veredicto = verificarEsma(config.esma, signal.symbol, size, signal.entryPrice, capital);
  }
  if (!veredicto.permitido) return rechazo("esma_apalancamiento_excedido");

  return {
    approved: true,
    order: {
      symbol: signal.symbol,
      side: signal.side,
      size,
      entryPrice: signal.entryPrice,
      stopPrice: signal.stopPrice,
      riskAmount,
      correlationGroup: signal.correlationGroup,
      sleeve: signal.sleeve,
      nocional: veredicto.nocional,
      apalancamientoUsado: veredicto.apalancamientoUsado,
      setupId: signal.setupId,
      limitPrice: objetivoDeR(config, signal, stopDistance),
      riesgoMaximo: config.riesgo.riesgoMaximoPorOperacion,
    },
  };
}

/** Riesgo abierto agregado de los tres sleeves (informe y dashboard). */
export function riesgoAbiertoCartera(sleeves: CarteraSleeves): number {
  return riesgoAbierto(sleeves.core) + riesgoAbierto(sleeves.intradia) + riesgoAbierto(sleeves.eventscalp);
}
