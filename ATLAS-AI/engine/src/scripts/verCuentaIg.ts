/**
 * Qué dice IG que tiene la cuenta AHORA: saldo, posiciones abiertas y las
 * últimas operaciones cerradas con su P&L real.
 *
 * Es el contraste contra el que se mide todo lo demás. El estado interno del
 * motor y las tablas del panel son copias; esto es el original. Cuando las dos
 * cosas no coinciden, la que está mal es la copia.
 */
import { IgClient, igConfigDesdeEnv } from "../broker/igClient";

const cliente = new IgClient(igConfigDesdeEnv());
await cliente.conectar();

const cuenta = await cliente.cuenta();
console.log(`Cuenta ${cliente.accountId} (${cliente.currency})`);
console.log(`  saldo ${cuenta.balance} · P&L abierto ${cuenta.pnl} · disponible ${cuenta.disponible}`);

const r = await fetch(`${cliente.base}/positions`, { headers: cliente.cabeceras("2") });
const j = (await r.json()) as { positions?: Array<Record<string, any>> };
const abiertas = j.positions ?? [];
console.log(`\nPOSICIONES ABIERTAS EN IG: ${abiertas.length}`);
for (const p of abiertas) {
  console.log(
    `  ${p.market.epic.padEnd(28)} ${p.position.direction.padEnd(4)} ` +
      `tam ${p.position.size} @ ${p.position.level} · dealId ${p.position.dealId}`,
  );
}

const desde = new Date(Date.now() - 14 * 86_400_000);
const tx = await cliente.transacciones(desde).catch((e) => {
  console.log(`\nno se pudo leer el historial: ${e instanceof Error ? e.message : e}`);
  return [];
});
console.log(`\nOPERACIONES CERRADAS (14 días): ${tx.length}`);
for (const t of tx.slice(0, 20)) {
  console.log(`  ${t.fecha} ${t.instrumento?.padEnd(24)} ${t.tipo} tam ${t.tamano} · P&L ${t.pnl} ${t.divisa}`);
}

await cliente.desconectar();
