import { describe, expect, it } from "vitest";
import {
  Candle,
  LiquidityGrabParams,
  calculateLevels,
  defaultLiquidityGrabParams,
  detectGrab,
  detectSwings,
  liquidityGrabSignal,
} from "./liquidityGrab";

const params = (over: Partial<LiquidityGrabParams> = {}): LiquidityGrabParams => ({
  symbol: "XAUUSD",
  correlationGroup: "metal",
  ...defaultLiquidityGrabParams,
  ...over,
});

/** Vela sintética con cuerpo alrededor del cierre (sirve para construir escenarios legibles). */
const bar = (t: number, o: number, h: number, l: number, c: number): Candle => ({ t, o, h, l, c });

describe("detectSwings", () => {
  it("marca un mínimo local con ala 2 y lo confirma 2 barras después", () => {
    // El mínimo real está en el índice 2 (valor 90).
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 95, 98),
      bar(1800, 98, 99, 90, 94), //  <- mínimo local
      bar(2700, 94, 99, 96, 98),
      bar(3600, 98, 103, 97, 102),
    ];
    const swings = detectSwings(candles, 2);
    const low = swings.find((s) => s.type === "low");
    expect(low).toBeDefined();
    expect(low!.index).toBe(2);
    expect(low!.price).toBe(90);
    // Clave anti-lookahead: no es observable hasta la barra 4.
    expect(low!.confirmedAt).toBe(4);
  });

  it("no inventa swings en los bordes donde falta ala", () => {
    const candles = Array.from({ length: 4 }, (_, i) => bar(i * 900, 100, 101, 99, 100));
    expect(detectSwings(candles, 2)).toHaveLength(0);
  });
});

describe("anti-lookahead", () => {
  it("NO usa un swing antes de su barra de confirmación", () => {
    // Escenario con grab alcista real en la barra 6 sobre el mínimo del índice 2 (confirmado en 4).
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 99, 100),
      bar(1800, 100, 101, 90, 95), // mínimo local en 90, confirmado en el índice 4
      bar(2700, 95, 96, 94, 95),
      bar(3600, 95, 96, 94, 95),
      bar(4500, 95, 96, 88, 89), // rompe el soporte
      bar(5400, 89, 96, 88, 94), // vuelve por encima -> grab
    ];
    const swings = detectSwings(candles, 2);
    const low = swings.find((s) => s.type === "low")!;
    expect(low.confirmedAt).toBe(4);

    // Con el swing ya confirmado, el grab se detecta.
    expect(detectGrab(candles, swings, 6, params())).not.toBeNull();

    // Misma serie y mismo nivel, pero fingiendo que el swing aún no está confirmado en la barra 6:
    // la guarda anti-lookahead debe hacerlo desaparecer. Este es el bug que infla los backtests.
    const notYetConfirmed = swings.map((s) => ({ ...s, confirmedAt: 7 }));
    expect(detectGrab(candles, notYetConfirmed, 6, params())).toBeNull();
  });

  it("descarta swings cuyo confirmedAt es posterior a la barra evaluada", () => {
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 99, 100),
      bar(1800, 100, 101, 90, 95), // mínimo, confirmado en 4
      bar(2700, 95, 96, 94, 94), // por debajo de 90? no -> no hay grab de todos modos
      bar(3600, 94, 99, 93, 98),
    ];
    const swings = detectSwings(candles, 2);
    const usableAt3 = swings.filter((s) => s.confirmedAt <= 3);
    expect(usableAt3).toHaveLength(0);
  });
});

describe("detectGrab", () => {
  it("detecta un BULLISH_GRAB: rompe el soporte y vuelve por encima", () => {
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 99, 100),
      bar(1800, 100, 101, 90, 95), // mínimo en 90, confirmado en 4
      bar(2700, 95, 96, 94, 95),
      bar(3600, 95, 96, 94, 95),
      bar(4500, 95, 96, 88, 89), // cierra DEBAJO de 90
      bar(5400, 89, 96, 88, 94), // cierra ENCIMA de 90 -> grab alcista
    ];
    const swings = detectSwings(candles, 2);
    const grab = detectGrab(candles, swings, 6, params());
    expect(grab).not.toBeNull();
    expect(grab!.type).toBe("BULLISH_GRAB");
    expect(grab!.level).toBe(90);
  });

  it("no dispara si el precio rompe pero NO vuelve", () => {
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 99, 100),
      bar(1800, 100, 101, 90, 95),
      bar(2700, 95, 96, 94, 95),
      bar(3600, 95, 96, 94, 95),
      bar(4500, 95, 96, 88, 89), // rompe
      bar(5400, 89, 90, 85, 87), // sigue abajo -> sin grab
    ];
    const swings = detectSwings(candles, 2);
    expect(detectGrab(candles, swings, 6, params())).toBeNull();
  });

  it("ignora niveles más antiguos que el lookback", () => {
    const candles: Candle[] = [
      bar(0, 100, 101, 99, 100),
      bar(900, 100, 101, 99, 100),
      bar(1800, 100, 101, 90, 95), // mínimo antiguo
      ...Array.from({ length: 30 }, (_, i) => bar((i + 3) * 900, 95, 96, 94, 95)),
      bar(30 * 900 + 2700, 95, 96, 88, 89),
      bar(31 * 900 + 2700, 89, 96, 88, 94),
    ];
    const swings = detectSwings(candles, 2);
    const now = candles.length - 1;
    // Con lookback amplio hay grab; con lookback corto el nivel ya caducó.
    expect(detectGrab(candles, swings, now, params({ lookback: 100 }))).not.toBeNull();
    expect(detectGrab(candles, swings, now, params({ lookback: 5 }))).toBeNull();
  });
});

describe("calculateLevels", () => {
  it("calcula stop y objetivo 1:1 con el margen del 10% en un grab alcista", () => {
    const levels = calculateLevels({ type: "BULLISH_GRAB", level: 90, levelIndex: 2 }, 100, params());
    expect(levels).not.toBeNull();
    // distancia = (100 - 90) * 1.1 = 11
    expect(levels!.side).toBe("buy");
    expect(levels!.stopDistance).toBeCloseTo(11);
    expect(levels!.stop).toBeCloseTo(89);
    expect(levels!.target).toBeCloseTo(111);
  });

  it("calcula el espejo en un grab bajista", () => {
    const levels = calculateLevels({ type: "BEARISH_GRAB", level: 110, levelIndex: 2 }, 100, params());
    expect(levels!.side).toBe("sell");
    expect(levels!.stopDistance).toBeCloseTo(11);
    expect(levels!.stop).toBeCloseTo(111);
    expect(levels!.target).toBeCloseTo(89);
  });

  it("rechaza distancias de stop no positivas (entrada del lado equivocado del nivel)", () => {
    expect(calculateLevels({ type: "BULLISH_GRAB", level: 100, levelIndex: 2 }, 100, params())).toBeNull();
    expect(calculateLevels({ type: "BULLISH_GRAB", level: 110, levelIndex: 2 }, 100, params())).toBeNull();
  });

  it("respeta un RR distinto de 1:1", () => {
    const levels = calculateLevels({ type: "BULLISH_GRAB", level: 90, levelIndex: 2 }, 100, params({ rewardRatio: 2 }));
    expect(levels!.target).toBeCloseTo(122); // 100 + 11*2
  });
});

describe("liquidityGrabSignal", () => {
  const scenario: Candle[] = [
    bar(0, 100, 101, 99, 100),
    bar(900, 100, 101, 99, 100),
    bar(1800, 100, 101, 90, 95),
    bar(2700, 95, 96, 94, 95),
    bar(3600, 95, 96, 94, 95),
    bar(4500, 95, 96, 88, 89),
    bar(5400, 89, 96, 88, 94),
    bar(6300, 94, 97, 93, 96),
  ];

  it("produce una señal apta para el risk gate", () => {
    const swings = detectSwings(scenario, 2);
    const found = liquidityGrabSignal(scenario, swings, 6, params());
    expect(found).not.toBeNull();
    expect(found!.signal.side).toBe("buy");
    expect(found!.signal.symbol).toBe("XAUUSD");
    expect(found!.signal.entryPrice).toBe(94);
    expect(Math.abs(found!.signal.entryPrice - found!.signal.stopPrice)).toBeGreaterThan(0);
  });

  it("el filtro EMA descarta grabs contra tendencia", () => {
    const swings = detectSwings(scenario, 2);
    // Cierre 94 por debajo de la EMA(6) ≈ 94.4 en ese punto -> el grab alcista se descarta.
    const withFilter = liquidityGrabSignal(scenario, swings, 6, params({ useEmaFilter: true, emaPeriod: 6 }));
    const withoutFilter = liquidityGrabSignal(scenario, swings, 6, params({ useEmaFilter: false }));
    expect(withoutFilter).not.toBeNull();
    expect(withFilter).toBeNull();
  });

  it("entryDelay 1 desplaza la entrada una vela después del grab", () => {
    const swings = detectSwings(scenario, 2);
    expect(liquidityGrabSignal(scenario, swings, 7, params({ entryDelay: 0 }))).toBeNull();
    const delayed = liquidityGrabSignal(scenario, swings, 7, params({ entryDelay: 1 }));
    expect(delayed).not.toBeNull();
    expect(delayed!.signal.entryPrice).toBe(96); // cierre de la barra 7, no de la 6
  });
});
