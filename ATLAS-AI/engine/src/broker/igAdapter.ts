import { fileURLToPath } from "node:url";
import { CachePrecios, VelaCache, segundosDeResolucion } from "./cachePrecios";
import { GrabadorPrecios } from "./grabadorPrecios";
import { IgClient, IgConfig, ResolucionIg, VelaIg } from "./igClient";
import { Order, Position } from "../domain/types";
import { Vela } from "../domain/bars";

/**
 * Adaptador de ejecución contra IG Markets.
 *
 * Sustituye a Deriv como venue operativo por tres razones medidas el 2026-08-13:
 *   1. Deriv dejó de ofrecer contratos (17 h de rechazos) y su capa de ofertas
 *      resultó ser un punto único de fallo sin aviso.
 *   2. IG publica BID/ASK reales; Deriv no. Sin eso el coste era un supuesto,
 *      y el supuesto estaba 17x equivocado.
 *   3. IG permite operar índices (US30, Nasdaq). Deriv daba su precio pero
 *      rechazaba la orden.
 *
 * SEGURIDAD: el entorno lo fija `IG_ENV`. Con DEMO, la URL base es
 * `demo-api.ig.com` y es materialmente imposible que una orden alcance la
 * cuenta real — no depende de una bandera interna que alguien pueda olvidar.
 */

/** Símbolo interno de Atlas → epic de IG. Verificados contra la cuenta Z6DHEP. */
/**
 * Universo operable en IG: CUATRO instrumentos, decidido por Moisés el
 * 2026-08-17. Pocos y conocidos, para poder controlar y probar de verdad lo que
 * hace el bot antes de ampliar. USD/JPY se retiró de esta lista.
 *
 * Son los contratos MINI a propósito. Con los estándar, el lote mínimo de IG
 * arriesgaba más que el presupuesto entero: en NASDAQ, 0,2 lotes con un stop
 * diario se llevaban 87% de la cuenta, y el gestor de riesgo tenía que
 * rechazarlos siempre. Medido el 2026-08-17 con 8 626 € en cuenta:
 *
 *   estándar         mini          coste de 1 punto con el lote mínimo
 *   -------------    ----------    -----------------------------------
 *   NASDAQ  IFD      IFM           20,00 $  ->  5,00 $
 *   US30    IFD      IFM            2,00 $  ->  1,00 $
 *   oro     CFDGC    CFM (10oz)    10,00 $  ->  1,00 $
 *
 * Con los mini, el oro cabe en el Core con su stop diario y los índices caben
 * con stops cortos. No es un truco: es elegir el contrato del tamaño de la
 * cuenta en vez de deformar la estrategia para que quepa en el contrato.
 *
 * Añadir un símbolo aquí es añadirlo al bot: no se opera nada que no esté.
 */
export const EPIC_POR_SIMBOLO: Record<string, string> = {
  frxEURUSD: "CS.D.EURUSD.MINI.IP", // 0,10 $/punto con el lote mínimo
  frxXAUUSD: "CS.D.CFDGOLD.CFM.IP", // Spot Gold Mini (10 oz) — 1,00 $ por cada $1
  US30: "IX.D.DOW.IFM.IP", // Wall Street Cash ($2) — 1,00 $/punto
  NASDAQ: "IX.D.NASDAQ.IFM.IP", // US Tech 100 Cash ($20) — 5,00 $/punto
};

/** Resolución de IG equivalente a un tamaño de vela en segundos. */
function resolucionDe(granularidadSeg: number): ResolucionIg {
  if (granularidadSeg <= 60) return "MINUTE";
  if (granularidadSeg <= 300) return "MINUTE_5";
  if (granularidadSeg <= 900) return "MINUTE_15";
  if (granularidadSeg <= 1800) return "MINUTE_30";
  if (granularidadSeg <= 3600) return "HOUR";
  if (granularidadSeg <= 14400) return "HOUR_4";
  return "DAY";
}

const aVela = (v: VelaIg): Vela => ({
  epoch: v.epoch, open: v.mid.open, high: v.mid.high, low: v.mid.low, close: v.mid.close,
});

interface PosicionIg {
  dealId: string;
  epic: string;
  direccion: "BUY" | "SELL";
  tamano: number;
  nivelApertura: number;
}

/**
 * Ajusta un tamaño al escalón que admite el instrumento, redondeando HACIA
 * ABAJO y con los decimales exactos del escalón.
 *
 * IG rechaza la orden completa —no la recorta— si el tamaño trae más decimales
 * de los que admite el epic: `validation.number.too-many-decimal-places`. Y el
 * redondeo va a la baja a propósito: al alza se abriría una posición mayor que
 * la que autorizó el gestor de riesgo.
 */
export function ajustarTamano(tamano: number, escalon: number): number {
  if (!(escalon > 0)) return tamano;
  const decimales = (String(escalon).split(".")[1] ?? "").length;
  const pasos = Math.floor(tamano / escalon + 1e-9);
  return Number((pasos * escalon).toFixed(decimales));
}

export class IgAdapter {
  readonly name = "ig";
  private readonly cliente: IgClient;
  private readonly cache: CachePrecios;
  private readonly grabador: GrabadorPrecios;
  accountId = "";
  currency = "";

  constructor(config: IgConfig, rutaCache?: string) {
    this.cliente = new IgClient(config);
    this.cache = new CachePrecios(rutaCache ?? fileURLToPath(new URL("../../runtime/cache-ig/", import.meta.url)));
    this.grabador = new GrabadorPrecios(this.cache);
  }

  /**
   * Serie de velas: el histórico del bróker es la BASE, el precio vivo es el
   * motor.
   *
   * Rediseñado el 2026-08-17 tras cuatro días con el bot ciego. El diseño
   * anterior trataba el histórico como la fuente de verdad y lo repedía en cada
   * pasada; cuando IG contestó `exceeded-account-historical-data-allowance`
   * (cuota SEMANAL agotada), el ciclo siguió pidiendo cada 15 minutos —962
   * rechazos— y mientras tanto servía en silencio velas de hace dos días. Un
   * motor que decide sobre precios rancios es peor que un motor parado.
   *
   * Ahora: se descarga histórico UNA vez para tener base, y a partir de ahí la
   * serie se prolonga con lo que el bot observa en vivo en cada ciclo (el
   * snapshot `/markets/{epic}` NO gasta cuota). La serie que ven las estrategias
   * termina SIEMPRE en el precio de ahora mismo, sin depender de la cuota.
   *
   * @param permitirPropia velas propias solo donde importa el cierre. Ver
   *   `intradayCandles`: su máximo/mínimo son de las muestras, no del mercado.
   */
  private async velas(
    symbol: string,
    resolucion: ResolucionIg,
    minimo: number,
    permitirPropia = false,
  ): Promise<VelaCache[]> {
    const epic = this.epic(symbol);

    // Al bróker solo se le molesta si falta base Y queda cuota que gastar.
    if (this.cache.necesitaRefresco(epic, resolucion, minimo) && !this.cache.cuotaEnCooldown()) {
      const cuantas = this.cache.velasQueFaltan(epic, resolucion, minimo);
      try {
        const { velas } = await this.cliente.historial(epic, resolucion, cuantas);
        this.cache.guardar(
          epic,
          resolucion,
          velas.map((v) => ({
            epoch: v.epoch, open: v.mid.open, high: v.mid.high,
            low: v.mid.low, close: v.mid.close, spread: v.spread,
          })),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("exceeded-account-historical-data-allowance")) {
          // Se apunta y no se vuelve a pedir en horas. Insistir no devuelve la
          // cuota: solo llena el log y esconde el problema.
          this.cache.marcarCuotaAgotada();
          console.log(`  sin cuota de histórico en IG · se sigue con la serie propia (reintento en 6 h)`);
        } else {
          console.log(`  aviso: no se pudo refrescar ${symbol} (${msg})`);
        }
      }
    }

    const base = this.cache.leer(epic, resolucion);
    if (!permitirPropia) return base;

    // La serie propia (M15) se reagrupa a la resolución pedida y se pega al
    // final de la base. La base MANDA donde exista: sus velas son reales.
    const periodo = segundosDeResolucion(resolucion);
    const propias = CachePrecios.agrupar(this.grabador.serie(epic), periodo);
    if (propias.length === 0) return base;
    const finBase = base.length > 0 ? base[base.length - 1]!.epoch : -Infinity;
    return [...base, ...propias.filter((v) => v.epoch > finBase)];
  }

  /**
   * Cuánto hace que no entra un dato nuevo, en periodos de esa resolución.
   * `null` si no hay serie. Lo usan los métodos públicos para negarse a
   * decidir sobre precios viejos en vez de operar a ciegas.
   */
  private antiguedad(velas: VelaCache[], resolucion: ResolucionIg): number | null {
    if (velas.length === 0) return null;
    const periodo = segundosDeResolucion(resolucion);
    return (Math.floor(Date.now() / 1000) - velas[velas.length - 1]!.epoch) / periodo;
  }

  private epic(symbol: string): string {
    const e = EPIC_POR_SIMBOLO[symbol];
    // Fallo seguro: un símbolo sin epic conocido NO se opera a ciegas.
    if (!e) throw new Error(`Sin epic de IG para ${symbol}`);
    return e;
  }

  async connect(): Promise<void> {
    await this.cliente.conectar();
    this.accountId = this.cliente.accountId;
    this.currency = this.cliente.currency;
  }

  async disconnect(): Promise<void> {
    await this.cliente.desconectar();
  }

  async getEquity(): Promise<number> {
    const c = await this.cliente.cuenta();
    // Equity = saldo + P&L abierto. El "balance" a secas no incluye lo flotante
    // y usarlo haría que los breakers de drawdown reaccionaran tarde.
    return c.balance + c.pnl;
  }

  /**
   * Salud del venue: qué instrumentos están operables AHORA. El ciclo lo usa
   * para distinguir "mercado cerrado" de "bróker caído" (ver vigilanciaVenue).
   */
  async activeSymbols(): Promise<Array<{ symbol: string; nombre: string; mercado: string; submercado: string; abierto: boolean }>> {
    const salida: Array<{ symbol: string; nombre: string; mercado: string; submercado: string; abierto: boolean }> = [];
    for (const [symbol, epic] of Object.entries(EPIC_POR_SIMBOLO)) {
      try {
        const m = await this.cliente.mercado(epic);
        // Se aprovecha la consulta para ir construyendo serie propia. El
        // snapshot de precio NO cuenta contra la cuota de histórico (solo
        // /prices lo hace), así que esto es gratis y crece en cada pasada.
        if (m.estado === "TRADEABLE") {
          this.grabador.registrar(epic, { epoch: Math.floor(Date.now() / 1000), bid: m.bid, ask: m.ask });
        }
        salida.push({ symbol, nombre: symbol, mercado: "ig", submercado: epic, abierto: m.estado === "TRADEABLE" });
      } catch {
        // Un instrumento que falla no debe hacer creer que el venue entero cayó.
      }
    }
    return salida;
  }

  /**
   * Cierres diarios: base del bróker + jornadas que el bot ha cerrado él solo.
   *
   * Aquí SÍ vale la serie propia. El Core decide sobre cierres, y el cierre de
   * la serie propia es la última observación real de la jornada — un cierre
   * legítimo. Es lo que permite que el Core siga operando sin cuota.
   */
  async dailyCloses(symbol: string, count: number): Promise<number[]> {
    const v = await this.velas(symbol, "DAY", count, true);
    const dias = this.antiguedad(v, "DAY");
    // Un cierre diario de hace más de dos jornadas no describe este mercado.
    if (dias === null || dias > 2) {
      throw new Error(`sin cierres diarios frescos de ${symbol} (${dias === null ? "sin serie" : dias.toFixed(1) + " días"})`);
    }
    return v.map((x) => x.close).slice(-count);
  }

  /**
   * Velas intradía: SOLO las del bróker.
   *
   * La serie propia no sirve aquí y hay que decirlo en voz alta: se forma con
   * una observación por ciclo, así que su máximo y su mínimo son los de las
   * muestras, no los del mercado. Un ATR calculado sobre eso sale ridículamente
   * pequeño y el tamaño de posición saldría enorme. Sin velas reales y frescas,
   * este sleeve NO opera ese símbolo.
   */
  async intradayCandles(symbol: string, granularity: number, count: number): Promise<Vela[]> {
    const resolucion = resolucionDe(granularity);
    const v = await this.velas(symbol, resolucion, count);
    const periodos = this.antiguedad(v, resolucion);
    if (periodos === null || periodos > 3) {
      throw new Error(
        `sin velas intradía frescas de ${symbol} (${periodos === null ? "sin serie" : periodos.toFixed(0) + " periodos"})`,
      );
    }
    return v.slice(-count).map((x) => ({ epoch: x.epoch, open: x.open, high: x.high, low: x.low, close: x.close }));
  }

  /** IG no expone el tick a tick histórico en REST: se aproxima con velas de 1 min. */
  async ticksEntre(symbol: string, desde: number, hasta: number): Promise<number[]> {
    const minutos = Math.max(1, Math.min(500, Math.ceil((hasta - desde) / 60)));
    const { velas } = await this.cliente.historial(this.epic(symbol), "MINUTE", minutos);
    return velas.filter((v) => v.epoch >= desde && v.epoch <= hasta).map((v) => v.mid.close);
  }

  /**
   * Coste REAL de abrir: medio spread por lado. En IG el spread ES la comisión
   * en forex e índices, así que no hay que sumarle nada más.
   */
  async costeApertura(symbol: string, stake: number): Promise<{ commission: number | null; spot: number | null }> {
    const m = await this.cliente.mercado(this.epic(symbol));
    const medio = (m.bid + m.ask) / 2;
    return { commission: (m.spread / 2) * (stake / medio), spot: medio };
  }

  /**
   * Cuánto vale 1 unidad de la divisa de la CUENTA en la divisa del
   * instrumento. La cuenta va en EUR y estos cuatro instrumentos liquidan en
   * USD: sin convertir, el presupuesto de riesgo se aplicaría con un 16% de
   * error permanente.
   */
  private async cambioDesdeCuenta(divisaInstrumento?: string): Promise<number> {
    const cuenta = this.currency || "EUR";
    if (!divisaInstrumento || divisaInstrumento === cuenta) return 1;
    if (cuenta === "EUR" && divisaInstrumento === "USD") {
      // El propio EUR/USD que ya operamos da el cambio. Viene en puntos
      // (11575,6 = 1,15756), de ahí la escala.
      const m = await this.cliente.mercado(EPIC_POR_SIMBOLO.frxEURUSD!);
      return ((m.bid + m.ask) / 2) / 10_000;
    }
    // Fallo seguro: sin cambio conocido no se inventa uno. Un 1 aquí
    // dimensionaría con la divisa equivocada y nadie se enteraría.
    throw new Error(`sin tipo de cambio ${cuenta}->${divisaInstrumento}: no se dimensiona a ciegas`);
  }

  /**
   * Los `dealId` que el BRÓKER dice tener abiertos ahora mismo.
   *
   * Es la lista contra la que se concilia el estado del motor. El 2026-08-17 el
   * panel enseñó cuatro posiciones que en IG no existían: sin esta comprobación,
   * una posición que el motor cree tener vive para siempre aunque nadie la haya
   * abierto nunca.
   */
  async dealIdsAbiertos(): Promise<Set<string>> {
    return new Set((await this.posiciones()).map((p) => p.dealId));
  }

  private async posiciones(): Promise<PosicionIg[]> {
    const r = await fetch(`${this.cliente.base}/positions`, { headers: this.cabeceras("2") });
    if (!r.ok) throw new Error(`IG positions ${r.status}`);
    const j = (await r.json()) as { positions: Array<Record<string, any>> };
    return (j.positions ?? []).map((p) => ({
      dealId: p.position.dealId,
      epic: p.market.epic,
      direccion: p.position.direction,
      tamano: p.position.size,
      nivelApertura: p.position.level,
    }));
  }

  /** Delegado en el cliente, que es quien guarda CST y token de sesión. */
  private cabeceras(version: string): Record<string, string> {
    return this.cliente.cabeceras(version);
  }

  async placeOrder(order: Order): Promise<Position> {
    const epic = this.epic(order.symbol);
    const m = await this.cliente.mercado(epic);
    if (m.estado !== "TRADEABLE") throw new Error(`${order.symbol} no operable ahora (${m.estado})`);

    // EL TAMAÑO SE CALCULA AQUÍ, no se hereda del motor.
    //
    // El motor razona en "dinero arriesgado", que es como se opera en Deriv.
    // En IG el tamaño son CONTRATOS y cada instrumento tiene su valor por punto
    // (`lotSize`): en oro vale 100, así que "0,1" no es 0,1 onzas sino 10. El
    // 2026-08-17 eso abrió una posición que arriesgaba 807 $ creyendo que
    // arriesgaba 14 $ —57 veces más— sobre una cuenta de 8 626 €. La conversión
    // de unidades vive en el adaptador porque es el único que conoce al bróker.
    const distancia = Math.abs(order.entryPrice - order.stopPrice);
    if (!(distancia > 0)) throw new Error(`stop pegado al precio en ${order.symbol}: no se puede dimensionar`);

    const riesgoEnDivisa = order.riskAmount * (await this.cambioDesdeCuenta(m.divisas[0]));
    const bruto = riesgoEnDivisa / (distancia * m.valorPorPunto);
    const size = ajustarTamano(bruto, m.minTamano);

    if (size < m.minTamano) {
      // Se dice lo que costaría el lote mínimo: es el dato que hace falta para
      // decidir si la cuenta da para este instrumento o no.
      const riesgoMinimo = m.minTamano * distancia * m.valorPorPunto;
      throw new Error(
        `el lote mínimo de IG (${m.minTamano}) arriesgaría ${riesgoMinimo.toFixed(0)} ${m.divisas[0] ?? ""} ` +
          `y el presupuesto es ${riesgoEnDivisa.toFixed(0)} · no se opera`,
      );
    }

    const cuerpo = {
      epic,
      expiry: "-",
      direction: order.side === "buy" ? "BUY" : "SELL",
      size,
      orderType: "MARKET",
      // El stop viaja CON la orden: si el proceso muere entre abrir y poner el
      // stop, la posición se queda desprotegida en el bróker. Enviarlo junto es
      // la única forma de que eso no pueda pasar.
      stopLevel: order.stopPrice,
      guaranteedStop: false,
      forceOpen: true,
      // La divisa del INSTRUMENTO, no la de la cuenta. Mandar EUR en un epic
      // que solo cotiza en USD hacía que IG devolviera `REJECTED` con motivo
      // `UNKNOWN`: horas de depuración por un campo.
      currencyCode: m.divisas[0] ?? (this.currency || "EUR"),
    };

    const r = await fetch(`${this.cliente.base}/positions/otc`, {
      method: "POST",
      headers: this.cabeceras("2"),
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, any>;
    if (!r.ok) throw new Error(`IG orden ${r.status}: ${j.errorCode ?? ""}`);

    // IG confirma en dos pasos: la orden devuelve una referencia y hay que
    // consultar si acabó aceptada. Dar por buena la referencia sería registrar
    // como abierta una posición que el bróker rechazó.
    const conf = await fetch(`${this.cliente.base}/confirms/${j.dealReference}`, { headers: this.cabeceras("1") });
    const c = (await conf.json().catch(() => ({}))) as Record<string, any>;
    if (c.dealStatus !== "ACCEPTED") {
      // El motivo va COMPLETO a propósito: un "UNKNOWN" a secas obliga a
      // depurar a ciegas contra el bróker, y ese fue el coste real de esta
      // tarde. Aquí caben tamaño, nivel de stop y estado; todos hacen falta
      // para saber qué corregir.
      const detalle = [
        c.reason && `motivo ${c.reason}`,
        c.dealStatus && `estado ${c.dealStatus}`,
        c.rejectReason && `rechazo ${c.rejectReason}`,
        c.status && `posición ${c.status}`,
        `pedido size ${size} stop ${order.stopPrice}`,
        c.level != null && `nivel ${c.level}`,
      ]
        .filter(Boolean)
        .join(" · ");
      throw new Error(`IG rechazó la orden: ${detalle}`);
    }

    return {
      id: c.dealId,
      symbol: order.symbol,
      side: order.side,
      size: c.size ?? size,
      entryPrice: c.level ?? order.entryPrice,
      stopPrice: order.stopPrice,
      riskAmount: order.riskAmount,
      correlationGroup: order.correlationGroup,
    };
  }

  /** P&L vivo de una posición abierta, en moneda de cuenta. */
  async contractPnl(dealId: string): Promise<{ profit: number; currentSpot: number }> {
    const abiertas = await this.posiciones();
    const p = abiertas.find((x) => x.dealId === dealId);
    if (!p) throw new Error(`Posición IG desconocida: ${dealId}`);
    const m = await this.cliente.mercado(p.epic);
    // Se valora al precio al que se PODRÍA cerrar, no al punto medio: cerrar un
    // largo se hace contra el bid. Usar el medio infla el P&L sistemáticamente.
    const salida = p.direccion === "BUY" ? m.bid : m.ask;
    const delta = p.direccion === "BUY" ? salida - p.nivelApertura : p.nivelApertura - salida;
    // Con `valorPorPunto` y el cambio a la divisa de la cuenta. Sin las dos
    // cosas el panel enseñaba 0,09 € donde IG cobraba 6,59 €: el operador
    // miraba una cifra que no era la suya.
    const enDivisa = delta * p.tamano * m.valorPorPunto;
    const cambio = await this.cambioDesdeCuenta(m.divisas[0]).catch(() => 1);
    return { profit: enDivisa / cambio, currentSpot: (m.bid + m.ask) / 2 };
  }

  async closePosition(dealId: string): Promise<void> {
    const abiertas = await this.posiciones();
    const p = abiertas.find((x) => x.dealId === dealId);
    if (!p) return; // ya no existe: cerrarla otra vez no es un error

    const r = await fetch(`${this.cliente.base}/positions/otc`, {
      method: "POST",
      headers: { ...this.cabeceras("1"), "_method": "DELETE" },
      body: JSON.stringify({
        dealId,
        direction: p.direccion === "BUY" ? "SELL" : "BUY",
        size: p.tamano,
        orderType: "MARKET",
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(`IG cierre ${r.status}: ${j.errorCode ?? ""}`);
    }
  }

  /**
   * Reconciliación: qué dice el bróker que tenemos abierto. El ciclo debe
   * comparar esto con su estado local y parar si no cuadran (Fase 9 del brief:
   * LOCAL_POSITION vs BROKER_POSITION).
   */
  async posicionesDelBroker(): Promise<Array<{ id: string; symbol: string; side: "buy" | "sell"; size: number; entryPrice: number }>> {
    const epicASimbolo = Object.fromEntries(Object.entries(EPIC_POR_SIMBOLO).map(([s, e]) => [e, s]));
    return (await this.posiciones()).map((p) => ({
      id: p.dealId,
      symbol: epicASimbolo[p.epic] ?? p.epic,
      side: p.direccion === "BUY" ? "buy" : "sell",
      size: p.tamano,
      entryPrice: p.nivelApertura,
    }));
  }
}
