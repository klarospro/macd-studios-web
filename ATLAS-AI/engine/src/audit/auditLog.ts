import { Order, RiskRejectionReason, Signal } from "../domain/types";

export type AuditEvent =
  | { kind: "order_placed"; at: string; order: Order; positionId: string }
  | { kind: "order_rejected"; at: string; signal: Signal; reason: RiskRejectionReason }
  | { kind: "order_failed"; at: string; order: Order; error: string };

export interface AuditLog {
  record(event: AuditEvent): Promise<void>;
}

export class ConsoleAuditLog implements AuditLog {
  async record(event: AuditEvent): Promise<void> {
    console.log(JSON.stringify(event));
  }
}
