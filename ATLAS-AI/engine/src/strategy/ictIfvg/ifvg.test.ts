import { describe, expect, it } from "vitest";
import { Candle, IfvgSignal } from "./types";
import { detectFvgZones, detectIfvgAt, detectIfvgRetestAt } from "./ifvg";

const bar = (t: number, o: number, h: number, l: number, c: number): Candle => ({ t, o, h, l, c });

describe("detectFvgZones", () => {
  it("detecta un FVG alcista de 3 velas con hueco >= minGapPoints", () => {
    const candles: Candle[] = [
      bar(0, 99, 100, 98, 99), // c1: high 100
      bar(900, 99, 101, 97, 99),
      bar(1800, 104, 106, 105, 105), // c3: low 105 -> gap 5
    ];
    const zones = detectFvgZones(candles, 3);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ direction: "bullish", bottom: 100, top: 105, sizePoints: 5, formedAt: 2 });
  });

  it("detecta un FVG bajista de 3 velas", () => {
    const candles: Candle[] = [
      bar(0, 105, 106, 105, 105), // c1: low 105
      bar(900, 99, 101, 97, 99),
      bar(1800, 99, 100, 98, 99), // c3: high 100 -> gap 5
    ];
    const zones = detectFvgZones(candles, 3);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ direction: "bearish", bottom: 100, top: 105, sizePoints: 5 });
  });

  it("incluye el hueco cuando el tamaño es EXACTAMENTE el umbral (>=, no estricto)", () => {
    const candles: Candle[] = [bar(0, 99, 100, 98, 99), bar(900, 99, 101, 97, 99), bar(1800, 103, 104, 103, 103)];
    expect(detectFvgZones(candles, 3)).toHaveLength(1); // gap = 103 - 100 = 3
  });

  it("descarta el hueco cuando queda un punto por debajo del umbral", () => {
    const candles: Candle[] = [bar(0, 99, 100, 98, 99), bar(900, 99, 101, 97, 99), bar(1800, 102, 102, 102, 102)];
    expect(detectFvgZones(candles, 3)).toHaveLength(0); // gap = 2
  });

  it("no detecta nada con una serie de velas vacía", () => {
    expect(detectFvgZones([], 3)).toHaveLength(0);
  });
});

describe("detectIfvgAt", () => {
  const scenario: Candle[] = [
    bar(0, 99, 100, 98, 99), // idx0: c1, high 100
    bar(900, 99, 101, 97, 99), // idx1
    bar(1800, 104, 106, 105, 105), // idx2: c3, low 105 -> zona [100,105] formada aquí
    bar(2700, 103, 104, 101, 102), // idx3: cierre 102, todavía dentro/encima de la zona
    bar(3600, 101, 102, 96, 98), // idx4: cierre 98 < 100 -> INVIERTE (confirmación)
    bar(4500, 97, 99, 95, 96), // idx5: cierre 96 < 100, pero ya venía de debajo -> NO debe re-disparar
  ];

  it("confirma la inversión en la vela cuyo CIERRE cruza el borde contrario (no la mecha)", () => {
    const zones = detectFvgZones(scenario.slice(0, 5), 3);
    const found = detectIfvgAt(scenario, zones, 4);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ side: "sell", zoneBottom: 100, zoneTop: 105, formedAt: 2, invertedAt: 4 });
  });

  it("NO vuelve a disparar en la vela siguiente si el precio ya estaba fuera de la zona (anti-repetición)", () => {
    const zones = detectFvgZones(scenario.slice(0, 6), 3);
    expect(detectIfvgAt(scenario, zones, 5)).toHaveLength(0);
  });

  it("anti-lookahead: ignora zonas formadas en la misma barra o después de `now`", () => {
    const zones = detectFvgZones(scenario, 3);
    // now = 2 es la propia barra de formación de la zona: formedAt(2) >= now(2) -> se descarta.
    expect(detectIfvgAt(scenario, zones, 2)).toHaveLength(0);
  });

  it("devuelve vacío en now = 0 (no hay barra previa que comparar)", () => {
    const zones = detectFvgZones(scenario, 3);
    expect(detectIfvgAt(scenario, zones, 0)).toHaveLength(0);
  });
});

describe("detectIfvgRetestAt", () => {
  const inv: IfvgSignal = { side: "sell", zoneTop: 105, zoneBottom: 100, formedAt: 2, invertedAt: 4 };

  const candles: Candle[] = [
    bar(0, 99, 100, 98, 99),
    bar(900, 99, 101, 97, 99),
    bar(1800, 104, 106, 105, 105),
    bar(2700, 103, 104, 101, 102),
    bar(3600, 101, 102, 96, 98), // idx4: inversión confirmada aquí (no es un retest)
    bar(4500, 96, 99, 94, 97), // idx5: NO toca la zona (high 99 < zoneBottom 100)
    bar(5400, 97, 101, 96, 100), // idx6: SÍ toca (high 101 >= 100) -> primer retest
    bar(6300, 100, 102, 98, 101), // idx7: también toca, pero YA fue retesteada en idx6
  ];

  it("no dispara en la propia barra de inversión ni antes", () => {
    expect(detectIfvgRetestAt(candles, [inv], 4)).toHaveLength(0);
    expect(detectIfvgRetestAt(candles, [inv], 3)).toHaveLength(0);
  });

  it("no dispara mientras el precio no vuelve a tocar la zona", () => {
    expect(detectIfvgRetestAt(candles, [inv], 5)).toHaveLength(0);
  });

  it("dispara en la PRIMERA barra que vuelve a tocar la zona", () => {
    const found = detectIfvgRetestAt(candles, [inv], 6);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject(inv);
  });

  it("NO vuelve a disparar en una barra posterior si el retest ya ocurrió antes (anti-repetición)", () => {
    expect(detectIfvgRetestAt(candles, [inv], 7)).toHaveLength(0);
  });

  it("con una lista de pendientes vacía, no dispara nada", () => {
    expect(detectIfvgRetestAt(candles, [], 6)).toHaveLength(0);
  });
});
