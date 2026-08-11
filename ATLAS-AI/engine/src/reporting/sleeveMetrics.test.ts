import { describe, expect, it } from "vitest";
import { SleeveTrade } from "../audit/sleeveTrade";
import { cargarConfig, SleeveId } from "../config/sleeveConfig";
import {
  calcularMetricas,
  checklistFase1,
  drawdownMaximo,
  evaluarChecklist,
  metricasCartera,
  tradesEvaluables,
} from "./sleeveMetrics";
import { construirResumen } from "./weeklySummary";

const config = cargarConfig();

let contador = 0;
function trade(sleeve: SleeveId, pnl: number | undefined, overrides: Partial<SleeveTrade> = {}): SleeveTrade {
  contador++;
  return {
    id: `t${contador}`,
    sleeve,
    symbol: "frxEURUSD",
    side: "buy",
    abiertoEn: `2026-08-${String(10 + (contador % 20)).padStart(2, "0")}T08:00:00.000Z`,
    cerradoEn: pnl === undefined ? undefined : `2026-08-${String(10 + (contador % 20)).padStart(2, "0")}T12:00:00.000Z`,
    precioEntrada: 1.1,
    precioSalida: 1.11,
    size: 1000,
    riskAmount: 20,
    nocional: 1100,
    apalancamientoUsado: 0.275,
    pnl,
    simulada: false,
    ...overrides,
  };
}

describe("sleeveMetrics · filtrado", () => {
  it("excluye las operaciones abiertas y las simuladas", () => {
    const trades = [
      trade("core", 10),
      trade("core", undefined), // abierta
      trade("core", 10, { simulada: true }), // dry-run
    ];
    expect(tradesEvaluables(trades)).toHaveLength(1);
  });
});

describe("sleeveMetrics · cálculo", () => {
  it("calcula win rate, expectancy y profit factor", () => {
    // 3 ganadoras de +30 y 2 perdedoras de -20 -> PF = 90/40 = 2.25
    const trades = [
      trade("intradia", 30),
      trade("intradia", 30),
      trade("intradia", 30),
      trade("intradia", -20),
      trade("intradia", -20),
    ];
    const m = calcularMetricas("intradia", trades, 10_000);
    expect(m.trades).toBe(5);
    expect(m.winRate).toBeCloseTo(0.6, 9);
    expect(m.expectancy).toBeCloseTo(10, 9);
    expect(m.profitFactor).toBeCloseTo(2.25, 9);
    expect(m.pnlTotal).toBeCloseTo(50, 9);
  });

  it("expresa la expectancy en R usando el riesgo asumido", () => {
    const m = calcularMetricas("core", [trade("core", 40, { riskAmount: 20 })], 10_000);
    expect(m.expectancyR).toBeCloseTo(2, 9);
  });

  it("no mezcla operaciones de otros sleeves", () => {
    const trades = [trade("core", 100), trade("intradia", -50)];
    expect(calcularMetricas("core", trades, 10_000).pnlTotal).toBeCloseTo(100, 9);
    expect(calcularMetricas("intradia", trades, 10_000).pnlTotal).toBeCloseTo(-50, 9);
  });

  it("sin pérdidas el profit factor es infinito, no cero", () => {
    const m = calcularMetricas("core", [trade("core", 10), trade("core", 20)], 10_000);
    expect(m.profitFactor).toBe(Number.POSITIVE_INFINITY);
  });

  it("sin operaciones devuelve ceros en vez de NaN", () => {
    const m = calcularMetricas("core", [], 10_000);
    expect(m.trades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.expectancy).toBe(0);
    expect(Number.isNaN(m.expectancyR)).toBe(false);
  });

  it("promedia spread y slippage cuando están registrados", () => {
    const trades = [
      trade("intradia", 10, { spreadEntrada: 0.0001, slippage: 0.00002 }),
      trade("intradia", 10, { spreadEntrada: 0.0003, slippage: 0.00004 }),
    ];
    const m = calcularMetricas("intradia", trades, 10_000);
    expect(m.spreadMedio).toBeCloseTo(0.0002, 12);
    expect(m.slippageMedio).toBeCloseTo(0.00003, 12);
  });

  it("deja spread en null si nadie lo registró", () => {
    expect(calcularMetricas("core", [trade("core", 10)], 10_000).spreadMedio).toBeNull();
  });

  it("agrega los tres sleeves en la ficha de cartera", () => {
    const trades = [trade("core", 100), trade("intradia", -30), trade("eventscalp", 20)];
    expect(metricasCartera(trades, 10_000).pnlTotal).toBeCloseTo(90, 9);
    expect(metricasCartera(trades, 10_000).trades).toBe(3);
  });
});

describe("sleeveMetrics · drawdown", () => {
  it("mide la peor caída desde un pico de la curva acumulada", () => {
    // Curva: 100, 60, 160 -> pico 100, valle 60 -> caída 40
    expect(drawdownMaximo([100, -40, 100])).toBeCloseTo(40, 9);
  });

  it("una serie solo ganadora no tiene caída", () => {
    expect(drawdownMaximo([10, 20, 30])).toBe(0);
  });

  it("cuenta la caída desde el arranque si se empieza perdiendo", () => {
    expect(drawdownMaximo([-50, -30])).toBeCloseTo(80, 9);
  });

  it("expresa la caída como fracción del equity de referencia", () => {
    const trades = [trade("core", 100), trade("core", -400)];
    expect(calcularMetricas("core", trades, 10_000).drawdownMaxPct).toBeCloseTo(0.04, 9);
  });
});

describe("sleeveMetrics · checklist de Fase 1", () => {
  it("marca muestra insuficiente en vez de fracaso cuando faltan operaciones", () => {
    const metricas = calcularMetricas("intradia", [trade("intradia", -10)], 10_000);
    const check = evaluarChecklist("intradia", metricas, config.fase1.criterios.intradia);
    expect(check.pasa).toBe(false);
    expect(check.criterios.every((c) => c.estado !== "no_cumple")).toBe(true);
    expect(check.criterios[0]!.estado).toBe("muestra_insuficiente");
  });

  it("un sleeve con muestra suficiente y buenas cifras pasa", () => {
    const trades = Array.from({ length: 45 }, (_, i) => trade("intradia", i % 3 === 0 ? -20 : 30));
    const metricas = calcularMetricas("intradia", trades, 1_000_000);
    const check = evaluarChecklist("intradia", metricas, config.fase1.criterios.intradia);
    expect(metricas.trades).toBe(45);
    expect(check.pasa).toBe(true);
  });

  it("un sleeve con muestra suficiente y expectancy negativa NO pasa", () => {
    const trades = Array.from({ length: 45 }, (_, i) => trade("intradia", i % 3 === 0 ? 10 : -20));
    const metricas = calcularMetricas("intradia", trades, 1_000_000);
    const check = evaluarChecklist("intradia", metricas, config.fase1.criterios.intradia);
    expect(check.pasa).toBe(false);
    expect(check.criterios.some((c) => c.estado === "no_cumple")).toBe(true);
  });

  it("el drawdown excesivo tumba el sleeve aunque la expectancy sea positiva", () => {
    // Gran caída inicial y recuperación: expectancy > 0 pero DD > 10%.
    // Los cierres deben ir en orden creciente: el drawdown se mide sobre la
    // secuencia temporal real, no sobre el orden en que se listen aquí.
    const enOrden = (i: number, pnl: number) =>
      trade("intradia", pnl, {
        cerradoEn: `2026-08-11T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00.000Z`,
      });
    const trades = [
      ...Array.from({ length: 20 }, (_, i) => enOrden(i, -100)),
      ...Array.from({ length: 25 }, (_, i) => enOrden(20 + i, 200)),
    ];
    const metricas = calcularMetricas("intradia", trades, 10_000);
    const check = evaluarChecklist("intradia", metricas, config.fase1.criterios.intradia);
    expect(metricas.expectancy).toBeGreaterThan(0);
    expect(check.criterios.find((c) => c.criterio.startsWith("Drawdown"))!.estado).toBe("no_cumple");
    expect(check.pasa).toBe(false);
  });

  it("EventScalp se mide por eventos mínimos, no por operaciones", () => {
    const check = evaluarChecklist(
      "eventscalp",
      calcularMetricas("eventscalp", [], 10_000),
      config.fase1.criterios.eventscalp,
    );
    expect(check.criterios[0]!.criterio).toBe("Eventos mínimos");
    expect(check.criterios[0]!.objetivo).toBe(">= 20");
  });

  it("un sleeve que falla no arrastra a los demás", () => {
    const trades = [
      ...Array.from({ length: 45 }, (_, i) => trade("intradia", i % 3 === 0 ? 10 : -20)), // malo
      trade("core", 500), // bueno
    ];
    const { sleeves } = checklistFase1(config, trades, 1_000_000);
    const intradia = sleeves.find((s) => s.sleeve === "intradia")!;
    const core = sleeves.find((s) => s.sleeve === "core")!;
    expect(intradia.pasa).toBe(false);
    expect(core.pasa).toBe(true);
  });
});

describe("weeklySummary", () => {
  it("incluye los tres sleeves, la cartera y el aviso de demo", () => {
    const trades = [trade("core", 50), trade("intradia", -20), trade("eventscalp", 15)];
    const { texto } = construirResumen(config, trades, 10_000, "2026-08-04", "2026-08-10");
    expect(texto).toContain("Core (tendencia)");
    expect(texto).toContain("Intradía (breakout)");
    expect(texto).toContain("EventScalp (macro)");
    expect(texto).toContain("Cartera completa");
    expect(texto).toContain("Cuenta demo");
    expect(texto).toContain("no es asesoramiento financiero");
  });

  it("dice claramente cuando ningún sleeve cumple todavía", () => {
    const { texto } = construirResumen(config, [], 10_000, "2026-08-04", "2026-08-10");
    expect(texto).toContain("Ningún sleeve cumple todavía");
  });

  it("no maquilla una semana mala", () => {
    const trades = Array.from({ length: 45 }, () => trade("intradia", -50));
    const { texto } = construirResumen(config, trades, 10_000, "2026-08-04", "2026-08-10");
    expect(texto).toContain("❌");
  });
});
