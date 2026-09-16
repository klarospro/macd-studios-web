/**
 * ATLAS CORE — estrategia propia, diseñada sobre la evidencia documentada de trend following
 * institucional (no sobre una promesa de rentabilidad).
 *
 * Tesis: en este repo ya se ha demostrado tres veces que buscar una SEÑAL mejor no funciona
 * (scalping momentum, liquidity grab: ambos muertos por costes). Lo que la literatura sí
 * documenta como robusto no es la señal, sino tres decisiones de CONSTRUCCIÓN:
 *
 *  1. ENSEMBLE DE HORIZONTES en vez de un único lookback.
 *     Un solo lookback es una estimación puntual y frágil (¿por qué 100 días y no 90?).
 *     Promediar señales de 1, 3, 6 y 12 meses captura variaciones distintas del momentum y
 *     elimina la mayor fuente de sobreajuste. Fuente: Baltas & Kosowski; CME "Improving
 *     Time-Series Momentum Strategies".
 *
 *  2. DIMENSIONAMIENTO POR VOLATILIDAD INVERSA (vol targeting) en vez de % fijo de riesgo.
 *     Con "1% por operación", BTC y EUR/USD reciben el mismo presupuesto nominal pero aportan
 *     riesgos radicalmente distintos. Escalar por 1/volatilidad iguala la contribución de riesgo
 *     de cada mercado. Es la práctica estándar de los CTA.
 *
 *  3. MUCHOS MERCADOS POCO CORRELACIONADOS.
 *     Es la única palanca que sube el retorno POR UNIDAD DE RIESGO sin tocar el apalancamiento.
 *     Un CTA real corre esto sobre 50-100 mercados; hacerlo sobre 5 es el problema, no la señal.
 *
 * Consecuencia deliberada: posiciones continuas que rotan despacio, con exposición que cambia
 * poco día a día → la fricción por operación deja de ser determinante. Es exactamente lo
 * contrario del intradía que ya falló dos veces.
 *
 * Lo que esto NO es: no promete un porcentaje mensual, no evita meses negativos, y su retorno
 * esperado está en el rango de un dígito a dos dígitos bajos ANUAL sobre el riesgo asumido.
 */

export interface AtlasCoreParams {
  /** Horizontes de momentum en días de mercado. Por defecto ~1, 3, 6 y 12 meses. */
  lookbacks: number[];
  /** Ventana para estimar la volatilidad realizada usada en el sizing. */
  volWindow: number;
  /** Volatilidad anualizada objetivo de la cartera completa (p. ej. 0.12 = 12%). */
  targetVol: number;
  /** Tope de exposición bruta total (suma de |peso|) como múltiplo del capital. */
  maxGrossExposure: number;
  /** Tope de exposición por instrumento. */
  maxWeightPerAsset: number;
  /** Si false, usa señal binaria de un solo lookback (para comparar contra el enfoque anterior). */
  useEnsemble: boolean;
  /** Si false, usa peso igual en vez de volatilidad inversa (para aislar el efecto del vol targeting). */
  useVolTargeting: boolean;
  /**
   * "sign": ±1 por horizonte (lo clásico, pero cada giro mueve la posición un 50% de golpe).
   * "continuous": momentum ajustado por riesgo y recortado a [-1,1] — la posición se mueve
   * proporcionalmente a la fuerza de la tendencia, no a saltos. Reduce la rotación drásticamente.
   */
  signalMode: "sign" | "continuous";
  /**
   * Banda de no-negociación: no se mueve un peso si el cambio respecto al actual es menor que
   * esto. Es EL control de costes de un CTA real — sin banda, el ruido de la señal se traduce
   * en rotación pura que solo paga comisiones.
   */
  noTradeBand: number;
  /**
   * Cada cuántos días se recalcula la cartera. La literatura académica de momentum temporal
   * (Moskowitz-Ooi-Pedersen) rebalancea MENSUALMENTE; rebalancear a diario sobre señales de
   * 3-12 meses añade rotación sin añadir información. 1 = diario, 21 ≈ mensual.
   */
  rebalanceEvery: number;
}

export const defaultAtlasCoreParams: AtlasCoreParams = {
  lookbacks: [63, 126, 252], // 3, 6 y 12 meses; se descarta el de 21 días por ruidoso
  volWindow: 60,
  targetVol: 0.12,
  maxGrossExposure: 3,
  maxWeightPerAsset: 0.5,
  useEnsemble: true,
  useVolTargeting: true,
  signalMode: "continuous",
  noTradeBand: 0.02,
  rebalanceEvery: 21,
};

const TRADING_DAYS = 252;

/**
 * Señal de momentum en `t` usando SOLO información hasta `t` (sin lookahead).
 * Ensemble: media de los signos de cada horizonte → valor continuo en [-1, +1].
 * Un valor de 0.5 significa "3 de 4 horizontes alcistas": convicción parcial, posición parcial.
 */
export function momentumSignal(prices: number[], t: number, params: AtlasCoreParams, vol?: number | null): number | null {
  const lookbacks = params.useEnsemble ? params.lookbacks : [params.lookbacks[params.lookbacks.length - 1]!];
  let sum = 0;
  let used = 0;

  for (const lb of lookbacks) {
    const past = prices[t - lb];
    const now = prices[t];
    if (past === undefined || now === undefined || past <= 0) continue;

    if (params.signalMode === "sign") {
      sum += now > past ? 1 : -1;
    } else {
      // Momentum ajustado por riesgo: el retorno del periodo dividido por lo que cabría esperar
      // de la volatilidad en ese mismo periodo. Un +5% en un mercado tranquilo pesa más que un
      // +5% en uno agitado, y la posición escala con la CONVICCIÓN en vez de saltar de 0 a todo.
      if (!vol || vol <= 0) continue;
      const periodReturn = now / past - 1;
      const expectedMove = vol * Math.sqrt(lb / TRADING_DAYS);
      const z = periodReturn / expectedMove;
      sum += Math.max(-1, Math.min(1, z));
    }
    used++;
  }

  if (used === 0) return null;
  return sum / used;
}

/** Volatilidad anualizada realizada en `t`, con los últimos `volWindow` retornos diarios. */
export function realizedVol(prices: number[], t: number, window: number): number | null {
  if (t < window) return null;
  const rets: number[] = [];
  for (let i = t - window + 1; i <= t; i++) {
    const prev = prices[i - 1];
    const now = prices[i];
    if (prev === undefined || now === undefined || prev <= 0) continue;
    rets.push(now / prev - 1);
  }
  if (rets.length < window / 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const vol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
  return vol > 0 ? vol : null;
}

/**
 * Pesos objetivo de la cartera en `t`. Cada instrumento recibe un presupuesto de volatilidad
 * igual; el signo y la magnitud vienen de la señal de momentum.
 *
 * `perAssetVolTarget = targetVol / sqrt(N)`: si los mercados fueran independientes, la suma de
 * N contribuciones de ese tamaño da exactamente `targetVol` de volatilidad de cartera. Como en
 * la práctica hay correlación positiva residual, la volatilidad realizada saldrá algo por encima;
 * se reporta medida, no asumida.
 */
export function targetWeights(
  series: Record<string, number[]>,
  t: number,
  params: AtlasCoreParams,
  currentWeights: Record<string, number> = {},
): Record<string, number> {
  const names = Object.keys(series);
  const raw: Record<string, number> = {};

  const perAssetVolTarget = params.targetVol / Math.sqrt(names.length);

  for (const name of names) {
    const prices = series[name]!;
    const vol = realizedVol(prices, t, params.volWindow);
    const signal = momentumSignal(prices, t, params, vol);
    if (signal === null || signal === 0) continue;

    let weight: number;
    if (params.useVolTargeting) {
      if (vol === null) continue;
      weight = signal * (perAssetVolTarget / vol);
    } else {
      weight = signal / names.length;
    }

    raw[name] = Math.max(-params.maxWeightPerAsset, Math.min(params.maxWeightPerAsset, weight));
  }

  // Tope de exposición bruta: si la suma de |peso| se dispara (típico cuando la volatilidad
  // colapsa en todos los mercados a la vez), se reescala todo proporcionalmente.
  const gross = Object.values(raw).reduce((s, w) => s + Math.abs(w), 0);
  if (gross > params.maxGrossExposure) {
    const scale = params.maxGrossExposure / gross;
    for (const name of Object.keys(raw)) raw[name] = raw[name]! * scale;
  }

  // ── Banda de no-negociación ──
  // Si el peso objetivo apenas se ha movido respecto al que ya tenemos, NO se toca la posición.
  // Sin esto, el ruido diario de la señal se convierte en rotación pura: coste sin información.
  if (params.noTradeBand > 0) {
    const final: Record<string, number> = {};
    const allNames = new Set([...Object.keys(raw), ...Object.keys(currentWeights)]);
    for (const name of allNames) {
      const target = raw[name] ?? 0;
      const current = currentWeights[name] ?? 0;
      const chosen = Math.abs(target - current) < params.noTradeBand ? current : target;
      if (chosen !== 0) final[name] = chosen;
    }
    return final;
  }

  return raw;
}
