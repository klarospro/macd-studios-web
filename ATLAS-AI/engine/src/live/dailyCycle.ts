import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { tsmomSignal, TsmomParams } from "../strategy/tsmom";
import { evaluate } from "../risk/riskGate";
import { defaultRiskConfig } from "../config/riskConfig";
import { AccountState, Position } from "../domain/types";
import { createAuditLog } from "../audit/supabaseAuditLog";
import { analyzeSignal, InstrumentStats } from "../analysis/signalAnalysis";
import { appendEquity, HeldPosition, loadMeta, loadState, OpenState, saveMeta, saveState } from "./state";
import { publishLiveSnapshot } from "./publishLive";
import { notifyEntry, notifyExit } from "./telegram";

/**
 * Ciclo diario en vivo (Deriv DEMO): baja velas reales, calcula la señal TSMOM por instrumento,
 * la pasa por el risk gate REAL con un estado de cuenta COMPARTIDO que acumula las posiciones
 * (aplica de verdad el tope de posiciones concurrentes, el riesgo agregado y los breakers de
 * drawdown), gestiona salidas por cambio de tendencia y (con `--execute`) abre/cierra en la demo.
 * Avisa por Telegram (vía n8n) en cada entrada. DRY-RUN por defecto.
 */
interface Instrument {
  name: string;
  derivSymbol: string;
  label: string;
  stats: InstrumentStats;
}

// Solo activos que la cuenta DEMO de Deriv ofrece para operar (cripto, oro, forex).
// Los índices de acciones (US30, Nasdaq) NO se ofrecen en Deriv → irán por MT5 en la
// arquitectura multi-venue (ver 11_MT5). Aquí solo lo operable en este venue.
const INSTRUMENTS: Instrument[] = [
  { name: "BTCUSD", derivSymbol: "cryBTCUSD", label: "BTC/USD", stats: { winRatePct: 39, avgHoldDays: 28, horizon: "medio" } },
  { name: "Oro", derivSymbol: "frxXAUUSD", label: "Oro (XAU/USD)", stats: { winRatePct: 75, avgHoldDays: 120, horizon: "largo" } },
  { name: "EURUSD", derivSymbol: "frxEURUSD", label: "EUR/USD", stats: { winRatePct: 22, avgHoldDays: 28, horizon: "medio" } },
];

const LOOKBACK = 60;
const FETCH_COUNT = 300; // generoso: Deriv recorta a lo disponible (~250 en índices/forex)
const RISK_PCT = 1;
const CONFIG = { ...defaultRiskConfig, maxConsecutiveLosses: 12 }; // trend following (decisión por-venue)
const EXECUTE = process.argv.includes("--execute");

const RUNTIME = new URL("../../runtime/", import.meta.url);
const audit = createAuditLog(fileURLToPath(new URL("audit.jsonl", RUNTIME)));
const STATE_PATH = fileURLToPath(new URL("state.json", RUNTIME));
const META_PATH = fileURLToPath(new URL("portfolio.json", RUNTIME));
const EQUITY_PATH = fileURLToPath(new URL("equity.jsonl", RUNTIME));

function paramsFor(symbol: string): TsmomParams {
  return { symbol, correlationGroup: "multi", lookback: LOOKBACK, atrPeriod: 14, atrMult: 2 };
}

function heldToPosition(name: string, h: HeldPosition): Position {
  return {
    id: h.contractId,
    symbol: name,
    side: h.side,
    size: h.size,
    entryPrice: h.entryPrice,
    stopPrice: h.stopPrice,
    riskAmount: h.riskAmount,
    correlationGroup: "multi",
  };
}

/**
 * Construye el análisis enriquecido de la señal y avisa de la ENTRADA por Telegram
 * (operaciones + clientes) vía el módulo `telegram.ts`. Fire-and-forget: no rompe el ciclo.
 */
async function announceEntry(inst: Instrument, closes: number[], dryRun: boolean): Promise<void> {
  const a = analyzeSignal(closes, paramsFor(inst.derivSymbol), inst.stats, inst.label);
  if (!a) return;
  await notifyEntry(a, inst.label, RISK_PCT, dryRun);
}

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  try {
    await runCycle(adapter);
  } finally {
    await adapter.disconnect();
  }
}

async function runCycle(adapter: DerivDemoAdapter): Promise<void> {
  const equity = await adapter.getEquity();
  const state: OpenState = loadState(STATE_PATH);
  const at = new Date().toISOString();
  const today = at.slice(0, 10);

  // Meta de cartera: pico de equity + equity de inicio de día (para los breakers de drawdown).
  const prevMeta = loadMeta(META_PATH);
  const startOfDayEquity = prevMeta && prevMeta.startOfDayDate === today ? prevMeta.startOfDayEquity : equity;
  const peakEquity = Math.max(prevMeta?.peakEquity ?? equity, equity);

  // Estado de cuenta COMPARTIDO: arranca con las posiciones ya abiertas y se va acumulando.
  const account: AccountState = {
    equity,
    startOfDayEquity,
    peakEquity,
    openPositions: Object.entries(state).map(([name, h]) => heldToPosition(name, h)),
    consecutiveLosses: 0, // TODO: derivar del P&L al cerrar (pendiente); breakers de drawdown ya activos.
    recentBrokerErrors: 0,
    tradingHalted: false,
  };

  console.log(
    `Ciclo diario · demo ${adapter.accountId} · equity $${equity} · inicio-día $${startOfDayEquity} · pico $${peakEquity} · ` +
      `modo ${EXECUTE ? "EJECUTAR" : "DRY-RUN"} · ${at}\n`,
  );

  for (const inst of INSTRUMENTS) {
   try {
    const { name, derivSymbol, label } = inst;
    const closes = await adapter.dailyCloses(derivSymbol, FETCH_COUNT);
    const i = closes.length - 1;
    const signal = tsmomSignal(closes, i, paramsFor(derivSymbol));
    const held = state[name];

    // 1. SALIDAS: si tenemos posición y la tendencia se giró o desapareció, cerrar.
    if (held && (!signal || signal.side !== held.side)) {
      if (EXECUTE) await adapter.closePosition(held.contractId);
      await audit.record({ kind: "position_closed", at, venueId: "deriv-demo", positionId: held.contractId, symbol: name, motivo: "cambio_de_tendencia" });
      delete state[name];
      account.openPositions = account.openPositions.filter((p) => p.id !== held.contractId); // libera riesgo
      console.log(`${name.padEnd(8)} · CIERRE (${held.side.toUpperCase()} → tendencia girada) · contract ${held.contractId}`);
      await notifyExit(label, held.side, "cambio_de_tendencia", !EXECUTE);
    }

    if (!signal) {
      console.log(`${name.padEnd(8)} · sin señal (${closes.length} velas)`);
      continue;
    }
    if (state[name]) {
      console.log(`${name.padEnd(8)} · mantiene ${signal.side.toUpperCase()} (posición ya abierta)`);
      continue;
    }

    // 2. ENTRADAS: nueva señal sin posición → risk gate contra el estado ACUMULADO.
    const decision = evaluate(CONFIG, account, signal);
    if (!decision.approved) {
      await audit.record({ kind: "order_rejected", at, signal, reason: decision.reason, venueId: "deriv-demo" });
      console.log(`${name.padEnd(8)} · señal ${signal.side.toUpperCase()} → RECHAZADA (${decision.reason})`);
      continue;
    }

    const o = decision.order;
    console.log(`${name.padEnd(8)} · ${o.side.toUpperCase()} @ ${o.entryPrice} · stop ${o.stopPrice.toFixed(2)} · riesgo $${o.riskAmount.toFixed(2)} · size ${o.size.toFixed(6)}${EXECUTE ? " · EJECUTANDO…" : " · (dry-run)"}`);

    // Posición resultante (real si ejecutamos, sintética en dry-run) → acumula en el estado.
    const position: Position = EXECUTE
      ? await adapter.placeOrder(o)
      : { id: `dry-${name}`, symbol: o.symbol, side: o.side, size: o.size, entryPrice: o.entryPrice, stopPrice: o.stopPrice, riskAmount: o.riskAmount, correlationGroup: o.correlationGroup };
    account.openPositions.push(position);

    if (EXECUTE) {
      state[name] = { contractId: position.id, side: o.side, entryPrice: position.entryPrice, stopPrice: o.stopPrice, size: o.size, riskAmount: o.riskAmount, openedAt: at };
      await audit.record({ kind: "order_placed", at, order: o, positionId: position.id, venueId: "deriv-demo" });
      console.log(`         ↳ abierta · contract_id ${position.id}`);
    }
    await announceEntry(inst, closes, !EXECUTE);
   } catch (e) {
    // Un fallo de broker en un activo NO debe tumbar el ciclo entero ni perder el estado.
    console.log(`${inst.name.padEnd(8)} · ERROR broker: ${e instanceof Error ? e.message : String(e)} (se salta, el ciclo sigue)`);
   }
  }

  const openRisk = account.openPositions.reduce((s, p) => s + p.riskAmount, 0);
  console.log(
    `\nResumen · ${account.openPositions.length}/${CONFIG.maxConcurrentPositions} posiciones · ` +
      `riesgo abierto $${openRisk.toFixed(2)} (${((openRisk / equity) * 100).toFixed(1)}% / máx ${(CONFIG.maxAggregateRiskPct * 100).toFixed(0)}%)`,
  );

  saveState(STATE_PATH, state);
  saveMeta(META_PATH, { peakEquity, startOfDayEquity, startOfDayDate: today });
  appendEquity(EQUITY_PATH, equity);

  // Publica el snapshot en vivo (equity + P&L de posiciones reales) para el dashboard.
  await publishLiveSnapshot(adapter, "deriv-demo", STATE_PATH);
}

main().catch((error) => {
  console.error(`FALLO ciclo diario: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
