import { describe, expect, it } from "vitest";
import { AtlasConfig, cargarConfig } from "../config/sleeveConfig";
import { carteraVacia, SleevePosition } from "../portfolio/sleeveAllocator";
import { ContextoCartera, evaluarSleeve, LimitesSleeve, SleeveSignal } from "./sleeveRiskGate";

const config = cargarConfig();

const LIMITES_CORE: LimitesSleeve = { riesgoPorTradePct: 0.005 };
const LIMITES_INTRADIA: LimitesSleeve = {
  riesgoPorTradePct: 0.005,
  tradesDiaMax: 3,
  tradesSemanaMax: 10,
  pararTrasPerdidasConsecutivas: 2,
};
const LIMITES_EVENTSCALP: LimitesSleeve = {
  riesgoPorTradePct: 0.005,
  tradesDiaMax: 2,
  tradesSemanaMax: 5,
  breakerDrawdownPct: 0.02,
};

function ctx(overrides: Partial<ContextoCartera> = {}): ContextoCartera {
  return {
    equityTotal: 10_000,
    pnlDiaCartera: 0,
    pnlSemanaCartera: 0,
    sleeves: carteraVacia(),
    fecha: "2026-08-11",
    ...overrides,
  };
}

function senal(overrides: Partial<SleeveSignal> = {}): SleeveSignal {
  return {
    sleeve: "core",
    symbol: "frxEURUSD",
    side: "buy",
    entryPrice: 1.1,
    stopPrice: 1.09,
    correlationGroup: "fx",
    ...overrides,
  };
}

function posicion(sleeve: SleevePosition["sleeve"], symbol: string, side: "buy" | "sell", riskAmount: number): SleevePosition {
  return {
    id: `${sleeve}-${symbol}`,
    symbol,
    side,
    size: 1,
    entryPrice: 1.1,
    stopPrice: 1.09,
    riskAmount,
    correlationGroup: "fx",
    sleeve,
  };
}

describe("sleeveRiskGate · sizing sobre el capital del sleeve", () => {
  it("dimensiona con el capital del SLEEVE, no con el equity total", () => {
    // Core = 40% de 10.000 = 4.000. Riesgo 0,5% -> 20 USD (no 50).
    const decision = evaluarSleeve(config, ctx(), senal(), LIMITES_CORE);
    expect(decision.approved).toBe(true);
    if (decision.approved) expect(decision.order.riskAmount).toBeCloseTo(20, 9);
  });

  it("dos sleeves con la misma señal reciben riesgo distinto según su margen", () => {
    const core = evaluarSleeve(config, ctx(), senal({ sleeve: "core" }), LIMITES_CORE);
    const intradia = evaluarSleeve(config, ctx(), senal({ sleeve: "intradia", symbol: "frxGBPUSD" }), LIMITES_INTRADIA);
    expect(core.approved && intradia.approved).toBe(true);
    if (core.approved && intradia.approved) {
      expect(core.order.riskAmount).toBeCloseTo(20, 9); // 0,5% de 4.000
      expect(intradia.order.riskAmount).toBeCloseTo(15, 9); // 0,5% de 3.000
    }
  });

  it("acota el riesgo por trade al rango del YAML aunque el sleeve pida más", () => {
    const decision = evaluarSleeve(config, ctx(), senal(), { riesgoPorTradePct: 0.5 });
    expect(decision.approved).toBe(true);
    if (decision.approved) expect(decision.order.riskAmount).toBeCloseTo(4_000 * 0.005, 9);
  });

  it("el vol-target reduce el riesgo proporcionalmente y nunca lo amplifica", () => {
    const reducido = evaluarSleeve(config, ctx(), senal({ escalaVolTarget: 0.5 }), LIMITES_CORE);
    expect(reducido.approved).toBe(true);
    if (reducido.approved) expect(reducido.order.riskAmount).toBeCloseTo(10, 9);

    const amplificado = evaluarSleeve(config, ctx(), senal({ escalaVolTarget: 3 }), LIMITES_CORE);
    expect(amplificado.approved).toBe(true);
    if (amplificado.approved) expect(amplificado.order.riskAmount).toBeCloseTo(20, 9);
  });

  it("rechaza si el presupuesto del sleeve está agotado, aunque sobre margen en la cartera", () => {
    const sleeves = carteraVacia();
    sleeves.eventscalp.openPositions.push(posicion("eventscalp", "frxGBPUSD", "buy", 3_000));
    const decision = evaluarSleeve(
      config,
      ctx({ sleeves }),
      senal({ sleeve: "eventscalp" }),
      LIMITES_EVENTSCALP,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("presupuesto_sleeve_agotado");
  });
});

describe("sleeveRiskGate · breakers", () => {
  it("una pérdida del 2% en el día para TODA la cartera", () => {
    const decision = evaluarSleeve(config, ctx({ pnlDiaCartera: -200 }), senal(), LIMITES_CORE);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("breaker_cartera_diario");
  });

  it("una pérdida del 5% en la semana para TODA la cartera", () => {
    const decision = evaluarSleeve(config, ctx({ pnlSemanaCartera: -500 }), senal(), LIMITES_CORE);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("breaker_cartera_semanal");
  });

  it("justo por debajo del umbral diario deja operar", () => {
    const decision = evaluarSleeve(config, ctx({ pnlDiaCartera: -199.99 }), senal(), LIMITES_CORE);
    expect(decision.approved).toBe(true);
  });

  it("Intradía para tras dos pérdidas consecutivas en el día", () => {
    const sleeves = carteraVacia();
    sleeves.intradia.perdidasConsecutivasHoy = 2;
    const decision = evaluarSleeve(config, ctx({ sleeves }), senal({ sleeve: "intradia" }), LIMITES_INTRADIA);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("breaker_sleeve_perdidas_consecutivas");
  });

  it("EventScalp para al perder el 2% de SU capital, no el de la cartera", () => {
    const sleeves = carteraVacia();
    sleeves.eventscalp.pnlDia = -60; // 2% de 3.000
    const decision = evaluarSleeve(
      config,
      ctx({ sleeves, pnlDiaCartera: -60 }), // -0,6% de cartera: el breaker global NO salta
      senal({ sleeve: "eventscalp" }),
      LIMITES_EVENTSCALP,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("breaker_sleeve_drawdown");
  });

  it("el breaker de un sleeve no bloquea a los demás", () => {
    const sleeves = carteraVacia();
    sleeves.intradia.perdidasConsecutivasHoy = 2;
    const decision = evaluarSleeve(config, ctx({ sleeves }), senal({ sleeve: "core" }), LIMITES_CORE);
    expect(decision.approved).toBe(true);
  });

  it("respeta los topes de operaciones por día y por semana", () => {
    const porDia = carteraVacia();
    porDia.intradia.tradesHoy = 3;
    const dia = evaluarSleeve(config, ctx({ sleeves: porDia }), senal({ sleeve: "intradia" }), LIMITES_INTRADIA);
    expect(dia.approved).toBe(false);
    if (!dia.approved) expect(dia.reason).toBe("limite_trades_dia");

    const porSemana = carteraVacia();
    porSemana.intradia.tradesSemana = 10;
    const semana = evaluarSleeve(config, ctx({ sleeves: porSemana }), senal({ sleeve: "intradia" }), LIMITES_INTRADIA);
    expect(semana.approved).toBe(false);
    if (!semana.approved) expect(semana.reason).toBe("limite_trades_semana");
  });

  it("respeta una pausa vigente y deja operar cuando expira", () => {
    const sleeves = carteraVacia();
    sleeves.intradia.pausadoHasta = "2026-08-12";
    const pausado = evaluarSleeve(
      config,
      ctx({ sleeves, fecha: "2026-08-11" }),
      senal({ sleeve: "intradia" }),
      LIMITES_INTRADIA,
    );
    expect(pausado.approved).toBe(false);
    if (!pausado.approved) expect(pausado.reason).toBe("sleeve_pausado");

    const expirada = evaluarSleeve(
      config,
      ctx({ sleeves, fecha: "2026-08-12" }),
      senal({ sleeve: "intradia" }),
      LIMITES_INTRADIA,
    );
    expect(expirada.approved).toBe(true);
  });
});

describe("sleeveRiskGate · reglas de señal", () => {
  it("impide la reentrada al mismo setup el mismo día", () => {
    const sleeves = carteraVacia();
    sleeves.intradia.setupsUsadosHoy.push("orb:frxEURUSD:londres");
    const decision = evaluarSleeve(
      config,
      ctx({ sleeves }),
      senal({ sleeve: "intradia", setupId: "orb:frxEURUSD:londres" }),
      LIMITES_INTRADIA,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("reentrada_mismo_setup");
  });

  it("deja pasar un setup distinto sobre el mismo activo", () => {
    const sleeves = carteraVacia();
    sleeves.intradia.setupsUsadosHoy.push("orb:frxEURUSD:londres");
    const decision = evaluarSleeve(
      config,
      ctx({ sleeves }),
      senal({ sleeve: "intradia", setupId: "orb:frxEURUSD:ny" }),
      LIMITES_INTRADIA,
    );
    expect(decision.approved).toBe(true);
  });

  it("bloquea la señal que solaparía con otro sleeve en la misma dirección", () => {
    const sleeves = carteraVacia();
    sleeves.core.openPositions.push(posicion("core", "frxEURUSD", "buy", 20));
    const decision = evaluarSleeve(
      config,
      ctx({ sleeves }),
      senal({ sleeve: "intradia", side: "buy" }),
      LIMITES_INTRADIA,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("solapamiento_con_otro_sleeve");
  });

  it("rechaza un spread por encima de 1,5x el normal", () => {
    const decision = evaluarSleeve(
      config,
      ctx(),
      senal({ spreadActual: 1.6, spreadNormal: 1, spreadMuestras: 50 }),
      LIMITES_CORE,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("spread_excesivo");
  });

  it("acepta un spread justo en el límite de 1,5x", () => {
    const decision = evaluarSleeve(
      config,
      ctx(),
      senal({ spreadActual: 1.5, spreadNormal: 1, spreadMuestras: 50 }),
      LIMITES_CORE,
    );
    expect(decision.approved).toBe(true);
  });

  it("rechaza si no hay muestras suficientes para conocer el spread normal", () => {
    const decision = evaluarSleeve(
      config,
      ctx(),
      senal({ spreadActual: 1, spreadNormal: 1, spreadMuestras: 5 }),
      LIMITES_CORE,
    );
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("spread_sin_referencia");
  });

  it("rechaza un stop pegado al precio de entrada", () => {
    const decision = evaluarSleeve(config, ctx(), senal({ stopPrice: 1.1 }), LIMITES_CORE);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("stop_invalido");
  });
});

describe("sleeveRiskGate · ESMA", () => {
  it("recorta el tamaño al máximo legal en vez de descartar la señal", () => {
    // Stop muy pegado -> el sizing por riesgo pediría un nocional enorme.
    // Core = 4.000 y FX mayor 1:30 -> nocional máximo 120.000.
    const decision = evaluarSleeve(
      config,
      ctx(),
      senal({ entryPrice: 1.1, stopPrice: 1.09999 }),
      LIMITES_CORE,
    );
    expect(decision.approved).toBe(true);
    if (decision.approved) {
      expect(decision.order.nocional).toBeLessThanOrEqual(4_000 * 30 + 1e-6);
      expect(decision.order.apalancamientoUsado).toBeLessThanOrEqual(30 + 1e-9);
      // Y el riesgo real queda POR DEBAJO del pedido, no por encima.
      expect(decision.order.riskAmount).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  it("rechaza un símbolo que no está clasificado en el YAML", () => {
    const decision = evaluarSleeve(config, ctx(), senal({ symbol: "frxXXXYYY" }), LIMITES_CORE);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("esma_simbolo_sin_clasificar");
  });

  it("aplica a cripto el tramo 1:2 sobre el capital del sleeve", () => {
    const decision = evaluarSleeve(
      config,
      ctx(),
      senal({ symbol: "cryBTCUSD", entryPrice: 60_000, stopPrice: 59_000 }),
      LIMITES_CORE,
    );
    expect(decision.approved).toBe(true);
    if (decision.approved) expect(decision.order.apalancamientoUsado).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe("sleeveRiskGate · restricciones duras", () => {
  it("no aprueba ninguna orden si el modo no es demo", () => {
    const enReal: AtlasConfig = { ...config, modo: "real" };
    const decision = evaluarSleeve(enReal, ctx(), senal(), LIMITES_CORE);
    expect(decision.approved).toBe(false);
    if (!decision.approved) expect(decision.reason).toBe("modo_no_demo");
  });

  it("el breaker de cartera manda sobre cualquier señal del sleeve que sea", () => {
    for (const sleeve of ["core", "intradia", "eventscalp"] as const) {
      const decision = evaluarSleeve(
        config,
        ctx({ pnlDiaCartera: -250 }),
        senal({ sleeve, symbol: "frxEURUSD" }),
        LIMITES_CORE,
      );
      expect(decision.approved).toBe(false);
    }
  });
});
