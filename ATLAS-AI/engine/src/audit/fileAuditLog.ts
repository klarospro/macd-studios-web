import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AuditEvent, AuditLog } from "./auditLog";

/**
 * Auditoría append-only en fichero JSONL (una línea por evento). Patrón WORM local:
 * solo se añade, nunca se reescribe — mismo principio que `trading_audit_log` de 18_SECURITY.
 * Sirve para el demo mientras no esté conectado Supabase (ver SupabaseAuditLog).
 */
export class FileAuditLog implements AuditLog {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  async record(event: AuditEvent): Promise<void> {
    appendFileSync(this.path, `${JSON.stringify(event)}\n`);
  }
}
