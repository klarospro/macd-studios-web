import { describe, expect, it } from "vitest";
import { distanciaR, paramsBreakevenDesdeConfig, stopBreakeven } from "./breakeven";

const LARGO = { side: "buy" as const, entryPrice: 100, stopPrice: 98, riskAmount: 200 };
const CORTO = { side: "sell" as const, entryPrice: 100, stopPrice: 102, riskAmount: 200 };
const BE = { activo: true, activarEnR: 1, offsetR: 0 };

describe("stopBreakeven", () => {
  it("no mueve nada mientras el beneficio no llega al umbral", () => {
    expect(stopBreakeven(LARGO, 199, 2, BE)).toBeUndefined();
  });

  it("mueve el stop a la entrada justo al alcanzar 1R de beneficio", () => {
    expect(stopBreakeven(LARGO, 200, 2, BE)).toBe(100);
  });

  it("en corto el stop baja hasta la entrada", () => {
    expect(stopBreakeven(CORTO, 250, 2, BE)).toBe(100);
  });

  it("con offset deja el stop a favor, no en la entrada exacta", () => {
    expect(stopBreakeven(LARGO, 200, 2, { ...BE, offsetR: 0.1 })).toBeCloseTo(100.2, 10);
    expect(stopBreakeven(CORTO, 200, 2, { ...BE, offsetR: 0.1 })).toBeCloseTo(99.8, 10);
  });

  it("nunca afloja un stop que ya protege más", () => {
    // Segunda pasada: el stop ya está en la entrada. Volver a ponerlo ahí no es
    // una mejora, y devolver un valor haría que el ciclo llamase al bróker en
    // cada vuelta para nada.
    expect(stopBreakeven({ ...LARGO, stopPrice: 100 }, 500, 2, BE)).toBeUndefined();
    expect(stopBreakeven({ ...LARGO, stopPrice: 101 }, 500, 2, BE)).toBeUndefined();
  });

  it("usa la R ORIGINAL, no la distancia al stop ya movido", () => {
    // Si midiera R contra el stop vigente (=entrada), R valdría 0 y la regla
    // se dispararía en bucle. Con la R original, 1R sigue siendo 200 €.
    const yaMovida = { ...LARGO, stopPrice: 100 };
    expect(stopBreakeven(yaMovida, 199, 2, { ...BE, offsetR: 0.5 })).toBeUndefined();
    expect(stopBreakeven(yaMovida, 200, 2, { ...BE, offsetR: 0.5 })).toBe(101);
  });

  it("apagada no hace nada aunque la operación vaya muy a favor", () => {
    expect(stopBreakeven(LARGO, 10_000, 2, { ...BE, activo: false })).toBeUndefined();
  });

  it("se protege de datos imposibles en vez de calcular un stop absurdo", () => {
    expect(stopBreakeven(LARGO, 500, 0, BE)).toBeUndefined();
    expect(stopBreakeven({ ...LARGO, riskAmount: 0 }, 500, 2, BE)).toBeUndefined();
  });
});

describe("distanciaR", () => {
  it("es la distancia absoluta entre entrada y stop", () => {
    expect(distanciaR(100, 98)).toBe(2);
    expect(distanciaR(100, 102)).toBe(2);
  });
});

describe("paramsBreakevenDesdeConfig", () => {
  it("lee el bloque del YAML", () => {
    const p = paramsBreakevenDesdeConfig({ salidas: { breakeven: { activo: true, activar_en_r: 1.5, offset_r: 0.1 } } });
    expect(p).toEqual({ activo: true, activarEnR: 1.5, offsetR: 0.1 });
  });

  it("sin bloque, apagada", () => {
    expect(paramsBreakevenDesdeConfig({}).activo).toBe(false);
    expect(paramsBreakevenDesdeConfig({ salidas: {} }).activo).toBe(false);
  });

  it("una config a medias apaga la regla en vez de inventarse el umbral", () => {
    expect(paramsBreakevenDesdeConfig({ salidas: { breakeven: { activo: true } } }).activo).toBe(false);
    expect(paramsBreakevenDesdeConfig({ salidas: { breakeven: { activo: true, activar_en_r: 0 } } }).activo).toBe(false);
    expect(paramsBreakevenDesdeConfig({ salidas: { breakeven: { activo: true, activar_en_r: 1, offset_r: -1 } } }).activo).toBe(false);
  });
});
