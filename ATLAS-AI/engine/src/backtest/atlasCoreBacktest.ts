import { AtlasCoreParams, targetWeights } from "../strategy/atlasCore";

/**
 * Backtest a nivel de CARTERA para Atlas Core.
 *
 * Diferencia esencial con el backtest anterior (`tsmomBacktest`): allí cada instrumento se
 * simulaba por separado con su propio stop y su propia cuenta. Aquí hay UNA cuenta y un vector de
 * pesos que se recalcula cada día — que es como funciona realmente un fondo de tendencia.
 *
 * Garantías anti-lookahead:
 * - Los pesos del día `t` se calculan con precios hasta `t` inclusive.
 * - El retorno que se les aplica es el del tramo `t → t+1`, que aún no se conoce en `t`.
 * - Un instrumento solo entra en la cartera cuando tiene histórico suficiente (`startIndex`).
 *
 * Costes: se cobran sobre la ROTACIÓN (`Σ|Δpeso|`), no por operación. Es el modelo correcto para
 * una cartera de pesos continuos, y penaliza justamente lo que hay que penalizar: mover posiciones.
 */

export interface AlignedUniverse {
  /** Fechas comunes (epoch en segundos), ascendentes. */
  dates: number[];
  /** Serie de precios alineada a `dates` para cada instrumento (con relleno hacia delante). */
  series: Record<string, number[]>;
  /** Primer índice con dato REAL de cada instrumento (antes de eso no existe). */
  startIndex: Record<string, number>;
  /** Clase de activo de cada instrumento. */
  groups: Record<string, string>;
}

export interface PortfolioResult {
  equityCurve: number[];
  dates: number[];
  dailyReturns: number[];
  /** Rotación diaria media (Σ|Δpeso|), como diagnóstico de coste. */
  avgTurnover: number;
  /** Nº medio de instrumentos con posición abierta. */
  avgPositions: number;
  /** Exposición bruta media (Σ|peso|). */
  avgGrossExposure: number;
}

interface Bar {
  t: number;
  c: number;
}

export interface UniverseEntry {
  group: string;
  bars: Bar[];
}

/**
 * Alinea instrumentos con calendarios distintos (festivos, cripto 24/7, apertura tardía) sobre
 * una rejilla común de fechas, rellenando hacia delante. Un mercado cerrado simplemente repite
 * su último precio → retorno 0 ese día, que es el comportamiento correcto.
 */
export function alignUniverse(universe: Record<string, UniverseEntry>): AlignedUniverse {
  // CRÍTICO: cada mercado marca sus velas con la hora de apertura LOCAL (Nikkei 00:00 UTC,
  // S&P 13:30 UTC, futuros otra distinta). Sin normalizar a día natural, la unión de calendarios
  // genera decenas de miles de instantes en vez de ~6.500 días, y un "lookback de 21 barras"
  // deja de ser 21 días. Se trunca todo a medianoche UTC antes de alinear.
  const toDay = (epoch: number): number => Math.floor(epoch / 86400) * 86400;

  const allDates = new Set<number>();
  for (const entry of Object.values(universe)) {
    for (const bar of entry.bars) allDates.add(toDay(bar.t));
  }
  const dates = [...allDates].sort((a, b) => a - b);

  const series: Record<string, number[]> = {};
  const startIndex: Record<string, number> = {};
  const groups: Record<string, string> = {};

  for (const [name, entry] of Object.entries(universe)) {
    groups[name] = entry.group;
    // Si un instrumento tuviera dos barras el mismo día natural, gana la última.
    const byDate = new Map(entry.bars.map((b) => [toDay(b.t), b.c]));
    const aligned: number[] = new Array(dates.length).fill(0);
    let last = 0;
    let first = -1;
    for (let i = 0; i < dates.length; i++) {
      const value = byDate.get(dates[i]!);
      if (value !== undefined) {
        last = value;
        if (first < 0) first = i;
      }
      aligned[i] = last;
    }
    series[name] = aligned;
    startIndex[name] = first < 0 ? dates.length : first;
  }

  return { dates, series, startIndex, groups };
}

export function runPortfolioBacktest(
  universe: AlignedUniverse,
  params: AtlasCoreParams,
  costBps: number,
  instruments?: string[],
): PortfolioResult {
  const names = instruments ?? Object.keys(universe.series);
  const maxLookback = Math.max(...params.lookbacks, params.volWindow);
  const n = universe.dates.length;

  let equity = 1;
  let prevWeights: Record<string, number> = {};
  const equityCurve: number[] = [];
  const dailyReturns: number[] = [];
  const dates: number[] = [];
  let turnoverSum = 0;
  let positionsSum = 0;
  let grossSum = 0;
  let days = 0;

  for (let t = maxLookback; t < n - 1; t++) {
    // Solo instrumentos con histórico suficiente EN ESTE MOMENTO del backtest.
    const available: Record<string, number[]> = {};
    for (const name of names) {
      if (t - maxLookback >= (universe.startIndex[name] ?? Infinity)) {
        available[name] = universe.series[name]!;
      }
    }
    if (Object.keys(available).length === 0) continue;

    // Entre rebalanceos la cartera se deja quieta: se mantienen los pesos del último recálculo.
    const isRebalanceDay = (t - maxLookback) % Math.max(1, params.rebalanceEvery) === 0;
    const weights = isRebalanceDay ? targetWeights(available, t, params, prevWeights) : prevWeights;

    // Coste por rotación: se paga al MOVER la cartera de ayer a la de hoy.
    let turnover = 0;
    const allNames = new Set([...Object.keys(weights), ...Object.keys(prevWeights)]);
    for (const name of allNames) {
      turnover += Math.abs((weights[name] ?? 0) - (prevWeights[name] ?? 0));
    }
    const cost = turnover * (costBps / 10000);

    // Retorno de mañana aplicado a los pesos de hoy (no se conoce al decidir).
    let grossReturn = 0;
    for (const [name, weight] of Object.entries(weights)) {
      const prices = universe.series[name]!;
      const p0 = prices[t]!;
      const p1 = prices[t + 1]!;
      if (p0 <= 0) continue;
      grossReturn += weight * (p1 / p0 - 1);
    }

    const netReturn = grossReturn - cost;
    equity *= 1 + netReturn;

    equityCurve.push(equity);
    dailyReturns.push(netReturn);
    dates.push(universe.dates[t + 1]!);
    turnoverSum += turnover;
    positionsSum += Object.keys(weights).length;
    grossSum += Object.values(weights).reduce((s, w) => s + Math.abs(w), 0);
    days++;
    prevWeights = weights;
  }

  return {
    equityCurve,
    dates,
    dailyReturns,
    avgTurnover: days ? turnoverSum / days : 0,
    avgPositions: days ? positionsSum / days : 0,
    avgGrossExposure: days ? grossSum / days : 0,
  };
}

export interface Metrics {
  cagr: number;
  vol: number;
  sharpe: number;
  maxDd: number;
  calmar: number;
  years: number;
  negativeMonthsPct: number;
  worstMonth: number;
  bestMonth: number;
  maxMonthsUnderwater: number;
  totalReturn: number;
}

const TRADING_DAYS = 252;

/** Agrupa retornos diarios en meses naturales reales (no bloques de 21 barras). */
export function monthlyReturns(dates: number[], dailyReturns: number[]): number[] {
  const byMonth = new Map<string, number>();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]! * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 1) * (1 + dailyReturns[i]!));
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => (v - 1) * 100);
}

export function metrics(r: PortfolioResult): Metrics {
  const rets = r.dailyReturns;
  if (rets.length === 0) {
    return { cagr: 0, vol: 0, sharpe: 0, maxDd: 0, calmar: 0, years: 0, negativeMonthsPct: 0, worstMonth: 0, bestMonth: 0, maxMonthsUnderwater: 0, totalReturn: 0 };
  }

  const years = (r.dates[r.dates.length - 1]! - r.dates[0]!) / (365.25 * 86400);
  const finalEquity = r.equityCurve[r.equityCurve.length - 1]!;
  const cagr = (Math.pow(finalEquity, 1 / years) - 1) * 100;

  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
  const vol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS) * 100;
  const sharpe = vol > 0 ? (mean * TRADING_DAYS * 100) / vol : 0;

  let peak = 0;
  let maxDd = 0;
  for (const e of r.equityCurve) {
    peak = Math.max(peak, e);
    maxDd = Math.max(maxDd, (peak - e) / peak);
  }

  const months = monthlyReturns(r.dates, rets);
  const negative = months.filter((m) => m < 0).length;
  const sortedMonths = [...months].sort((a, b) => a - b);

  let mPeak = 1;
  let mEquity = 1;
  let underwater = 0;
  let maxMonthsUnderwater = 0;
  for (const m of months) {
    mEquity *= 1 + m / 100;
    if (mEquity >= mPeak) {
      mPeak = mEquity;
      underwater = 0;
    } else {
      underwater++;
      maxMonthsUnderwater = Math.max(maxMonthsUnderwater, underwater);
    }
  }

  return {
    cagr,
    vol,
    sharpe,
    maxDd: maxDd * 100,
    calmar: maxDd > 0 ? cagr / (maxDd * 100) : 0,
    years,
    negativeMonthsPct: months.length ? (negative / months.length) * 100 : 0,
    worstMonth: sortedMonths[0] ?? 0,
    bestMonth: sortedMonths[sortedMonths.length - 1] ?? 0,
    maxMonthsUnderwater,
    totalReturn: (finalEquity - 1) * 100,
  };
}

/** Correlación de Pearson entre dos series de igual longitud. */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}
