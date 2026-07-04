import { Order, RiskRejectionReason, Signal } from "../domain/types";

export type AuditEvent =
  | { kind: "order_placed"; at: string; order: Order; positionId: string; venueId?: string }
  | { kind: "order_rejected"; at: string; signal: Signal; reason: RiskRejectionReason; venueId?: string }
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
