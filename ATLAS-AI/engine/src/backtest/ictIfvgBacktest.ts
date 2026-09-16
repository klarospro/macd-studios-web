import { BacktestAdapter } from "./backtestAdapter";
import { evaluate } from "../risk/riskGate";
import { RiskConfig } from "../config/riskConfig";
import { AccountState, Position } from "../domain/types";
import { Candle } from "../strategy/ictIfvg/types";
import { IctIfvgParams, findIctIfvgSignal } from "../strategy/ictIfvg";

/**
 * Backtest de ICT IFVG sobre velas 5M de NQ reales, pasando por el risk gate REAL del motor
 * (`evaluate`) para cada entrada — el mismo que valida órdenes en vivo. `riskGate.ts` NO se
 * modifica: no modela objetivos ni cierres parciales, así que la gestión de TP1(50%)/break-even/
 * TP2(resto) se simula aquí, mutando en memoria los campos del `Position` que el propio
 * `BacktestAdapter` ya expone (sin tocar la clase). Ver 28_ESTRATEGIA_ICT_IFVG/03_INTEGRACION_ENGINE.md.
 *
 * Reglas de simulación DECLARADAS (mismo criterio de honestidad que `liquidityGrabBacktest.ts`):
 * - Entrada solo dentro de la ventana 9:30-10:10 NY, al CIERRE de la vela de confirmación IFVG.
 * - La GESTIÓN de la posición (stop/TP1/BE/TP2) continúa DESPUÉS de la ventana de entrada, hasta
 *   resolverse o hasta el cierre del día natural (NY) — la ventana solo restringe cuándo se puede
 *   ENTRAR, no cuánto dura la gestión. Esto no está explícito en la spec; es la lectura más
 *   razonable (una ventana de 40 min rara vez alcanza para tocar TP1+TP2).
 * - Resolución dentro de la barra con high/low reales. Empate stop/objetivo en la MISMA vela ->
 *   se asume que el STOP se tocó primero (supuesto conservador, igual que Liquidity Grab).
 * - TP1 cierra el 50% de los contratos y mueve el stop del resto a break-even (precio de entrada).
 * - Sin TP2 identificado (sin swing de liquidez externa en los datos): el resto se cierra al
 *   FINAL del día natural NY — no se inventa un nivel de TP2.
 * - Máximo 2 entradas/día. Kill switch: -1% de equity vs. el inicio del día -> cierra cualquier
 *   posición abierta y bloquea nuevas entradas el resto del día.
 * - Coste `costBps` por LADO sobre el nocional, cobrado en cada fill (entrada, TP1, cierre final).
 * - MAE/MFE por operación: excursión adversa/favorable máxima en PUNTOS del índice, medida sobre
 *   el high/low de cada vela mientras cualquier parte de la posición sigue abierta.
 */

export type IctIfvgOutcome =
  | "stop_full" // stop tocado ANTES de alcanzar TP1 (sin cierre parcial)
  | "tp1_then_stop_be" // TP1 tocado, el resto salió luego en break-even (o peor, si hubo gap)
  | "tp1_then_tp2" // TP1 y TP2 alcanzados: ciclo completo de la spec
  | "tp1_then_day_end" // TP1 tocado, pero ni BE ni TP2 se resolvieron antes de cerrar el día
  | "day_end_no_tp1" // el día terminó sin haber tocado stop ni TP1 (operación sin resolver)
  | "daily_kill_switch" // cierre forzado por el kill switch de -1% diario
  | "end_of_data"; // se acabaron las velas del dataset con la posición todavía abierta

export interface IctIfvgTrade {
  entryTime: number;
  exitTime: number;
  side: "buy" | "sell";
  entry: number;
  stop: number;
  tp1: number;
  tp2: number | null;
  exitTp1: number | null;
  exitFinal: number;
  /** Tamaño ORIGINAL aprobado por el riskGate (unidades del gate, no contratos — ver 03_INTEGRACION_ENGINE.md). */
  size: number;
  pnl: number;
  outcome: IctIfvgOutcome;
  maePoints: number;
  mfePoints: number;
}

export interface IctIfvgBacktestResult {
  trades: IctIfvgTrade[];
  wins: number;
  losses: number;
  initialEquity: number;
  finalEquity: number;
  maxDrawdownPct: number;
  grossProfit: number;
  grossLoss: number;
  rejections: Record<string, number>;
  killSwitchDays: number;
  bars: number;
  spanDays: number;
}

const NY_TZ = "America/New_York";
const nyDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Clave de día natural en zona horaria de Nueva York (para reinicios diarios y kill switch). */
function nyDayKey(epochSeconds: number): string {
  return nyDayFormatter.format(new Date(epochSeconds * 1000));
}

interface TradePlanState {
  side: "buy" | "sell";
  stop: number;
  tp1: number;
  tp2: number | null;
}

interface OpenTrade {
  position: Position;
  plan: TradePlanState;
  entryTime: number;
  originalSize: number;
  tp1Hit: boolean;
  tp1ExitPrice: number | null;
  tp1RealizedPnl: number;
  maePoints: number;
  mfePoints: number;
}

export async function runIctIfvgBacktest(
  m5: Candle[],
  dailyCandles: Candle[],
  h4Candles: Candle[],
  config: RiskConfig,
  params: IctIfvgParams,
  initialEquity: number,
  costBps = 0,
  maxTradesPerDay = 2,
  dailyKillPct = 0.01,
): Promise<IctIfvgBacktestResult> {
  const adapter = new BacktestAdapter(initialEquity);

  let open: OpenTrade | null = null;
  let consecutiveLosses = 0;
  let peakEquity = initialEquity;
  let maxDrawdownPct = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  // Vacío a propósito (no `nyDayKey(m5[0].t)`): así la barra i=0 SIEMPRE entra en la rama de
  // "cambio de día" de más abajo y calcula dailySlice/h4Slice antes de buscar la primera señal.
  let currentDay = "";
  let startOfDayEquity = initialEquity;
  let tradesToday = 0;
  let killSwitchToday = false;
  let killSwitchDays = 0;
  // Daily/4H recortados a solo velas YA CERRADAS antes de "hoy" (anti-lookahead) — se recalculan
  // una vez por día, no en cada vela 5M. Pasar los arrays completos sin recortar (como se hacía
  // antes) filtra el bias sobre TODO el histórico, incluyendo el futuro respecto a `now`, y de
  // paso lo deja fijo durante todo el backtest — el bug que dio 0 operaciones en la primera corrida.
  let dailySlice: Candle[] = [];
  let h4Slice: Candle[] = [];
  const trades: IctIfvgTrade[] = [];
  const rejections: Record<string, number> = {};

  const costOf = (size: number, price: number): number => (costBps / 10000) * size * price;

  const recordClose = (trade: IctIfvgTrade): void => {
    if (trade.pnl > 0) {
      wins++;
      grossProfit += trade.pnl;
      consecutiveLosses = 0;
    } else {
      losses++;
      grossLoss += Math.abs(trade.pnl);
      consecutiveLosses++;
    }
    trades.push(trade);
  };

  /** Cierra el resto de la posición (o toda, si TP1 nunca se tocó) y registra el trade completo. */
  const finalizeTrade = async (price: number, time: number, outcome: IctIfvgOutcome): Promise<void> => {
    if (!open) return;
    const current = open;
    const before = await adapter.getEquity();
    adapter.currentPrice = price;
    await adapter.closePosition(current.position.id);
    if (costBps > 0) adapter.charge(costOf(current.position.size, price));
    const finalLegPnl = (await adapter.getEquity()) - before;
    const totalPnl = current.tp1RealizedPnl + finalLegPnl;

    recordClose({
      entryTime: current.entryTime,
      exitTime: time,
      side: current.plan.side,
      entry: current.position.entryPrice,
      stop: current.plan.stop,
      tp1: current.plan.tp1,
      tp2: current.plan.tp2,
      exitTp1: current.tp1ExitPrice,
      exitFinal: price,
      size: current.originalSize,
      pnl: totalPnl,
      outcome,
      maePoints: current.maePoints,
      mfePoints: current.mfePoints,
    });
    open = null;
  };

  /** Cierra el 50% de la posición en TP1 y mueve el stop del resto a break-even. */
  const applyTp1 = async (price: number): Promise<void> => {
    if (!open || open.tp1Hit) return;
    const current = open;
    const positions = adapter.openPositions;
    const pos = positions.find((p) => p.id === current.position.id);
    if (!pos) return;

    const halfSize = pos.size / 2;
    const direction = current.plan.side === "buy" ? 1 : -1;
    const partialPnl = (price - pos.entryPrice) * halfSize * direction;

    adapter.charge(-partialPnl); // `charge` resta del equity; se pasa negativo para SUMAR el PnL realizado en TP1.
    if (costBps > 0) adapter.charge(costOf(halfSize, price));

    // Reduce el tamaño y riesgo restante del Position en memoria (misma referencia que expone el
    // adapter) para que el resto de la vida del trade opere sobre la mitad restante. No se toca
    // BacktestAdapter ni ningún archivo existente.
    pos.size = halfSize;
    pos.riskAmount = pos.riskAmount / 2;

    open = {
      ...current,
      tp1Hit: true,
      tp1ExitPrice: price,
      tp1RealizedPnl: partialPnl,
      plan: { ...current.plan, stop: pos.entryPrice }, // break-even = mismo nivel que TP1, spec §Break-even
    };
  };

  for (let i = 0; i < m5.length; i++) {
    const bar = m5[i]!;
    const day = nyDayKey(bar.t);
    if (day !== currentDay) {
      currentDay = day;
      startOfDayEquity = await adapter.getEquity();
      tradesToday = 0;
      killSwitchToday = false;
      // Solo velas 1D/4H YA CERRADAS antes de hoy (anti-lookahead) — mismo criterio de "no mirar
      // al futuro" que ya usan liquidityGrab/detectSwings en el resto del motor.
      dailySlice = dailyCandles.filter((c) => nyDayKey(c.t) < currentDay);
      h4Slice = h4Candles.filter((c) => nyDayKey(c.t) < currentDay);
    }

    if (open) {
      const current: OpenTrade = open;
      const long = current.plan.side === "buy";
      const entry = current.position.entryPrice;
      const adverse = long ? entry - bar.l : bar.h - entry;
      const favorable = long ? bar.h - entry : entry - bar.l;
      open = { ...current, maePoints: Math.max(current.maePoints, adverse), mfePoints: Math.max(current.mfePoints, favorable) };
    }

    if (open) {
      const { plan, tp1Hit } = open;
      const long = plan.side === "buy";
      const stopTouched = long ? bar.l <= plan.stop : bar.h >= plan.stop;
      const stopGap = long ? bar.o <= plan.stop : bar.o >= plan.stop;

      if (!tp1Hit) {
        const tp1Touched = long ? bar.h >= plan.tp1 : bar.l <= plan.tp1;
        const tp1Gap = long ? bar.o >= plan.tp1 : bar.o <= plan.tp1;

        if (stopGap) await finalizeTrade(bar.o, bar.t, "stop_full");
        else if (stopTouched) await finalizeTrade(plan.stop, bar.t, "stop_full"); // empate -> gana el stop (conservador)
        else if (tp1Gap) await applyTp1(bar.o);
        else if (tp1Touched) await applyTp1(plan.tp1);
      } else {
        const tp2 = plan.tp2;
        const tp2Touched = tp2 !== null && (long ? bar.h >= tp2 : bar.l <= tp2);
        const tp2Gap = tp2 !== null && (long ? bar.o >= tp2 : bar.o <= tp2);

        if (stopGap) await finalizeTrade(bar.o, bar.t, "tp1_then_stop_be");
        else if (stopTouched) await finalizeTrade(plan.stop, bar.t, "tp1_then_stop_be"); // empate -> gana el stop
        else if (tp2Gap) await finalizeTrade(bar.o, bar.t, "tp1_then_tp2");
        else if (tp2Touched && tp2 !== null) await finalizeTrade(tp2, bar.t, "tp1_then_tp2");
      }
    }

    // Cierre forzado: fin de los datos o cambio de día natural NY.
    const nextBar = m5[i + 1];
    if (open && !nextBar) {
      await finalizeTrade(bar.c, bar.t, "end_of_data");
    } else if (open && nextBar && nyDayKey(nextBar.t) !== currentDay) {
      await finalizeTrade(bar.c, bar.t, open.tp1Hit ? "tp1_then_day_end" : "day_end_no_tp1");
    }

    adapter.currentPrice = bar.c;
    const equityNow = await adapter.getEquity();
    peakEquity = Math.max(peakEquity, equityNow);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peakEquity - equityNow) / peakEquity);

    // Kill switch diario: -1% de equity vs. el inicio del día -> cierra lo abierto y bloquea entradas.
    const dailyLossPct = startOfDayEquity > 0 ? (startOfDayEquity - equityNow) / startOfDayEquity : 0;
    if (!killSwitchToday && dailyLossPct >= dailyKillPct) {
      killSwitchToday = true;
      killSwitchDays++;
      if (open) await finalizeTrade(bar.c, bar.t, "daily_kill_switch");
    }

    if (open || killSwitchToday || tradesToday >= maxTradesPerDay) continue;

    const found = findIctIfvgSignal(m5, dailySlice, h4Slice, i, params);
    if (!found) continue;

    const account: AccountState = {
      equity: equityNow,
      startOfDayEquity,
      peakEquity,
      openPositions: adapter.openPositions,
      consecutiveLosses,
      recentBrokerErrors: 0,
      tradingHalted: false,
    };
    const decision = evaluate(config, account, found.signal);
    if (!decision.approved) {
      rejections[decision.reason] = (rejections[decision.reason] ?? 0) + 1;
      continue;
    }

    const position = await adapter.placeOrder(decision.order);
    if (costBps > 0) adapter.charge(costOf(position.size, position.entryPrice));

    open = {
      position,
      plan: { side: found.plan.side, stop: found.plan.stop, tp1: found.plan.tp1, tp2: found.plan.tp2 },
      entryTime: bar.t,
      originalSize: position.size,
      tp1Hit: false,
      tp1ExitPrice: null,
      tp1RealizedPnl: 0,
      maePoints: 0,
      mfePoints: 0,
    };
    tradesToday++;
  }

  const spanDays = m5.length > 0 ? (m5[m5.length - 1]!.t - m5[0]!.t) / 86400 : 0;
  return {
    trades,
    wins,
    losses,
    initialEquity,
    finalEquity: await adapter.getEquity(),
    maxDrawdownPct,
    grossProfit,
    grossLoss,
    rejections,
    killSwitchDays,
    bars: m5.length,
    spanDays,
  };
}

export interface IctIfvgMetrics {
  returnPct: number;
  winRate: number;
  profitFactor: number;
  maxDdPct: number;
  numTrades: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  avgMaePoints: number;
  avgMfePoints: number;
}

export function summarizeIctIfvg(r: IctIfvgBacktestResult): IctIfvgMetrics {
  const numTrades = r.trades.length;
  const wins = r.trades.filter((t) => t.pnl > 0);
  const losses = r.trades.filter((t) => t.pnl <= 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const winRate = numTrades ? wins.length / numTrades : 0;

  return {
    returnPct: ((r.finalEquity - r.initialEquity) / r.initialEquity) * 100,
    winRate: winRate * 100,
    profitFactor: r.grossLoss > 0 ? r.grossProfit / r.grossLoss : r.grossProfit > 0 ? Infinity : 0,
    maxDdPct: r.maxDrawdownPct * 100,
    numTrades,
    expectancy: winRate * avgWin + (1 - winRate) * avgLoss,
    avgWin,
    avgLoss,
    avgMaePoints: numTrades ? r.trades.reduce((s, t) => s + t.maePoints, 0) / numTrades : 0,
    avgMfePoints: numTrades ? r.trades.reduce((s, t) => s + t.mfePoints, 0) / numTrades : 0,
  };
}
