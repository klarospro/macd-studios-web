/**
 * Sizing en CONTRATOS (NQ se opera en contratos enteros, no en unidades continuas como el
 * `size` que calcula `riskGate.ts` para CFD/forex). Ver 02_GESTION_RIESGO.md §2 y
 * 03_INTEGRACION_ENGINE.md para cómo se concilian ambas nociones de tamaño.
 *
 * Valor del punto: NQ (E-mini Nasdaq) = 20 USD/punto por contrato. Dato de especificación
 * pública de CME, NO verificado contra fuente oficial esta noche (regla dura: sin navegador) —
 * ver TODO en 05_PREGUNTAS_ABIERTAS.md. MNQ (Micro E-mini) = 2 USD/punto, incluido por si el
 * tamaño de cuenta hace más práctico operar el contrato micro.
 */
export const NQ_POINT_VALUE_USD = 20;
export const MNQ_POINT_VALUE_USD = 2;

export interface SizingInput {
  equity: number;
  riskPct: number;
  /** Distancia del stop en PUNTOS del índice (no en precio bruto ni en USD). Debe ser > 0. */
  stopPoints: number;
  /** USD por punto por contrato (NQ_POINT_VALUE_USD o MNQ_POINT_VALUE_USD). */
  pointValue: number;
}

export interface SizingResult {
  /** Contratos enteros, siempre redondeado hacia ABAJO — nunca excede el riesgo aprobado. */
  contracts: number;
  /** Riesgo solicitado (equity * riskPct), antes de redondear a contratos enteros. */
  riskAmount: number;
  /** Riesgo real una vez redondeado a contratos enteros (<= riskAmount). 0 si contracts es 0. */
  actualRiskAmount: number;
}

/**
 * Calcula contratos a partir de riesgo %, capital y distancia de stop en puntos. Redondea SIEMPRE
 * hacia abajo: si el riesgo no alcanza ni para 1 contrato, devuelve 0 (no hay posiciones
 * fraccionarias en futuros) — caso cubierto explícitamente en los tests.
 */
export function sizeContracts(input: SizingInput): SizingResult {
  const { equity, riskPct, stopPoints, pointValue } = input;
  const riskAmount = equity * riskPct;

  if (equity <= 0 || riskPct <= 0 || stopPoints <= 0 || pointValue <= 0) {
    return { contracts: 0, riskAmount, actualRiskAmount: 0 };
  }

  const rawContracts = riskAmount / (stopPoints * pointValue);
  const contracts = Math.floor(rawContracts);
  const actualRiskAmount = contracts * stopPoints * pointValue;
  return { contracts, riskAmount, actualRiskAmount };
}
