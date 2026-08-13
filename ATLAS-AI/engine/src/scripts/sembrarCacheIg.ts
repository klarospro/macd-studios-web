/**
 * Siembra la caché de precios con el histórico ya descargado.
 *
 * Evita volver a gastar cuota: los datos de `backtest/data/ig/` costaron 8.400
 * puntos y son exactamente los mismos que el ciclo necesita para arrancar.
 * Sin esto, el motor tendría que esperar a que IG renovara la cuota semanal.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CachePrecios } from "../broker/cachePrecios";
import { EPIC_POR_SIMBOLO } from "../broker/igAdapter";

const cache = new CachePrecios(fileURLToPath(new URL("../../runtime/cache-ig/", import.meta.url)));
const ORIGEN = new URL("../backtest/data/ig/", import.meta.url);

const FICHEROS: Array<{ fichero: string; symbol: string; resolucion: string }> = [
  { fichero: "eurusd-diario.json", symbol: "frxEURUSD", resolucion: "DAY" },
  { fichero: "usdjpy-diario.json", symbol: "frxUSDJPY", resolucion: "DAY" },
  { fichero: "oro-diario.json", symbol: "frxXAUUSD", resolucion: "DAY" },
  { fichero: "us30-diario.json", symbol: "US30", resolucion: "DAY" },
  { fichero: "nasdaq-diario.json", symbol: "NASDAQ", resolucion: "DAY" },
  { fichero: "oro-m15.json", symbol: "frxXAUUSD", resolucion: "MINUTE_15" },
];

for (const { fichero, symbol, resolucion } of FICHEROS) {
  try {
    const crudo = JSON.parse(readFileSync(fileURLToPath(new URL(fichero, ORIGEN)), "utf8")) as Array<{
      epoch: number; mid: { open: number; high: number; low: number; close: number }; spread: number;
    }>;
    const velas = crudo.map((v) => ({
      epoch: v.epoch, open: v.mid.open, high: v.mid.high, low: v.mid.low, close: v.mid.close, spread: v.spread,
    }));
    const epic = EPIC_POR_SIMBOLO[symbol]!;
    const total = cache.guardar(epic, resolucion, velas);
    console.log(`  ${symbol.padEnd(12)} ${resolucion.padEnd(11)} ${velas.length} velas sembradas · caché ${total.length}`);
  } catch (e) {
    console.log(`  ${symbol.padEnd(12)} ${resolucion.padEnd(11)} ERROR: ${e instanceof Error ? e.message : e}`);
  }
}
console.log("\nCaché sembrada. El ciclo ya no necesita cuota para arrancar.");
