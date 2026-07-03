export type Side = "buy" | "sell";

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  size: number;
  entryPrice: number;
  stopPrice: number;
  riskAmount: number;
  correlationGroup: string;
}

export interface Signal {
  symbol: string;
  side: Side;
  entryPrice: number;
  stopPrice: number;
  correlationGroup: string;
  winProbability?: number;
  payoffRatio?: number;
}

export interface Order {
  symbol: string;
  side: Side;
  size: number;
  entryPrice: number;
  stopPrice: number;
  riskAmount: number;
  correlationGroup: string;
}

export interface AccountState {
  equity: number;
  startOfDayEquity: number;
  peakEquity: number;
  openPositions: Position[];
  consecutiveLosses: number;
  recentBrokerErrors: number;
  tradingHalted: boolean;
}

export type RiskRejectionReason =
  | "trading_halted"
  | "circuit_breaker_losses"
  | "circuit_breaker_broker_errors"
  | "daily_drawdown_reached"
  | "total_drawdown_reached"
  | "max_concurrent_positions"
  | "max_aggregate_risk"
  | "invalid_stop_distance"
  | "non_positive_size";

export type RiskDecision =
  | { approved: true; order: Order }
  | { approved: false; reason: RiskRejectionReason };
