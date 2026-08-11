import { writeFileSync } from "node:fs";

// Descarga histórico diario LARGO (2 décadas) para un universo amplio y diversificado.
//
// Por qué no Deriv: solo sirve ~1 año de velas diarias, insuficiente para validar horizontes de
// hasta 12 meses. Para el BACKTEST hace falta profundidad histórica; la EJECUCIÓN sigue siendo
// un problema separado (Deriv/otro venue) que no se resuelve aquí.
//
// Por qué este universo: la diversificación entre clases de activo poco correlacionadas es la
// única palanca documentada que sube el retorno por unidad de riesgo sin tocar el apalancamiento.
// Los bonos y los agrícolas están precisamente porque NO se mueven con la renta variable.
//
//   node --import tsx src/scripts/fetchLongHistory.ts

const SYMBOLS: Record<string, { ticker: string; group: string }> = {
  // Renta variable (índices)
  SP500: { ticker: "^GSPC", group: "equity" },
  Nasdaq: { ticker: "^NDX", group: "equity" },
  US30: { ticker: "^DJI", group: "equity" },
  DAX: { ticker: "^GDAXI", group: "equity" },
  FTSE: { ticker: "^FTSE", group: "equity" },
  Nikkei: { ticker: "^N225", group: "equity" },
  HangSeng: { ticker: "^HSI", group: "equity" },
  EuroStoxx: { ticker: "^STOXX50E", group: "equity" },
  ASX: { ticker: "^AXJO", group: "equity" },
  // Divisas
  EURUSD: { ticker: "EURUSD=X", group: "fx" },
  GBPUSD: { ticker: "GBPUSD=X", group: "fx" },
  USDJPY: { ticker: "JPY=X", group: "fx" },
  AUDUSD: { ticker: "AUDUSD=X", group: "fx" },
  USDCHF: { ticker: "CHF=X", group: "fx" },
  USDCAD: { ticker: "CAD=X", group: "fx" },
  // Metales
  Oro: { ticker: "GC=F", group: "metal" },
  Plata: { ticker: "SI=F", group: "metal" },
  Cobre: { ticker: "HG=F", group: "metal" },
  // Energía
  Petroleo: { ticker: "CL=F", group: "energy" },
  GasNatural: { ticker: "NG=F", group: "energy" },
  // Bonos (diversificador clave frente a renta variable)
  TNote10y: { ticker: "ZN=F", group: "bond" },
  TBond30y: { ticker: "ZB=F", group: "bond" },
  // Agrícolas (poco correlacionados con lo financiero)
  Maiz: { ticker: "ZC=F", group: "agri" },
  Trigo: { ticker: "ZW=F", group: "agri" },
  Soja: { ticker: "ZS=F", group: "agri" },
  Azucar: { ticker: "SB=F", group: "agri" },
  // Cripto
  BTCUSD: { ticker: "BTC-USD", group: "crypto" },
  ETHUSD: { ticker: "ETH-USD", group: "crypto" },
};

interface Bar {
  t: number; // epoch en segundos
  c: number;
}

export interface UniverseEntry {
  group: string;
  bars: Bar[];
}

const OUT = new URL("../backtest/data/longUniverse.json", import.meta.url);
const RANGE = "25y";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchTicker(ticker: string): Promise<Bar[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=${RANGE}&interval=1d`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
      };
      const result = json.chart?.result?.[0];
      const stamps = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      if (stamps.length === 0) throw new Error("sin datos");

      const bars: Bar[] = [];
      for (let i = 0; i < stamps.length; i++) {
        const c = closes[i];
        const t = stamps[i];
        // Yahoo intercala nulos en días sin cotización: se omiten, no se interpolan.
        if (typeof c !== "number" || !Number.isFinite(c) || c <= 0 || typeof t !== "number") continue;
        bars.push({ t, c });
      }
      return bars;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(attempt * 3000);
    }
  }
  return [];
}

async function main(): Promise<void> {
  const out: Record<string, UniverseEntry> = {};

  for (const [name, { ticker, group }] of Object.entries(SYMBOLS)) {
    try {
      const bars = await fetchTicker(ticker);
      if (bars.length < 1000) {
        console.log(`${name.padEnd(11)} (${ticker.padEnd(10)}): solo ${bars.length} barras — descartado`);
        continue;
      }
      out[name] = { group, bars };
      const from = new Date(bars[0]!.t * 1000).toISOString().slice(0, 10);
      const to = new Date(bars[bars.length - 1]!.t * 1000).toISOString().slice(0, 10);
      const years = (bars[bars.length - 1]!.t - bars[0]!.t) / (365.25 * 86400);
      console.log(
        `${name.padEnd(11)} (${ticker.padEnd(10)}) ${group.padEnd(7)}: ${String(bars.length).padStart(6)} barras · ${from} → ${to} (${years.toFixed(1)}a)`,
      );
    } catch (error) {
      console.log(`${name.padEnd(11)} (${ticker.padEnd(10)}): ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(500);
  }

  writeFileSync(OUT, JSON.stringify(out));
  const groups = new Set(Object.values(out).map((e) => e.group));
  console.log(`\n${Object.keys(out).length} instrumentos · ${groups.size} clases de activo → ${OUT.pathname}`);
}

main().catch((error) => {
  console.error(`FALLO fetch histórico largo: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
