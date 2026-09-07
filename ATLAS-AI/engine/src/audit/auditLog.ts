import { Order, RiskRejectionReason, Signal } from "../domain/types";
import type { SleeveRechazo } from "../risk/sleeveRiskGate";

export type AuditEvent =
  | { kind: "order_placed"; at: string; order: Order; positionId: string; venueId?: string }
  // El motivo admite los del gate clásico y los del multi-sleeve: registrar
  // todos como "max_aggregate_risk" —lo que se hacía hasta 2026-09-07— hacía
  // ilegible la auditoría, porque 143 de 147 rechazos decían lo mismo sin serlo.
  | { kind: "order_rejected"; at: string; signal: Signal; reason: RiskRejectionReason | SleeveRechazo; venueId?: string }
  | { kind: "order_failed"; at: string; order: Order; error: string; venueId?: string }
  | { kind: "portfolio_rejected"; at: string; signal: Signal; venueId: string; reason: "global_budget_exceeded" }
  | { kind: "position_closed"; at: string; venueId?: string; positionId: string; symbol: string; motivo: string };

export interface AuditLog {
  record(event: AuditEvent): Promise<void>;
}

export class ConsoleAuditLog implements AuditLog {
  async record(event: AuditEvent): Promise<void> {
    console.log(JSON.stringify(event));
  }
}
