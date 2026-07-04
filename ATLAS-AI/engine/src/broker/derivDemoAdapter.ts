import { BrokerAdapter } from "./brokerAdapter";
import { DerivClient } from "./derivClient";
import { Order, Position } from "../domain/types";

export interface DerivConfig {
  appId: string;
  apiToken: string;
  endpoint: string;
  multiplier: number;
}

export function derivConfigFromEnv(): DerivConfig {
  const apiToken = process.env.DERIV_API_TOKEN;
  if (!apiToken) {
    throw new Error("Falta DERIV_API_TOKEN en el entorno (.env.local)");
  }
  const appId = process.env.DERIV_APP_ID ?? "1089";
  // Multiplicador del contrato. Cada símbolo de Deriv admite un set concreto de valores
  // (p. ej. R_100 admite 100/200/.../500); si no es válido, Deriv rechaza la proposal
  // con un error explícito. Default demo = 100. Override: DERIV_MULTIPLIER.
  const multiplier = Number(process.env.DERIV_MULTIPLIER ?? "100");
  return { appId, apiToken, endpoint: "wss://ws.derivws.com/websockets/v3", multiplier };
}

export class DerivDemoAdapter implements BrokerAdapter {
  readonly name = "deriv-demo";
  private readonly client: DerivClient;
  private loginId = "";
  private currency = "USD";

  constructor(private readonly config: DerivConfig) {
    this.client = new DerivClient(config.appId, config.endpoint);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    const response = await this.client.send({ authorize: this.config.apiToken });
    const authorize = response.authorize as
      | { is_virtual?: number; loginid?: string; currency?: string }
      | undefined;
    if (!authorize) throw new Error("authorize sin respuesta");
    if (authorize.is_virtual !== 1) {
      await this.client.disconnect();
      throw new Error("SEGURIDAD: el token no es de una cuenta DEMO (is_virtual != 1). Abortado.");
    }
    this.loginId = authorize.loginid ?? "";
    this.currency = authorize.currency ?? "USD";
  }

  get accountId(): string {
    return this.loginId;
  }

  /** Posiciones/contratos abiertos ahora mismo en la cuenta (portfolio). */
  async openContracts(): Promise<Array<{ contractId: number; symbol: string; longcode: string; buyPrice: number }>> {
    const response = await this.client.send({ portfolio: 1 });
    const portfolio = response.portfolio as { contracts?: Array<Record<string, unknown>> } | undefined;
    return (portfolio?.contracts ?? []).map((c) => ({
      contractId: Number(c.contract_id),
      symbol: String(c.symbol ?? ""),
      longcode: String(c.longcode ?? ""),
      buyPrice: Number(c.buy_price ?? 0),
    }));
  }

  /** Últimas transacciones de la cuenta (statement) para el historial. */
  async statement(limit: number): Promise<Array<{ action: string; amount: number; balanceAfter: number; time: number; longcode: string }>> {
    const response = await this.client.send({ statement: 1, limit, description: 1 });
    const statement = response.statement as { transactions?: Array<Record<string, unknown>> } | undefined;
    return (statement?.transactions ?? []).map((t) => ({
      action: String(t.action_type ?? ""),
      amount: Number(t.amount ?? 0),
      balanceAfter: Number(t.balance_after ?? 0),
      time: Number(t.transaction_time ?? 0),
      longcode: String(t.longcode ?? ""),
    }));
  }

  /** Cierres diarios recientes de un símbolo (ticks_history, público). Para señales en vivo. */
  async dailyCloses(symbol: string, count: number): Promise<number[]> {
    const response = await this.client.send({
      ticks_history: symbol,
      end: "latest",
      count,
      style: "candles",
      granularity: 86400,
    });
    const candles = (response.candles as Array<{ close?: number }> | undefined) ?? [];
    return candles.map((c) => c.close).filter((c): c is number => typeof c === "number");
  }

  async getEquity(): Promise<number> {
    const response = await this.client.send({ balance: 1, account: "current" });
    const balance = response.balance as { balance?: number } | undefined;
    if (!balance || typeof balance.balance !== "number") {
      throw new Error("Respuesta de balance inválida");
    }
    return balance.balance;
  }

  /**
   * Mapeo Order (modelo CFD) → contrato Multiplier de Deriv. DECISIÓN DE DEMO,
   * aprobada por Moisés para el banco de pruebas; el broker de dinero real (MT5 u otro)
   * usará su propio mapeo. Documentado aquí a propósito:
   *   - side "buy"  → MULTUP,  "sell" → MULTDOWN.
   *   - amount = riskAmount, basis "stake": se invierte exactamente lo que se arriesga.
   *     En Multipliers la pérdida máxima está acotada al stake por construcción, así que
   *     max loss = stake = riskAmount (el riesgo ya lo fijó el riskGate). No hace falta
   *     limit_order para el tope de pérdida.
   *   - entryPrice/stopPrice de nuestro modelo NO se envían: Deriv abre a mercado, no acepta
   *     precio de entrada ni stop en precio para este producto. Se conservan en la Position
   *     devuelta solo como metadato de la señal original.
   *   - multiplier: valor de config (debe estar entre los admitidos por el símbolo).
   * El id de la Position devuelta es el contract_id de Deriv, para poder cerrarlo con sell.
   */
  async placeOrder(order: Order): Promise<Position> {
    const contractType = order.side === "buy" ? "MULTUP" : "MULTDOWN";
    const proposalResponse = await this.client.send({
      proposal: 1,
      amount: order.riskAmount,
      basis: "stake",
      contract_type: contractType,
      currency: this.currency,
      symbol: order.symbol,
      multiplier: this.config.multiplier,
    });
    const proposal = proposalResponse.proposal as
      | { id?: string; ask_price?: number; spot?: number }
      | undefined;
    if (!proposal?.id || typeof proposal.ask_price !== "number") {
      throw new Error("Respuesta de proposal inválida");
    }

    const buyResponse = await this.client.send({ buy: proposal.id, price: proposal.ask_price });
    const buy = buyResponse.buy as { contract_id?: number } | undefined;
    if (!buy || buy.contract_id === undefined) {
      throw new Error("Respuesta de buy inválida (sin contract_id)");
    }

    return {
      id: String(buy.contract_id),
      symbol: order.symbol,
      side: order.side,
      size: order.size,
      entryPrice: proposal.spot ?? order.entryPrice,
      stopPrice: order.stopPrice,
      riskAmount: order.riskAmount,
      correlationGroup: order.correlationGroup,
    };
  }

  async closePosition(positionId: string): Promise<void> {
    // "Cancelar" en Deriv = vender el contrato abierto. price: 0 = aceptar precio de mercado.
    // Justo tras el buy, Deriv rechaza el sell con "Waiting for entry tick" hasta que el
    // contrato registra su tick de entrada (peculiaridad de Deriv, no un fallo real).
    // Reintentamos con backoff corto antes de propagar el error al motor.
    const contractId = Number(positionId);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.client.send({ sell: contractId, price: 0 });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isTransient = /entry tick/i.test(message);
        if (!isTransient || attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
