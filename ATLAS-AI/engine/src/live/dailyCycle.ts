import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { tsmomSignal, TsmomParams } from "../strategy/tsmom";
import { evaluate } from "../risk/riskGate";
import { defaultRiskConfig } from "../config/riskConfig";
import { AccountState } from "../domain/types";
import { createAuditLog } from "../audit/supabaseAuditLog";
import { appendEquity, loadState, OpenState, saveState } from "./state";

/**
 * Ciclo diario en vivo (Deriv DEMO): baja velas reales, calcula la señal TSMOM por instrumento,
 * la pasa por el risk gate REAL, gestiona salidas por cambio de tendencia y (con `--execute`)
 * abre/cierra en la demo. Deja rastro en auditoría append-only y registra la curva de equity.
 * DRY-RUN por defecto. Pensado para correr en un scheduler (cron/VPS) durante el mes de prueba.
 */
const INSTRUMENTS: Array<{ name: string; derivSymbol: string }> = [
  { name: "BTCUSD", derivSymbol: "cryBTCUSD" },
  { name: "Oro", derivSymbol: "frxXAUUSD" },
  { name: "US30", derivSymbol: "OTC_DJI" },
  { name: "Nasdaq", derivSymbol: "OTC_NDX" },
  { name: "EURUSD", derivSymbol: "frxEURUSD" },
];

const LOOKBACK = 60;
const FETCH_COUNT = 300; // generoso: Deriv recorta a lo disponible (~250 en índices/forex)
const CONFIG = { ...defaultRiskConfig, maxConsecutiveLosses: 12 }; // trend following (decisión por-venue)
const EXECUTE = process.argv.includes("--execute");

const RUNTIME = new URL("../../runtime/", import.meta.url);
const audit = createAuditLog(fileURLToPath(new URL("audit.jsonl", RUNTIME)));
const STATE_PATH = fileURLToPath(new URL("state.json", RUNTIME));
const EQUITY_PATH = fileURLToPath(new URL("equity.jsonl", RUNTIME));

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  try {
    await runCycle(adapter);
  } finally {
    await adapter.disconnect(); // siempre soltar el socket, incluso ante error
  }
}

async function runCycle(adapter: DerivDemoAdapter): Promise<void> {
  const equity = await adapter.getEquity();
  const state: OpenState = loadState(STATE_PATH);
  const at = new Date().toISOString();
  console.log(`Ciclo diario · demo ${adapter.accountId} · equity $${equity} · modo ${EXECUTE ? "EJECUTAR" : "DRY-RUN"} · ${at}\n`);

  for (const { name, derivSymbol } of INSTRUMENTS) {
    const closes = await adapter.dailyCloses(derivSymbol, FETCH_COUNT);
    const i = closes.length - 1;
    const params: TsmomParams = { symbol: derivSymbol, correlationGroup: "multi", lookback: LOOKBACK, atrPeriod: 14, atrMult: 2 };
    const signal = tsmomSignal(closes, i, params);
    const held = state[name];

    // 1. SALIDAS: si tenemos posición y la tendencia se giró o desapareció, cerrar.
    if (held && (!signal || signal.side !== held.side)) {
      if (EXECUTE) await adapter.closePosition(held.contractId);
      await audit.record({ kind: "position_closed", at, venueId: "deriv-demo", positionId: held.contractId, symbol: name, motivo: "cambio_de_tendencia" });
      delete state[name];
      console.log(`${name.padEnd(8)} · CIERRE (${held.side.toUpperCase()} → tendencia girada) · contract ${held.contractId}`);
    }

    if (!signal) {
      console.log(`${name.padEnd(8)} · sin señal (${closes.length} velas)`);
      continue;
    }
    if (state[name]) {
      console.log(`${name.padEnd(8)} · mantiene ${signal.side.toUpperCase()} (posición ya abierta)`);
      continue;
    }

    // 2. ENTRADAS: nueva señal sin posición → risk gate.
    const account: AccountState = {
      equity,
      startOfDayEquity: equity,
      peakEquity: equity,
      openPositions: [],
      consecutiveLosses: 0,
      recentBrokerErrors: 0,
      tradingHalted: false,
    };
    const decision = evaluate(CONFIG, account, signal);
    if (!decision.approved) {
      await audit.record({ kind: "order_rejected", at, signal, reason: decision.reason, venueId: "deriv-demo" });
      console.log(`${name.padEnd(8)} · señal ${signal.side.toUpperCase()} → RECHAZADA (${decision.reason})`);
      continue;
    }

    const o = decision.order;
    console.log(`${name.padEnd(8)} · ${o.side.toUpperCase()} @ ${o.entryPrice} · stop ${o.stopPrice.toFixed(2)} · riesgo $${o.riskAmount.toFixed(2)} · size ${o.size.toFixed(6)}${EXECUTE ? " · EJECUTANDO…" : " · (dry-run)"}`);

    if (EXECUTE) {
      const position = await adapter.placeOrder(o);
      state[name] = { contractId: position.id, side: o.side, entryPrice: position.entryPrice, stopPrice: o.stopPrice, size: o.size, riskAmount: o.riskAmount, openedAt: at };
      await audit.record({ kind: "order_placed", at, order: o, positionId: position.id, venueId: "deriv-demo" });
      console.log(`         ↳ abierta · contract_id ${position.id}`);
    }
  }

  saveState(STATE_PATH, state);
  appendEquity(EQUITY_PATH, equity);
}

main().catch((error) => {
  console.error(`FALLO ciclo diario: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
