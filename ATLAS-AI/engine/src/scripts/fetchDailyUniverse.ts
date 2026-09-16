import { writeFileSync } from "node:fs";
import { DerivClient } from "../broker/derivClient";

// Descarga el histórico diario MÁS LARGO disponible en Deriv para un universo AMPLIO de
// instrumentos. La diversificación entre mercados poco correlacionados es la única palanca
// que sube el retorno por unidad de riesgo sin subir el apalancamiento; para poder medirla
// hace falta un universo, no cinco símbolos.
//
//   node --import tsx src/scripts/fetchDailyUniverse.ts
//
// Los símbolos que Deriv no sirva se reportan y se omiten (no abortan el resto).

const SYMBOLS: Record<string, { symbol: string; group: string }> = {
  // Divisas
  EURUSD: { symbol: "frxEURUSD", group: "fx" },
  GBPUSD: { symbol: "frxGBPUSD", group: "fx" },
  USDJPY: { symbol: "frxUSDJPY", group: "fx" },
  AUDUSD: { symbol: "frxAUDUSD", group: "fx" },
  USDCHF: { symbol: "frxUSDCHF", group: "fx" },
  USDCAD: { symbol: "frxUSDCAD", group: "fx" },
  NZDUSD: { symbol: "frxNZDUSD", group: "fx" },
  EURGBP: { symbol: "frxEURGBP", group: "fx" },
  EURJPY: { symbol: "frxEURJPY", group: "fx" },
  // Metales
  Oro: { symbol: "frxXAUUSD", group: "metal" },
  Plata: { symbol: "frxXAGUSD", group: "metal" },
  // Índices
  US30: { symbol: "OTC_DJI", group: "index" },
  Nasdaq: { symbol: "OTC_NDX", group: "index" },
  SP500: { symbol: "OTC_SPC", group: "index" },
  DAX: { symbol: "OTC_GDAXI", group: "index" },
  FTSE: { symbol: "OTC_FTSE", group: "index" },
  Nikkei: { symbol: "OTC_N225", group: "index" },
  HangSeng: { symbol: "OTC_HSI", group: "index" },
  ASX: { symbol: "OTC_AS51", group: "index" },
  // Cripto
  BTCUSD: { symbol: "cryBTCUSD", group: "crypto" },
  ETHUSD: { symbol: "cryETHUSD", group: "crypto" },
};

const GRANULARITY = 86400; // diario
const PER_REQUEST = 5000;
const PAGES = 4;
const OUT = new URL("../backtest/data/dailyUniverse.json", import.meta.url);

interface Bar {
  t: number;
  c: number;
}

export interface UniverseEntry {
  group: string;
  bars: Bar[];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchSymbol(client: DerivClient, symbol: string): Promise<Bar[]> {
  const byEpoch = new Map<number, Bar>();
  let end: number | "latest" = "latest";

  for (let page = 0; page < PAGES; page++) {
    let raw: unknown[] | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await client.send({
          ticks_history: symbol,
          end: String(end),
          count: PER_REQUEST,
          style: "candles",
          granularity: GRANULARITY,
        });
        raw = (res.candles as unknown[] | undefined) ?? [];
        break;
      } catch {
        await sleep(attempt * 4000);
      }
    }
    if (raw === null || raw.length === 0) break;

    let oldest = Number.POSITIVE_INFINITY;
    let added = 0;
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const c = item as Record<string, unknown>;
      if (typeof c.epoch !== "number" || typeof c.close !== "number") continue;
      if (!byEpoch.has(c.epoch)) added++;
      byEpoch.set(c.epoch, { t: c.epoch, c: c.close });
      oldest = Math.min(oldest, c.epoch);
    }
    // Si la página no aportó nada nuevo, ya estamos en el límite del histórico.
    if (added === 0 || !Number.isFinite(oldest)) break;
    end = oldest - 1;
    await sleep(1500);
  }

  return [...byEpoch.values()].sort((a, b) => a.t - b.t);
}

async function main(): Promise<void> {
  const client = new DerivClient(process.env.DERIV_APP_ID ?? "1089", "wss://ws.derivws.com/websockets/v3");
  await client.connect();

  const out: Record<string, UniverseEntry> = {};
  for (const [name, { symbol, group }] of Object.entries(SYMBOLS)) {
    try {
      const bars = await fetchSymbol(client, symbol);
      if (bars.length < 200) {
        console.log(`${name.padEnd(10)} (${symbol.padEnd(12)}): solo ${bars.length} barras — descartado`);
        continue;
      }
      out[name] = { group, bars };
      const from = new Date(bars[0]!.t * 1000).toISOString().slice(0, 10);
      const to = new Date(bars[bars.length - 1]!.t * 1000).toISOString().slice(0, 10);
      console.log(`${name.padEnd(10)} (${symbol.padEnd(12)}): ${String(bars.length).padStart(5)} barras · ${from} → ${to}`);
    } catch (error) {
      console.log(`${name.padEnd(10)} (${symbol.padEnd(12)}): ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await client.disconnect();
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n${Object.keys(out).length} instrumentos escritos en ${OUT.pathname}`);
}

main().catch((error) => {
  console.error(`FALLO fetch universo: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
