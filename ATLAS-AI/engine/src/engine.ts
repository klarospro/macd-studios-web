import { RiskConfig } from "./config/riskConfig";
import { AccountState, Signal } from "./domain/types";
import { evaluate } from "./risk/riskGate";
import { BrokerAdapter } from "./broker/brokerAdapter";
import { AuditLog } from "./audit/auditLog";

export class TradingEngine {
  constructor(
    private readonly config: RiskConfig,
    private readonly broker: BrokerAdapter,
    private readonly audit: AuditLog,
  ) {}

  async handleSignal(account: AccountState, signal: Signal): Promise<void> {
    const decision = evaluate(this.config, account, signal);
    const at = new Date().toISOString();

    if (!decision.approved) {
      await this.audit.record({ kind: "order_rejected", at, signal, reason: decision.reason });
      return;
    }

    const position = await this.broker.placeOrder(decision.order);
    await this.audit.record({ kind: "order_placed", at, order: decision.order, positionId: position.id });
  }
}
