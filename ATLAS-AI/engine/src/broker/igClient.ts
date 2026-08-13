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

  async conectar(): Promise<void> {
    const r = await fetch(`${this.base}/session`, {
      method: "POST",
      headers: this.cabeceras("2", false),
      body: JSON.stringify({ identifier: this.config.usuario, password: this.config.password }),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, any>;
    if (!r.ok) throw new Error(`IG login ${r.status}: ${j.errorCode ?? "desconocido"}`);
    this.cst = r.headers.get("CST") ?? undefined;
    this.token = r.headers.get("X-SECURITY-TOKEN") ?? undefined;
    this.accountId = j.currentAccountId ?? "";
    this.currency = j.currencyIsoCode ?? "";
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

  /** Precio vivo de un instrumento, con su spread real. */
  async mercado(epic: string): Promise<{ bid: number; ask: number; spread: number; estado: string }> {
    const r = await fetch(`${this.base}/markets/${encodeURIComponent(epic)}`, { headers: this.cabeceras("3") });
    if (!r.ok) throw new Error(`IG market ${epic} ${r.status}`);
    const j = (await r.json()) as { snapshot: Record<string, any> };
    const bid = j.snapshot.bid;
    const ask = j.snapshot.offer;
    return { bid, ask, spread: ask - bid, estado: j.snapshot.marketStatus };
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
