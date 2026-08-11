import { describe, expect, it } from "vitest";
import { cargarConfig } from "../config/sleeveConfig";
import { nocional, sizeMaximoEsma, verificarEsma } from "./esma";

const esma = cargarConfig().esma;

describe("esma", () => {
  it("calcula el nocional como tamaño × precio", () => {
    expect(nocional(2, 1.1)).toBeCloseTo(2.2, 12);
    expect(nocional(-2, 1.1)).toBeCloseTo(2.2, 12); // siempre positivo
  });

  it("permite una orden de FX mayor justo en el límite 1:30", () => {
    const capital = 1000;
    const precio = 1.1;
    const size = (capital * 30) / precio; // nocional exacto = 30x capital
    const veredicto = verificarEsma(esma, "frxEURUSD", size, precio, capital);
    expect(veredicto.permitido).toBe(true);
    if (veredicto.permitido) expect(veredicto.apalancamientoUsado).toBeCloseTo(30, 9);
  });

  it("rechaza FX mayor por encima de 1:30", () => {
    const capital = 1000;
    const precio = 1.1;
    const size = (capital * 30.01) / precio;
    const veredicto = verificarEsma(esma, "frxEURUSD", size, precio, capital);
    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido) expect(veredicto.motivo).toBe("apalancamiento_excedido");
  });

  it("aplica al oro el tramo 1:20, más estricto que el de divisas", () => {
    const capital = 1000;
    const precio = 2000;
    const size25x = (capital * 25) / precio; // legal en FX, ilegal en oro
    const veredicto = verificarEsma(esma, "frxXAUUSD", size25x, precio, capital);
    expect(veredicto.permitido).toBe(false);

    const size20x = (capital * 20) / precio;
    expect(verificarEsma(esma, "frxXAUUSD", size20x, precio, capital).permitido).toBe(true);
  });

  it("aplica a cripto el tramo 1:2", () => {
    const capital = 1000;
    const precio = 60000;
    expect(verificarEsma(esma, "cryBTCUSD", (capital * 2) / precio, precio, capital).permitido).toBe(true);
    expect(verificarEsma(esma, "cryBTCUSD", (capital * 3) / precio, precio, capital).permitido).toBe(false);
  });

  it("rechaza un símbolo sin clasificar en vez de asumir un tramo permisivo", () => {
    const veredicto = verificarEsma(esma, "frxXXXYYY", 1, 100, 1000);
    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido) expect(veredicto.motivo).toBe("simbolo_sin_clasificar");
  });

  it("rechaza entradas no positivas", () => {
    expect(verificarEsma(esma, "frxEURUSD", 0, 1.1, 1000).permitido).toBe(false);
    expect(verificarEsma(esma, "frxEURUSD", 1, 0, 1000).permitido).toBe(false);
    expect(verificarEsma(esma, "frxEURUSD", 1, 1.1, 0).permitido).toBe(false);
  });

  it("el tamaño máximo devuelto es exactamente el que agota el límite", () => {
    const capital = 5000;
    const precio = 1.25;
    const size = sizeMaximoEsma(esma, "frxEURUSD", precio, capital);
    expect(verificarEsma(esma, "frxEURUSD", size, precio, capital).permitido).toBe(true);
    expect(verificarEsma(esma, "frxEURUSD", size * 1.000001, precio, capital).permitido).toBe(false);
  });

  it("el tamaño máximo de un símbolo sin clasificar es 0", () => {
    expect(sizeMaximoEsma(esma, "frxXXXYYY", 100, 1000)).toBe(0);
  });
});
