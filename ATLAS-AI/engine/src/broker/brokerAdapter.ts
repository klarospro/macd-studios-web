import { Order, Position } from "../domain/types";

export interface BrokerAdapter {
  readonly name: string;
  connect(): Promise<void>;
  getEquity(): Promise<number>;
  placeOrder(order: Order): Promise<Position>;
  closePosition(positionId: string): Promise<void>;
  disconnect(): Promise<void>;
}
