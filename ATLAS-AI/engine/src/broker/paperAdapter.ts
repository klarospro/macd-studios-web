import { randomUUID } from "node:crypto";
import { BrokerAdapter } from "./brokerAdapter";
import { Order, Position } from "../domain/types";

export class PaperAdapter implements BrokerAdapter {
  readonly name = "paper";
  private equity: number;
  private readonly positions = new Map<string, Position>();

  constructor(initialEquity: number) {
    this.equity = initialEquity;
  }

  async connect(): Promise<void> {}

  async getEquity(): Promise<number> {
    return this.equity;
  }

  async placeOrder(order: Order): Promise<Position> {
    const position: Position = { id: randomUUID(), ...order };
    this.positions.set(position.id, position);
    return position;
  }

  async closePosition(positionId: string): Promise<void> {
    this.positions.delete(positionId);
  }

  async disconnect(): Promise<void> {}
}
