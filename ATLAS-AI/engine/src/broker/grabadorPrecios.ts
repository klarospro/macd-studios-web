import { CachePrecios, VelaCache, segundosDeResolucion } from "./cachePrecios";

/**
 * Construye velas propias a partir de los precios en vivo de cada ciclo.
 *
 * Nace de un límite duro: IG raciona 10.000 puntos de histórico por SEMANA y se
 * agotaron el 2026-08-13. Pero el snapshot de precio (`/markets/{epic}`) NO
 * cuenta contra esa cuota — solo `/prices` lo hace. Si el ciclo ya consulta el
 * precio vivo de cada instrumento en cada pasada, esa observación se puede
 * guardar y agregar en velas: histórico propio, gratis y creciendo solo.
 *
 * Con el ciclo cada 15 minutos, una semana da ~672 velas por instrumento. Es
 * exactamente lo que falta para pasar de 44 señales (indistinguibles del azar)
 * a varios cientos y poder decidir si el motor de flujo tiene ventaja.
 *
 * LIMITACIÓN QUE HAY QUE TENER PRESENTE: una vela construida así se forma con
 * UNA observación por ciclo, no con todas las operaciones del periodo. Su
 * máximo y mínimo son los de las muestras tomadas, no los reales del mercado,
 * y no lleva volumen. Sirve para estudiar el precio y el spread; NO sustituye
 * a las velas del bróker para nada que dependa del rango exacto.
 */

export interface Observacion {
  epoch: number;
  bid: number;
  ask: number;
}

/** Sufijo que distingue estas velas de las descargadas del bróker. */
export const SUFIJO_PROPIO = "_PROPIO";

export class GrabadorPrecios {
  constructor(
    private readonly cache: CachePrecios,
    private readonly resolucion = "MINUTE_15",
  ) {}

  private clave(epic: string): string {
    return `${epic}${SUFIJO_PROPIO}`;
  }

  /**
   * Registra una observación y devuelve la serie actualizada.
   *
   * Si cae dentro de la vela en curso, la actualiza (máximo, mínimo, cierre);
   * si abre una vela nueva, la crea. El instante se alinea al inicio del
   * periodo para que las velas queden en la rejilla estándar.
   */
  registrar(epic: string, obs: Observacion): VelaCache[] {
    const periodo = segundosDeResolucion(this.resolucion);
    const inicio = Math.floor(obs.epoch / periodo) * periodo;
    const medio = (obs.bid + obs.ask) / 2;
    const spread = obs.ask - obs.bid;

    const clave = this.clave(epic);
    const serie = this.cache.leer(clave, this.resolucion);
    const ultima = serie[serie.length - 1];

    if (ultima && ultima.epoch === inicio) {
      const actualizada: VelaCache = {
        epoch: inicio,
        open: ultima.open,
        high: Math.max(ultima.high, medio),
        low: Math.min(ultima.low, medio),
        close: medio,
        spread,
      };
      return this.cache.guardar(clave, this.resolucion, [actualizada]);
    }

    return this.cache.guardar(clave, this.resolucion, [
      { epoch: inicio, open: medio, high: medio, low: medio, close: medio, spread },
    ]);
  }

  /** Serie propia acumulada de un instrumento. */
  serie(epic: string): VelaCache[] {
    return this.cache.leer(this.clave(epic), this.resolucion);
  }

  /** Cuántas velas propias llevamos por instrumento, para seguir el progreso. */
  progreso(epics: string[]): Array<{ epic: string; velas: number; desde: string | null }> {
    return epics.map((epic) => {
      const s = this.serie(epic);
      return {
        epic,
        velas: s.length,
        desde: s.length > 0 ? new Date(s[0]!.epoch * 1000).toISOString().slice(0, 16) : null,
      };
    });
  }
}
