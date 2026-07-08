import { SignalAnalysis, toTelegramCard } from "../analysis/signalAnalysis";

/**
 * Notificaciones de Telegram con DOS audiencias:
 *   - OPERACIONES (interno / Moisés): detalle completo — porqué, probabilidad, duración,
 *     riesgo, entrada y stop. Es la tarjeta técnica de `signalAnalysis`.
 *   - CLIENTES (canal público): versión curada y amable, sin internals de riesgo, con
 *     el aviso de que es informativo y no asesoramiento financiero.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN        — token del bot (BotFather). Sin él, no se envía nada.
 *   TELEGRAM_CHAT_ID          — chat/grupo de OPERACIONES (interno).
 *   TELEGRAM_CLIENT_CHAT_ID   — canal de CLIENTES (opcional; si falta, no se avisa a clientes).
 *   N8N_WEBHOOK_URL / N8N_TOKEN — fan-out opcional a n8n (WhatsApp, etc.).
 *
 * Todo es fire-and-forget: un fallo de red NUNCA rompe el ciclo de trading.
 */

async function send(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
}

const opsChat = () => process.env.TELEGRAM_CHAT_ID ?? "";
const clientChat = () => process.env.TELEGRAM_CLIENT_CHAT_ID ?? "";

const DISCLAIMER = "<i>Información ilustrativa sobre la actividad del sistema; no es asesoramiento financiero ni garantiza rentabilidad.</i>";

/** Tarjeta amable para el canal de clientes al ABRIR una posición. */
function clientEntryCard(label: string, side: "buy" | "sell", horizon: string): string {
  const dir = side === "buy" ? "al alza 📈" : "a la baja 📉";
  return [
    `🟢 <b>Nueva posición · ${label}</b>`,
    ``,
    `Nuestro sistema ha abierto una posición siguiendo la tendencia ${dir} de ${label}.`,
    `Horizonte estimado: <b>plazo ${horizon}</b>. La posición se gestiona con riesgo controlado y se`,
    `cierra por sí sola si la tendencia se invierte.`,
    ``,
    DISCLAIMER,
  ].join("\n");
}

/** Tarjeta amable para el canal de clientes al CERRAR una posición. */
function clientExitCard(label: string, motivo: string): string {
  const causa = motivo === "cambio_de_tendencia" ? "la tendencia se giró" : motivo.replace(/_/g, " ");
  return [
    `⚪ <b>Posición cerrada · ${label}</b>`,
    ``,
    `El sistema ha cerrado la posición en ${label} porque ${causa}. Disciplina antes que emoción:`,
    `se sigue la regla igual en euforia que en calma.`,
    ``,
    DISCLAIMER,
  ].join("\n");
}

/** Tarjeta técnica para OPERACIONES al CERRAR (interno). */
function opsExitCard(label: string, side: "buy" | "sell", motivo: string): string {
  const accion = side === "buy" ? "LARGO (BUY)" : "CORTO (SELL)";
  return [
    `⚪ <b>${label}</b> — CIERRE de ${accion}`,
    `<i>Cerrada automáticamente · registrada en tu panel</i>`,
    ``,
    `<b>Motivo:</b> ${motivo.replace(/_/g, " ")}.`,
  ].join("\n");
}

async function fanoutN8n(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  await fetch(`${url}/webhook/atlas-evento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.N8N_TOKEN ?? ""}` },
    body: JSON.stringify(payload),
  }).catch(() => null);
}

/** Aviso de ENTRADA a operaciones (detalle) y a clientes (curado). */
export async function notifyEntry(a: SignalAnalysis, label: string, riskPct: number, dryRun: boolean): Promise<void> {
  const tag = dryRun ? "🧪 <i>[simulacro]</i>\n" : "";
  await send(opsChat(), tag + toTelegramCard(a, label, riskPct));
  await send(clientChat(), tag + clientEntryCard(label, a.side, a.horizon));
  await fanoutN8n({ kind: "entry", symbol: a.symbol, label, side: a.side, dryRun });
}

/** Aviso de SALIDA a operaciones (detalle) y a clientes (curado). */
export async function notifyExit(label: string, side: "buy" | "sell", motivo: string, dryRun: boolean): Promise<void> {
  const tag = dryRun ? "🧪 <i>[simulacro]</i>\n" : "";
  await send(opsChat(), tag + opsExitCard(label, side, motivo));
  await send(clientChat(), tag + clientExitCard(label, motivo));
  await fanoutN8n({ kind: "exit", label, side, motivo, dryRun });
}
