/**
 * Tipos compartidos de la estrategia ICT IFVG (28_ESTRATEGIA_ICT_IFVG). Módulo autocontenido:
 * no importa tipos de otras estrategias (liquidityGrab.ts, tsmom.ts) a propósito, para no crear
 * acoplamiento entre estrategias independientes.
 */

/** Misma forma que el `Candle` de otras estrategias del motor: epoch en SEGUNDOS, UTC. */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/**
 * Sesgo diario por estructura (HH/HL = UP, LL/LH = DOWN). `NONE` = sin estructura clara → skip
 * del día (ver 01_REGLAS_ENTRADA.md §2).
 */
export type Bias = "UP" | "DOWN" | "NONE";

/** Fair Value Gap de 3 velas, antes de evaluar si se invierte. */
export interface FvgZone {
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
  /** Índice de la vela `i` (la tercera del patrón de 3 velas) que formó el hueco. */
  formedAt: number;
  sizePoints: number;
}

/** Señal de IFVG confirmada: la zona se invirtió y su nueva polaridad marca el lado a operar. */
export interface IfvgSignal {
  side: "buy" | "sell";
  zoneTop: number;
  zoneBottom: number;
  formedAt: number;
  /** Índice de la vela cuyo CIERRE confirmó la inversión (ver 01_REGLAS_ENTRADA.md §3). */
  invertedAt: number;
}

/**
 * Plan de operación completo (entry/stop/TP1/TP2/break-even) para una señal IFVG aprobada.
 * `tp2` es `null` cuando no se encontró un segundo pool de liquidez en los datos disponibles —
 * ver 02_GESTION_RIESGO.md §4 (no se inventa un nivel).
 */
export interface TradePlan {
  symbol: string;
  side: "buy" | "sell";
  entry: number;
  stop: number;
  stopPoints: number;
  tp1: number;
  tp2: number | null;
  /** Mismo nivel que tp1 — ver 02_GESTION_RIESGO.md §4. */
  breakEvenTrigger: number;
}
