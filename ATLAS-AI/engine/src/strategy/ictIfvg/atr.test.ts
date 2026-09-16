import { describe, expect, it } from "vitest";
import { Candle } from "./types";
import { atrAt, atrSeries, trueRange } from "./atr";

const bar = (o: number, h: number, l: number, c: number, t = 0): Candle => ({ t, o, h, l, c });

describe("trueRange", () => {
  it("sin vela previa, es simplemente high - low", () => {
    expect(trueRange(null, bar(9, 10, 8, 9))).toBe(2);
  });

  it("con vela previa, es el máximo de los 3 componentes clásicos", () => {
    const prev = bar(9, 11, 9, 20); // cierre previo 20, fuera del rango de la vela actual
    const current = bar(21, 22, 19, 21);
    // h-l = 3, |h-prevC| = |22-20| = 2, |l-prevC| = |19-20| = 1 -> max = 3
    expect(trueRange(prev, current)).toBe(3);
  });
});

describe("atrSeries / atrAt (Wilder, causal)", () => {
  // TR: [2, 2, 2, 5] -> seed(period 3) en idx2 = 2, luego suavizado de Wilder en idx3 = (2*2+5)/3 = 3
  const candles: Candle[] = [bar(9, 10, 8, 9), bar(9, 11, 9, 10), bar(10, 12, 10, 11), bar(12, 15, 10, 12)];

  it("devuelve null antes de tener `period` velas", () => {
    const series = atrSeries(candles, 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
  });

  it("calcula el ATR seed como media simple de los primeros `period` TR", () => {
    expect(atrAt(candles, 2, 3)).toBeCloseTo(2);
  });

  it("suaviza al estilo Wilder en la barra siguiente", () => {
    expect(atrAt(candles, 3, 3)).toBeCloseTo(3);
  });

  it("devuelve null con una serie más corta que el periodo (ATR con serie corta)", () => {
    expect(atrAt(candles, 3, 14)).toBeNull();
    expect(atrAt(candles.slice(0, 5), candles.length, 14)).toBeNull();
  });

  it("devuelve null con una serie de velas vacía", () => {
    expect(atrAt([], 0, 14)).toBeNull();
    expect(atrSeries([], 14)).toHaveLength(0);
  });

  it("devuelve null para un índice fuera de rango", () => {
    expect(atrAt(candles, 99, 3)).toBeNull();
    expect(atrAt(candles, -1, 3)).toBeNull();
  });
});
