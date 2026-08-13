import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Order, Position, Side } from "../domain/types";
import { Vela } from "../domain/bars";

/**
 * Ejecución SIMULADA sobre el feed de precios REAL de Deriv.
 *
 * Nace del incidente del 2026-08-12: la capa de ofertas de Deriv
 * (`active_symbols` / `contracts_for` / `proposal`) devolvió cero durante
 * horas, mientras el feed de precios seguía entregando velas frescas. Con el
 * bróker medio caído no se puede abrir un contrato, pero SÍ se puede saber qué
 * habría hecho la estrategia — que es lo que hay que poder ver en el panel.
 *
 * Reparto de responsabilidades, en la línea de "el cerebro es el activo y los
 * brokers son enchufes":
 *   - datos de mercado  → se DELEGAN en el adaptador real (velas, ticks).
 *   - ejecución y saldo → se simulan aquí y se persisten en `paper.json`.
 *
 * Honestidad de la simulación (si no, el equity que pinte el panel es humo):
 *   - Se llena al ÚLTIMO PRECIO del feed, no al precio teórico de la señal.
 *   - Se cobra `costeBps` por lado, la misma cifra (10 bps) con la que se
 *     validó el TSMOM a 10 años. No se inventa un coste más amable.
 *   - El P&L se marca a mercado con el spot vivo, no con el precio de entrada.
 * Lo que NO simula, y por eso esto no sustituye a una demo real: hueco de
 * apertura, rechazo por liquidez, y deslizamiento variable según volatilidad.
 */

/** Coste por lado, en puntos básicos. Igual que `COST_BPS` de la validación profunda. */
export const COSTE_BPS_PAPER = 10;

/** Lo que el ciclo necesita del mercado. Lo cumple `DerivDemoAdapter`. */
export interface FuenteDeMercado {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  dailyCloses(symbol: string, count: number): Promise<number[]>;
  intradayCandles(symbol: string, granularity: number, count: number): Promise<Vela[]>;
  ticksEntre(symbol: string, desde: number, hasta: number): Promise<number[]>;
}

interface PosicionPapel {
  id: string;
  symbol: string;
  side: Side;
  size: number;
  entryPrice: number;
  stopPrice: number;
  riskAmount: number;
  correlationGroup: string;
  comisionPagada: number;
  abiertaEn: string;
}

interface CuentaPapel {
  equity: number;
  /** Realizado acumulado, para poder auditar de dónde sale el equity. */
  realizado: number;
  posiciones: Record<string, PosicionPapel>;
}

function cuentaInicial(equity: number): CuentaPapel {
  return { equity, realizado: 0, posiciones: {} };
}

function cargar(ruta: string, equityInicial: number): CuentaPapel {
  if (!existsSync(ruta)) return cuentaInicial(equityInicial);
  try {
    const c = JSON.parse(readFileSync(ruta, "utf8")) as CuentaPapel;
    return { ...cuentaInicial(equityInicial), ...c, posiciones: c.posiciones ?? {} };
  } catch {
    // Un fichero corrupto no debe heredar cifras dudosas a una curva de equity.
    return cuentaInicial(equityInicial);
  }
}

/** P&L a mercado de una posición de multiplicadores: Δprecio × tamaño, con signo. */
export function pnlPosicion(p: { side: Side; entryPrice: number; size: number }, spot: number): number {
  const delta = spot - p.entryPrice;
  return (p.side === "buy" ? delta : -delta) * p.size;
}

/** Comisión de un lado: bps sobre el nocional expuesto. */
export function comisionDe(nocional: number, bps: number): number {
  return Math.abs(nocional) * (bps / 10_000);
}

export class PaperDerivAdapter {
  readonly name = "deriv-paper";
  readonly accountId = "PAPER";
  private cuenta: CuentaPapel;

  constructor(
    private readonly mercado: FuenteDeMercado,
    private readonly rutaEstado: string,
    equityInicial: number,
    private readonly universo: string[],
    private readonly costeBps: number = COSTE_BPS_PAPER,
  ) {
    this.cuenta = cargar(rutaEstado, equityInicial);
  }

  async connect(): Promise<void> {
    await this.mercado.connect();
  }

  async disconnect(): Promise<void> {
    this.guardar();
    await this.mercado.disconnect();
  }

  private guardar(): void {
    mkdirSync(dirname(this.rutaEstado), { recursive: true });
    writeFileSync(this.rutaEstado, JSON.stringify(this.cuenta, null, 2), "utf8");
  }

  /** Último precio del feed. Es el precio al que se simula el llenado. */
  async spot(symbol: string): Promise<number> {
    const velas = await this.mercado.intradayCandles(symbol, 60, 1);
    const ultima = velas[velas.length - 1];
    if (!ultima) throw new Error(`Sin precio para ${symbol}`);
    return ultima.close;
  }

  // ── Datos de mercado: se delegan tal cual en el bróker real ──
  dailyCloses(symbol: string, count: number): Promise<number[]> {
    return this.mercado.dailyCloses(symbol, count);
  }
  intradayCandles(symbol: string, granularity: number, count: number): Promise<Vela[]> {
    return this.mercado.intradayCandles(symbol, granularity, count);
  }
  ticksEntre(symbol: string, desde: number, hasta: number): Promise<number[]> {
    return this.mercado.ticksEntre(symbol, desde, hasta);
  }

  /**
   * En papel, la salud del venue es la salud del FEED, no la de las ofertas.
   * Si el feed responde, el universo entero es operable; si no, cero símbolos
   * y el vigilante de `sleeveCycle` lo detecta igual que con el bróker real.
   */
  async activeSymbols(): Promise<Array<{ symbol: string; nombre: string; mercado: string; submercado: string; abierto: boolean }>> {
    const sonda = this.universo[0];
    if (!sonda) return [];
    try {
      await this.spot(sonda);
    } catch {
      return [];
    }
    return this.universo.map((symbol) => ({
      symbol,
      nombre: symbol,
      mercado: "papel",
      submercado: "papel",
      abierto: true,
    }));
  }

  /** Coste estimado de abrir: la comisión que se cobrará, sin pedirle nada al bróker. */
  async costeApertura(symbol: string, stake: number): Promise<{ commission: number | null; spot: number | null }> {
    return { commission: comisionDe(stake, this.costeBps), spot: await this.spot(symbol) };
  }

  /** Equity = saldo + P&L no realizado de lo que siga abierto. */
  async getEquity(): Promise<number> {
    let flotante = 0;
    for (const p of Object.values(this.cuenta.posiciones)) {
      try {
        flotante += pnlPosicion(p, await this.spot(p.symbol));
      } catch {
        // Un símbolo sin precio no debe impedir valorar el resto de la cartera.
      }
    }
    return this.cuenta.equity + flotante;
  }

  async placeOrder(order: Order): Promise<Position> {
    // Se llena al precio VIVO, no al de la señal: es la diferencia entre una
    // curva de equity creíble y una que se autoengaña.
    const precio = await this.spot(order.symbol);
    const comision = comisionDe(precio * order.size, this.costeBps);
    const posicion: PosicionPapel = {
      id: randomUUID(),
      symbol: order.symbol,
      side: order.side,
      size: order.size,
      entryPrice: precio,
      stopPrice: order.stopPrice,
      riskAmount: order.riskAmount,
      correlationGroup: order.correlationGroup,
      comisionPagada: comision,
      abiertaEn: new Date().toISOString(),
    };
    this.cuenta.posiciones[posicion.id] = posicion;
    this.cuenta.equity -= comision; // el coste se paga al abrir
    this.guardar();
    return { ...order, id: posicion.id, entryPrice: precio };
  }

  /** P&L vivo, con el mismo contrato que `DerivDemoAdapter.contractPnl`. */
  async contractPnl(positionId: string): Promise<{ profit: number; currentSpot: number }> {
    const p = this.cuenta.posiciones[positionId];
    if (!p) throw new Error(`Posición de papel desconocida: ${positionId}`);
    const spot = await this.spot(p.symbol);
    return { profit: pnlPosicion(p, spot), currentSpot: spot };
  }

  async closePosition(positionId: string): Promise<void> {
    const p = this.cuenta.posiciones[positionId];
    if (!p) return;
    const spot = await this.spot(p.symbol);
    const bruto = pnlPosicion(p, spot);
    const comisionCierre = comisionDe(spot * p.size, this.costeBps);
    this.cuenta.equity += bruto - comisionCierre;
    this.cuenta.realizado += bruto - comisionCierre - p.comisionPagada;
    delete this.cuenta.posiciones[positionId];
    this.guardar();
  }

  /** Para el panel: qué hay abierto ahora mismo en la cuenta de papel. */
  posicionesAbiertas(): PosicionPapel[] {
    return Object.values(this.cuenta.posiciones);
  }
}
