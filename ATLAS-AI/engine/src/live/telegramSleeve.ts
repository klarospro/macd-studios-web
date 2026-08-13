import { SleeveId } from "../config/sleeveConfig";
import { SleeveOrder } from "../risk/sleeveRiskGate";

/**
 * Avisos de Telegram etiquetados por sleeve (Tarea 6).
 *
 * Reutiliza el mismo contrato que `telegram.ts` —dos audiencias, fire-and-forget,
 * un fallo de red nunca rompe el ciclo— y añade lo que el diseño multi-sleeve
 * necesita: saber DE QUÉ SLEEVE viene cada operación. Sin esa etiqueta, cuatro
 * semanas de avisos mezclados serían inservibles para decidir qué sleeve pasa
 * de fase y cuál se cancela.
 */

const NOMBRE: Record<SleeveId, string> = {
  core: "Core · tendencia",
  intradia: "Intradía · ruptura",
  eventscalp: "EventScalp · macro",
};

const EMOJI: Record<SleeveId, string> = {
  core: "🧭",
  intradia: "⚡",
  eventscalp: "📰",
};

const DISCLAIMER =
  "<i>Cuenta demo. Información sobre la actividad del sistema; no es asesoramiento financiero ni garantiza rentabilidad.</i>";

async function enviar(chatId: string, texto: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
}

const chatOps = () => process.env.TELEGRAM_CHAT_ID ?? "";
const chatClientes = () => process.env.TELEGRAM_CLIENT_CHAT_ID ?? "";

async function fanoutN8n(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  await fetch(`${url}/webhook/atlas-evento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.N8N_TOKEN ?? ""}` },
    body: JSON.stringify(payload),
  }).catch(() => null);
}

/** Aviso de ENTRADA, con la ficha técnica completa para operaciones. */
export async function notificarEntradaSleeve(orden: SleeveOrder, etiqueta: string, dryRun: boolean): Promise<void> {
  const tag = dryRun ? "🧪 <i>[simulacro]</i>\n" : "";
  const dir = orden.side === "buy" ? "LARGO (BUY)" : "CORTO (SELL)";

  const ops = [
    `${EMOJI[orden.sleeve]} <b>${etiqueta}</b> — ${dir}`,
    `<i>${NOMBRE[orden.sleeve]}</i>`,
    ``,
    `<b>Entrada:</b> ${orden.entryPrice}`,
    `<b>Stop:</b> ${orden.stopPrice.toFixed(5)}`,
    `<b>Riesgo:</b> $${orden.riskAmount.toFixed(2)}`,
    `<b>Nocional:</b> $${orden.nocional.toFixed(2)} · apalancamiento ${orden.apalancamientoUsado.toFixed(1)}x`,
    orden.setupId ? `<b>Setup:</b> ${orden.setupId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const clientes = [
    `${EMOJI[orden.sleeve]} <b>Nueva posición · ${etiqueta}</b>`,
    ``,
    `El sistema ha abierto una posición ${orden.side === "buy" ? "al alza 📈" : "a la baja 📉"} en ${etiqueta},`,
    `siguiendo su estrategia de ${NOMBRE[orden.sleeve].toLowerCase()}. El riesgo de la operación está`,
    `acotado de antemano y la posición se cierra sola si el escenario deja de cumplirse.`,
    ``,
    DISCLAIMER,
  ].join("\n");

  await enviar(chatOps(), tag + ops);
  await enviar(chatClientes(), tag + clientes);
  await fanoutN8n({
    kind: "entry",
    sleeve: orden.sleeve,
    symbol: orden.symbol,
    side: orden.side,
    riskAmount: orden.riskAmount,
    dryRun,
  });
}

/** Aviso de SALIDA, con el P&L realizado. */
export async function notificarSalidaSleeve(
  sleeve: SleeveId,
  symbol: string,
  side: "buy" | "sell",
  motivo: string,
  pnl: number,
  dryRun: boolean,
): Promise<void> {
  const tag = dryRun ? "🧪 <i>[simulacro]</i>\n" : "";
  const signo = pnl >= 0 ? "+" : "";
  const causa = motivo.replace(/_/g, " ");

  const ops = [
    `⚪ <b>${symbol}</b> — CIERRE de ${side === "buy" ? "LARGO" : "CORTO"}`,
    `<i>${NOMBRE[sleeve]}</i>`,
    ``,
    `<b>Motivo:</b> ${causa}`,
    `<b>Resultado:</b> ${signo}${pnl.toFixed(2)}`,
  ].join("\n");

  const clientes = [
    `⚪ <b>Posición cerrada · ${symbol}</b>`,
    ``,
    `El sistema ha cerrado la posición porque ${causa}. Se sigue la regla igual en`,
    `euforia que en calma: la disciplina es lo que protege el capital.`,
    ``,
    DISCLAIMER,
  ].join("\n");

  await enviar(chatOps(), tag + ops);
  await enviar(chatClientes(), tag + clientes);
  await fanoutN8n({ kind: "exit", sleeve, symbol, side, motivo, pnl, dryRun });
}

/** Envía el resumen semanal al canal de operaciones. */
export async function enviarResumenSemanal(texto: string): Promise<void> {
  await enviar(chatOps(), texto);
  await fanoutN8n({ kind: "weekly_summary", texto });
}

/**
 * Avisa de que el bróker dejó de ofrecer mercado. Va SOLO a operaciones: es un
 * problema de infraestructura, no una noticia para clientes.
 */
export async function notificarVenueCaido(minutos: number, detalle: string): Promise<void> {
  const texto = [
    `🔴 <b>ATLAS · venue sin ofertas</b>`,
    ``,
    `Deriv lleva <b>${minutos} min</b> sin ofrecer ni un símbolo operable.`,
    `El motor está vivo y no ha abierto nada: no hay riesgo en curso.`,
    ``,
    `<code>${detalle}</code>`,
    ``,
    `Se avisará de nuevo cuando el bróker vuelva.`,
  ].join("\n");
  await enviar(chatOps(), texto);
  await fanoutN8n({ kind: "venue_down", minutos, detalle });
}

/** Cierra el incidente anterior: sin esto nadie sabe si sigue roto. */
export async function notificarVenueRecuperado(minutos: number, simbolos: number): Promise<void> {
  const texto = [
    `🟢 <b>ATLAS · venue recuperado</b>`,
    ``,
    `Deriv vuelve a ofrecer <b>${simbolos} símbolos</b>.`,
    `Estuvo caído ~${minutos} min. El motor reanuda el ciclo normal.`,
  ].join("\n");
  await enviar(chatOps(), texto);
  await fanoutN8n({ kind: "venue_up", minutos, simbolos });
}
