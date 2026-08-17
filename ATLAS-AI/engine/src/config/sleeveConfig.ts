import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * Carga y VALIDA `config/atlas.yaml` — la única fuente de parámetros ajustables
 * de la cartera multi-sleeve (27_SCALPING/04, entregable 2).
 *
 * El principio es fallo seguro: si el fichero viola una restricción dura del
 * diseño (margen que no suma 1, reasignación de margen ocioso, apalancamiento
 * del margen libre, modo real sin aprobación), el proceso ABORTA al arrancar en
 * vez de operar con una configuración inválida. Un error de config no puede
 * convertirse en una orden mal dimensionada.
 */

export type SleeveId = "core" | "intradia" | "eventscalp";

export const SLEEVE_IDS: readonly SleeveId[] = ["core", "intradia", "eventscalp"];

/** Clases de activo con tramo de apalancamiento propio bajo ESMA. */
export type AssetClass =
  | "fx_mayor"
  | "fx_menor"
  | "oro"
  | "indice_mayor"
  | "indice_menor"
  | "materia_prima"
  | "cripto";

export interface CarteraConfig {
  margenPorSleeve: Record<SleeveId, number>;
  reasignarMargenOcioso: boolean;
  apalancarMargenLibre: boolean;
  /** Orden de cierre ante solapamiento: el primero de la lista se cierra antes. */
  prioridadCierre: SleeveId[];
  breakers: { perdidaDiariaPct: number; perdidaSemanalPct: number };
}

export interface EsmaConfig {
  apalancamientoMax: Record<AssetClass, number>;
  clasePorSimbolo: Record<string, AssetClass>;
}

export interface RiesgoConfig {
  riesgoPorTradePct: { min: number; max: number };
  /** Riesgo total que cada tipo de estrategia puede poner en juego en un día. */
  presupuestoDiarioPct: { scalping: number; semanal: number };
  /** Riesgo vivo simultáneo máximo en un mismo bloque correlacionado. */
  topePorBloquePct: number;
  /** Riesgo fijo por operación en moneda de cuenta. 0 = usar porcentajes. */
  riesgoFijoPorOperacion: number;
  /** Objetivo en múltiplos de R. 0 = sin objetivo fijo (salida por estrategia). */
  objetivoR: number;
  spreadMaxXNormal: number;
  spreadMuestrasMinimas: number;
}

export interface Fase1Criterio {
  expectancyMin: number;
  profitFactorMin?: number;
  tradesMinimos?: number;
  eventosMinimos?: number;
  drawdownMaxCartera: number;
}

export interface AtlasConfig {
  version: number;
  modo: "demo" | "real";
  cartera: CarteraConfig;
  esma: EsmaConfig;
  riesgo: RiesgoConfig;
  fase1: { semanasDemo: number; criterios: Record<SleeveId, Fase1Criterio> };
  /** Bloques por sleeve, sin normalizar: los consume cada estrategia. */
  core: Record<string, unknown>;
  intradia: Record<string, unknown>;
  eventscalp: Record<string, unknown>;
  auditoria: Record<string, unknown>;
}

export class ConfigInvalidaError extends Error {
  constructor(motivo: string) {
    super(`config/atlas.yaml inválido: ${motivo}`);
    this.name = "ConfigInvalidaError";
  }
}

function exigir(condicion: boolean, motivo: string): void {
  if (!condicion) throw new ConfigInvalidaError(motivo);
}

function numero(raw: unknown, ruta: string): number {
  exigir(typeof raw === "number" && Number.isFinite(raw), `${ruta} debe ser un número`);
  return raw as number;
}

function fraccion(raw: unknown, ruta: string): number {
  const valor = numero(raw, ruta);
  exigir(valor >= 0 && valor <= 1, `${ruta} debe estar entre 0 y 1 (recibido ${valor})`);
  return valor;
}

/** Tolerancia al comparar la suma de márgenes: evita falsos fallos por coma flotante. */
const EPSILON_SUMA = 1e-9;

export function validarConfig(raw: unknown): AtlasConfig {
  exigir(typeof raw === "object" && raw !== null, "el fichero está vacío o no es un mapa");
  const doc = raw as Record<string, any>;

  exigir(doc.version === 1, `version debe ser 1 (recibido ${String(doc.version)})`);

  // Restricción dura: no se pasa a capital real sin aprobación explícita.
  exigir(
    doc.modo === "demo" || doc.modo === "real",
    `modo debe ser "demo" o "real" (recibido ${String(doc.modo)})`,
  );

  // --- Cartera (Tarea 1) ---
  const cartera = doc.cartera ?? {};
  const margenes = cartera.margen_por_sleeve ?? {};
  const margenPorSleeve = {} as Record<SleeveId, number>;
  let suma = 0;
  for (const id of SLEEVE_IDS) {
    const valor = fraccion(margenes[id], `cartera.margen_por_sleeve.${id}`);
    exigir(valor > 0, `cartera.margen_por_sleeve.${id} debe ser > 0`);
    margenPorSleeve[id] = valor;
    suma += valor;
  }
  exigir(
    Math.abs(suma - 1) < EPSILON_SUMA,
    `cartera.margen_por_sleeve debe sumar 1.0 (suma ${suma.toFixed(6)})`,
  );

  // El margen en reposo queda como colchón: reasignarlo está prohibido por diseño.
  exigir(
    cartera.reasignar_margen_ocioso === false,
    "cartera.reasignar_margen_ocioso debe ser false — el margen de un sleeve en reposo queda como colchón",
  );
  exigir(
    cartera.apalancar_margen_libre === false,
    "cartera.apalancar_margen_libre debe ser false — prohibido apalancar la cartera con el margen libre",
  );

  const prioridad = cartera.prioridad_cierre;
  exigir(
    Array.isArray(prioridad) && prioridad.length === SLEEVE_IDS.length,
    `cartera.prioridad_cierre debe listar los ${SLEEVE_IDS.length} sleeves`,
  );
  for (const id of SLEEVE_IDS) {
    exigir(prioridad.includes(id), `cartera.prioridad_cierre no incluye "${id}"`);
  }

  const breakers = cartera.breakers ?? {};
  const perdidaDiariaPct = fraccion(breakers.perdida_diaria_pct, "cartera.breakers.perdida_diaria_pct");
  const perdidaSemanalPct = fraccion(breakers.perdida_semanal_pct, "cartera.breakers.perdida_semanal_pct");
  exigir(
    perdidaDiariaPct > 0 && perdidaSemanalPct > 0,
    "los breakers de cartera deben ser > 0 — sin ellos no hay red de seguridad",
  );
  exigir(
    perdidaDiariaPct <= perdidaSemanalPct,
    "cartera.breakers: la pérdida diaria no puede superar a la semanal",
  );

  // --- ESMA (Tarea 5) ---
  const esmaRaw = doc.esma ?? {};
  const apalancamientoRaw = esmaRaw.apalancamiento_max ?? {};
  const clases: AssetClass[] = [
    "fx_mayor",
    "fx_menor",
    "oro",
    "indice_mayor",
    "indice_menor",
    "materia_prima",
    "cripto",
  ];
  const apalancamientoMax = {} as Record<AssetClass, number>;
  for (const clase of clases) {
    const valor = numero(apalancamientoRaw[clase], `esma.apalancamiento_max.${clase}`);
    exigir(valor >= 1, `esma.apalancamiento_max.${clase} debe ser >= 1`);
    apalancamientoMax[clase] = valor;
  }
  // Los dos topes que fija el regulador y el prompt: no pueden relajarse por config.
  exigir(apalancamientoMax.fx_mayor <= 30, "esma.apalancamiento_max.fx_mayor no puede superar 30 (1:30)");
  exigir(apalancamientoMax.oro <= 20, "esma.apalancamiento_max.oro no puede superar 20 (1:20)");

  const clasePorSimboloRaw = esmaRaw.clase_por_simbolo ?? {};
  const clasePorSimbolo: Record<string, AssetClass> = {};
  for (const [simbolo, clase] of Object.entries(clasePorSimboloRaw)) {
    exigir(
      clases.includes(clase as AssetClass),
      `esma.clase_por_simbolo.${simbolo}: clase desconocida "${String(clase)}"`,
    );
    clasePorSimbolo[simbolo] = clase as AssetClass;
  }
  exigir(
    Object.keys(clasePorSimbolo).length > 0,
    "esma.clase_por_simbolo está vacío — sin clasificación no se puede verificar el apalancamiento",
  );

  // --- Riesgo común (Tarea 5) ---
  const riesgoRaw = doc.riesgo ?? {};
  const rangoRaw = riesgoRaw.riesgo_por_trade_pct ?? {};
  const min = fraccion(rangoRaw.min, "riesgo.riesgo_por_trade_pct.min");
  const max = fraccion(rangoRaw.max, "riesgo.riesgo_por_trade_pct.max");
  exigir(min > 0, "riesgo.riesgo_por_trade_pct.min debe ser > 0");
  exigir(min <= max, "riesgo.riesgo_por_trade_pct: min no puede superar a max");
  const spreadMaxXNormal = numero(riesgoRaw.spread_max_x_normal, "riesgo.spread_max_x_normal");
  exigir(spreadMaxXNormal >= 1, "riesgo.spread_max_x_normal debe ser >= 1");
  const spreadMuestrasMinimas = numero(riesgoRaw.spread_muestras_minimas, "riesgo.spread_muestras_minimas");
  exigir(spreadMuestrasMinimas >= 1, "riesgo.spread_muestras_minimas debe ser >= 1");

  // Presupuesto diario por estrategia y tope por bloque correlacionado.
  const presRaw = riesgoRaw.presupuesto_diario_pct ?? {};
  const presupuestoDiarioPct = {
    scalping: fraccion(presRaw.scalping, "riesgo.presupuesto_diario_pct.scalping"),
    semanal: fraccion(presRaw.semanal, "riesgo.presupuesto_diario_pct.semanal"),
  };
  const topePorBloquePct = fraccion(riesgoRaw.tope_por_bloque_pct, "riesgo.tope_por_bloque_pct");
  exigir(topePorBloquePct > 0, "riesgo.tope_por_bloque_pct debe ser > 0");
  const riesgoFijoPorOperacion = numero(riesgoRaw.riesgo_fijo_por_operacion ?? 0, "riesgo.riesgo_fijo_por_operacion");
  exigir(riesgoFijoPorOperacion >= 0, "riesgo.riesgo_fijo_por_operacion no puede ser negativo");
  const objetivoR = numero(riesgoRaw.objetivo_r ?? 0, "riesgo.objetivo_r");
  exigir(objetivoR >= 0, "riesgo.objetivo_r no puede ser negativo");

  // --- Fase 1 (Tarea 7) ---
  const fase1Raw = doc.fase1 ?? {};
  const criteriosRaw = fase1Raw.criterios ?? {};
  const criterios = {} as Record<SleeveId, Fase1Criterio>;
  for (const id of SLEEVE_IDS) {
    const c = criteriosRaw[id] ?? {};
    criterios[id] = {
      expectancyMin: numero(c.expectancy_min, `fase1.criterios.${id}.expectancy_min`),
      profitFactorMin: c.profit_factor_min === undefined ? undefined : numero(c.profit_factor_min, `fase1.criterios.${id}.profit_factor_min`),
      tradesMinimos: c.trades_minimos === undefined ? undefined : numero(c.trades_minimos, `fase1.criterios.${id}.trades_minimos`),
      eventosMinimos: c.eventos_minimos === undefined ? undefined : numero(c.eventos_minimos, `fase1.criterios.${id}.eventos_minimos`),
      drawdownMaxCartera: fraccion(c.drawdown_max_cartera, `fase1.criterios.${id}.drawdown_max_cartera`),
    };
  }

  return {
    version: doc.version,
    modo: doc.modo,
    cartera: {
      margenPorSleeve,
      reasignarMargenOcioso: false,
      apalancarMargenLibre: false,
      prioridadCierre: prioridad as SleeveId[],
      breakers: { perdidaDiariaPct, perdidaSemanalPct },
    },
    esma: { apalancamientoMax, clasePorSimbolo },
    riesgo: {
      riesgoPorTradePct: { min, max },
      spreadMaxXNormal,
      spreadMuestrasMinimas,
      presupuestoDiarioPct,
      topePorBloquePct,
      riesgoFijoPorOperacion,
      objetivoR,
    },
    fase1: { semanasDemo: numero(fase1Raw.semanas_demo, "fase1.semanas_demo"), criterios },
    core: doc.core ?? {},
    intradia: doc.intradia ?? {},
    eventscalp: doc.eventscalp ?? {},
    auditoria: doc.auditoria ?? {},
  };
}

/** Ruta por defecto: `engine/config/atlas.yaml`, relativa a este módulo. */
export const RUTA_CONFIG_POR_DEFECTO = fileURLToPath(new URL("../../config/atlas.yaml", import.meta.url));

let cache: AtlasConfig | undefined;

/** Carga (y cachea) la config. `ruta` permite inyectar un fichero en tests. */
export function cargarConfig(ruta: string = RUTA_CONFIG_POR_DEFECTO): AtlasConfig {
  if (ruta === RUTA_CONFIG_POR_DEFECTO && cache) return cache;
  const config = validarConfig(parse(readFileSync(ruta, "utf8")));
  if (ruta === RUTA_CONFIG_POR_DEFECTO) cache = config;
  return config;
}
