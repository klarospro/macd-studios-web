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

    try {
      const position = await this.broker.placeOrder(decision.order);
      await this.audit.record({ kind: "order_placed", at, order: decision.order, positionId: position.id });
    } catch (error) {
      // 08_TRADING/09_RISK regla 5: un fallo/timeout del broker NO es una orden perdida en
      // silencio — se audita y se propaga para que el llamador lo cuente como evento de
      // circuit breaker (recentBrokerErrors), nunca se traga la excepción.
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ kind: "order_failed", at, order: decision.order, error: message });
      throw error;
    }
  }
}
