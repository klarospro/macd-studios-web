import { describe, expect, it } from "vitest";
import { ajustarTamano } from "./igAdapter";

/**
 * El fallo que motiva estos tests (2026-08-17): la primera orden real que el
 * Core llegó a mandar a IG murió con
 * `validation.number.too-many-decimal-places.request.size` porque el tamaño
 * salía del cálculo de riesgo con 17 decimales.
 */
describe("ajustarTamano", () => {
  it("recorta los decimales al escalón del instrumento", () => {
    expect(ajustarTamano(0.06415597728038142, 0.1)).toBe(0);
    expect(ajustarTamano(1.23456789, 0.1)).toBe(1.2);
    expect(ajustarTamano(3.9999, 1)).toBe(3);
  });

  it("redondea SIEMPRE a la baja: al alza se rompería el tope de riesgo", () => {
    expect(ajustarTamano(0.99, 0.5)).toBe(0.5);
    expect(ajustarTamano(2.9, 1)).toBe(2);
  });

  it("un tamaño ya alineado no cambia", () => {
    expect(ajustarTamano(0.5, 0.1)).toBe(0.5);
    expect(ajustarTamano(3, 1)).toBe(3);
  });

  it("no se traga el error de coma flotante (0.1+0.2 y compañía)", () => {
    // 0.3 / 0.1 da 2.9999... en binario: sin margen, esto devolvería 0.2.
    expect(ajustarTamano(0.3, 0.1)).toBe(0.3);
    expect(ajustarTamano(0.7, 0.1)).toBe(0.7);
  });

  it("un escalón inválido deja el tamaño intacto en vez de anularlo", () => {
    expect(ajustarTamano(1.5, 0)).toBe(1.5);
    expect(ajustarTamano(1.5, NaN)).toBe(1.5);
  });
});
