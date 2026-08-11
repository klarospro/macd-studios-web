import { SleeveSignal } from "../risk/sleeveRiskGate";
import { atrProxy } from "./tsmom";
import { realizedVol } from "./atlasCore";

/**
 * Sleeve A "Core" (Trend + Carry) — horizonte semanal. Tarea 2 de 27_SCALPING/04.
 *
 * Sustituye a la señal TSMOM de lookback único que corría en `dailyCycle.ts`.
 * Dos diferencias que importan:
 *
 *  - La dirección sale de una ESTRUCTURA de medias (50/100/200 alineadas) o de
 *    una ruptura de canal Donchian, no del signo de un único retorno. Exigir
 *    alineación filtra los mercados laterales, que es donde el trend following
 *    sangra por costes.
 *  - El tamaño se escala por volatilidad realizada contra un objetivo del 10%
 *    anualizado. Es la decisión que el estudio de ablación de `atlasCore`
 *    confirmó que SÍ aporta Sharpe (13_BACKTESTING/02).
 *
 * El Carry queda deliberadamente fuera: Deriv no publica diferenciales de swap
 * por API y la investigación previa lo dejó "sin confirmar". No se opera un
 * diferencial que no se puede medir.
 */

export interface CoreTrendParams {
  symbol: string;
  correlationGroup: string;
  metodo: "ewma" | "donchian";
  ewmaPeriodos: [number, number, number];
  donchianPeriodo: number;
  atrPeriodo: number;
  atrMultStop: number;
}

export interface CoreVolTargetParams {
  activo: boolean;
  objetivoAnual: number;
  ventanaDias: number;
  escalaMaxima: number;
}

/**
 * Media exponencial en `t` con el factor estándar 2/(n+1). Se siembra con la
 * media simple de la primera ventana para no arrastrar el sesgo de arranque
 * que produce inicializar con el primer precio.
 */
export function ewma(prices: number[], t: number, periodo: number): number | null {
  if (periodo < 1 || t < periodo - 1) return null;

  let suma = 0;
  for (let i = 0; i < periodo; i++) {
    const p = prices[i];
    if (p === undefined) return null;
    suma += p;
  }
  let valor = suma / periodo;

  const alpha = 2 / (periodo + 1);
  for (let i = periodo; i <= t; i++) {
    const p = prices[i];
    if (p === undefined) return null;
    valor = alpha * p + (1 - alpha) * valor;
  }
  return valor;
}

/** Dirección por alineación de tres EWMA. Sin alineación completa, no hay señal. */
export function direccionEwma(
  prices: number[],
  t: number,
  periodos: [number, number, number],
): "buy" | "sell" | null {
  const [rapida, media, lenta] = periodos;
  const a = ewma(prices, t, rapida);
  const b = ewma(prices, t, media);
  const c = ewma(prices, t, lenta);
  if (a === null || b === null || c === null) return null;

  if (a > b && b > c) return "buy";
  if (a < b && b < c) return "sell";
  return null;
}

/**
 * Dirección por ruptura de canal Donchian sobre cierres. El canal se calcula
 * con las `periodo` barras ANTERIORES a `t`: incluir la barra actual haría que
 * el precio rompiera su propio máximo y la señal fuese siempre positiva.
 */
export function direccionDonchian(prices: number[], t: number, periodo: number): "buy" | "sell" | null {
  if (periodo < 1 || t < periodo) return null;

  let maximo = -Infinity;
  let minimo = Infinity;
  for (let i = t - periodo; i < t; i++) {
    const p = prices[i];
    if (p === undefined) return null;
    if (p > maximo) maximo = p;
    if (p < minimo) minimo = p;
  }

  const actual = prices[t];
  if (actual === undefined) return null;
  if (actual > maximo) return "buy";
  if (actual < minimo) return "sell";
  return null;
}

/**
 * Escala de vol-target: si la volatilidad realizada supera el objetivo, se
 * reduce el tamaño proporcionalmente. Nunca por encima de `escalaMaxima` — un
 * mercado tranquilo no es una invitación a apalancarse.
 *
 * Devuelve 1 si el vol-target está desactivado, y `null` si no hay histórico
 * suficiente para medir la volatilidad (el gate rechazará por falta de datos
 * antes que operar a ciegas).
 */
export function escalaVolTarget(
  prices: number[],
  t: number,
  params: CoreVolTargetParams,
): number | null {
  if (!params.activo) return 1;
  const vol = realizedVol(prices, t, params.ventanaDias);
  if (vol === null || !(vol > 0)) return null;
  return Math.min(params.escalaMaxima, params.objetivoAnual / vol);
}

/**
 * Señal del Sleeve A en la barra `t`, o `null` si no hay tendencia alineada,
 * datos insuficientes o volatilidad no medible.
 */
export function senalCore(
  prices: number[],
  t: number,
  params: CoreTrendParams,
  volTarget: CoreVolTargetParams,
): SleeveSignal | null {
  const side =
    params.metodo === "ewma"
      ? direccionEwma(prices, t, params.ewmaPeriodos)
      : direccionDonchian(prices, t, params.donchianPeriodo);
  if (!side) return null;

  const entryPrice = prices[t];
  if (entryPrice === undefined || !(entryPrice > 0)) return null;

  const distancia = atrProxy(prices, t, params.atrPeriodo) * params.atrMultStop;
  if (!(distancia > 0)) return null;

  const escala = escalaVolTarget(prices, t, volTarget);
  if (escala === null) return null;

  return {
    sleeve: "core",
    symbol: params.symbol,
    side,
    entryPrice,
    stopPrice: side === "buy" ? entryPrice - distancia : entryPrice + distancia,
    correlationGroup: params.correlationGroup,
    setupId: `core:${params.metodo}:${params.symbol}`,
    escalaVolTarget: escala,
  };
}

/**
 * ¿Debe cerrarse una posición abierta del Core? El sleeve es de horizonte
 * semanal y sin stop intradía en el broker: la salida ocurre cuando la
 * estructura que justificó la entrada deja de existir.
 */
export function debeCerrarCore(
  prices: number[],
  t: number,
  params: CoreTrendParams,
  ladoAbierto: "buy" | "sell",
): boolean {
  const side =
    params.metodo === "ewma"
      ? direccionEwma(prices, t, params.ewmaPeriodos)
      : direccionDonchian(prices, t, params.donchianPeriodo);

  // Donchian no vuelve a señalar dentro del canal: solo se cierra si rompe al revés.
  if (params.metodo === "donchian") return side !== null && side !== ladoAbierto;
  return side === null || side !== ladoAbierto;
}

/** Lee los parámetros del Sleeve A desde el bloque `core` del YAML. */
export function paramsCoreDesdeConfig(
  bloque: Record<string, any>,
  symbol: string,
  correlationGroup: string,
): { trend: CoreTrendParams; volTarget: CoreVolTargetParams; activo: boolean } {
  const trendRaw = bloque.trend ?? {};
  const volRaw = bloque.vol_target ?? {};
  const periodos = (trendRaw.ewma_periodos ?? [50, 100, 200]) as [number, number, number];

  return {
    activo: bloque.activo === true && trendRaw.activo === true,
    trend: {
      symbol,
      correlationGroup,
      metodo: trendRaw.metodo === "donchian" ? "donchian" : "ewma",
      ewmaPeriodos: periodos,
      donchianPeriodo: trendRaw.donchian_periodo ?? 100,
      atrPeriodo: trendRaw.atr_periodo ?? 14,
      atrMultStop: trendRaw.atr_mult_stop ?? 2,
    },
    volTarget: {
      activo: volRaw.activo === true,
      objetivoAnual: volRaw.objetivo_anual ?? 0.1,
      ventanaDias: volRaw.ventana_dias ?? 60,
      escalaMaxima: volRaw.escala_maxima ?? 1,
    },
  };
}
