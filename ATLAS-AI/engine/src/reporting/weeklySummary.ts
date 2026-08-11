import { SleeveTrade } from "../audit/sleeveTrade";
import { AtlasConfig, SleeveId } from "../config/sleeveConfig";
import { ChecklistFase1, ChecklistSleeve, MetricasSleeve, calcularMetricas, checklistFase1 } from "./sleeveMetrics";

/**
 * Resumen semanal automático por sleeve y por cartera (Tarea 6) y volcado del
 * checklist de Fase 1 (Tarea 7).
 *
 * El formato es texto plano con HTML mínimo para Telegram. Deliberadamente no
 * se adorna el resultado: si un sleeve va mal, el mensaje lo dice con la misma
 * claridad que si va bien. Un informe que suaviza las malas semanas es inútil
 * justo cuando más falta hace.
 */

const NOMBRE: Record<SleeveId, string> = {
  core: "Core (tendencia)",
  intradia: "Intradía (breakout)",
  eventscalp: "EventScalp (macro)",
};

const ICONO: Record<string, string> = {
  cumple: "✅",
  no_cumple: "❌",
  muestra_insuficiente: "⏳",
};

function pct(valor: number, decimales = 1): string {
  return `${(valor * 100).toFixed(decimales)}%`;
}

function num(valor: number, decimales = 2): string {
  if (!Number.isFinite(valor)) return "∞";
  return valor.toFixed(decimales);
}

/** Bloque de un sleeve: métricas de la semana + estado de sus criterios. */
export function bloqueSleeve(metricas: MetricasSleeve, checklist: ChecklistSleeve): string {
  const lineas = [
    `<b>${NOMBRE[metricas.sleeve]}</b>`,
    `Operaciones: ${metricas.trades} · aciertos ${pct(metricas.winRate)}`,
    `Expectancy: ${num(metricas.expectancy)} (${num(metricas.expectancyR)}R) · PF ${num(metricas.profitFactor)}`,
    `P&L: ${num(metricas.pnlTotal)} · caída máx ${pct(metricas.drawdownMaxPct)}`,
  ];

  if (metricas.spreadMedio !== null) {
    const slip = metricas.slippageMedio !== null ? ` · slippage ${num(metricas.slippageMedio, 5)}` : "";
    lineas.push(`Spread medio: ${num(metricas.spreadMedio, 5)}${slip}`);
  }

  lineas.push("<i>Criterios de paso:</i>");
  for (const c of checklist.criterios) {
    lineas.push(`  ${ICONO[c.estado]} ${c.criterio}: ${c.valor} (objetivo ${c.objetivo})`);
  }

  return lineas.join("\n");
}

export interface ResumenSemanal {
  texto: string;
  checklist: ChecklistFase1;
}

/**
 * Construye el resumen. `trades` debe traer las operaciones del periodo que se
 * quiere reportar; el filtrado por fechas se hace fuera para que esta función
 * sea reutilizable tanto en el informe semanal como en el cierre de Fase 1.
 */
export function construirResumen(
  config: AtlasConfig,
  trades: SleeveTrade[],
  equityReferencia: number,
  desde: string,
  hasta: string,
): ResumenSemanal {
  const checklist = checklistFase1(config, trades, equityReferencia);

  const bloques = checklist.sleeves.map((c) =>
    bloqueSleeve(calcularMetricas(c.sleeve, trades, equityReferencia), c),
  );

  const cartera = checklist.cartera;
  const sleevesQuePasan = checklist.sleeves.filter((s) => s.pasa).map((s) => NOMBRE[s.sleeve]);

  const texto = [
    `📊 <b>Resumen semanal Atlas · ${desde} → ${hasta}</b>`,
    `<i>Cuenta demo. Información sobre la actividad del sistema; no es asesoramiento financiero ni garantiza rentabilidad.</i>`,
    ``,
    ...bloques.flatMap((b) => [b, ""]),
    `<b>Cartera completa</b>`,
    `Operaciones: ${cartera.trades} · aciertos ${pct(cartera.winRate)}`,
    `Expectancy: ${num(cartera.expectancy)} (${num(cartera.expectancyR)}R) · PF ${num(cartera.profitFactor)}`,
    `P&L: ${num(cartera.pnlTotal)} · caída máx ${pct(cartera.drawdownMaxPct)}`,
    ``,
    sleevesQuePasan.length > 0
      ? `Sleeves que cumplen hoy los criterios de Fase 1: ${sleevesQuePasan.join(", ")}.`
      : `Ningún sleeve cumple todavía todos los criterios de Fase 1.`,
  ].join("\n");

  return { texto, checklist };
}

/** Checklist en texto plano, para el informe de cierre de Fase 1 en consola. */
export function checklistEnTexto(checklist: ChecklistFase1): string {
  const lineas: string[] = ["CHECKLIST FASE 1", ""];
  for (const sleeve of checklist.sleeves) {
    lineas.push(`${sleeve.pasa ? "PASA" : "NO PASA"} · ${NOMBRE[sleeve.sleeve]}`);
    for (const c of sleeve.criterios) {
      const marca = c.estado === "cumple" ? "[x]" : c.estado === "no_cumple" ? "[ ]" : "[~]";
      lineas.push(`  ${marca} ${c.criterio}: ${c.valor} (objetivo ${c.objetivo})`);
    }
    lineas.push("");
  }
  lineas.push("[x] cumple · [ ] no cumple · [~] muestra insuficiente");
  return lineas.join("\n");
}
