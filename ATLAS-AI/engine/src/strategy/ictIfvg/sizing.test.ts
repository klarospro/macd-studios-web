import { describe, expect, it } from "vitest";
import { MNQ_POINT_VALUE_USD, NQ_POINT_VALUE_USD, sizeContracts } from "./sizing";

describe("sizeContracts", () => {
  it("caso feliz: calcula contratos enteros redondeando hacia abajo", () => {
    // equity 50000 * 0.5% = 250 USD de riesgo. Stop 20 puntos * $20/pt = $400/contrato.
    // 250/400 = 0.625 -> 0 contratos (ver test dedicado más abajo con capital mayor)
    const result = sizeContracts({ equity: 50000, riskPct: 0.005, stopPoints: 20, pointValue: NQ_POINT_VALUE_USD });
    expect(result.riskAmount).toBeCloseTo(250);
    expect(result.contracts).toBe(0);
  });

  it("caso feliz con capital suficiente para varios contratos", () => {
    // equity 200000 * 0.5% = 1000 USD. Stop 20pt * $20 = $400/contrato -> 2.5 -> 2 contratos.
    const result = sizeContracts({ equity: 200000, riskPct: 0.005, stopPoints: 20, pointValue: NQ_POINT_VALUE_USD });
    expect(result.contracts).toBe(2);
    expect(result.actualRiskAmount).toBeCloseTo(800); // 2 * 20 * 20
    expect(result.actualRiskAmount).toBeLessThanOrEqual(result.riskAmount);
  });

  it("redondea SIEMPRE hacia abajo, nunca excede el riesgo solicitado", () => {
    // 1000/400 = 2.5 -> debe dar 2, nunca 3.
    const result = sizeContracts({ equity: 200000, riskPct: 0.005, stopPoints: 20, pointValue: NQ_POINT_VALUE_USD });
    expect(result.contracts).toBe(2);
  });

  it("riesgo que resulta en 0 contratos (capital insuficiente para 1 contrato)", () => {
    const result = sizeContracts({ equity: 1000, riskPct: 0.005, stopPoints: 20, pointValue: NQ_POINT_VALUE_USD });
    expect(result.contracts).toBe(0);
    expect(result.actualRiskAmount).toBe(0);
  });

  it("MNQ (micro) permite tamaños que NQ (full-size) redondearía a 0", () => {
    const result = sizeContracts({ equity: 5000, riskPct: 0.005, stopPoints: 20, pointValue: MNQ_POINT_VALUE_USD });
    // 25 USD de riesgo / (20pt * $2) = 0.625 -> sigue siendo 0, pero con más capital ya no
    expect(result.contracts).toBe(0);
    const bigger = sizeContracts({ equity: 20000, riskPct: 0.005, stopPoints: 20, pointValue: MNQ_POINT_VALUE_USD });
    expect(bigger.contracts).toBe(2); // 100 USD / (20*2=40) = 2.5 -> 2
  });

  it("stopPoints no positivo devuelve 0 contratos sin lanzar excepción", () => {
    expect(sizeContracts({ equity: 200000, riskPct: 0.005, stopPoints: 0, pointValue: NQ_POINT_VALUE_USD }).contracts).toBe(0);
    expect(sizeContracts({ equity: 200000, riskPct: 0.005, stopPoints: -5, pointValue: NQ_POINT_VALUE_USD }).contracts).toBe(0);
  });

  it("equity no positivo devuelve 0 contratos", () => {
    expect(sizeContracts({ equity: 0, riskPct: 0.005, stopPoints: 20, pointValue: NQ_POINT_VALUE_USD }).contracts).toBe(0);
  });
});
