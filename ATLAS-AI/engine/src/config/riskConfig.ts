export interface RiskConfig {
  riskPerTradePct: number;
  kellyFraction: number;
  dailyDrawdownPct: number;
  dailyDrawdownReducePct: number;
  totalDrawdownPct: number;
  maxAggregateRiskPct: number;
  maxConcurrentPositions: number;
  maxConsecutiveLosses: number;
  maxBrokerErrors: number;
}

export const defaultRiskConfig: RiskConfig = {
  riskPerTradePct: 0.01,
  kellyFraction: 0.25,
  dailyDrawdownPct: 0.03,
  dailyDrawdownReducePct: 0.015,
  totalDrawdownPct: 0.1,
  maxAggregateRiskPct: 0.05,
  maxConcurrentPositions: 3,
  maxConsecutiveLosses: 4,
  maxBrokerErrors: 3,
};
