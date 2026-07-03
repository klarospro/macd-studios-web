import { RiskConfig } from "../config/riskConfig";
import { AccountState, RiskDecision, Signal } from "../domain/types";

function kellyEdge(winProbability: number, payoffRatio: number): number {
  const raw = winProbability - (1 - winProbability) / payoffRatio;
  return Math.max(0, raw);
}

function targetRiskFraction(config: RiskConfig, signal: Signal): number {
  if (signal.winProbability === undefined || signal.payoffRatio === undefined) {
    return config.riskPerTradePct;
  }
  const fractionalKelly = kellyEdge(signal.winProbability, signal.payoffRatio) * config.kellyFraction;
  return Math.min(config.riskPerTradePct, fractionalKelly);
}

function drawdownFromPeak(account: AccountState): number {
  if (account.peakEquity <= 0) return 0;
  return (account.peakEquity - account.equity) / account.peakEquity;
}

function dailyDrawdown(account: AccountState): number {
  if (account.startOfDayEquity <= 0) return 0;
  return (account.startOfDayEquity - account.equity) / account.startOfDayEquity;
}

function openAggregateRiskPct(account: AccountState): number {
  if (account.equity <= 0) return 1;
  const openRisk = account.openPositions.reduce((total, position) => total + position.riskAmount, 0);
  return openRisk / account.equity;
}

export function evaluate(config: RiskConfig, account: AccountState, signal: Signal): RiskDecision {
  if (account.tradingHalted) return { approved: false, reason: "trading_halted" };
  if (account.consecutiveLosses >= config.maxConsecutiveLosses) {
    return { approved: false, reason: "circuit_breaker_losses" };
  }
  if (account.recentBrokerErrors >= config.maxBrokerErrors) {
    return { approved: false, reason: "circuit_breaker_broker_errors" };
  }
  if (drawdownFromPeak(account) >= config.totalDrawdownPct) {
    return { approved: false, reason: "total_drawdown_reached" };
  }
  if (dailyDrawdown(account) >= config.dailyDrawdownPct) {
    return { approved: false, reason: "daily_drawdown_reached" };
  }
  if (account.openPositions.length >= config.maxConcurrentPositions) {
    return { approved: false, reason: "max_concurrent_positions" };
  }

  const stopDistance = Math.abs(signal.entryPrice - signal.stopPrice);
  if (stopDistance <= 0) return { approved: false, reason: "invalid_stop_distance" };

  const halvedByDrawdown = dailyDrawdown(account) >= config.dailyDrawdownReducePct;
  const riskFraction = targetRiskFraction(config, signal) * (halvedByDrawdown ? 0.5 : 1);

  if (openAggregateRiskPct(account) + riskFraction > config.maxAggregateRiskPct) {
    return { approved: false, reason: "max_aggregate_risk" };
  }

  const riskAmount = account.equity * riskFraction;
  const size = riskAmount / stopDistance;
  if (size <= 0) return { approved: false, reason: "non_positive_size" };

  return {
    approved: true,
    order: {
      symbol: signal.symbol,
      side: signal.side,
      size,
      entryPrice: signal.entryPrice,
      stopPrice: signal.stopPrice,
      riskAmount,
      correlationGroup: signal.correlationGroup,
    },
  };
}
