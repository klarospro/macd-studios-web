import { describe, expect, it } from "vitest";
import { cargarConfig } from "../config/sleeveConfig";
import {
  CoreTrendParams,
  CoreVolTargetParams,
  debeCerrarCore,
  direccionDonchian,
  direccionEwma,
  escalaVolTarget,
  ewma,
  paramsCoreDesdeConfig,
  senalCore,
} from "./sleeveCore";

/** Serie con tendencia lineal: sube (o baja) `paso` por barra desde `inicio`. */
function tendencia(n: number, inicio: number, paso: number): number[] {
  return Array.from({ length: n }, (_, i) => inicio + i * paso);
}

/**
 * Mercado lateral realista: oscilación de periodo largo comparado con las
 * medias. Una alternancia barra a barra NO sirve como fixture — sobre una
 * sierra perfecta las tres EWMA quedan ordenadas y el filtro sí señala.
 */
function oscilante(n: number, nivel: number, amplitud: number, periodo: number): number[] {
  return Array.from({ length: n }, (_, i) => nivel + amplitud * Math.sin((2 * Math.PI * i) / periodo));
}

/** Cuenta en cuántas barras del tramo final NO hay señal alineada. */
function barrasSinSenal(prices: number[], desde: number, periodos: [number, number, number]): number {
  let sin = 0;
  for (let t = desde; t < prices.length; t++) {
    if (direccionEwma(prices, t, periodos) === null) sin++;
  }
  return sin;
}

const TREND: CoreTrendParams = {
  symbol: "frxEURUSD",
  correlationGroup: "fx",
  metodo: "ewma",
  ewmaPeriodos: [5, 10, 20],
  donchianPeriodo: 20,
  atrPeriodo: 14,
  atrMultStop: 2,
};

const SIN_VOL_TARGET: CoreVolTargetParams = {
  activo: false,
  objetivoAnual: 0.1,
  ventanaDias: 60,
  escalaMaxima: 1,
};

describe("sleeveCore · EWMA", () => {
  it("de una serie constante devuelve ese mismo valor", () => {
    const planos = Array(50).fill(100);
    expect(ewma(planos, 49, 10)).toBeCloseTo(100, 9);
  });

  it("va por detrás del precio en una serie que sube", () => {
    const prices = tendencia(100, 100, 1);
    const valor = ewma(prices, 99, 20);
    expect(valor).not.toBeNull();
    expect(valor!).toBeLessThan(prices[99]!);
  });

  it("la media corta reacciona antes que la larga", () => {
    const prices = tendencia(200, 100, 1);
    expect(ewma(prices, 199, 5)!).toBeGreaterThan(ewma(prices, 199, 50)!);
  });

  it("devuelve null sin histórico suficiente", () => {
    expect(ewma(tendencia(5, 100, 1), 4, 20)).toBeNull();
  });
});

describe("sleeveCore · dirección", () => {
  it("señala largo con las tres medias alineadas al alza", () => {
    expect(direccionEwma(tendencia(200, 100, 1), 199, [5, 10, 20])).toBe("buy");
  });

  it("señala corto con las tres medias alineadas a la baja", () => {
    expect(direccionEwma(tendencia(200, 300, -1), 199, [5, 10, 20])).toBe("sell");
  });

  it("suprime la señal buena parte del tiempo en mercado lateral", () => {
    // Es el propósito del filtro de alineación: en un rango sin dirección hay
    // muchas barras sin señal, frente a ninguna en una tendencia limpia.
    const rango = oscilante(200, 100, 5, 40);
    expect(barrasSinSenal(rango, 60, [5, 10, 20])).toBeGreaterThan(20);
    expect(barrasSinSenal(tendencia(200, 100, 1), 60, [5, 10, 20])).toBe(0);
  });

  it("Donchian señala solo al romper el canal previo, no dentro de él", () => {
    const dentro = [...Array(30).fill(100), 100];
    expect(direccionDonchian(dentro, 30, 20)).toBeNull();

    const rompeArriba = [...Array(30).fill(100), 101];
    expect(direccionDonchian(rompeArriba, 30, 20)).toBe("buy");

    const rompeAbajo = [...Array(30).fill(100), 99];
    expect(direccionDonchian(rompeAbajo, 30, 20)).toBe("sell");
  });

  it("Donchian no usa la barra actual para calcular su propio canal", () => {
    // Si la incluyera, el máximo sería el propio precio y nunca habría ruptura.
    const prices = [...tendencia(30, 100, 1), 200];
    expect(direccionDonchian(prices, 30, 20)).toBe("buy");
  });
});

describe("sleeveCore · vol-target", () => {
  const params: CoreVolTargetParams = { activo: true, objetivoAnual: 0.1, ventanaDias: 60, escalaMaxima: 1 };

  it("desactivado devuelve escala 1", () => {
    expect(escalaVolTarget(tendencia(200, 100, 1), 199, SIN_VOL_TARGET)).toBe(1);
  });

  it("nunca amplifica por encima de la escala máxima en un mercado tranquilo", () => {
    // Serie casi sin varianza -> vol muy baja -> objetivo/vol enorme, pero topado a 1.
    const prices = Array.from({ length: 200 }, (_, i) => 100 + i * 1e-6);
    const escala = escalaVolTarget(prices, 199, params);
    expect(escala).not.toBeNull();
    expect(escala!).toBeLessThanOrEqual(1);
  });

  it("reduce la escala cuando la volatilidad supera el objetivo", () => {
    // Oscilación fuerte -> vol anualizada muy por encima del 10%.
    const prices = Array.from({ length: 200 }, (_, i) => 100 * (1 + (i % 2 === 0 ? 0.03 : -0.03)));
    const escala = escalaVolTarget(prices, 199, params);
    expect(escala).not.toBeNull();
    expect(escala!).toBeLessThan(1);
    expect(escala!).toBeGreaterThan(0);
  });

  it("devuelve null sin histórico para medir la volatilidad", () => {
    expect(escalaVolTarget(tendencia(20, 100, 1), 19, params)).toBeNull();
  });
});

describe("sleeveCore · señal completa", () => {
  it("produce una señal etiquetada como core, con stop por ATR", () => {
    const prices = tendencia(200, 100, 1);
    const signal = senalCore(prices, 199, TREND, SIN_VOL_TARGET);
    expect(signal).not.toBeNull();
    expect(signal!.sleeve).toBe("core");
    expect(signal!.side).toBe("buy");
    expect(signal!.stopPrice).toBeLessThan(signal!.entryPrice);
    expect(signal!.setupId).toBe("core:ewma:frxEURUSD");
  });

  it("el stop de un corto queda por encima de la entrada", () => {
    const signal = senalCore(tendencia(200, 300, -1), 199, TREND, SIN_VOL_TARGET);
    expect(signal!.side).toBe("sell");
    expect(signal!.stopPrice).toBeGreaterThan(signal!.entryPrice);
  });

  it("se queda fuera del mercado en las barras sin alineación", () => {
    const rango = oscilante(200, 100, 5, 40);
    const sinSenal = [];
    for (let t = 60; t < rango.length; t++) {
      if (senalCore(rango, t, TREND, SIN_VOL_TARGET) === null) sinSenal.push(t);
    }
    expect(sinSenal.length).toBeGreaterThan(20);
  });

  it("adjunta la escala de vol-target para que el gate la aplique", () => {
    const params: CoreVolTargetParams = { activo: true, objetivoAnual: 0.1, ventanaDias: 60, escalaMaxima: 1 };
    const signal = senalCore(tendencia(200, 100, 1), 199, TREND, params);
    expect(signal).not.toBeNull();
    expect(signal!.escalaVolTarget).toBeGreaterThan(0);
    expect(signal!.escalaVolTarget).toBeLessThanOrEqual(1);
  });
});

describe("sleeveCore · salidas", () => {
  it("mantiene el largo mientras la estructura alcista siga viva", () => {
    expect(debeCerrarCore(tendencia(200, 100, 1), 199, TREND, "buy")).toBe(false);
  });

  it("cierra el largo cuando la estructura se gira", () => {
    expect(debeCerrarCore(tendencia(200, 300, -1), 199, TREND, "buy")).toBe(true);
  });

  it("con EWMA, perder la alineación basta para cerrar", () => {
    const rango = oscilante(200, 100, 5, 40);
    const t = Array.from({ length: 140 }, (_, k) => k + 60).find(
      (bar) => direccionEwma(rango, bar, TREND.ewmaPeriodos) === null,
    );
    expect(t).toBeDefined();
    expect(debeCerrarCore(rango, t!, TREND, "buy")).toBe(true);
  });

  it("con Donchian NO se cierra por estar dentro del canal, solo por ruptura inversa", () => {
    const donchian: CoreTrendParams = { ...TREND, metodo: "donchian", donchianPeriodo: 20 };
    const dentro = [...Array(30).fill(100), 100];
    expect(debeCerrarCore(dentro, 30, donchian, "buy")).toBe(false);

    const rompeAbajo = [...Array(30).fill(100), 99];
    expect(debeCerrarCore(rompeAbajo, 30, donchian, "buy")).toBe(true);
  });
});

describe("sleeveCore · lectura del YAML", () => {
  it("lee los parámetros del atlas.yaml desplegado", () => {
    const { trend, volTarget, activo } = paramsCoreDesdeConfig(
      cargarConfig().core as Record<string, any>,
      "frxEURUSD",
      "fx",
    );
    expect(activo).toBe(true);
    expect(trend.metodo).toBe("ewma");
    expect(trend.ewmaPeriodos).toEqual([50, 100, 200]);
    expect(volTarget.activo).toBe(true);
    expect(volTarget.objetivoAnual).toBe(0.1);
  });

  it("el Carry sigue desactivado: no hay fuente de swaps confirmada", () => {
    const core = cargarConfig().core as Record<string, any>;
    expect(core.carry.activo).toBe(false);
  });
});
