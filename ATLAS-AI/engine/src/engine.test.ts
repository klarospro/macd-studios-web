import { describe, expect, it } from "vitest";
import { TradingEngine } from "./engine";
import { defaultRiskConfig } from "./config/riskConfig";
import { PaperAdapter } from "./broker/paperAdapter";
import { BrokerAdapter } from "./broker/brokerAdapter";
import { AuditEvent, AuditLog } from "./audit/auditLog";
import { AccountState, Order, Position, Signal } from "./domain/types";

class MemoryAuditLog implements AuditLog {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class FailingAdapter implements BrokerAdapter {
  readonly name = "failing";
  async connect(): Promise<void> {}
  async getEquity(): Promise<number> {
    return 0;
  }
  async placeOrder(_order: Order): Promise<Position> {
    throw new Error("WebSocket cerrado");
  }
  async closePosition(): Promise<void> {}
  async disconnect(): Promise<void> {}
}

function healthyAccount(): AccountState {
  return {
    equity: 10000,
    startOfDayEquity: 10000,
    peakEquity: 10000,
    openPositions: [],
    consecutiveLosses: 0,
    recentBrokerErrors: 0,
    tradingHalted: false,
  };
}

const signal: Signal = {
  symbol: "R_100",
  side: "buy",
  entryPrice: 100,
  stopPrice: 99,
  correlationGroup: "test",
};

describe("TradingEngine.handleSignal (flujo completo)", () => {
  it("señal aprobada → coloca orden y la audita como order_placed", async () => {
    const audit = new MemoryAuditLog();
    const engine = new TradingEngine(defaultRiskConfig, new PaperAdapter(10000), audit);

    await engine.handleSignal(healthyAccount(), signal);

    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.kind).toBe("order_placed");
  });

  it("señal rechazada por el risk gate → audita order_rejected y NO llama al broker", async () => {
    const audit = new MemoryAuditLog();
    const engine = new TradingEngine(defaultRiskConfig, new PaperAdapter(10000), audit);
    const halted = { ...healthyAccount(), tradingHalted: true };

    await engine.handleSignal(halted, signal);

    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({ kind: "order_rejected", reason: "trading_halted" });
  });

  it("fallo del broker → audita order_failed y propaga (no se traga en silencio)", async () => {
    const audit = new MemoryAuditLog();
    const engine = new TradingEngine(defaultRiskConfig, new FailingAdapter(), audit);

    await expect(engine.handleSignal(healthyAccount(), signal)).rejects.toThrow("WebSocket cerrado");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({ kind: "order_failed", error: "WebSocket cerrado" });
  });
});
