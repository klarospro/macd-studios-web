import { describe, expect, it } from "vitest";
import type { TransaccionIg } from "../broker/igClient";
import { emparejarCierre, motivoDeCierre } from "./cierresBroker";

const tx = (over: Partial<TransaccionIg>): TransaccionIg => ({
  referencia: "REF",
  fecha: "2026-09-01T10:00:00",
  instrumento: "Spot Gold",
  tipo: "DEAL",
  tamano: 0.1,
  nivelApertura: 4620.5,
  nivelCierre: 4600,
  pnl: -200,
  divisa: "EUR",
  ...over,
});

describe("emparejarCierre", () => {
  const posicion = { entryPrice: 4620.5, size: 0.1 };

  it("encuentra la transacción por nivel de apertura y tamaño", () => {
    const t = tx({});
    expect(emparejarCierre([tx({ nivelApertura: 100, tamano: 5 }), t], posicion)).toBe(t);
  });

  it("empareja aunque IG devuelva el tamaño con signo negativo (corto)", () => {
    const t = tx({ tamano: -0.1 });
    expect(emparejarCierre([t], posicion)).toBe(t);
  });

  it("no empareja si el nivel de apertura no es el nuestro", () => {
    expect(emparejarCierre([tx({ nivelApertura: 4700 })], posicion)).toBeUndefined();
  });

  it("no empareja si el tamaño no coincide", () => {
    expect(emparejarCierre([tx({ tamano: 0.5 })], posicion)).toBeUndefined();
  });

  it("ante DOS candidatas idénticas no elige: prefiere un hueco a un P&L mal atribuido", () => {
    expect(emparejarCierre([tx({ referencia: "A" }), tx({ referencia: "B" })], posicion)).toBeUndefined();
  });

  it("ignora transacciones sin nivel de apertura (ingresos, comisiones)", () => {
    expect(emparejarCierre([tx({ nivelApertura: null })], posicion)).toBeUndefined();
  });

  it("sin transacciones no inventa nada", () => {
    expect(emparejarCierre([], posicion)).toBeUndefined();
  });
});

describe("motivoDeCierre", () => {
  const largo = { side: "buy" as const, stopPrice: 98, stopInicial: 98 };

  it("reconoce el stop cuando IG cierra en su nivel", () => {
    expect(motivoDeCierre(largo, 98, -200)).toBe("stop");
  });

  it("distingue el breakeven del stop original", () => {
    // El stop vigente (100) ya no es el de apertura (98): saltó el breakeven.
    expect(motivoDeCierre({ ...largo, stopPrice: 100 }, 100, 2)).toBe("breakeven");
  });

  it("un cierre ganador lejos del stop no se afirma como objetivo", () => {
    // No guardamos el limitPrice en la posición, así que no se puede sostener
    // que fuera el objetivo. El nombre lo admite en vez de fingir certeza.
    expect(motivoDeCierre(largo, 105, 500)).toBe("objetivo_o_cierre_broker");
  });

  it("un cierre perdedor lejos del stop se marca como tal", () => {
    expect(motivoDeCierre(largo, 99, -100)).toBe("cierre_broker_perdedor");
  });

  it("sin nivel de cierre se cae al signo del P&L", () => {
    expect(motivoDeCierre(largo, null, 50)).toBe("cierre_broker_ganador");
    expect(motivoDeCierre(largo, null, -50)).toBe("cierre_broker_perdedor");
  });
});
