/**
 * Cliente REST de IG (IG Markets). Base compartida por el adaptador de
 * ejecución y por los scripts de descarga histórica.
 *
 * Dos cosas que IG hace distinto a Deriv y que condicionan el diseño:
 *
 * 1. BID/ASK REALES. Las velas llegan con precio de compra y de venta por
 *    separado, así que el spread se MIDE en vez de asumirse. Es la diferencia
 *    entre un backtest con un coste inventado y uno con el coste que pagas.
 *
 * 2. CUOTA DE HISTÓRICO. IG raciona los puntos de precio históricos por
 *    semana y responde con cuánto queda. Gastarla sin mirar deja la cuenta
 *    seca días. Por eso `historial()` devuelve siempre la cuota restante.
 *
 * Seguridad: `IG_ENV` gobierna el endpoint. Mientras diga DEMO, es
 * imposible que una orden llegue a la cuenta real — no es una convención,
 * es la URL la que cambia.
 */

export interface IgConfig {
  apiKey: string;
  usuario: string;
  password: string;
  entorno: "DEMO" | "LIVE";
}

export function igConfigDesdeEnv(): IgConfig {
  const apiKey = process.env.IG_API_KEY;
  const usuario = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;
  if (!apiKey || !usuario || !password) {
    throw new Error("Faltan IG_API_KEY / IG_USERNAME / IG_PASSWORD en el entorno");
  }
  // Por defecto DEMO: si la variable falta o viene mal escrita, se opera en
  // demo. El fallo seguro nunca puede ser "acabas en la cuenta real".
  const entorno = process.env.IG_ENV?.toUpperCase() === "LIVE" ? "LIVE" : "DEMO";
  return { apiKey, usuario, password, entorno };
}

export const BASE_DEMO = "https://demo-api.ig.com/gateway/deal";
export const BASE_LIVE = "https://api.ig.com/gateway/deal";

/** Resoluciones de vela que admite IG. */
export type ResolucionIg =
  | "MINUTE" | "MINUTE_5" | "MINUTE_15" | "MINUTE_30"
  | "HOUR" | "HOUR_4" | "DAY" | "WEEK" | "MONTH";

/** Una vela de IG trae TRES series: compra, venta y el punto medio. */
export interface VelaIg {
  epoch: number;
  bid: { open: number; high: number; low: number; close: number };
  ask: { open: number; high: number; low: number; close: number };
  /** Punto medio, que es lo que usan las estrategias para decidir. */
  mid: { open: number; high: number; low: number; close: number };
  /** Spread al cierre, en unidades de precio. */
  spread: number;
  volumen: number | null;
}

export interface Cuota {
  restante: number;
  total: number;
  expiraEnSegundos: number;
}

/**
 * Una operación ya cerrada según el bróker, con su P&L real cobrado.
 * `referencia` es el identificador de IG: sirve para no duplicar al re-sincronizar.
 */
export interface TransaccionIg {
  referencia: string;
  fecha: string;
  instrumento: string;
  tipo: string;
  tamano: number;
  nivelApertura: number | null;
  nivelCierre: number | null;
  pnl: number;
  divisa: string;
}

interface PrecioCrudo {
  snapshotTimeUTC?: string;
  snapshotTime?: string;
  openPrice: { bid: number | null; ask: number | null };
  highPrice: { bid: number | null; ask: number | null };
  lowPrice: { bid: number | null; ask: number | null };
  closePrice: { bid: number | null; ask: number | null };
  lastTradedVolume?: number;
}

const medio = (bid: number | null, ask: number | null): number =>
  bid != null && ask != null ? (bid + ask) / 2 : (bid ?? ask ?? NaN);

/**
 * IG v2 marca las velas como `"2026/08/11 00:00:00"` (barras, hora UTC, sin
 * zona). `new Date()` no entiende ese formato y devuelve Invalid Date, lo que
 * hacía que TODAS las velas se descartaran silenciosamente — el descargador
 * consumía cuota y guardaba cero. Se parsea a mano.
 */
export function epochDeIg(marca: string): number {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(marca);
  if (m) {
    return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) / 1000;
  }
  // `snapshotTimeUTC` (versiones nuevas) ya viene en ISO.
  const t = Date.parse(marca.endsWith("Z") ? marca : `${marca}Z`);
  return Number.isFinite(t) ? t / 1000 : NaN;
}

export class IgClient {
  private cst?: string;
  private token?: string;
  readonly base: string;
  accountId = "";
  currency = "";

  constructor(private readonly config: IgConfig) {
    this.base = config.entorno === "LIVE" ? BASE_LIVE : BASE_DEMO;
  }

  /** Cabeceras firmadas de la sesión. Público: el adaptador las necesita. */
  cabeceras(version: string, autenticado = true): Record<string, string> {
    const h: Record<string, string> = {
      "X-IG-API-KEY": this.config.apiKey,
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json; charset=UTF-8",
      Version: version,
    };
    if (autenticado && this.cst && this.token) {
      h.CST = this.cst;
      h["X-SECURITY-TOKEN"] = this.token;
    }
    return h;
  }

  /**
   * Abre sesión, reintentando ante limitación de IG.
   *
   * IG estrangula los logins seguidos y responde
   * `failure-invalid-client-security-token`, que NO significa credenciales
   * malas sino "demasiado rápido". Un bot 24/7 se topa con esto en cuanto
   * coinciden el timer y cualquier ejecución manual, y morir por eso dejaría
   * la cartera sin vigilancia hasta la siguiente pasada.
   */
  async conectar(intentos = 3): Promise<void> {
    let ultimoError = "";
    for (let intento = 1; intento <= intentos; intento++) {
      const r = await fetch(`${this.base}/session`, {
        method: "POST",
        headers: this.cabeceras("2", false),
        body: JSON.stringify({ identifier: this.config.usuario, password: this.config.password }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, any>;

      if (r.ok) {
        this.cst = r.headers.get("CST") ?? undefined;
        this.token = r.headers.get("X-SECURITY-TOKEN") ?? undefined;
        this.accountId = j.currentAccountId ?? "";
        this.currency = j.currencyIsoCode ?? "";
        return;
      }

      ultimoError = `${r.status}: ${j.errorCode ?? "desconocido"}`;
      const esLimitacion = /security-token|rate|throttle|too-many/i.test(String(j.errorCode ?? ""));
      // Credenciales mal puestas no mejoran esperando: se falla ya y se dice
      // por qué, en vez de gastar tres intentos en lo mismo.
      if (!esLimitacion || intento === intentos) break;

      const espera = intento * 20_000; // 20 s, 40 s
      console.log(`  aviso: IG limita el login (${j.errorCode}). Reintento ${intento}/${intentos - 1} en ${espera / 1000}s`);
      await new Promise((res) => setTimeout(res, espera));
    }
    throw new Error(`IG login ${ultimoError}`);
  }

  async desconectar(): Promise<void> {
    if (!this.cst) return;
    await fetch(`${this.base}/session`, { method: "DELETE", headers: this.cabeceras("1") }).catch(() => null);
    this.cst = undefined;
    this.token = undefined;
  }

  /** Saldo y margen de la cuenta activa. */
  async cuenta(): Promise<{ balance: number; disponible: number; pnl: number; margen: number }> {
    const r = await fetch(`${this.base}/accounts`, { headers: this.cabeceras("1") });
    if (!r.ok) throw new Error(`IG accounts ${r.status}`);
    const j = (await r.json()) as { accounts: Array<Record<string, any>> };
    const activa = j.accounts.find((a) => a.accountId === this.accountId) ?? j.accounts[0];
    const b = activa?.balance ?? {};
    return { balance: b.balance ?? 0, disponible: b.available ?? 0, pnl: b.profitLoss ?? 0, margen: b.deposit ?? 0 };
  }

  /**
   * Historial REAL de operaciones cerradas de la cuenta, según el bróker.
   *
   * Es la única fuente de verdad sobre lo que ha ganado o perdido la cuenta: el
   * registro interno del motor dice lo que el motor CREE que hizo, y las dos
   * cosas pueden separarse (una orden rechazada, un cierre por stop del bróker,
   * un reinicio a media pasada). El panel debe enseñar esto, no aquello.
   */
  async transacciones(desde: Date, hasta = new Date()): Promise<TransaccionIg[]> {
    const iso = (d: Date) => d.toISOString().slice(0, 19);
    const r = await fetch(
      `${this.base}/history/transactions?from=${iso(desde)}&to=${iso(hasta)}&pageSize=500`,
      { headers: this.cabeceras("2") },
    );
    if (!r.ok) throw new Error(`IG transactions ${r.status}`);
    const j = (await r.json()) as { transactions: Array<Record<string, any>> };
    // `profitAndLoss` llega como texto con el símbolo de la divisa ("E12.34").
    const importe = (v: unknown): number => Number(String(v ?? "").replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0;
    return (j.transactions ?? []).map((t) => ({
      referencia: t.reference,
      fecha: t.dateUtc ?? t.date,
      instrumento: t.instrumentName,
      tipo: t.transactionType,
      tamano: Number(t.size) || 0,
      nivelApertura: Number(t.openLevel) || null,
      nivelCierre: Number(t.closeLevel) || null,
      pnl: importe(t.profitAndLoss),
      divisa: t.currency ?? "",
    }));
  }

  /**
   * Precio vivo de un instrumento, con su spread real y sus reglas de tamaño.
   *
   * `minTamano` no es un detalle burocrático: IG rechaza la orden entera con
   * `validation.number.too-many-decimal-places.request.size` si el tamaño no
   * encaja en el escalón del instrumento. Cada epic tiene el suyo, así que se
   * lee del bróker en vez de asumir uno.
   */
  async mercado(epic: string): Promise<{ bid: number; ask: number; spread: number; estado: string; minTamano: number; divisas: string[]; valorPorPunto: number; escala: number }> {
    const r = await fetch(`${this.base}/markets/${encodeURIComponent(epic)}`, { headers: this.cabeceras("3") });
    if (!r.ok) throw new Error(`IG market ${epic} ${r.status}`);
    const j = (await r.json()) as {
      snapshot: Record<string, any>;
      dealingRules?: Record<string, any>;
      instrument?: Record<string, any>;
    };
    const bid = j.snapshot.bid;
    const ask = j.snapshot.offer;
    const min = Number(j.dealingRules?.minDealSize?.value);
    // La divisa la dicta el INSTRUMENTO, no la cuenta: IG rechaza la orden si
    // se le manda una que ese epic no ofrece. Estos cotizan en USD aunque la
    // cuenta esté en EUR.
    const divisas = ((j.instrument?.currencies ?? []) as Array<{ code: string }>).map((c) => c.code);
    // Lo que se gana o se pierde por CADA punto de precio con tamaño 1. Es
    // `lotSize`, y es el número que faltaba: sin él, "tamaño 0,1" en oro parece
    // 0,1 onzas cuando son 10, y el riesgo real sale 57 veces mayor que el
    // calculado (medido en la cuenta el 2026-08-17).
    const lote = Number(j.instrument?.lotSize);
    // Cuánto hay que dividir el precio cotizado para obtener el real. EUR/USD
    // MINI llega como 11575,6 (escala 10 000) y EUR/GBP MINI como 0,85489
    // (escala 1). Asumir una sola escala dejaba el tipo de cambio en 0,0000855
    // y el presupuesto de riesgo en cero.
    const escala = Number(j.instrument?.scalingFactor);
    return {
      bid,
      ask,
      spread: ask - bid,
      estado: j.snapshot.marketStatus,
      minTamano: Number.isFinite(min) && min > 0 ? min : 1,
      divisas,
      valorPorPunto: Number.isFinite(lote) && lote > 0 ? lote : 1,
      escala: Number.isFinite(escala) && escala > 0 ? escala : 1,
    };
  }

  /**
   * Velas históricas con bid/ask. Devuelve también la cuota restante, porque
   * IG la agota por semana y quedarse sin ella bloquea el trabajo días.
   */
  async historial(
    epic: string,
    resolucion: ResolucionIg,
    puntos: number,
  ): Promise<{ velas: VelaIg[]; cuota: Cuota | null }> {
    const r = await fetch(
      `${this.base}/prices/${encodeURIComponent(epic)}/${resolucion}/${puntos}`,
      { headers: this.cabeceras("2") },
    );
    const j = (await r.json().catch(() => ({}))) as Record<string, any>;
    if (!r.ok) throw new Error(`IG prices ${epic} ${r.status}: ${j.errorCode ?? ""}`);

    const velas: VelaIg[] = ((j.prices ?? []) as PrecioCrudo[])
      .map((p) => {
        const epoch = epochDeIg(p.snapshotTimeUTC ?? p.snapshotTime ?? "");
        const bid = {
          open: p.openPrice.bid ?? NaN, high: p.highPrice.bid ?? NaN,
          low: p.lowPrice.bid ?? NaN, close: p.closePrice.bid ?? NaN,
        };
        const ask = {
          open: p.openPrice.ask ?? NaN, high: p.highPrice.ask ?? NaN,
          low: p.lowPrice.ask ?? NaN, close: p.closePrice.ask ?? NaN,
        };
        return {
          epoch,
          bid,
          ask,
          mid: {
            open: medio(p.openPrice.bid, p.openPrice.ask),
            high: medio(p.highPrice.bid, p.highPrice.ask),
            low: medio(p.lowPrice.bid, p.lowPrice.ask),
            close: medio(p.closePrice.bid, p.closePrice.ask),
          },
          spread: ask.close - bid.close,
          volumen: p.lastTradedVolume ?? null,
        };
      })
      .filter((v) => Number.isFinite(v.mid.close) && Number.isFinite(v.epoch));

    const a = j.allowance as Partial<Record<string, number>> | undefined;
    const cuota: Cuota | null =
      a && typeof a.remainingAllowance === "number"
        ? {
            restante: a.remainingAllowance,
            total: a.totalAllowance ?? 0,
            expiraEnSegundos: a.allowanceExpiry ?? 0,
          }
        : null;
    return { velas, cuota };
  }
}
