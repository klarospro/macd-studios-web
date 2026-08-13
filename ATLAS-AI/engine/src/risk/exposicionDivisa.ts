/**
 * Límite de exposición NETA por divisa (o subyacente).
 *
 * Por qué existe, medido y no supuesto: el 2026-08-12 la cartera abrió a la vez
 * USD/JPY largo, EUR/JPY largo y GBP/JPY largo. Son TRES apuestas a que el yen
 * se debilita, pero repartidas entre `fx_mayor` y `fx_menor`, así que el tope
 * de "4 posiciones por clase" las aprobó todas sin protestar.
 *
 * La clase ESMA es una categoría REGULATORIA (cuánto apalancamiento permite el
 * regulador), no una medida de correlación. Dos posiciones de clases distintas
 * pueden ser la misma apuesta. Esto mide la apuesta de verdad: se descompone
 * cada par en sus dos piernas y se suma el riesgo neto por divisa.
 *
 * Es la práctica estándar de un CTA: limitar la exposición por factor para que
 * ningún tema domine la cartera, en vez de fiarse de límites por instrumento.
 */

export type Lado = "buy" | "sell";

export interface PiernaExpuesta {
  symbol: string;
  side: Lado;
  /** Riesgo en moneda de cuenta que aporta esta posición. */
  riskAmount: number;
}

export interface Piernas {
  base: string;
  quote: string;
}

/**
 * Descompone un símbolo de Deriv en sus dos divisas.
 * `frxEURUSD` → EUR/USD · `frxXAUUSD` → XAU/USD · `cryBTCUSD` → BTC/USD
 * Devuelve `null` si el símbolo no encaja en el patrón de 6 letras (p. ej. un
 * índice como `OTC_SPC`), en cuyo caso este límite no aplica.
 */
export function piernasDe(symbol: string): Piernas | null {
  const m = /^(?:frx|cry)([A-Z]{3})([A-Z]{3})$/.exec(symbol);
  if (!m) return null;
  return { base: m[1]!, quote: m[2]! };
}

/**
 * Riesgo neto por divisa de una cartera abierta.
 *
 * Comprar EUR/USD es estar LARGO de euro y CORTO de dólar por el mismo importe,
 * así que cada posición suma en una divisa y resta en la otra. El signo importa:
 * largo EUR/USD y largo USD/JPY se compensan parcialmente en dólar, y ese neteo
 * es justo lo que un límite por instrumento no ve.
 */
export function exposicionPorDivisa(posiciones: PiernaExpuesta[]): Record<string, number> {
  const neto: Record<string, number> = {};
  for (const p of posiciones) {
    const piernas = piernasDe(p.symbol);
    if (!piernas) continue;
    const signo = p.side === "buy" ? 1 : -1;
    neto[piernas.base] = (neto[piernas.base] ?? 0) + signo * p.riskAmount;
    neto[piernas.quote] = (neto[piernas.quote] ?? 0) - signo * p.riskAmount;
  }
  return neto;
}

export interface VeredictoExposicion {
  permitido: boolean;
  /** Divisa que hace saltar el límite, si lo hay. */
  divisa?: string;
  /** Exposición neta que habría resultado. */
  expuestoTras?: number;
  limite?: number;
}

export interface OpcionesExposicion {
  /**
   * Divisa de la cuenta (normalmente USD). Necesita un tope PROPIO y más alto,
   * porque está en un lado de casi todos los pares: aplicarle el mismo límite
   * que al yen bloquea la diversificación en vez de protegerla. Medido en la
   * primera pasada con el límite puesto: rechazó oro, plata, BTC y ETH a la vez.
   */
  divisaCuenta?: string;
  /** Multiplicador del tope para la divisa de la cuenta. */
  multiploCuenta?: number;
}

/**
 * ¿Cabe una posición más sin concentrar la cartera en una sola divisa?
 *
 * Se evalúa sobre el resultado FINAL (abiertas + candidata), no sobre la
 * candidata aislada: lo que concentra la cartera es el conjunto.
 *
 * `maxNetoPorDivisa` debe ser una cifra de CARTERA (p. ej. equity × riesgo × 2),
 * nunca derivada del riesgo de la candidata: si el tope encoge con la señal,
 * las posiciones pequeñas se vuelven imposibles de abrir.
 */
export function permiteExposicion(
  abiertas: PiernaExpuesta[],
  candidata: PiernaExpuesta,
  maxNetoPorDivisa: number,
  opciones: OpcionesExposicion = {},
): VeredictoExposicion {
  if (!(maxNetoPorDivisa > 0)) return { permitido: true };
  const piernas = piernasDe(candidata.symbol);
  if (!piernas) return { permitido: true }; // símbolo sin piernas: no aplica

  const neto = exposicionPorDivisa([...abiertas, candidata]);
  const { divisaCuenta, multiploCuenta = 3 } = opciones;

  // Solo se juzgan las divisas que la candidata TOCA: no tiene sentido
  // rechazarla por una concentración preexistente en la que no participa.
  for (const divisa of [piernas.base, piernas.quote]) {
    const limite = divisa === divisaCuenta ? maxNetoPorDivisa * multiploCuenta : maxNetoPorDivisa;
    const expuesto = Math.abs(neto[divisa] ?? 0);
    if (expuesto > limite) {
      return { permitido: false, divisa, expuestoTras: neto[divisa], limite };
    }
  }
  return { permitido: true };
}
