import { AuditEvent, AuditLog } from "./auditLog";
import { FileAuditLog } from "./fileAuditLog";

/**
 * Sink de auditoría contra Supabase (PostgREST). Escribe en `trading_audit_log` (ver
 * db/001_trading_audit_log.sql, patrón WORM). Requiere SUPABASE_URL + SUPABASE_SERVICE_KEY.
 * Si faltan, `createAuditLog` cae al FileAuditLog local — nada de credenciales en código.
 */
export class SupabaseAuditLog implements AuditLog {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const row: Record<string, unknown> = {
      at: event.at,
      kind: event.kind,
      venue_id: "venueId" in event ? event.venueId : null,
      symbol: "symbol" in event ? event.symbol : "order" in event ? event.order.symbol : null,
      reason: "reason" in event ? event.reason : null,
      event,
    };
    const response = await fetch(`${this.url}/rest/v1/trading_audit_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      throw new Error(`Supabase audit ${response.status}: ${await response.text()}`);
    }
  }
}

/** Elige el sink de auditoría: Supabase si hay credenciales, si no fichero local JSONL. */
export function createAuditLog(filePath: string): AuditLog {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) return new SupabaseAuditLog(url, key);
  return new FileAuditLog(filePath);
}
