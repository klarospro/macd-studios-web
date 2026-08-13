import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Vela } from "../domain/bars";
import { Order } from "../domain/types";
import { comisionDe, COSTE_BPS_PAPER, PaperDerivAdapter, pnlPosicion } from "./paperDerivAdapter";

/** Feed falso: precio controlado por el test, sin red. */
class MercadoFalso {
  precio = 100;
  fallar = false;
  constructor(public llamadas = 0) {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async dailyCloses(): Promise<number[]> {
    return [98, 99, this.precio];
  }
  async intradayCandles(): Promise<Vela[]> {
    this.llamadas++;
    if (this.fallar) throw new Error("feed caído");
    return [{ epoch: 1, open: this.precio, high: this.precio, low: this.precio, close: this.precio }];
  }
  async ticksEntre(): Promise<number[]> {
    return [this.precio];
  }
}

const rutaTemp = () => join(mkdtempSync(join(tmpdir(), "atlas-paper-")), "paper.json");

const orden = (over: Partial<Order> = {}): Order => ({
  symbol: "frxXAUUSD",
  side: "buy",
  size: 2,
  entryPrice: 100,
  stopPrice: 95,
  riskAmount: 10,
  correlationGroup: "metales",
  ...over,
});

describe("pnlPosicion", () => {
  it("un largo gana cuando el precio sube", () => {
    expect(pnlPosicion({ side: "buy", entryPrice: 100, size: 2 }, 110)).toBe(20);
  });
  it("un corto gana cuando el precio baja", () => {
    expect(pnlPosicion({ side: "sell", entryPrice: 100, size: 2 }, 90)).toBe(20);
  });
  it("un corto pierde cuando el precio sube", () => {
    expect(pnlPosicion({ side: "sell", entryPrice: 100, size: 2 }, 110)).toBe(-20);
  });
});

describe("comisionDe", () => {
  it("cobra los bps sobre el nocional", () => {
    expect(comisionDe(10_000, 10)).toBe(10);
  });
});

describe("PaperDerivAdapter", () => {
  it("llena al precio VIVO del feed, no al precio teórico de la señal", async () => {
    const mercado = new MercadoFalso();
    mercado.precio = 104.5;
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD"]);
    const pos = await a.placeOrder(orden({ entryPrice: 100 }));
    expect(pos.entryPrice).toBe(104.5);
  });

  it("cobra comisión al abrir, así que el equity baja antes de moverse el precio", async () => {
    const mercado = new MercadoFalso();
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD"]);
    await a.placeOrder(orden({ size: 2 })); // nocional 200 → 10 bps = 0,2
    // equity = 1000 - 0,2 de comisión + 0 de flotante
    expect(await a.getEquity()).toBeCloseTo(999.8, 6);
  });

  it("marca a mercado el P&L flotante", async () => {
    const mercado = new MercadoFalso();
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD"]);
    const pos = await a.placeOrder(orden({ size: 2 }));
    mercado.precio = 110; // +10 × 2 = +20
    const pnl = await a.contractPnl(pos.id);
    expect(pnl.profit).toBeCloseTo(20, 6);
    expect(pnl.currentSpot).toBe(110);
    expect(await a.getEquity()).toBeCloseTo(1019.8, 6);
  });

  it("al cerrar realiza el P&L y cobra la comisión del segundo lado", async () => {
    const mercado = new MercadoFalso();
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD"]);
    const pos = await a.placeOrder(orden({ size: 2 }));
    mercado.precio = 110;
    await a.closePosition(pos.id);
    // 1000 - 0,2 (abrir) + 20 (ganancia) - 0,22 (cerrar: 220 × 10bps)
    expect(await a.getEquity()).toBeCloseTo(1019.58, 6);
    expect(a.posicionesAbiertas()).toHaveLength(0);
  });

  it("una operación plana PIERDE dinero: el coste existe", async () => {
    // Si esto fallara, la curva del panel sería una mentira optimista.
    const mercado = new MercadoFalso();
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD"]);
    const pos = await a.placeOrder(orden({ size: 2 }));
    await a.closePosition(pos.id);
    expect(await a.getEquity()).toBeLessThan(1000);
  });

  it("persiste la cuenta entre procesos: el ciclo es oneshot", async () => {
    const ruta = rutaTemp();
    const mercado = new MercadoFalso();
    const primero = new PaperDerivAdapter(mercado, ruta, 1000, ["frxXAUUSD"]);
    const pos = await primero.placeOrder(orden({ size: 2 }));
    await primero.disconnect();

    const segundo = new PaperDerivAdapter(new MercadoFalso(), ruta, 1000, ["frxXAUUSD"]);
    expect(segundo.posicionesAbiertas().map((p) => p.id)).toEqual([pos.id]);
    expect(JSON.parse(readFileSync(ruta, "utf8")).equity).toBeCloseTo(999.8, 6);
  });

  it("sin feed no ofrece símbolos, para que el vigilante lo detecte", async () => {
    const mercado = new MercadoFalso();
    mercado.fallar = true;
    const a = new PaperDerivAdapter(mercado, rutaTemp(), 1000, ["frxXAUUSD", "cryBTCUSD"]);
    expect(await a.activeSymbols()).toEqual([]);
  });

  it("con feed vivo ofrece el universo configurado", async () => {
    const a = new PaperDerivAdapter(new MercadoFalso(), rutaTemp(), 1000, ["frxXAUUSD", "cryBTCUSD"]);
    const s = await a.activeSymbols();
    expect(s.map((x) => x.symbol)).toEqual(["frxXAUUSD", "cryBTCUSD"]);
    expect(s.every((x) => x.abierto)).toBe(true);
  });

  it("usa el mismo coste que la validación profunda aprobada", () => {
    expect(COSTE_BPS_PAPER).toBe(10);
  });
});
