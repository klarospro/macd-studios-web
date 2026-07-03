import { RiskConfig } from "../config/riskConfig";
import { AccountState, Signal } from "../domain/types";
import { evaluate } from "../risk/riskGate";
import { BrokerAdapter } from "../broker/brokerAdapter";
import { AuditLog } from "../audit/auditLog";

/**
 * Un venue = una cuenta operable en un broker (Deriv, Polymarket, MT5, fondeo).
 * Envuelve un BrokerAdapter y mantiene su propio estado de cuenta y sus reglas de
 * riesgo LOCALES (que pueden diferir por venue, p. ej. límites externos de un prop firm
 * codificados en un RiskConfig más estricto). Ver 14_PORTFOLIOS/01_DETALLE_CAPA_PORTAFOLIO.md.
 */
export interface Venue {
  id: string;
  adapter: BrokerAdapter;
  config: RiskConfig;
  account: AccountState;
}

export interface PortfolioConfig {
  /** Techo de riesgo agregado sobre el capital TOTAL de todos los venues (default 4%). */
  globalRiskPct: number;
}

/**
 * Capa de portafolio ("plantilla maestra"): sitúa un gate GLOBAL por encima de los venues.
 * Una orden se aprueba solo si pasa el gate LOCAL del venue (09_RISK) Y el gate GLOBAL de
 * portafolio (riesgo agregado sobre el capital total). Todo se denomina en la misma moneda
 * (USD); la normalización de divisa se asume hecha aguas arriba.
 */
export class PortfolioManager {
  constructor(
    private readonly portfolio: PortfolioConfig,
    private readonly venues: Venue[],
    private readonly audit: AuditLog,
  ) {}

  totalEquity(): number {
    return this.venues.reduce((total, venue) => total + venue.account.equity, 0);
  }

  globalOpenRisk(): number {
    return this.venues.reduce(
      (total, venue) =>
        total + venue.account.openPositions.reduce((sum, position) => sum + position.riskAmount, 0),
      0,
    );
  }

  globalBudget(): number {
    return this.totalEquity() * this.portfolio.globalRiskPct;
  }

  private venueOrThrow(venueId: string): Venue {
    const venue = this.venues.find((candidate) => candidate.id === venueId);
    if (!venue) throw new Error(`Venue desconocido: ${venueId}`);
    return venue;
  }

  async handleSignal(venueId: string, signal: Signal): Promise<void> {
    const venue = this.venueOrThrow(venueId);
    const at = new Date().toISOString();

    // 1. Gate LOCAL del venue (sizing, Kelly, drawdown, breakers, correlación intra-venue).
    const decision = evaluate(venue.config, venue.account, signal);
    if (!decision.approved) {
      await this.audit.record({ kind: "order_rejected", at, signal, reason: decision.reason, venueId });
      return;
    }

    // 2. Gate GLOBAL de portafolio: el riesgo ya sizeado debe caber en el presupuesto global
    //    restante sobre el capital TOTAL. Es lo que impide que 3 cuentas al 5% local sumen 15%.
    const available = this.globalBudget() - this.globalOpenRisk();
    if (decision.order.riskAmount > available) {
      await this.audit.record({
        kind: "portfolio_rejected",
        at,
        signal,
        venueId,
        reason: "global_budget_exceeded",
      });
      return;
    }

    // 3. Ejecución + seguimiento de la posición abierta (alimenta globalOpenRisk).
    try {
      const position = await venue.adapter.placeOrder(decision.order);
      venue.account.openPositions.push(position);
      await this.audit.record({ kind: "order_placed", at, order: decision.order, positionId: position.id, venueId });
    } catch (error) {
      // 08_TRADING/09_RISK regla 5: fallo de broker se audita y se propaga, no se pierde.
      const message = error instanceof Error ? error.message : String(error);
      await this.audit.record({ kind: "order_failed", at, order: decision.order, error: message, venueId });
      throw error;
    }
  }
}
