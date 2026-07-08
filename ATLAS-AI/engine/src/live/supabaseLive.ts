import { HeldPosition } from "./state";

/**
 * Publica en Supabase el snapshot en vivo del venue (equity + posiciones abiertas) para el
 * dashboard en tiempo real. Usa SUPABASE_URL + SUPABASE_SERVICE_KEY (deriva la URL del JWT si
 * falta). Si no hay credenciales, no hace nada (modo local). Nunca rompe el ciclo.
 */
function deriveUrl(key?: string): string | undefined {
  if (!key) return undefined;
  try {
    const part = key.split(".")[1];
    if (!part) return undefined;
    const payload = JSON.parse(Buffer.from(part, "base64").toString("utf8"));
    return payload.ref ? `https://${payload.ref}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

export async function publishSnapshot(
  venueId: string,
  equity: number,
  positions: Record<string, HeldPosition>,
  pnl: Record<string, { profit: number; currentSpot: number }> = {},
): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.SUPABASE_URL ?? deriveUrl(key);
  if (!key || !url) return;

  const headers = { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
  const at = new Date().toISOString();

  // 1. Curva de equity (append).
  await fetch(`${url}/rest/v1/equity_log`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ at, venue_id: venueId, equity }),
  }).catch(() => null);

  // 2. Snapshot de posiciones: reemplaza las de este venue.
  await fetch(`${url}/rest/v1/atlas_positions?venue=eq.${encodeURIComponent(venueId)}`, {
    method: "DELETE",
    headers,
  }).catch(() => null);

  const rows = Object.entries(positions).map(([name, p]) => ({
    venue: venueId,
    symbol: name,
    side: p.side,
    size: p.size,
    entry_price: p.entryPrice,
    stop_price: p.stopPrice,
    risk_amount: p.riskAmount,
    opened_at: p.openedAt,
    profit: pnl[name]?.profit ?? null,
    current_spot: pnl[name]?.currentSpot ?? null,
  }));
  if (rows.length > 0) {
    await fetch(`${url}/rest/v1/atlas_positions`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    }).catch(() => null);
  }
}
