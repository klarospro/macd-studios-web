import { describe, expect, it } from "vitest";
import { tsmomSignal, TsmomParams } from "./tsmom";

const params: TsmomParams = { symbol: "BTCUSD", correlationGroup: "crypto", lookback: 3, atrPeriod: 2, atrMult: 2 };

describe("tsmomSignal", () => {
  it("momentum positivo → señal de compra con stop por debajo de la entrada", () => {
    const prices = [100, 101, 102, 110]; // precio[3] > precio[0]
    const signal = tsmomSignal(prices, 3, params);
    expect(signal?.side).toBe("buy");
    expect(signal?.entryPrice).toBe(110);
    expect(signal?.stopPrice).toBeLessThan(110);
  });

  it("momentum negativo → señal de venta con stop por encima de la entrada", () => {
    const prices = [110, 108, 105, 100]; // precio[3] < precio[0]
    const signal = tsmomSignal(prices, 3, params);
    expect(signal?.side).toBe("sell");
    expect(signal?.stopPrice).toBeGreaterThan(100);
  });

  it("sin datos suficientes (i < lookback) → null", () => {
    expect(tsmomSignal([100, 101], 1, params)).toBeNull();
  });
});
