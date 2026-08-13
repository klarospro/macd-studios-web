import { describe, expect, it } from "vitest";
import { exposicionPorDivisa, permiteExposicion, piernasDe, PiernaExpuesta } from "./exposicionDivisa";

const pos = (symbol: string, side: "buy" | "sell", riskAmount = 100): PiernaExpuesta => ({ symbol, side, riskAmount });

describe("piernasDe", () => {
  it("descompone pares de forex", () => {
    expect(piernasDe("frxEURUSD")).toEqual({ base: "EUR", quote: "USD" });
    expect(piernasDe("frxGBPJPY")).toEqual({ base: "GBP", quote: "JPY" });
  });
  it("trata metales y cripto como cualquier otro par", () => {
    expect(piernasDe("frxXAUUSD")).toEqual({ base: "XAU", quote: "USD" });
    expect(piernasDe("cryBTCUSD")).toEqual({ base: "BTC", quote: "USD" });
  });
  it("devuelve null para símbolos sin dos piernas", () => {
    expect(piernasDe("OTC_SPC")).toBeNull();
    expect(piernasDe("R_100")).toBeNull();
  });
});

describe("exposicionPorDivisa", () => {
  it("comprar EUR/USD es largo de euro y corto de dólar", () => {
    expect(exposicionPorDivisa([pos("frxEURUSD", "buy")])).toEqual({ EUR: 100, USD: -100 });
  });

  it("vender invierte ambas piernas", () => {
    expect(exposicionPorDivisa([pos("frxEURUSD", "sell")])).toEqual({ EUR: -100, USD: 100 });
  });

  it("netea el dólar entre posiciones que se compensan", () => {
    // Largo EUR/USD (corto USD) + largo USD/JPY (largo USD) = dólar neutro.
    const neto = exposicionPorDivisa([pos("frxEURUSD", "buy"), pos("frxUSDJPY", "buy")]);
    expect(neto.USD).toBe(0);
    expect(neto.EUR).toBe(100);
    expect(neto.JPY).toBe(-100);
  });

  it("detecta la apuesta triple contra el yen que el límite por clase no vio", () => {
    // El caso REAL del 2026-08-12: tres largos con el yen como contrapartida.
    const neto = exposicionPorDivisa([
      pos("frxUSDJPY", "buy"),
      pos("frxEURJPY", "buy"),
      pos("frxGBPJPY", "buy"),
    ]);
    expect(neto.JPY).toBe(-300); // triple corto de yen, disfrazado de tres pares distintos
  });
});

describe("permiteExposicion", () => {
  const MAX = 200;

  it("acepta la primera posición", () => {
    expect(permiteExposicion([], pos("frxUSDJPY", "buy"), MAX).permitido).toBe(true);
  });

  it("acepta la segunda: aún dentro del tope", () => {
    const abiertas = [pos("frxUSDJPY", "buy")];
    expect(permiteExposicion(abiertas, pos("frxEURJPY", "buy"), MAX).permitido).toBe(true);
  });

  it("RECHAZA la tercera apuesta contra el yen", () => {
    const abiertas = [pos("frxUSDJPY", "buy"), pos("frxEURJPY", "buy")];
    const v = permiteExposicion(abiertas, pos("frxGBPJPY", "buy"), MAX);
    expect(v.permitido).toBe(false);
    expect(v.divisa).toBe("JPY");
    expect(v.expuestoTras).toBe(-300);
  });

  it("permite la operación CONTRARIA aunque toque una divisa saturada", () => {
    // Vender EUR/JPY reduce el corto de yen: no debe bloquearse por prudencia mal entendida.
    const abiertas = [pos("frxUSDJPY", "buy"), pos("frxEURJPY", "buy")];
    expect(permiteExposicion(abiertas, pos("frxGBPJPY", "sell"), MAX).permitido).toBe(true);
  });

  it("no juzga divisas que la candidata no toca", () => {
    // Cartera concentrada en yen; una candidata de oro/dólar no debe pagar por ello.
    const abiertas = [pos("frxUSDJPY", "buy"), pos("frxEURJPY", "buy"), pos("frxGBPJPY", "buy")];
    expect(permiteExposicion(abiertas, pos("frxXAUUSD", "sell"), 400).permitido).toBe(true);
  });

  it("símbolos sin dos piernas quedan fuera del límite", () => {
    expect(permiteExposicion([], pos("R_100", "buy"), 1).permitido).toBe(true);
  });

  it("un tope no positivo desactiva la regla", () => {
    const abiertas = [pos("frxUSDJPY", "buy"), pos("frxEURJPY", "buy")];
    expect(permiteExposicion(abiertas, pos("frxGBPJPY", "buy"), 0).permitido).toBe(true);
  });

  it("el riesgo de cada posición pondera: dos pequeñas no pesan como una grande", () => {
    const abiertas = [pos("frxUSDJPY", "buy", 50), pos("frxEURJPY", "buy", 50)];
    expect(permiteExposicion(abiertas, pos("frxGBPJPY", "buy", 50), MAX).permitido).toBe(true);
  });

  it("la divisa de la cuenta tiene un tope propio y más alto", () => {
    // Sin esto, el dólar —presente en un lado de casi todos los pares— bloquea
    // la diversificación entera. Caso real: rechazó oro, plata, BTC y ETH a la vez.
    const abiertas = [pos("frxEURUSD", "sell"), pos("frxGBPUSD", "sell")]; // +200 USD
    const candidata = pos("frxXAUUSD", "sell"); // sumaría +100 USD → 300
    expect(permiteExposicion(abiertas, candidata, MAX).permitido).toBe(false);
    expect(permiteExposicion(abiertas, candidata, MAX, { divisaCuenta: "USD" }).permitido).toBe(true);
  });

  it("el tope de la divisa de la cuenta no es infinito", () => {
    const abiertas = Array.from({ length: 8 }, () => pos("frxEURUSD", "sell")); // +800 USD
    const v = permiteExposicion(abiertas, pos("frxXAUUSD", "sell"), MAX, { divisaCuenta: "USD" });
    expect(v.permitido).toBe(false);
    expect(v.divisa).toBe("USD");
    expect(v.limite).toBe(MAX * 3);
  });

  it("el yen sigue con el tope estricto aunque la cuenta sea en dólares", () => {
    const abiertas = [pos("frxUSDJPY", "buy"), pos("frxEURJPY", "buy")];
    const v = permiteExposicion(abiertas, pos("frxGBPJPY", "buy"), MAX, { divisaCuenta: "USD" });
    expect(v.permitido).toBe(false);
    expect(v.divisa).toBe("JPY");
  });
});
