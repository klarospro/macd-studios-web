import { describe, expect, it } from "vitest";
import { Candle } from "./types";
import { combinedDailyBias, dailyBiasFromStructure, dailyLeadsBias } from "./bias";

const bar = (i: number, o: number, h: number, l: number, c: number): Candle => ({ t: i * 900, o, h, l, c });

/** HH/HL: low en idx2 (90), high en idx5 (110), low en idx8 (93, > 90), high en idx11 (120, > 110). */
const upStructure: Candle[] = [
  bar(0, 100, 100, 100, 100),
  bar(1, 100, 100, 100, 100),
  bar(2, 94, 100, 90, 94),
  bar(3, 98, 100, 95, 98),
  bar(4, 98, 100, 95, 98),
  bar(5, 105, 110, 95, 105),
  bar(6, 98, 100, 95, 98),
  bar(7, 98, 100, 95, 98),
  bar(8, 94, 100, 93, 94),
  bar(9, 98, 100, 97, 98),
  bar(10, 98, 100, 97, 98),
  bar(11, 110, 120, 97, 110),
  bar(12, 98, 100, 97, 98),
  bar(13, 98, 100, 97, 98),
];

/** LL/LH: low en idx2 (93), high en idx5 (120), low en idx8 (90, < 93), high en idx11 (110, < 120). */
const downStructure: Candle[] = [
  bar(0, 100, 100, 100, 100),
  bar(1, 100, 100, 100, 100),
  bar(2, 97, 100, 93, 97),
  bar(3, 98, 100, 95, 98),
  bar(4, 98, 100, 95, 98),
  bar(5, 105, 120, 95, 105),
  bar(6, 98, 100, 95, 98),
  bar(7, 98, 100, 95, 98),
  bar(8, 94, 100, 90, 94),
  bar(9, 98, 100, 97, 98),
  bar(10, 98, 100, 97, 98),
  bar(11, 105, 110, 97, 105),
  bar(12, 98, 100, 97, 98),
  bar(13, 98, 100, 97, 98),
];

describe("dailyBiasFromStructure", () => {
  it("detecta UP con HH + HL", () => {
    expect(dailyBiasFromStructure(upStructure, 2)).toBe("UP");
  });

  it("detecta DOWN con LL + LH", () => {
    expect(dailyBiasFromStructure(downStructure, 2)).toBe("DOWN");
  });

  it("devuelve NONE con una serie de velas vacía", () => {
    expect(dailyBiasFromStructure([], 2)).toBe("NONE");
  });

  it("devuelve NONE cuando no hay suficientes swings confirmados (serie corta)", () => {
    const short = upStructure.slice(0, 4);
    expect(dailyBiasFromStructure(short, 2)).toBe("NONE");
  });
});

describe("combinedDailyBias", () => {
  it("UP cuando 1D y 4H coinciden en UP", () => {
    expect(combinedDailyBias(upStructure, upStructure, 2)).toBe("UP");
  });

  it("NONE cuando 1D y 4H no coinciden (supuesto declarado: se exige acuerdo)", () => {
    expect(combinedDailyBias(upStructure, downStructure, 2)).toBe("NONE");
  });

  it("NONE cuando uno de los dos timeframes no tiene estructura clara", () => {
    expect(combinedDailyBias(upStructure, [], 2)).toBe("NONE");
  });
});

describe("dailyLeadsBias (variante: 1D manda, 4H solo veta si contradice)", () => {
  it("usa el bias del 1D cuando el 4H no tiene estructura propia (a diferencia de combinedDailyBias)", () => {
    expect(dailyLeadsBias(upStructure, [], 2)).toBe("UP");
    expect(combinedDailyBias(upStructure, [], 2)).toBe("NONE"); // contraste explícito con el default
  });

  it("usa el bias del 1D cuando ambos coinciden", () => {
    expect(dailyLeadsBias(upStructure, upStructure, 2)).toBe("UP");
  });

  it("NONE cuando el 4H tiene estructura propia y CONTRADICE al 1D", () => {
    expect(dailyLeadsBias(upStructure, downStructure, 2)).toBe("NONE");
  });

  it("NONE cuando el propio 1D no tiene estructura clara, sin importar el 4H", () => {
    expect(dailyLeadsBias([], upStructure, 2)).toBe("NONE");
  });
});
