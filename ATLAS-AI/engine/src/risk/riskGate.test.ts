import { describe, expect, it } from "vitest";
import { defaultRiskConfig } from "../config/riskConfig";
import { AccountState, Signal } from "../domain/types";
import { evaluate } from "./riskGate";

function baseAccount(overrides: Partial<AccountState> = {}): AccountState {
  return {
    equity: 10000,
    startOfDayEquity: 10000,
    peakEquity: 10000,
    openPositions: [],
    consecutiveLosses: 0,
    recentBrokerErrors: 0,
    tradingHalted: false,
    ...overrides,
  };
}

const signal: Signal = {
  symbol: "R_100",
  side: "buy",
  entryPrice: 100,
  stopPrice: 99,
  correlationGroup: "synthetics",
};

describe("riskGate", () => {
  it("dimensiona la posición al 1% del capital sobre la distancia al stop", () => {
    const decision = evaluate(defaultRiskConfig, baseAccount(), signal);
    expect(decision.approved).toBe(true);
    if (decision.approved) {
      expect(decision.order.riskAmount).toBeCloseTo(100);
      expect(decision.order.size).toBeCloseTo(100);
    }
  });

  it("rechaza cuando el trading está en halt", () => {
    const decision = evaluate(defaultRiskConfig, baseAccount({ tradingHalted: true }), signal);
    expect(decision).toEqual({ approved: false, reason: "trading_halted" });
  });

  it("rechaza al alcanzar el drawdown total", () => {
    const account = baseAccount({ equity: 9000, peakEquity: 10000 });
    const decision = evaluate(defaultRiskConfig, account, signal);
    expect(decision).toEqual({ approved: false, reason: "total_drawdown_reached" });
  });

  it("rechaza un stop inválido", () => {
    const decision = evaluate(defaultRiskConfig, baseAccount(), { ...signal, stopPrice: 100 });
    expect(decision).toEqual({ approved: false, reason: "invalid_stop_distance" });
  });
});
