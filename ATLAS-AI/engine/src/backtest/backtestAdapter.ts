import { BrokerAdapter } from "../broker/brokerAdapter";
import { Order, Position } from "../domain/types";

/**
 * Adaptador de backtest: implementa la MISMA interfaz BrokerAdapter que Deriv/Polymarket,
 * pero rellena las órdenes contra un precio histórico inyectado por el driver. Así el motor
 * completo (riskGate + auditoría) se reutiliza tal cual sobre datos históricos — es el
 * `HistoricalReplayAdapter` anticipado en 08_TRADING. Sin red, determinista, testeable.
 */
export class BacktestAdapter implements BrokerAdapter {
  readonly name = "backtest";
  currentPrice = 0;
  private equity: number;
  private readonly open = new Map<string, Position>();
  private seq = 0;

  constructor(initialEquity: number) {
    this.equity = initialEquity;
  }

  async connect(): Promise<void> {}

  async getEquity(): Promise<number> {
    return this.equity;
  }

  async placeOrder(order: Order): Promise<Position> {
    // Se rellena al precio actual de la barra (fill a mercado), conservando el sizing del riskGate.
    const position: Position = { ...order, id: `bt-${++this.seq}`, entryPrice: this.currentPrice };
    this.open.set(position.id, position);
    return position;
  }

  async closePosition(positionId: string): Promise<void> {
    const position = this.open.get(positionId);
    if (!position) return;
    const direction = position.side === "buy" ? 1 : -1;
    this.equity += (this.currentPrice - position.entryPrice) * position.size * direction;
    this.open.delete(positionId);
  }

  async disconnect(): Promise<void> {}

  get openPositions(): Position[] {
    return [...this.open.values()];
  }
}
