import { describe, expect, it } from "vitest";
import { AtlasCoreParams, defaultAtlasCoreParams, momentumSignal, realizedVol, targetWeights } from "./atlasCore";
import { alignUniverse } from "../backtest/atlasCoreBacktest";

const params = (over: Partial<AtlasCoreParams> = {}): AtlasCoreParams => ({ ...defaultAtlasCoreParams, ...over });

/** Serie con tendencia constante: precio * (1+drift)^i. */
const trending = (n: number, drift: number, start = 100): number[] =>
  Array.from({ length: n }, (_, i) => start * Math.pow(1 + drift, i));

describe("momentumSignal", () => {
  it("es positiva en tendencia alcista y negativa en bajista", () => {
    const up = trending(400, 0.001);
    const down = trending(400, -0.001);
    const p = params({ signalMode: "sign" });
    expect(momentumSignal(up, 399, p)).toBeGreaterThan(0);
    expect(momentumSignal(down, 399, p)).toBeLessThan(0);
  });

  it("NO mira al futuro: la señal en t solo depende de precios hasta t", () => {
    const base = trending(400, 0.001);
    const tampered = [...base];
    // Se altera brutalmente todo lo POSTERIOR a la barra 300.
    for (let i = 301; i < tampered.length; i++) tampered[i] = 1;
    const p = params({ signalMode: "sign" });
    expect(momentumSignal(tampered, 300, p)).toBe(momentumSignal(base, 300, p));
  });

  it("la señal continua escala con la fuerza de la tendencia, no salta", () => {
    // Con ruido idéntico en ambas (misma volatilidad) y distinta tendencia: la señal debe
    // distinguirlas. Sin ruido la volatilidad sería ~0, el z-score infinito y ambas saturarían.
    const noise = (i: number): number => 1 + Math.sin(i * 2.399) * 0.012;
    const weak = trending(400, 0.0002).map((p, i) => p * noise(i));
    const strong = trending(400, 0.003).map((p, i) => p * noise(i));
    const p = params({ signalMode: "continuous" });
    const sWeak = momentumSignal(weak, 399, p, realizedVol(weak, 399, p.volWindow))!;
    const sStrong = momentumSignal(strong, 399, p, realizedVol(strong, 399, p.volWindow))!;
    expect(sStrong).toBeGreaterThan(sWeak);
    expect(Math.abs(sStrong)).toBeLessThanOrEqual(1);
  });

  it("devuelve null sin histórico suficiente", () => {
    expect(momentumSignal(trending(50, 0.001), 49, params())).toBeNull();
  });
});

describe("realizedVol", () => {
  it("es mayor en una serie más agitada", () => {
    const calm = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i) * 0.1);
    const wild = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i) * 10);
    expect(realizedVol(wild, 199, 60)!).toBeGreaterThan(realizedVol(calm, 199, 60)!);
  });

  it("devuelve null si no hay ventana suficiente", () => {
    expect(realizedVol(trending(30, 0.001), 29, 60)).toBeNull();
  });
});

describe("targetWeights", () => {
  it("da más peso al instrumento menos volátil (paridad de riesgo)", () => {
    // Dos series con la MISMA tendencia pero distinta volatilidad.
    const steady = trending(400, 0.001);
    const noisy = steady.map((p, i) => p * (1 + (i % 2 === 0 ? 0.03 : -0.03)));
    const w = targetWeights({ steady, noisy }, 399, params({ signalMode: "sign", noTradeBand: 0 }));
    expect(Math.abs(w.steady!)).toBeGreaterThan(Math.abs(w.noisy!));
  });

  it("respeta el tope de exposición bruta", () => {
    const series: Record<string, number[]> = {};
    for (let k = 0; k < 10; k++) series[`a${k}`] = trending(400, 0.001);
    const p = params({ signalMode: "sign", noTradeBand: 0, maxGrossExposure: 1.5 });
    const gross = Object.values(targetWeights(series, 399, p)).reduce((s, w) => s + Math.abs(w), 0);
    expect(gross).toBeLessThanOrEqual(1.5 + 1e-9);
  });

  it("la banda de no-negociación mantiene el peso actual ante cambios pequeños", () => {
    const series = { a: trending(400, 0.001) };
    const p = params({ signalMode: "sign", noTradeBand: 10 }); // banda enorme -> nunca se mueve
    const current = { a: 0.123 };
    expect(targetWeights(series, 399, p, current).a).toBe(0.123);
  });
});

describe("alignUniverse", () => {
  it("normaliza a día natural marcas de tiempo de mercados con horarios distintos", () => {
    // Mismo día natural, horas de apertura distintas (Nikkei 00:00 UTC vs S&P 13:30 UTC).
    const day = 86400 * 20000;
    const u = alignUniverse({
      nikkei: { group: "equity", bars: [{ t: day, c: 100 }, { t: day + 86400, c: 101 }] },
      sp500: { group: "equity", bars: [{ t: day + 48600, c: 200 }, { t: day + 86400 + 48600, c: 202 }] },
    });
    // Sin normalizar habría 4 fechas distintas; normalizado deben ser 2 días.
    expect(u.dates).toHaveLength(2);
    expect(u.series.nikkei).toEqual([100, 101]);
    expect(u.series.sp500).toEqual([200, 202]);
  });

  it("rellena hacia delante los días en que un mercado no cotiza", () => {
    const day = 86400 * 20000;
    const u = alignUniverse({
      cripto: { group: "crypto", bars: [0, 1, 2].map((i) => ({ t: day + i * 86400, c: 100 + i })) },
      bolsa: { group: "equity", bars: [{ t: day, c: 50 }, { t: day + 2 * 86400, c: 52 }] },
    });
    expect(u.dates).toHaveLength(3);
    // El día intermedio la bolsa repite su último precio -> retorno 0, no un salto inventado.
    expect(u.series.bolsa).toEqual([50, 50, 52]);
  });

  it("marca el primer índice real de cada instrumento", () => {
    const day = 86400 * 20000;
    const u = alignUniverse({
      viejo: { group: "fx", bars: [0, 1, 2].map((i) => ({ t: day + i * 86400, c: 10 })) },
      nuevo: { group: "crypto", bars: [{ t: day + 2 * 86400, c: 99 }] },
    });
    expect(u.startIndex.viejo).toBe(0);
    expect(u.startIndex.nuevo).toBe(2);
  });
});
