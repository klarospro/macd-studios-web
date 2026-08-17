import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Caché en disco de velas históricas.
 *
 * Nace de un fallo medido el 2026-08-13: el ciclo pedía 200 velas diarias por
 * símbolo en cada pasada (cada 5 min). Con Deriv eso era gratis; con IG agotó
 * los 10.000 puntos de cuota SEMANAL en minutos y dejó el motor ciego con un
 * `exceeded-account-historical-data-allowance`.
 *
 * La observación que lo arregla es trivial y estaba delante todo el tiempo:
 * **una vela diaria cambia una vez al día**. Pedir doscientas cada cinco
 * minutos no aporta ni un dato nuevo, solo quema cuota.
 *
 * Política: se sirve de disco mientras la última vela siga siendo la vigente
 * para esa resolución; solo se llama al bróker cuando de verdad hay una vela
 * nueva que traer.
 */

export interface VelaCache {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  spread?: number;
}

/** Segundos que dura una vela de cada resolución. */
export function segundosDeResolucion(resolucion: string): number {
  const tabla: Record<string, number> = {
    MINUTE: 60, MINUTE_5: 300, MINUTE_15: 900, MINUTE_30: 1800,
    HOUR: 3600, HOUR_4: 14400, DAY: 86400, WEEK: 604800,
  };
  return tabla[resolucion] ?? 86400;
}

export class CachePrecios {
  constructor(private readonly raiz: string) {}

  private ruta(symbol: string, resolucion: string): string {
    // El símbolo puede traer caracteres raros (epics con puntos): se sanea.
    return join(this.raiz, `${symbol.replace(/[^A-Za-z0-9_-]/g, "_")}-${resolucion}.json`);
  }

  leer(symbol: string, resolucion: string): VelaCache[] {
    const r = this.ruta(symbol, resolucion);
    if (!existsSync(r)) return [];
    try {
      const v = JSON.parse(readFileSync(r, "utf8")) as VelaCache[];
      return Array.isArray(v) ? v : [];
    } catch {
      // Un fichero corrupto se trata como caché vacía: se vuelve a pedir.
      return [];
    }
  }

  /** Fusiona sin duplicar y deja la serie ordenada por tiempo. */
  guardar(symbol: string, resolucion: string, nuevas: VelaCache[], maximo = 2000): VelaCache[] {
    const previas = this.leer(symbol, resolucion);
    const porEpoch = new Map<number, VelaCache>();
    for (const v of previas) porEpoch.set(v.epoch, v);
    // Las nuevas MANDAN: la última vela de una serie viva aún se está formando
    // y su cierre cambia hasta que la vela termina.
    for (const v of nuevas) porEpoch.set(v.epoch, v);

    const todas = [...porEpoch.values()].sort((a, b) => a.epoch - b.epoch).slice(-maximo);
    const r = this.ruta(symbol, resolucion);
    mkdirSync(dirname(r), { recursive: true });
    writeFileSync(r, JSON.stringify(todas), "utf8");
    return todas;
  }

  /**
   * ¿Hace falta molestar al bróker?
   *
   * Solo si la caché no llega al mínimo pedido, o si ya ha empezado una vela
   * posterior a la última guardada. Con margen de un 10% del periodo para no
   * pedir justo en el cambio de vela y traerla a medio formar.
   */
  necesitaRefresco(symbol: string, resolucion: string, minimo: number, ahoraSeg = Math.floor(Date.now() / 1000)): boolean {
    const velas = this.leer(symbol, resolucion);
    if (velas.length < minimo) return true;
    const ultima = velas[velas.length - 1]!;
    const periodo = segundosDeResolucion(resolucion);
    return ahoraSeg - ultima.epoch >= periodo * 1.1;
  }

  /**
   * Anota que el bróker ha dicho "sin cuota de histórico".
   *
   * Sin esto, el ciclo volvía a pedir histórico cada 15 minutos: 962 peticiones
   * en cuatro días, todas rechazadas, sin dejar que la cuota se recuperara
   * nunca. La cuota de IG es SEMANAL, así que reintentar cada pocas horas
   * basta y sobra.
   */
  marcarCuotaAgotada(ahoraSeg = Math.floor(Date.now() / 1000)): void {
    const r = join(this.raiz, "_cuota.json");
    mkdirSync(dirname(r), { recursive: true });
    writeFileSync(r, JSON.stringify({ agotadaEn: ahoraSeg }), "utf8");
  }

  /** ¿Seguimos en el periodo de espera tras un "sin cuota"? */
  cuotaEnCooldown(esperaSeg = 6 * 3600, ahoraSeg = Math.floor(Date.now() / 1000)): boolean {
    const r = join(this.raiz, "_cuota.json");
    if (!existsSync(r)) return false;
    try {
      const { agotadaEn } = JSON.parse(readFileSync(r, "utf8")) as { agotadaEn: number };
      return ahoraSeg - agotadaEn < esperaSeg;
    } catch {
      return false;
    }
  }

  /**
   * Reagrupa una serie fina en velas de un periodo mayor (M15 → DAY).
   *
   * Existe para que la serie que el bot graba solo (siempre en M15) sirva
   * también al sleeve Core, que razona en velas diarias. El cierre resultante
   * es la última observación de la jornada: un cierre diario legítimo.
   *
   * OJO: máximo y mínimo salen de las muestras tomadas, no del rango real del
   * mercado. Solo se debe usar donde importe el CIERRE (ver `dailyCloses`).
   */
  static agrupar(velas: VelaCache[], periodoDestino: number): VelaCache[] {
    const porBloque = new Map<number, VelaCache>();
    for (const v of velas) {
      const inicio = Math.floor(v.epoch / periodoDestino) * periodoDestino;
      const previa = porBloque.get(inicio);
      porBloque.set(
        inicio,
        previa
          ? {
              epoch: inicio,
              open: previa.open,
              high: Math.max(previa.high, v.high),
              low: Math.min(previa.low, v.low),
              close: v.close,
              spread: v.spread ?? previa.spread,
            }
          : { ...v, epoch: inicio },
      );
    }
    return [...porBloque.values()].sort((a, b) => a.epoch - b.epoch);
  }

  /** Cuántas velas pedir para tapar el hueco, sin traer de más. */
  velasQueFaltan(symbol: string, resolucion: string, minimo: number, ahoraSeg = Math.floor(Date.now() / 1000)): number {
    const velas = this.leer(symbol, resolucion);
    if (velas.length < minimo) return minimo;
    const periodo = segundosDeResolucion(resolucion);
    const transcurridas = Math.ceil((ahoraSeg - velas[velas.length - 1]!.epoch) / periodo);
    // +1 para refrescar la última (que pudo cerrarse distinta a como se guardó).
    return Math.max(1, Math.min(minimo, transcurridas + 1));
  }
}
