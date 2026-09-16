import { writeFileSync } from "node:fs";
import { DerivClient } from "../broker/derivClient";

// Descarga velas INTRADÍA M5 reales de Deriv (ticks_history, público) para el backtest de
// scalping. Pagina hacia atrás con `end` para juntar varios miles de barras por símbolo.
// Solo EUR/USD, Oro y BTC (los operables hoy en el adaptador Deriv Native; Nasdaq/US30 NO-GO).
//   node --import tsx src/scripts/fetchDerivIntraday.ts
const SYMBOLS: Record<string, string> = {
  EURUSD: "frxEURUSD",
  Oro: "frxXAUUSD",
  BTCUSD: "cryBTCUSD",
};

const GRANULARITY = 300; // M5 (segundos)
const PER_REQUEST = 5000; // máximo de Deriv por petición
const PAGES = 6; // ~30.000 barras M5 por símbolo

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchSymbol(client: DerivClient, symbol: string): Promise<number[]> {
  const closes: number[] = [];
  let end: number | "latest" = "latest";
  for (let page = 0; page < PAGES; page++) {
    const res = await client.send({
      ticks_history: symbol,
      end: String(end),
      count: PER_REQUEST,
      style: "candles",
      granularity: GRANULARITY,
    });
    const candles = (res.candles as Array<{ epoch?: number; close?: number }> | undefined) ?? [];
    if (candles.length === 0) break;
    const firstEpoch = candles[0]?.epoch;
    // prepend (cada página es más antigua que la anterior)
    const pageCloses = candles.map((c) => c.close).filter((c): c is number => typeof c === "number");
    closes.unshift(...pageCloses);
    if (typeof firstEpoch !== "number") break;
    end = firstEpoch - 1;
    await sleep(400);
  }
  return closes;
}

async function main(): Promise<void> {
  const client = new DerivClient(process.env.DERIV_APP_ID ?? "1089", "wss://ws.derivws.com/websockets/v3");
  await client.connect();

  const out: Record<string, number[]> = {};
  for (const [name, symbol] of Object.entries(SYMBOLS)) {
    try {
      const closes = await fetchSymbol(client, symbol);
      out[name] = closes;
      console.log(`${name} (${symbol}): ${closes.length} velas M5 (~${(closes.length / 288).toFixed(1)} días 24h)`);
    } catch (error) {
      console.log(`${name} (${symbol}): ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await client.disconnect();

  const body =
    `// Velas M5 reales de Deriv (precio de cierre). Generado por scripts/fetchDerivIntraday.ts.\n` +
    `// No editar a mano; re-generar con: npm run fetch:intraday\n` +
    `export const derivIntradayM5: Record<string, number[]> = ${JSON.stringify(out, null, 0)};\n`;
  writeFileSync(new URL("../backtest/data/derivIntradayM5.ts", import.meta.url), body);
  console.log("Escrito src/backtest/data/derivIntradayM5.ts");
}

main().catch((error) => {
  console.error(`FALLO fetch intradía: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
