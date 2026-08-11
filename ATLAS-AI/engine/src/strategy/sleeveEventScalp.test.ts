import { describe, expect, it } from "vitest";
import { cargarConfig } from "../config/sleeveConfig";
import { Vela } from "../domain/bars";
import {
  CalendarioManual,
  ContextoEvento,
  calendarioDesdeConfig,
  coincideConOtro,
  confirmaMomentum,
  enVentanaEntrada,
  esOperable,
  EventoMacro,
  EventScalpParams,
  evaluarEvento,
  objetivoEventScalp,
  paramsEventScalpDesdeConfig,
  puntuarSorpresa,
} from "./sleeveEventScalp";

const PARAMS: EventScalpParams = {
  correlationGroup: "fx",
  eventosPermitidos: ["CPI", "NFP", "FOMC", "ECB", "BOE", "PIB", "PMI_FLASH"],
  impactoMinimo: 3,
  esperaMinSeg: 60,
  esperaMaxSeg: 120,
  momentumVentanaSeg: 30,
  momentumMinAtr: 0.3,
  stopAtr: 0.5,
  tpR: 1.2,
  puntuacionMinima: 0.05,
  noOperarSiCoinciden: true,
  coincidenciaVentanaMin: 30,
  atrPeriodo: 14,
};

const PUBLICACION = 1_700_000_000;

function evento(overrides: Partial<EventoMacro> = {}): EventoMacro {
  return {
    id: "cpi-1",
    tipo: "CPI",
    epoch: PUBLICACION,
    impacto: 3,
    symbol: "frxEURUSD",
    actual: 3.3, // sorpresa relativa 0,10 — realista y por encima del umbral
    consenso: 3.0,
    signoEfecto: 1,
    ...overrides,
  };
}

/** Velas con recorrido constante -> ATR = 0.002. */
function velas(): Vela[] {
  return Array.from({ length: 40 }, (_, i) => ({
    epoch: PUBLICACION - (40 - i) * 300,
    open: 1.1,
    high: 1.101,
    low: 1.099,
    close: 1.1,
  }));
}

const ATR = 0.002;

function ctx(overrides: Partial<ContextoEvento> = {}): ContextoEvento {
  return {
    ahoraEpoch: PUBLICACION + 90,
    precioPublicacion: 1.1,
    precioActual: 1.1 + ATR * 0.5, // supera el umbral de 0,3 ATR
    ...overrides,
  };
}

describe("sleeveEventScalp · puntuación de la sorpresa", () => {
  it("puntúa por desvío relativo al consenso", () => {
    const s = puntuarSorpresa(evento({ actual: 3.6, consenso: 3.0 }));
    expect(s!.puntuacion).toBeCloseTo(0.2, 9);
    expect(s!.side).toBe("buy");
  });

  it("un dato por debajo del consenso invierte la dirección", () => {
    expect(puntuarSorpresa(evento({ actual: 2.4, consenso: 3.0 }))!.side).toBe("sell");
  });

  it("el signo del efecto invierte la lectura cuando el indicador es inverso", () => {
    const s = puntuarSorpresa(evento({ actual: 3.6, consenso: 3.0, signoEfecto: -1 }));
    expect(s!.side).toBe("sell");
    expect(s!.puntuacion).toBeCloseTo(0.2, 9);
  });

  it("sin dato o sin consenso no hay sorpresa medible", () => {
    expect(puntuarSorpresa(evento({ actual: undefined }))).toBeNull();
    expect(puntuarSorpresa(evento({ consenso: undefined }))).toBeNull();
  });

  it("un dato exactamente en consenso no genera señal", () => {
    expect(puntuarSorpresa(evento({ actual: 3.0, consenso: 3.0 }))).toBeNull();
  });

  it("un consenso de 0 se descarta en vez de dividir por cero", () => {
    expect(puntuarSorpresa(evento({ actual: 1, consenso: 0 }))).toBeNull();
  });
});

describe("sleeveEventScalp · filtros de evento", () => {
  it("solo opera eventos de alto impacto de la lista permitida", () => {
    expect(esOperable(evento(), PARAMS)).toBe(true);
    expect(esOperable(evento({ impacto: 2 }), PARAMS)).toBe(false);
    expect(esOperable(evento({ tipo: "PMI_FLASH" }), PARAMS)).toBe(true);
    expect(esOperable(evento({ tipo: "OTRO" as any }), PARAMS)).toBe(false);
  });

  it("no opera si dos eventos de alto impacto coinciden", () => {
    const a = evento({ id: "cpi-1" });
    const b = evento({ id: "nfp-1", tipo: "NFP", epoch: PUBLICACION + 600 });
    expect(coincideConOtro(a, [a, b], PARAMS)).toBe(true);
  });

  it("un evento lejano en el tiempo no cuenta como coincidencia", () => {
    const a = evento({ id: "cpi-1" });
    const b = evento({ id: "nfp-1", tipo: "NFP", epoch: PUBLICACION + 3 * 3600 });
    expect(coincideConOtro(a, [a, b], PARAMS)).toBe(false);
  });

  it("un evento de bajo impacto cercano no bloquea la operación", () => {
    const a = evento({ id: "cpi-1" });
    const b = evento({ id: "menor", tipo: "PIB", epoch: PUBLICACION + 300, impacto: 1 });
    expect(coincideConOtro(a, [a, b], PARAMS)).toBe(false);
  });
});

describe("sleeveEventScalp · ventana de entrada", () => {
  it("no entra en el instante de la publicación: ahí el spread está roto", () => {
    expect(enVentanaEntrada(evento(), PUBLICACION, PARAMS)).toBe(false);
    expect(enVentanaEntrada(evento(), PUBLICACION + 30, PARAMS)).toBe(false);
  });

  it("entra entre 60 y 120 segundos después", () => {
    expect(enVentanaEntrada(evento(), PUBLICACION + 60, PARAMS)).toBe(true);
    expect(enVentanaEntrada(evento(), PUBLICACION + 120, PARAMS)).toBe(true);
  });

  it("no entra pasada la ventana", () => {
    expect(enVentanaEntrada(evento(), PUBLICACION + 121, PARAMS)).toBe(false);
  });
});

describe("sleeveEventScalp · momentum", () => {
  it("confirma un movimiento suficiente en la dirección de la sorpresa", () => {
    expect(confirmaMomentum(1.1, 1.1 + ATR * 0.4, "buy", ATR, PARAMS)).toBe(true);
  });

  it("no confirma un movimiento demasiado pequeño", () => {
    expect(confirmaMomentum(1.1, 1.1 + ATR * 0.2, "buy", ATR, PARAMS)).toBe(false);
  });

  it("NO confirma un movimiento fuerte en dirección contraria a la sorpresa", () => {
    // El mercado leyó otra cosa: se descarta en vez de perseguirlo.
    expect(confirmaMomentum(1.1, 1.1 - ATR * 2, "buy", ATR, PARAMS)).toBe(false);
  });

  it("con ATR nulo no confirma nada", () => {
    expect(confirmaMomentum(1.1, 1.2, "buy", 0, PARAMS)).toBe(false);
  });
});

describe("sleeveEventScalp · decisión completa", () => {
  const todos = [evento()];

  it("produce una señal etiquetada como eventscalp", () => {
    const r = evaluarEvento(evento(), todos, velas(), 39, ctx(), PARAMS);
    expect(r.operar).toBe(true);
    if (r.operar) {
      expect(r.signal.sleeve).toBe("eventscalp");
      expect(r.signal.side).toBe("buy");
      expect(r.signal.setupId).toBe("evento:cpi-1");
      expect(r.signal.stopPrice).toBeLessThan(r.signal.entryPrice);
    }
  });

  it("el stop queda a 0,5 ATR de la entrada", () => {
    const r = evaluarEvento(evento(), todos, velas(), 39, ctx(), PARAMS);
    expect(r.operar).toBe(true);
    if (r.operar) {
      const distancia = Math.abs(r.signal.entryPrice - r.signal.stopPrice);
      expect(distancia).toBeCloseTo(ATR * 0.5, 9);
    }
  });

  it("descarta con el motivo exacto en cada filtro", () => {
    const casos: Array<[Partial<EventoMacro>, Partial<ContextoEvento>, string]> = [
      [{ impacto: 1 }, {}, "no_operable"],
      [{}, { ahoraEpoch: PUBLICACION + 10 }, "fuera_de_ventana"],
      [{ actual: undefined }, {}, "sorpresa_no_medible"],
      [{ actual: 3.01, consenso: 3.0 }, {}, "sorpresa_insuficiente"],
      [{}, { precioActual: 1.1 }, "momentum_no_confirma"],
    ];
    for (const [ev, contexto, esperado] of casos) {
      const r = evaluarEvento(evento(ev), [evento(ev)], velas(), 39, ctx(contexto), PARAMS);
      expect(r.operar).toBe(false);
      if (!r.operar) expect(r.motivo).toBe(esperado);
    }
  });

  it("propaga el spread para que el gate aplique la regla de 1,5x", () => {
    const r = evaluarEvento(
      evento(),
      todos,
      velas(),
      39,
      ctx({ spreadActual: 1.2, spreadNormal: 1, spreadMuestras: 40 }),
      PARAMS,
    );
    expect(r.operar).toBe(true);
    if (r.operar) {
      expect(r.signal.spreadActual).toBe(1.2);
      expect(r.signal.spreadMuestras).toBe(40);
    }
  });

  it("sitúa el objetivo a 1,2R", () => {
    const r = evaluarEvento(evento(), todos, velas(), 39, ctx(), PARAMS);
    expect(r.operar).toBe(true);
    if (r.operar) {
      const distancia = Math.abs(r.signal.entryPrice - r.signal.stopPrice);
      expect(objetivoEventScalp(r.signal, 1.2)).toBeCloseTo(r.signal.entryPrice + distancia * 1.2, 9);
    }
  });
});

describe("sleeveEventScalp · calendario", () => {
  it("filtra por ventana temporal", () => {
    const cal = new CalendarioManual([
      evento({ id: "a", epoch: 1000 }),
      evento({ id: "b", epoch: 2000 }),
      evento({ id: "c", epoch: 3000 }),
    ]);
    expect(cal.eventos(1000, 3000).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("construye el calendario desde el YAML y valida el signo del efecto", () => {
    const cal = calendarioDesdeConfig({
      sorpresa: {
        eventos_programados: [
          { id: "cpi-ago", tipo: "CPI", epoch: PUBLICACION, symbol: "frxEURUSD", signo_efecto: -1, consenso: 3, actual: 3.4 },
        ],
      },
    });
    const eventos = cal.eventos(PUBLICACION - 1, PUBLICACION + 1);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.signoEfecto).toBe(-1);
  });

  it("rechaza un evento del YAML sin epoch o con signo inválido", () => {
    expect(() =>
      calendarioDesdeConfig({ sorpresa: { eventos_programados: [{ tipo: "CPI", symbol: "x", signo_efecto: 1 }] } }),
    ).toThrow(/epoch/);
    expect(() =>
      calendarioDesdeConfig({ sorpresa: { eventos_programados: [{ tipo: "CPI", epoch: 1, symbol: "x", signo_efecto: 0 }] } }),
    ).toThrow(/signo_efecto/);
  });

  it("el atlas.yaml desplegado arranca sin eventos programados", () => {
    const cal = calendarioDesdeConfig(cargarConfig().eventscalp as Record<string, any>);
    expect(cal.eventos(0, 9_999_999_999)).toEqual([]);
  });
});

describe("sleeveEventScalp · lectura del YAML", () => {
  it("lee los parámetros del atlas.yaml desplegado", () => {
    const { params, activo, limites } = paramsEventScalpDesdeConfig(
      cargarConfig().eventscalp as Record<string, any>,
      "macro",
    );
    expect(activo).toBe(true);
    expect(params.esperaMinSeg).toBe(60);
    expect(params.esperaMaxSeg).toBe(120);
    expect(params.stopAtr).toBe(0.5);
    expect(params.tpR).toBe(1.2);
    expect(params.eventosPermitidos).toContain("CPI");
    expect(limites.eventos_dia_max).toBe(2);
    expect(limites.eventos_semana_max).toBe(5);
  });
});
