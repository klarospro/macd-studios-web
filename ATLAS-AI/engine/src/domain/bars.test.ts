import { describe, expect, it } from "vitest";
import { atrVelas, diaUtc, fechaUtc, horaUtc, minutoDeHora, minutoUtc, trueRange, Vela } from "./bars";

const DIA = 86_400;

function vela(epoch: number, open: number, high: number, low: number, close: number, ticks?: number): Vela {
  return { epoch, open, high, low, close, ticks };
}

describe("bars · tiempo UTC", () => {
  it("traduce epoch a minuto y hora del día", () => {
    expect(minutoUtc(0)).toBe(0);
    expect(horaUtc(0)).toBe(0);
    expect(minutoUtc(7 * 3600 + 30 * 60)).toBe(450);
    expect(horaUtc(7 * 3600 + 30 * 60)).toBe(7);
  });

  it("agrupa por jornada UTC", () => {
    expect(diaUtc(0)).toBe(0);
    expect(diaUtc(DIA - 1)).toBe(0);
    expect(diaUtc(DIA)).toBe(1);
  });

  it("devuelve la fecha ISO en UTC", () => {
    expect(fechaUtc(0)).toBe("1970-01-01");
    expect(fechaUtc(DIA)).toBe("1970-01-02");
  });

  it("convierte HH:MM a minuto del día", () => {
    expect(minutoDeHora("00:00")).toBe(0);
    expect(minutoDeHora("07:00")).toBe(420);
    expect(minutoDeHora("23:59")).toBe(1439);
  });

  it("rechaza horas mal formadas o fuera de rango", () => {
    expect(() => minutoDeHora("7:0")).toThrow();
    expect(() => minutoDeHora("24:00")).toThrow();
    expect(() => minutoDeHora("12:60")).toThrow();
  });
});

describe("bars · rango verdadero y ATR", () => {
  it("sin vela previa el rango es simplemente alto menos bajo", () => {
    expect(trueRange([vela(0, 100, 105, 95, 102)], 0)).toBe(10);
  });

  it("cuenta el hueco contra el cierre anterior", () => {
    const velas = [vela(0, 100, 101, 99, 100), vela(60, 110, 111, 109, 110)];
    // El hueco 100 -> 111 (11) domina al rango propio de la vela (2).
    expect(trueRange(velas, 1)).toBe(11);
  });

  it("promedia el rango verdadero sobre la ventana", () => {
    const velas = Array.from({ length: 20 }, (_, i) => vela(i * 60, 100, 102, 98, 100));
    expect(atrVelas(velas, 19, 14)).toBeCloseTo(4, 9);
  });

  it("devuelve null sin histórico suficiente", () => {
    const velas = Array.from({ length: 5 }, (_, i) => vela(i * 60, 100, 102, 98, 100));
    expect(atrVelas(velas, 4, 14)).toBeNull();
  });

  it("devuelve null si el ATR sale nulo (velas sin recorrido)", () => {
    const velas = Array.from({ length: 20 }, (_, i) => vela(i * 60, 100, 100, 100, 100));
    expect(atrVelas(velas, 19, 14)).toBeNull();
  });
});
