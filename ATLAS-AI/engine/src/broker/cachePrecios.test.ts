import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CachePrecios, segundosDeResolucion, VelaCache } from "./cachePrecios";

const nuevaCache = () => new CachePrecios(mkdtempSync(join(tmpdir(), "atlas-cache-")));
const vela = (epoch: number, close = 100): VelaCache => ({ epoch, open: close, high: close, low: close, close });

const DIA = 86400;
const AHORA = 1_800_000_000; // instante fijo: los tests no dependen del reloj

describe("segundosDeResolucion", () => {
  it("traduce las resoluciones de IG", () => {
    expect(segundosDeResolucion("DAY")).toBe(86400);
    expect(segundosDeResolucion("MINUTE_15")).toBe(900);
  });
  it("ante una resolución desconocida asume diaria (la más conservadora en cuota)", () => {
    expect(segundosDeResolucion("LO_QUE_SEA")).toBe(86400);
  });
});

describe("CachePrecios", () => {
  it("una caché vacía necesita refresco", () => {
    expect(nuevaCache().necesitaRefresco("EURUSD", "DAY", 200, AHORA)).toBe(true);
  });

  it("guarda y relee", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(AHORA - DIA), vela(AHORA)]);
    expect(c.leer("EURUSD", "DAY")).toHaveLength(2);
  });

  it("NO pide al bróker si la última vela sigue siendo la vigente", () => {
    // Este es el test que protege la cuota: con la vela del día ya guardada,
    // las 288 pasadas restantes del día no deben tocar la API.
    const c = nuevaCache();
    const velas = Array.from({ length: 200 }, (_, i) => vela(AHORA - (199 - i) * DIA));
    c.guardar("EURUSD", "DAY", velas);
    expect(c.necesitaRefresco("EURUSD", "DAY", 200, AHORA + 3600)).toBe(false);
  });

  it("pide cuando ya ha empezado una vela nueva", () => {
    const c = nuevaCache();
    const velas = Array.from({ length: 200 }, (_, i) => vela(AHORA - (199 - i) * DIA));
    c.guardar("EURUSD", "DAY", velas);
    expect(c.necesitaRefresco("EURUSD", "DAY", 200, AHORA + DIA * 2)).toBe(true);
  });

  it("pide si no llega al mínimo aunque la última sea reciente", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(AHORA)]);
    expect(c.necesitaRefresco("EURUSD", "DAY", 200, AHORA)).toBe(true);
  });

  it("no duplica velas al fusionar", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(1000), vela(2000)]);
    c.guardar("EURUSD", "DAY", [vela(2000), vela(3000)]);
    expect(c.leer("EURUSD", "DAY").map((v) => v.epoch)).toEqual([1000, 2000, 3000]);
  });

  it("la vela nueva sobrescribe a la vieja del mismo instante", () => {
    // La última vela de una serie viva aún se está formando: su cierre cambia.
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(1000, 100)]);
    c.guardar("EURUSD", "DAY", [vela(1000, 123)]);
    expect(c.leer("EURUSD", "DAY")[0]!.close).toBe(123);
  });

  it("mantiene el orden cronológico aunque lleguen desordenadas", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(3000), vela(1000), vela(2000)]);
    expect(c.leer("EURUSD", "DAY").map((v) => v.epoch)).toEqual([1000, 2000, 3000]);
  });

  it("recorta al máximo para que el fichero no crezca sin fin", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "MINUTE_15", Array.from({ length: 50 }, (_, i) => vela(i * 900)), 10);
    const v = c.leer("EURUSD", "MINUTE_15");
    expect(v).toHaveLength(10);
    expect(v[v.length - 1]!.epoch).toBe(49 * 900); // conserva las MÁS RECIENTES
  });

  it("pide solo el hueco, no la serie entera", () => {
    const c = nuevaCache();
    const velas = Array.from({ length: 200 }, (_, i) => vela(AHORA - (199 - i) * DIA));
    c.guardar("EURUSD", "DAY", velas);
    // Han pasado 3 días: bastan ~4 velas, no 200.
    expect(c.velasQueFaltan("EURUSD", "DAY", 200, AHORA + DIA * 3)).toBe(4);
  });

  it("con la caché corta pide el mínimo completo", () => {
    const c = nuevaCache();
    c.guardar("EURUSD", "DAY", [vela(AHORA)]);
    expect(c.velasQueFaltan("EURUSD", "DAY", 200, AHORA)).toBe(200);
  });

  it("un fichero corrupto se trata como caché vacía, no rompe el ciclo", () => {
    const c = nuevaCache();
    expect(c.leer("NO_EXISTE", "DAY")).toEqual([]);
  });
});
