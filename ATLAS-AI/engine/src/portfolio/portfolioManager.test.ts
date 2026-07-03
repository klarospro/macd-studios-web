import { describe, expect, it } from "vitest";
import { PortfolioManager, Venue } from "./portfolioManager";
import { defaultRiskConfig } from "../config/riskConfig";
import { PaperAdapter } from "../broker/paperAdapter";
import { BrokerAdapter } from "../broker/brokerAdapter";
import { AuditEvent, AuditLog } from "../audit/auditLog";
import { AccountState, Order, Position, Signal } from "../domain/types";

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

function account(equity: number, openPositions: Position[] = []): AccountState {
  return {
    equity,
    startOfDayEquity: equity,
    peakEquity: equity,
    openPositions,
    consecutiveLosses: 0,
    recentBrokerErrors: 0,
    tradingHalted: false,
  };
}

function venue(id: string, adapter: BrokerAdapter, acc: AccountState): Venue {
  return { id, adapter, config: defaultRiskConfig, account: acc };
}

// entry 100 / stop 99 → stopDistance 1 → riskAmount local = equity * 1% (sin Kelly).
const signal: Signal = { symbol: "R_100", side: "buy", entryPrice: 100, stopPrice: 99, correlationGroup: "t" };

describe("PortfolioManager — gate global + reparto", () => {
  it("orden dentro del presupuesto global → se coloca y se rastrea la posición", async () => {
    const audit = new MemoryAuditLog();
    const v = venue("deriv", new PaperAdapter(10000), account(10000));
    const pm = new PortfolioManager({ globalRiskPct: 0.04 }, [v], audit);

    await pm.handleSignal("deriv", signal); // riesgo local 100 ≤ budget 400

    expect(audit.events[0]).toMatchObject({ kind: "order_placed", venueId: "deriv" });
    expect(v.account.openPositions).toHaveLength(1);
    expect(pm.globalOpenRisk()).toBe(100);
  });

  it("rechazo LOCAL (venue en halt) → order_rejected y no toca el broker", async () => {
    const audit = new MemoryAuditLog();
    const acc = { ...account(10000), tradingHalted: true };
    const pm = new PortfolioManager({ globalRiskPct: 0.04 }, [venue("deriv", new PaperAdapter(10000), acc)], audit);

    await pm.handleSignal("deriv", signal);

    expect(audit.events[0]).toMatchObject({ kind: "order_rejected", reason: "trading_halted" });
  });

  it("pasa el gate LOCAL pero excede el presupuesto GLOBAL → portfolio_rejected", async () => {
    const audit = new MemoryAuditLog();
    // Posición previa que consume casi todo el budget: riesgo 350 sobre equity 10000 (3.5% local, ok).
    const preloaded: Position = {
      id: "prev",
      symbol: "R_75",
      side: "buy",
      size: 1,
      entryPrice: 100,
      stopPrice: 99,
      riskAmount: 350,
      correlationGroup: "otro",
    };
    const v = venue("deriv", new PaperAdapter(10000), account(10000, [preloaded]));
    const pm = new PortfolioManager({ globalRiskPct: 0.04 }, [v], audit); // budget 400, disponible 50

    await pm.handleSignal("deriv", signal); // riesgo local 100 > disponible 50

    expect(audit.events[0]).toMatchObject({ kind: "portfolio_rejected", reason: "global_budget_exceeded" });
    expect(v.account.openPositions).toHaveLength(1); // no se añadió ninguna
  });

  it("reparte entre venues hasta agotar el presupuesto global", async () => {
    const audit = new MemoryAuditLog();
    const a = venue("deriv", new PaperAdapter(10000), account(10000));
    const b = venue("poly", new PaperAdapter(10000), account(10000));
    // total 20000 · budget = 20000 * 0.0075 = 150. Cada orden local = 100.
    const pm = new PortfolioManager({ globalRiskPct: 0.0075 }, [a, b], audit);

    await pm.handleSignal("deriv", signal); // 100 ≤ 150 → colocada, quedan 50
    await pm.handleSignal("poly", signal); // 100 > 50 → rechazada por portafolio

    expect(audit.events[0]).toMatchObject({ kind: "order_placed", venueId: "deriv" });
    expect(audit.events[1]).toMatchObject({ kind: "portfolio_rejected", venueId: "poly" });
  });

  it("fallo del broker → order_failed y propaga (no se traga)", async () => {
    const audit = new MemoryAuditLog();
    const pm = new PortfolioManager({ globalRiskPct: 0.04 }, [venue("x", new FailingAdapter(), account(10000))], audit);

    await expect(pm.handleSignal("x", signal)).rejects.toThrow("WebSocket cerrado");
    expect(audit.events[0]).toMatchObject({ kind: "order_failed", venueId: "x" });
  });
});
