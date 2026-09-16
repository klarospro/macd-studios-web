import { writeFileSync } from "node:fs";
import { DerivClient } from "../broker/derivClient";

// Descarga velas OHLC REALES de XAU/USD (frxXAUUSD) desde Deriv `ticks_history` (endpoint público).
// A diferencia de fetchDerivIntraday.ts (que solo guarda cierres), aquí se conserva open/high/low/
// close/epoch porque la estrategia de liquidity grab necesita máximos y mínimos para detectar
// swings, y necesita intrabar high/low para resolver si se tocó antes el SL o el TP.
//
//   node --import tsx src/scripts/fetchGoldOhlc.ts
//
// Nota: Deriv devuelve como máximo 5000 velas por petición; se pagina hacia atrás con `end`.

const SYMBOL = "frxXAUUSD";
const GRANULARITY = 900; // M15 (segundos)
const PER_REQUEST = 5000;
const PAGES = 14; // Deriv devuelve ~3.200 velas/página en la práctica → objetivo ~45.000 (≈2 años)
const OUT = new URL("../backtest/data/goldOhlcM15.json", import.meta.url);

export interface Candle {
  t: number; // epoch (segundos)
  o: number;
  h: number;
  l: number;
  c: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function isCandle(raw: unknown): raw is { epoch: number; open: number; high: number; low: number; close: number } {
  if (typeof raw !== "object" || raw === null) return false;
  const c = raw as Record<string, unknown>;
  return (
    typeof c.epoch === "number" &&
    typeof c.open === "number" &&
    typeof c.high === "number" &&
    typeof c.low === "number" &&
    typeof c.close === "number"
  );
}

async function main(): Promise<void> {
  const client = new DerivClient(process.env.DERIV_APP_ID ?? "1089", "wss://ws.derivws.com/websockets/v3");
  await client.connect();

  const byEpoch = new Map<number, Candle>();
  let end: number | "latest" = "latest";

  // Deriv corta con "an error occurred" si se le pide demasiado seguido: reintentos con espera
  // creciente. Si aun así falla, se conserva lo descargado en vez de perderlo todo.
  const fetchPage = async (endAt: number | "latest"): Promise<unknown[] | null> => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await client.send({
          ticks_history: SYMBOL,
          end: String(endAt),
          count: PER_REQUEST,
          style: "candles",
          granularity: GRANULARITY,
        });
        return (res.candles as unknown[] | undefined) ?? [];
      } catch (error) {
        const wait = attempt * 5000;
        console.log(`  reintento ${attempt}/4 tras error (${error instanceof Error ? error.message : error}) — espero ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    return null;
  };

  for (let page = 0; page < PAGES; page++) {
    const raw = await fetchPage(end);
    if (raw === null) {
      console.log(`página ${page + 1}: fallo persistente, me quedo con lo descargado`);
      break;
    }
    if (raw.length === 0) {
      console.log(`página ${page + 1}: vacía, fin del histórico disponible`);
      break;
    }

    let oldest = Number.POSITIVE_INFINITY;
    for (const item of raw) {
      if (!isCandle(item)) continue;
      // Dedup por epoch: las páginas pueden solaparse en el borde.
      byEpoch.set(item.epoch, { t: item.epoch, o: item.open, h: item.high, l: item.low, c: item.close });
      oldest = Math.min(oldest, item.epoch);
    }
    if (!Number.isFinite(oldest)) break;

    console.log(`página ${page + 1}: ${raw.length} velas · más antigua ${new Date(oldest * 1000).toISOString()}`);
    end = oldest - 1;
    await sleep(2000);
  }

  await client.disconnect();

  const candles = [...byEpoch.values()].sort((a, b) => a.t - b.t);
  if (candles.length === 0) throw new Error("no se descargó ninguna vela");

  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  writeFileSync(OUT, JSON.stringify(candles));

  console.log(
    `\n${candles.length} velas M15 de ${SYMBOL}\n` +
      `desde ${new Date(first.t * 1000).toISOString()} hasta ${new Date(last.t * 1000).toISOString()}\n` +
      `precio ${first.c} → ${last.c}\n` +
      `escrito en ${OUT.pathname}`,
  );
}

main().catch((error) => {
  console.error(`FALLO fetch oro OHLC: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
