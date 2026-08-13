/**
 * Prueba de humo del adaptador de IG. SOLO LECTURA: no envía ninguna orden.
 * Verifica lo que el ciclo necesitará antes de dejarle operar solo.
 */
import { IgAdapter } from "../broker/igAdapter";
import { igConfigDesdeEnv } from "../broker/igClient";

const a = new IgAdapter(igConfigDesdeEnv());
await a.connect();
console.log(`Cuenta ${a.accountId} · ${a.currency}`);
console.log(`Equity (saldo + P&L abierto): ${(await a.getEquity()).toFixed(2)}\n`);

console.log("Instrumentos y estado ahora:");
for (const s of await a.activeSymbols()) {
  console.log(`  ${s.symbol.padEnd(12)} ${s.abierto ? "OPERABLE" : "cerrado "} · ${s.submercado}`);
}

console.log("\nCoste real de abrir 1.000 de nocional (medio spread):");
for (const s of ["frxEURUSD", "frxXAUUSD", "US30"]) {
  try {
    const c = await a.costeApertura(s, 1000);
    console.log(`  ${s.padEnd(12)} $${c.commission?.toFixed(4)} · spot ${c.spot}`);
  } catch (e) { console.log(`  ${s.padEnd(12)} ${e instanceof Error ? e.message : e}`); }
}

console.log("\nVelas diarias (comprobación del feed):");
for (const s of ["frxEURUSD", "US30"]) {
  const c = await a.dailyCloses(s, 5);
  console.log(`  ${s.padEnd(12)} ${c.length} cierres · último ${c[c.length - 1]}`);
}

console.log("\nPosiciones abiertas en el bróker (reconciliación):");
const p = await a.posicionesDelBroker();
console.log(p.length === 0 ? "  ninguna" : p.map((x) => `  ${x.symbol} ${x.side} ${x.size} @ ${x.entryPrice}`).join("\n"));
await a.disconnect();
console.log("\n[ok] Adaptador IG verificado. No se envió ninguna orden.");
