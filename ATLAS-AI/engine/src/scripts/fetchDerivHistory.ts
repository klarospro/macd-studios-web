import { writeFileSync } from "node:fs";
import { DerivClient } from "../broker/derivClient";

// Descarga velas diarias reales de Deriv (ticks_history, público) y las guarda como módulo TS
// para el backtest multi-instrumento. Símbolos Deriv oficiales; si alguno es inválido, Deriv
// devuelve error y se reporta sin abortar el resto.
//   node --env-file=../.env.local --import tsx src/scripts/fetchDerivHistory.ts
const SYMBOLS: Record<string, string> = {
  BTCUSD: "cryBTCUSD",
  Oro: "frxXAUUSD",
  US30: "OTC_DJI",
  Nasdaq: "OTC_NDX",
  EURUSD: "frxEURUSD",
};

async function main(): Promise<void> {
  const client = new DerivClient(process.env.DERIV_APP_ID ?? "1089", "wss://ws.derivws.com/websockets/v3");
  await client.connect();

  const out: Record<string, number[]> = {};
  for (const [name, symbol] of Object.entries(SYMBOLS)) {
    try {
      const res = await client.send({
        ticks_history: symbol,
        end: "latest",
        count: 730,
        style: "candles",
        granularity: 86400,
      });
      const candles = (res.candles as Array<{ close?: number }> | undefined) ?? [];
      const closes = candles.map((c) => c.close).filter((c): c is number => typeof c === "number");
      out[name] = closes;
      console.log(`${name} (${symbol}): ${closes.length} velas diarias`);
    } catch (error) {
      console.log(`${name} (${symbol}): ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await client.disconnect();

  const body =
    `// Velas diarias reales de Deriv (precio de cierre). Generado por scripts/fetchDerivHistory.ts.\n` +
    `// No editar a mano; re-generar con: npm run fetch:deriv\n` +
    `export const derivDaily: Record<string, number[]> = ${JSON.stringify(out, null, 0)};\n`;
  writeFileSync(new URL("../backtest/data/derivDaily.ts", import.meta.url), body);
  console.log("Escrito src/backtest/data/derivDaily.ts");
}

main().catch((error) => {
  console.error(`FALLO fetch Deriv: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
