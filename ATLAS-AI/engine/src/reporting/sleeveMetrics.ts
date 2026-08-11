import { SleeveTrade } from "../audit/sleeveTrade";
import { AtlasConfig, Fase1Criterio, SleeveId, SLEEVE_IDS } from "../config/sleeveConfig";

/**
 * Métricas por sleeve y de cartera (Tareas 6 y 7 de 27_SCALPING/04).
 *
 * Todo se calcula sobre operaciones CERRADAS y NO simuladas: una posición
 * abierta no tiene resultado, y contar dry-runs inflaría la muestra con
 * operaciones que nunca pagaron un spread.
 *
 * Nota sobre la expectancy: se reporta en moneda y en R (múltiplos del riesgo
 * asumido). La de moneda es la que se siente; la de R es la comparable entre
 * sleeves, porque cada uno arriesga sobre un capital distinto.
 */

export interface MetricasSleeve {
  sleeve: SleeveId;
  trades: number;
  ganadoras: number;
  perdedoras: number;
  winRate: number;
  /** Media de P&L por operación, en moneda de cuenta. */
  expectancy: number;
  /** Media de P&L por operación en múltiplos del riesgo asumido. */
  expectancyR: number;
  profitFactor: number;
  pnlTotal: number;
  /** Máxima caída de la curva acumulada, en moneda. */
  drawdownMax: number;
  /** La misma caída como fracción del equity de referencia. */
  drawdownMaxPct: number;
  spreadMedio: number | null;
  slippageMedio: number | null;
}

/** `profitFactor` cuando no hubo ninguna pérdida: infinito no es informativo. */
const PF_SIN_PERDIDAS = Number.POSITIVE_INFINITY;

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

/** Operaciones que cuentan para la Fase 1: cerradas, reales y con P&L. */
export function tradesEvaluables(trades: SleeveTrade[]): SleeveTrade[] {
  return trades.filter((t) => !t.simulada && t.cerradoEn !== undefined && typeof t.pnl === "number");
}

/**
 * Máxima caída de la curva de P&L acumulado. Se mide sobre el orden temporal
 * de cierre: reordenar las operaciones cambiaría el resultado.
 */
export function drawdownMaximo(pnls: number[]): number {
  let acumulado = 0;
  let pico = 0;
  let peor = 0;
  for (const pnl of pnls) {
    acumulado += pnl;
    if (acumulado > pico) pico = acumulado;
    const caida = pico - acumulado;
    if (caida > peor) peor = caida;
  }
  return peor;
}

export function calcularMetricas(
  sleeve: SleeveId,
  trades: SleeveTrade[],
  equityReferencia: number,
): MetricasSleeve {
  const evaluables = tradesEvaluables(trades)
    .filter((t) => t.sleeve === sleeve)
    .sort((a, b) => (a.cerradoEn! < b.cerradoEn! ? -1 : 1));

  const pnls = evaluables.map((t) => t.pnl!);
  const ganadoras = pnls.filter((p) => p > 0);
  const perdedoras = pnls.filter((p) => p < 0);

  const sumaGanancias = ganadoras.reduce((s, p) => s + p, 0);
  const sumaPerdidas = Math.abs(perdedoras.reduce((s, p) => s + p, 0));
  const pnlTotal = pnls.reduce((s, p) => s + p, 0);

  const rMultiples = evaluables
    .filter((t) => t.riskAmount > 0)
    .map((t) => t.pnl! / t.riskAmount);

  const dd = drawdownMaximo(pnls);

  return {
    sleeve,
    trades: evaluables.length,
    ganadoras: ganadoras.length,
    perdedoras: perdedoras.length,
    winRate: evaluables.length > 0 ? ganadoras.length / evaluables.length : 0,
    expectancy: evaluables.length > 0 ? pnlTotal / evaluables.length : 0,
    expectancyR: media(rMultiples) ?? 0,
    profitFactor: sumaPerdidas > 0 ? sumaGanancias / sumaPerdidas : ganadoras.length > 0 ? PF_SIN_PERDIDAS : 0,
    pnlTotal,
    drawdownMax: dd,
    drawdownMaxPct: equityReferencia > 0 ? dd / equityReferencia : 0,
    spreadMedio: media(evaluables.map((t) => t.spreadEntrada).filter((v): v is number => typeof v === "number")),
    slippageMedio: media(evaluables.map((t) => t.slippage).filter((v): v is number => typeof v === "number")),
  };
}

/** Métricas agregadas de la cartera entera (los tres sleeves juntos). */
export function metricasCartera(trades: SleeveTrade[], equityReferencia: number): MetricasSleeve {
  const evaluables = tradesEvaluables(trades).sort((a, b) => (a.cerradoEn! < b.cerradoEn! ? -1 : 1));
  const pnls = evaluables.map((t) => t.pnl!);
  const ganadoras = pnls.filter((p) => p > 0);
  const perdedoras = pnls.filter((p) => p < 0);
  const sumaGanancias = ganadoras.reduce((s, p) => s + p, 0);
  const sumaPerdidas = Math.abs(perdedoras.reduce((s, p) => s + p, 0));
  const pnlTotal = pnls.reduce((s, p) => s + p, 0);
  const rMultiples = evaluables.filter((t) => t.riskAmount > 0).map((t) => t.pnl! / t.riskAmount);
  const dd = drawdownMaximo(pnls);

  return {
    sleeve: "core", // marcador: la ficha de cartera no pertenece a un sleeve
    trades: evaluables.length,
    ganadoras: ganadoras.length,
    perdedoras: perdedoras.length,
    winRate: evaluables.length > 0 ? ganadoras.length / evaluables.length : 0,
    expectancy: evaluables.length > 0 ? pnlTotal / evaluables.length : 0,
    expectancyR: media(rMultiples) ?? 0,
    profitFactor: sumaPerdidas > 0 ? sumaGanancias / sumaPerdidas : ganadoras.length > 0 ? PF_SIN_PERDIDAS : 0,
    pnlTotal,
    drawdownMax: dd,
    drawdownMaxPct: equityReferencia > 0 ? dd / equityReferencia : 0,
    spreadMedio: media(evaluables.map((t) => t.spreadEntrada).filter((v): v is number => typeof v === "number")),
    slippageMedio: media(evaluables.map((t) => t.slippage).filter((v): v is number => typeof v === "number")),
  };
}

// ---------------------------------------------------------------------------
// TAREA 7 — Checklist de criterios de paso de la Fase 1
// ---------------------------------------------------------------------------

export type EstadoCriterio = "cumple" | "no_cumple" | "muestra_insuficiente";

export interface ResultadoCriterio {
  criterio: string;
  estado: EstadoCriterio;
  valor: string;
  objetivo: string;
}

export interface ChecklistSleeve {
  sleeve: SleeveId;
  /** Solo pasa si TODOS sus criterios cumplen. */
  pasa: boolean;
  criterios: ResultadoCriterio[];
}

function fmt(valor: number, decimales = 2): string {
  if (!Number.isFinite(valor)) return "∞";
  return valor.toFixed(decimales);
}

/**
 * Evalúa un sleeve contra sus criterios de paso.
 *
 * La distinción entre "no cumple" y "muestra insuficiente" es deliberada: un
 * sleeve con 3 operaciones y expectancy negativa no ha fracasado, es que
 * todavía no se sabe. Marcarlo como fracaso invitaría a cancelarlo antes de
 * tiempo; marcarlo como aprobado sería peor.
 */
export function evaluarChecklist(
  sleeve: SleeveId,
  metricas: MetricasSleeve,
  criterio: Fase1Criterio,
): ChecklistSleeve {
  const criterios: ResultadoCriterio[] = [];

  const minimoMuestra = criterio.tradesMinimos ?? criterio.eventosMinimos;
  const muestraSuficiente = minimoMuestra === undefined || metricas.trades >= minimoMuestra;

  if (minimoMuestra !== undefined) {
    criterios.push({
      criterio: criterio.eventosMinimos !== undefined ? "Eventos mínimos" : "Operaciones mínimas",
      estado: muestraSuficiente ? "cumple" : "muestra_insuficiente",
      valor: String(metricas.trades),
      objetivo: `>= ${minimoMuestra}`,
    });
  }

  const evaluar = (ok: boolean): EstadoCriterio =>
    !muestraSuficiente ? "muestra_insuficiente" : ok ? "cumple" : "no_cumple";

  criterios.push({
    criterio: "Expectancy tras costes",
    estado: evaluar(metricas.expectancy > criterio.expectancyMin),
    valor: `${fmt(metricas.expectancy)} (${fmt(metricas.expectancyR)}R)`,
    objetivo: `> ${criterio.expectancyMin}`,
  });

  if (criterio.profitFactorMin !== undefined) {
    criterios.push({
      criterio: "Profit factor",
      estado: evaluar(metricas.profitFactor >= criterio.profitFactorMin),
      valor: fmt(metricas.profitFactor),
      objetivo: `>= ${criterio.profitFactorMin}`,
    });
  }

  criterios.push({
    criterio: "Drawdown sobre cartera",
    estado: metricas.drawdownMaxPct < criterio.drawdownMaxCartera ? "cumple" : "no_cumple",
    valor: `${fmt(metricas.drawdownMaxPct * 100, 1)}%`,
    objetivo: `< ${fmt(criterio.drawdownMaxCartera * 100, 0)}%`,
  });

  return { sleeve, pasa: criterios.every((c) => c.estado === "cumple"), criterios };
}

export interface ChecklistFase1 {
  sleeves: ChecklistSleeve[];
  /** Un sleeve que no cumple queda en demo o se cancela SIN arrastrar a los demás. */
  cartera: MetricasSleeve;
}

export function checklistFase1(
  config: AtlasConfig,
  trades: SleeveTrade[],
  equityReferencia: number,
): ChecklistFase1 {
  return {
    sleeves: SLEEVE_IDS.map((id) =>
      evaluarChecklist(id, calcularMetricas(id, trades, equityReferencia), config.fase1.criterios[id]),
    ),
    cartera: metricasCartera(trades, equityReferencia),
  };
}
