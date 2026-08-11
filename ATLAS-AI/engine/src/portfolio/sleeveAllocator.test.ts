import { describe, expect, it } from "vitest";
import { cargarConfig, SleeveId } from "../config/sleeveConfig";
import { Side } from "../domain/types";
import {
  CarteraSleeves,
  capitalDeSleeve,
  carteraVacia,
  colchonTotal,
  crearIaSolapamiento,
  detectarSolapamientos,
  presupuestoDisponible,
  riesgoAbierto,
  SleevePosition,
} from "./sleeveAllocator";

const cartera = cargarConfig().cartera;

function posicion(sleeve: SleeveId, symbol: string, side: Side, riskAmount = 10, id = `${sleeve}-${symbol}-${side}`): SleevePosition {
  return {
    id,
    symbol,
    side,
    size: 1,
    entryPrice: 100,
    stopPrice: side === "buy" ? 90 : 110,
    riskAmount,
    correlationGroup: "multi",
    sleeve,
  };
}

function conPosiciones(...posiciones: SleevePosition[]): CarteraSleeves {
  const sleeves = carteraVacia();
  for (const p of posiciones) sleeves[p.sleeve].openPositions.push(p);
  return sleeves;
}

describe("sleeveAllocator · reparto de margen", () => {
  it("reparte el equity total según los porcentajes 40/30/30", () => {
    expect(capitalDeSleeve(cartera, 10_000, "core")).toBeCloseTo(4_000, 9);
    expect(capitalDeSleeve(cartera, 10_000, "intradia")).toBeCloseTo(3_000, 9);
    expect(capitalDeSleeve(cartera, 10_000, "eventscalp")).toBeCloseTo(3_000, 9);
  });

  it("la suma de los capitales de sleeve es el equity total", () => {
    const total =
      capitalDeSleeve(cartera, 7_777, "core") +
      capitalDeSleeve(cartera, 7_777, "intradia") +
      capitalDeSleeve(cartera, 7_777, "eventscalp");
    expect(total).toBeCloseTo(7_777, 9);
  });

  it("con equity no positivo el capital asignado es 0", () => {
    expect(capitalDeSleeve(cartera, 0, "core")).toBe(0);
    expect(capitalDeSleeve(cartera, -5, "core")).toBe(0);
  });

  it("el presupuesto disponible descuenta el riesgo ya abierto", () => {
    const sleeves = conPosiciones(posicion("core", "frxEURUSD", "buy", 1_000));
    expect(riesgoAbierto(sleeves.core)).toBe(1_000);
    expect(presupuestoDisponible(cartera, 10_000, sleeves.core)).toBeCloseTo(3_000, 9);
  });

  it("NO reasigna el margen ocioso de un sleeve a otro", () => {
    // Core e Intradía en reposo; EventScalp agotado. Su disponible sigue siendo 0
    // aunque haya 7.000 libres en la cartera: el colchón no es munición.
    const sleeves = conPosiciones(posicion("eventscalp", "frxEURUSD", "buy", 3_000));
    expect(presupuestoDisponible(cartera, 10_000, sleeves.eventscalp)).toBe(0);
    expect(colchonTotal(cartera, 10_000, sleeves)).toBeCloseTo(7_000, 9);
  });

  it("el presupuesto nunca es negativo aunque el riesgo abierto exceda el capital", () => {
    const sleeves = conPosiciones(posicion("intradia", "frxEURUSD", "buy", 99_999));
    expect(presupuestoDisponible(cartera, 10_000, sleeves.intradia)).toBe(0);
  });
});

describe("sleeveAllocator · regla de solapamiento", () => {
  it("no ve solapamiento cuando cada sleeve opera un instrumento distinto", () => {
    const sleeves = conPosiciones(
      posicion("core", "frxEURUSD", "buy"),
      posicion("intradia", "frxXAUUSD", "buy"),
    );
    expect(detectarSolapamientos(cartera, sleeves)).toEqual([]);
  });

  it("no ve solapamiento en direcciones opuestas sobre el mismo instrumento", () => {
    const sleeves = conPosiciones(
      posicion("core", "frxEURUSD", "buy"),
      posicion("intradia", "frxEURUSD", "sell"),
    );
    expect(detectarSolapamientos(cartera, sleeves)).toEqual([]);
  });

  it("detecta el mismo instrumento y dirección en dos sleeves", () => {
    const sleeves = conPosiciones(
      posicion("core", "frxEURUSD", "buy"),
      posicion("intradia", "frxEURUSD", "buy"),
    );
    const solapamientos = detectarSolapamientos(cartera, sleeves);
    expect(solapamientos).toHaveLength(1);
    expect(solapamientos[0]?.cerrar).toBe("intradia");
    expect(solapamientos[0]?.conservar).toBe("core");
  });

  it("cierra EventScalp antes que Intradía y conserva siempre Core", () => {
    const sleeves = conPosiciones(
      posicion("core", "frxEURUSD", "buy"),
      posicion("intradia", "frxEURUSD", "buy"),
      posicion("eventscalp", "frxEURUSD", "buy"),
    );
    const solapamientos = detectarSolapamientos(cartera, sleeves);
    expect(solapamientos).toHaveLength(2);
    expect(solapamientos.every((s) => s.conservar === "core")).toBe(true);
    expect(solapamientos.map((s) => s.cerrar).sort()).toEqual(["eventscalp", "intradia"]);
  });

  it("entre Intradía y EventScalp se conserva Intradía", () => {
    const sleeves = conPosiciones(
      posicion("intradia", "frxXAUUSD", "sell"),
      posicion("eventscalp", "frxXAUUSD", "sell"),
    );
    const solapamientos = detectarSolapamientos(cartera, sleeves);
    expect(solapamientos).toHaveLength(1);
    expect(solapamientos[0]?.conservar).toBe("intradia");
    expect(solapamientos[0]?.cerrar).toBe("eventscalp");
  });

  it("anticipa el choque antes de abrir, para no pagar dos veces el spread", () => {
    const sleeves = conPosiciones(posicion("core", "frxEURUSD", "buy"));
    expect(crearIaSolapamiento(sleeves, "eventscalp", "frxEURUSD", "buy")).toBe("core");
    expect(crearIaSolapamiento(sleeves, "eventscalp", "frxEURUSD", "sell")).toBeUndefined();
    expect(crearIaSolapamiento(sleeves, "eventscalp", "frxXAUUSD", "buy")).toBeUndefined();
  });

  it("no considera choque una segunda posición del MISMO sleeve", () => {
    const sleeves = conPosiciones(posicion("core", "frxEURUSD", "buy"));
    expect(crearIaSolapamiento(sleeves, "core", "frxEURUSD", "buy")).toBeUndefined();
  });
});
