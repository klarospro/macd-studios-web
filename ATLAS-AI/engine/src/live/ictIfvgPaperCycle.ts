import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRiskConfig, RiskConfig } from "../config/riskConfig";
import { evaluate } from "../risk/riskGate";
import { AccountState } from "../domain/types";
import { defaultIctIfvgParams, findIctIfvgSignal, IctIfvgParams } from "../strategy/ictIfvg";
import { Candle } from "../strategy/ictIfvg/types";
import { isInFirstIfvgWindow, isWeekday, nyDayKey } from "../strategy/ictIfvg/session";

/**
 * Ciclo PAPER de ICT IFVG (NQ) — pensado para correr cada 5 minutos vía systemd timer
 * (`16_AUTOMATION/deploy/atlas-ifvg-cycle.service` + `.timer`). SOLO PAPER: no ejecuta nada en
 * ningún broker, no requiere credenciales de IG/Deriv. Objetivo único: acumular operaciones REALES
 * (no de backtest) sobre precios reales para tener, con el tiempo, la muestra que el backtest de
 * 71 días de Yahoo no puede dar — ver `28_ESTRATEGIA_ICT_IFVG/06_VALIDACION_NQ_YAHOO.md`.
 *
 * Fuente de precios: Yahoo Finance (mismo endpoint público que `fetchNqIctData.ts`). Limitación
 * DECLARADA: no es un feed de broker en tiempo real, puede traer un desfase de segundos/minutos y
 * no tiene SLA — aceptable para acumular paper, NO para ejecutar dinero real (eso requiere IG u
 * otro broker conectado, pendiente credenciales — ver `05_PREGUNTAS_ABIERTAS.md` #3).
 *
 * Gestión de TP1/TP2/break-even: reimplementada aquí de forma simplificada, mirando SOLO la
 * última vela 5M en cada tick (a diferencia de `ictIfvgBacktest.ts`, que resuelve dentro de la
 * barra con high/low reales sobre TODO el histórico). Si el timer se salta un tick o Yahoo tarda,
 * un toque de stop/TP dentro de una vela perdida podría no registrarse hasta el siguiente tick —
 * limitación aceptada, documentada, no crítica para el objetivo de "acumular muestra".
 *
 *   node --import tsx src/live/ictIfvgPaperCycle.ts
 */

const INITIAL_EQUITY = 50_000;
const CONFIG: RiskConfig = {
  ...defaultRiskConfig,
  riskPerTradePct: 0.005,
  dailyDrawdownPct: 0.01,
  dailyDrawdownReducePct: 0.005,
  maxConcurrentPositions: 1,
};
const PARAMS: IctIfvgParams = { symbol: "NQ", correlationGroup: "nasdaq_index", ...defaultIctIfvgParams };
const MAX_TRADES_PER_DAY = 2;
const DAILY_KILL_PCT = 0.01;

const RUNTIME = new URL("../../runtime/", import.meta.url);
const STATE_PATH = fileURLToPath(new URL("ictIfvgState.json", RUNTIME));
const AUDIT_PATH = fileURLToPath(new URL("ictIfvgAudit.jsonl", RUNTIME));

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Yahoo respondió ${res.status} para ${symbol} ${interval}/${range}`);
  const body = (await res.json()) as {
    chart: { result: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> } }> | null; error: unknown };
  };
  if (body.chart.error) throw new Error(`Yahoo error ${symbol} ${interval}/${range}: ${JSON.stringify(body.chart.error)}`);
  const result = body.chart.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote?.open?.[i];
    const h = quote?.high?.[i];
    const l = quote?.low?.[i];
    const c = quote?.close?.[i];
    const t = timestamps[i];
    if (t == null || o == null || h == null || l == null || c == null) continue;
    candles.push({ t, o, h, l, c });
  }
  return candles.sort((a, b) => a.t - b.t);
}

function aggregate4h(hourly: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i + 3 < hourly.length; i += 4) {
    const block = hourly.slice(i, i + 4);
    out.push({ t: block[0]!.t, o: block[0]!.o, h: Math.max(...block.map((b) => b.h)), l: Math.min(...block.map((b) => b.l)), c: block[block.length - 1]!.c });
  }
  return out;
}

interface OpenIfvgPosition {
  side: "buy" | "sell";
  entry: number;
  stop: number; // se mueve a break-even tras TP1
  tp1: number;
  tp2: number | null;
  size: number; // unidades del riskGate (continuo — misma convención que el backtest, ver 03_INTEGRACION_ENGINE.md §5)
  riskAmount: number;
  tp1Hit: boolean;
  tp1RealizedPnl: number;
  openedAt: string;
}

interface IfvgRuntimeState {
  equity: number;
  peakEquity: number;
  startOfDayEquity: number;
  startOfDayDate: string; // YYYY-MM-DD NY
  tradesToday: number;
  killSwitchToday: boolean;
  consecutiveLosses: number;
  open: OpenIfvgPosition | null;
}

function loadState(): IfvgRuntimeState {
  if (!existsSync(STATE_PATH)) {
    return { equity: INITIAL_EQUITY, peakEquity: INITIAL_EQUITY, startOfDayEquity: INITIAL_EQUITY, startOfDayDate: "", tradesToday: 0, killSwitchToday: false, consecutiveLosses: 0, open: null };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as IfvgRuntimeState;
}

function saveState(state: IfvgRuntimeState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function auditLog(event: Record<string, unknown>): void {
  mkdirSync(dirname(AUDIT_PATH), { recursive: true });
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

async function main(): Promise<void> {
  const state = loadState();
  const m5 = await fetchYahooChart("NQ=F", "5m", "5d");
  if (m5.length === 0) throw new Error("Yahoo no devolvió velas 5M — reintentar en el próximo tick.");
  const now = m5.length - 1;
  const bar = m5[now]!;
  const today = nyDayKey(bar.t);

  if (today !== state.startOfDayDate) {
    state.startOfDayDate = today;
    state.startOfDayEquity = state.equity;
    state.tradesToday = 0;
    state.killSwitchToday = false;
  }

  console.log(`Ciclo PAPER ICT IFVG · ${new Date(bar.t * 1000).toISOString()} · equity $${state.equity.toFixed(2)} · vela ${bar.c}`);

  // ── 1. Gestión de la posición abierta (si hay) contra la última vela ──
  if (state.open) {
    const p = state.open;
    const long = p.side === "buy";
    const stopTouched = long ? bar.l <= p.stop : bar.h >= p.stop;
    const stopGap = long ? bar.o <= p.stop : bar.o >= p.stop;
    const exitPrice = stopGap ? bar.o : p.stop;

    const closeOut = (price: number, motivo: string): void => {
      const direction = long ? 1 : -1;
      const legSize = p.tp1Hit ? p.size / 2 : p.size;
      const legPnl = (price - p.entry) * legSize * direction;
      const totalPnl = p.tp1RealizedPnl + legPnl;
      state.equity += legPnl;
      if (totalPnl > 0) state.consecutiveLosses = 0;
      else state.consecutiveLosses++;
      auditLog({ kind: "position_closed", symbol: PARAMS.symbol, side: p.side, entry: p.entry, exit: price, pnl: totalPnl, motivo, tp1Hit: p.tp1Hit });
      console.log(`  CIERRE · ${p.side.toUpperCase()} @ ${p.entry} → ${price} · pnl $${totalPnl.toFixed(2)} · motivo ${motivo}`);
      state.open = null;
    };

    if (!p.tp1Hit) {
      const tp1Touched = long ? bar.h >= p.tp1 : bar.l <= p.tp1;
      const tp1Gap = long ? bar.o >= p.tp1 : bar.o <= p.tp1;
      if (stopGap || stopTouched) closeOut(exitPrice, "stop_full");
      else if (tp1Gap || tp1Touched) {
        const price = tp1Gap ? bar.o : p.tp1;
        const direction = long ? 1 : -1;
        const halfSize = p.size / 2;
        const partialPnl = (price - p.entry) * halfSize * direction;
        state.equity += partialPnl;
        state.open = { ...p, tp1Hit: true, tp1RealizedPnl: partialPnl, stop: p.entry }; // break-even
        auditLog({ kind: "tp1_partial", symbol: PARAMS.symbol, side: p.side, entry: p.entry, exit: price, pnl: partialPnl });
        console.log(`  TP1 · ${p.side.toUpperCase()} @ ${p.entry} → ${price} · pnl parcial $${partialPnl.toFixed(2)} · stop movido a break-even`);
      }
    } else {
      const tp2Touched = p.tp2 !== null && (long ? bar.h >= p.tp2 : bar.l <= p.tp2);
      const tp2Gap = p.tp2 !== null && (long ? bar.o >= p.tp2 : bar.o <= p.tp2);
      if (stopGap || stopTouched) closeOut(exitPrice, "tp1_then_stop_be");
      else if (p.tp2 !== null && (tp2Gap || tp2Touched)) closeOut(tp2Gap ? bar.o : p.tp2, "tp1_then_tp2");
    }
  }

  // ── 2. Kill switch diario ──
  const dailyLossPct = state.startOfDayEquity > 0 ? (state.startOfDayEquity - state.equity) / state.startOfDayEquity : 0;
  if (!state.killSwitchToday && dailyLossPct >= DAILY_KILL_PCT) {
    state.killSwitchToday = true;
    if (state.open) {
      auditLog({ kind: "daily_kill_switch", symbol: PARAMS.symbol });
      console.log("  KILL SWITCH DIARIO activado — se fuerza a revisar/cerrar en el próximo tick.");
    }
  }
  state.peakEquity = Math.max(state.peakEquity, state.equity);

  // ── 3. Búsqueda de nueva entrada (solo si flat, no kill-switch, no tope diario) ──
  if (!state.open && !state.killSwitchToday && state.tradesToday < MAX_TRADES_PER_DAY && isWeekday(bar.t)) {
    if (!isInFirstIfvgWindow(bar.t)) {
      console.log("  fuera de la ventana 9:30-10:10 NY — sin búsqueda de entrada este tick.");
    } else {
      const [daily, hourly] = await Promise.all([fetchYahooChart("NQ=F", "1d", "2y"), fetchYahooChart("NQ=F", "60m", "730d")]);
      const h4 = aggregate4h(hourly);
      const found = findIctIfvgSignal(m5, daily, h4, now, PARAMS);
      if (!found) {
        console.log("  sin señal válida en este tick (bias NONE o sin IFVG a favor).");
      } else {
        const account: AccountState = {
          equity: state.equity,
          startOfDayEquity: state.startOfDayEquity,
          peakEquity: state.peakEquity,
          openPositions: [],
          consecutiveLosses: state.consecutiveLosses,
          recentBrokerErrors: 0,
          tradingHalted: false,
        };
        const decision = evaluate(CONFIG, account, found.signal);
        if (!decision.approved) {
          auditLog({ kind: "order_rejected", symbol: PARAMS.symbol, signal: found.signal, reason: decision.reason });
          console.log(`  señal ${found.signal.side.toUpperCase()} RECHAZADA por el risk gate: ${decision.reason}`);
        } else {
          const o = decision.order;
          state.open = { side: o.side, entry: o.entryPrice, stop: o.stopPrice, tp1: found.plan.tp1, tp2: found.plan.tp2, size: o.size, riskAmount: o.riskAmount, tp1Hit: false, tp1RealizedPnl: 0, openedAt: new Date().toISOString() };
          state.tradesToday++;
          auditLog({ kind: "order_placed", symbol: PARAMS.symbol, order: o, plan: found.plan });
          console.log(`  ENTRADA (paper) · ${o.side.toUpperCase()} @ ${o.entryPrice} · stop ${o.stopPrice.toFixed(2)} · TP1 ${found.plan.tp1.toFixed(2)} · riesgo $${o.riskAmount.toFixed(2)}`);
        }
      }
    }
  }

  saveState(state);
}

main().catch((error) => {
  console.error(`FALLO ciclo paper ICT IFVG: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
