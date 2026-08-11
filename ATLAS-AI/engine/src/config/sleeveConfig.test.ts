import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { cargarConfig, ConfigInvalidaError, RUTA_CONFIG_POR_DEFECTO, validarConfig } from "./sleeveConfig";

/** Documento base válido = el YAML que realmente se despliega, ya parseado. */
function docBase(): Record<string, any> {
  return parse(readFileSync(RUTA_CONFIG_POR_DEFECTO, "utf8"));
}

describe("sleeveConfig", () => {
  it("carga el atlas.yaml real del repositorio", () => {
    const config = cargarConfig();
    expect(config.modo).toBe("demo");
    expect(config.cartera.margenPorSleeve).toEqual({ core: 0.4, intradia: 0.3, eventscalp: 0.3 });
  });

  it("el reparto de margen del fichero desplegado suma exactamente 1", () => {
    const { core, intradia, eventscalp } = cargarConfig().cartera.margenPorSleeve;
    expect(core + intradia + eventscalp).toBeCloseTo(1, 12);
  });

  it("rechaza un reparto de margen que no suma 1", () => {
    const doc = docBase();
    doc.cartera.margen_por_sleeve.core = 0.5; // suma 1.1
    expect(() => validarConfig(doc)).toThrow(ConfigInvalidaError);
  });

  it("rechaza reasignar el margen ocioso de un sleeve", () => {
    const doc = docBase();
    doc.cartera.reasignar_margen_ocioso = true;
    expect(() => validarConfig(doc)).toThrow(/colchón/);
  });

  it("rechaza apalancar el margen libre de la cartera", () => {
    const doc = docBase();
    doc.cartera.apalancar_margen_libre = true;
    expect(() => validarConfig(doc)).toThrow(/apalancar/);
  });

  it("no permite relajar los topes ESMA de FX mayor ni de oro", () => {
    const conFx = docBase();
    conFx.esma.apalancamiento_max.fx_mayor = 100;
    expect(() => validarConfig(conFx)).toThrow(/fx_mayor/);

    const conOro = docBase();
    conOro.esma.apalancamiento_max.oro = 50;
    expect(() => validarConfig(conOro)).toThrow(/oro/);
  });

  it("exige que la prioridad de cierre liste los tres sleeves", () => {
    const doc = docBase();
    doc.cartera.prioridad_cierre = ["eventscalp", "core"];
    expect(() => validarConfig(doc)).toThrow(ConfigInvalidaError);
  });

  it("exige breakers de cartera positivos y coherentes entre sí", () => {
    const sinBreaker = docBase();
    sinBreaker.cartera.breakers.perdida_diaria_pct = 0;
    expect(() => validarConfig(sinBreaker)).toThrow(/red de seguridad/);

    const incoherente = docBase();
    incoherente.cartera.breakers.perdida_diaria_pct = 0.08; // diaria > semanal
    expect(() => validarConfig(incoherente)).toThrow(/semanal/);
  });

  it("rechaza un rango de riesgo por trade invertido", () => {
    const doc = docBase();
    doc.riesgo.riesgo_por_trade_pct.min = 0.01;
    doc.riesgo.riesgo_por_trade_pct.max = 0.005;
    expect(() => validarConfig(doc)).toThrow(/min no puede superar/);
  });

  it("rechaza una clase de activo desconocida en la tabla de símbolos", () => {
    const doc = docBase();
    doc.esma.clase_por_simbolo.frxEURUSD = "acciones_meme";
    expect(() => validarConfig(doc)).toThrow(/clase desconocida/);
  });

  it("recoge los criterios de paso de Fase 1 de los tres sleeves", () => {
    const { criterios, semanasDemo } = cargarConfig().fase1;
    expect(semanasDemo).toBe(4);
    expect(criterios.intradia.tradesMinimos).toBe(40);
    expect(criterios.eventscalp.eventosMinimos).toBe(20);
    expect(criterios.intradia.profitFactorMin).toBe(1.3);
  });
});
