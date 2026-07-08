import { Signal } from "../domain/types";
import { atrProxy, TsmomParams, tsmomSignal } from "../strategy/tsmom";

/**
 * Enriquecimiento de la señal para la NOTIFICACIÓN (Telegram) a Moisés.
 * Convierte la señal TSMOM cruda en las 3 claves que pidió:
 *   1. el porqué (rationale legible),
 *   2. probabilidad de acierto (win-rate histórico del backtest, HONESTO),
 *   3. duración esperada de la operación (holding medio histórico).
 *
 * Honestidad: el trend following gana <50% de las veces por diseño; el edge está
 * en dejar correr los ganadores. Por eso mostramos win-rate + horizonte, sin inflar.
 */
export interface InstrumentStats {
  winRatePct: number; // % histórico de aciertos (backtest)
  avgHoldDays: number; // duración media de la operación en el backtest
  horizon: "corto" | "medio" | "largo";
}

export interface SignalAnalysis {
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  stopPrice: number;
  momentumPct: number; // % de cambio en la ventana de lookback
  stopDistancePct: number; // distancia al stop en %
  winProbabilityPct: number;
  expectedDays: number;
  horizon: "corto" | "medio" | "largo";
  rationale: string;
}

export function analyzeSignal(
  closes: number[],
  params: TsmomParams,
  stats: InstrumentStats,
  label: string,
): SignalAnalysis | null {
  const i = closes.length - 1;
  const signal: Signal | null = tsmomSignal(closes, i, params);
  if (!signal) return null;

  const prev = closes[i - params.lookback]!;
  const momentumPct = ((closes[i]! - prev) / prev) * 100;
  const stopDistancePct = (Math.abs(signal.entryPrice - signal.stopPrice) / signal.entryPrice) * 100;
  const atr = atrProxy(closes, i, params.atrPeriod);
  const dir = signal.side === "buy" ? "alcista" : "bajista";
  const accion = signal.side === "buy" ? "LARGO" : "CORTO";

  const rationale =
    `${label} en tendencia ${dir}: el precio se movió ${momentumPct >= 0 ? "+" : ""}${momentumPct.toFixed(1)}% ` +
    `en las últimas ${params.lookback} sesiones. Entrada ${accion} con stop a ${params.atrMult}×ATR ` +
    `(${stopDistancePct.toFixed(1)}% ≈ volatilidad diaria de ${atr.toFixed(2)}). Se mantiene mientras la tendencia siga; ` +
    `se cierra sola si el momentum se gira.`;

  return {
    symbol: signal.symbol,
    side: signal.side,
    entryPrice: signal.entryPrice,
    stopPrice: signal.stopPrice,
    momentumPct,
    stopDistancePct,
    winProbabilityPct: stats.winRatePct,
    expectedDays: stats.avgHoldDays,
    horizon: stats.horizon,
    rationale,
  };
}

/**
 * Formatea la señal enriquecida como AVISO de Telegram.
 * El sistema ejecuta solo (estrategia institucional) y notifica a Moisés: es informativo,
 * no requiere aprobación. Queda también registrado en su panel.
 */
export function toTelegramCard(a: SignalAnalysis, label: string, riskPct: number): string {
  const emoji = a.side === "buy" ? "📈" : "📉";
  const accion = a.side === "buy" ? "LARGO (BUY)" : "CORTO (SELL)";
  return [
    `${emoji} <b>${label}</b> — ${accion} · plazo ${a.horizon}`,
    `<i>Entrada ejecutada automáticamente · registrada en tu panel</i>`,
    ``,
    `<b>Por qué:</b> ${a.rationale}`,
    ``,
    `<b>Probabilidad de acierto:</b> ~${a.winProbabilityPct.toFixed(0)}% (histórico)`,
    `   ↳ trend following gana <50% por diseño; el edge está en dejar correr los ganadores.`,
    `<b>Duración estimada:</b> ~${a.expectedDays} días abierta`,
    `<b>Riesgo:</b> ${riskPct}% del capital · entrada ${a.entryPrice} · stop ${a.stopPrice.toFixed(2)}`,
  ].join("\n");
}
