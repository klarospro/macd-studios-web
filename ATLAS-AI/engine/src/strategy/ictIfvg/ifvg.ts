import { Candle, FvgZone, IfvgSignal } from "./types";

/**
 * Detección de Fair Value Gaps e inversión a IFVG (01_REGLAS_ENTRADA.md §3).
 *
 * Definición usada, DECLARADA (spec original ambigua en varios puntos — ver
 * 05_PREGUNTAS_ABIERTAS.md):
 *  1. FVG de 3 velas: hueco entre `high(i-2)` y `low(i)` (alcista) o entre `low(i-2)` y
 *     `high(i)` (bajista), tamaño >= `minGapPoints`.
 *  2. Inversión: la PRIMERA vela posterior cuyo CIERRE (no mecha) cruza el borde contrario de la
 *     zona. Se exige que la vela anterior NO hubiera cruzado ya ese borde, para que el evento sea
 *     "la vela que cruza", no "cualquier vela mientras el precio se queda fuera".
 *  3. Dirección resultante: FVG alcista invertido -> sesgo bajista (`sell`). FVG bajista
 *     invertido -> sesgo alcista (`buy`).
 */

/**
 * Busca todos los FVG de 3 velas en `candles` con hueco >= minGapPoints. Sin lookahead: cada zona
 * solo depende de las 3 velas que la forman.
 *
 * `indexOffset` (default 0): si `candles` es un SUBTRAMO de una serie más larga (p. ej. un
 * lookback acotado para no reescanear todo el histórico en cada llamada — ver `index.ts` modo
 * "retest"), se suma a los índices locales para que `formedAt` siga siendo un índice válido sobre
 * la serie ORIGINAL completa, no sobre el subtramo. Con offset 0 (el uso normal, modo "close"),
 * el comportamiento es idéntico al de antes.
 */
export function detectFvgZones(candles: Candle[], minGapPoints: number, indexOffset = 0): FvgZone[] {
  const zones: FvgZone[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2]!;
    const c3 = candles[i]!;

    if (c1.h < c3.l) {
      const gap = c3.l - c1.h;
      if (gap >= minGapPoints) {
        zones.push({ direction: "bullish", top: c3.l, bottom: c1.h, formedAt: i + indexOffset, sizePoints: gap });
      }
    } else if (c1.l > c3.h) {
      const gap = c1.l - c3.h;
      if (gap >= minGapPoints) {
        zones.push({ direction: "bearish", top: c1.l, bottom: c3.h, formedAt: i + indexOffset, sizePoints: gap });
      }
    }
  }
  return zones;
}

/**
 * Inversiones que se CONFIRMAN exactamente en la barra `now` (cierre de `now` cruza el borde
 * contrario de la zona, y el cierre de `now - 1` todavía no lo había cruzado). Solo considera
 * zonas formadas ANTES de `now` (`zone.formedAt < now`) — anti-lookahead.
 */
export function detectIfvgAt(candles: Candle[], zones: FvgZone[], now: number): IfvgSignal[] {
  if (now < 1) return [];
  const bar = candles[now];
  const prev = candles[now - 1];
  if (!bar || !prev) return [];

  const results: IfvgSignal[] = [];
  for (const zone of zones) {
    if (zone.formedAt >= now) continue;

    if (zone.direction === "bullish" && bar.c < zone.bottom && prev.c >= zone.bottom) {
      results.push({ side: "sell", zoneTop: zone.top, zoneBottom: zone.bottom, formedAt: zone.formedAt, invertedAt: now });
    } else if (zone.direction === "bearish" && bar.c > zone.top && prev.c <= zone.top) {
      results.push({ side: "buy", zoneTop: zone.top, zoneBottom: zone.bottom, formedAt: zone.formedAt, invertedAt: now });
    }
  }
  return results;
}

/**
 * Variante de entrada por RETEST (pregunta abierta #1, 05_PREGUNTAS_ABIERTAS.md): en vez de
 * entrar al cierre de la vela que confirma la inversión, se espera a que el precio VUELVA a tocar
 * la zona ya invertida antes de entrar (mejor R:R típico, sin bound de tiempo garantizado).
 *
 * `pending` son las inversiones ya confirmadas hoy (una por sesión, resuelto por el caller —
 * `index.ts` filtra "la primera a favor del bias dentro de la ventana" antes de llamar aquí).
 * Devuelve las que hacen su PRIMER retest exactamente en `now`: si una inversión ya fue
 * retesteada en una barra anterior, no se re-dispara aquí (la entrada real fue en esa barra).
 * Entrada declarada: al CIERRE de la vela que retestea (misma convención que el modo "close").
 */
export function detectIfvgRetestAt(candles: Candle[], pending: IfvgSignal[], now: number): IfvgSignal[] {
  const bar = candles[now];
  if (!bar) return [];

  const touchesZone = (inv: IfvgSignal, b: Candle): boolean => (inv.side === "sell" ? b.h >= inv.zoneBottom : b.l <= inv.zoneTop);

  const results: IfvgSignal[] = [];
  for (const inv of pending) {
    if (inv.invertedAt >= now) continue; // el retest no puede ocurrir en la propia barra de inversión ni antes
    if (!touchesZone(inv, bar)) continue;

    let alreadyRetested = false;
    for (let k = inv.invertedAt + 1; k < now; k++) {
      const mid = candles[k];
      if (mid && touchesZone(inv, mid)) {
        alreadyRetested = true;
        break;
      }
    }
    if (!alreadyRetested) results.push(inv);
  }
  return results;
}
