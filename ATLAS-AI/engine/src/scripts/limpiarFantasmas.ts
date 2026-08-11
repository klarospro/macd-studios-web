/**
 * Limpia de Supabase lo que el panel enseña pero ya no existe:
 *
 *  1. `atlas_positions` — filas que el runner anterior dejó marcadas como
 *     abiertas y que Deriv ya cerró hace semanas. La PÉRDIDA fue real y sigue
 *     reflejada en el saldo de la cuenta; lo que era falso es que la posición
 *     siguiera viva. Se borran solo las que el broker confirma cerradas.
 *  2. `atlas_sleeve_trades` con `simulada = true` — operaciones de dry-run de
 *     las pruebas. Contarlas falsearía las métricas de la Fase 1, porque nunca
 *     pagaron un spread.
 *
 * Pide confirmación con --confirmar; sin ella solo enseña qué borraría.
 * Uso: npm run limpiar:fantasmas -- --confirmar
 */
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

const CONFIRMAR = process.argv.includes("--confirmar");

const key = process.env.SUPABASE_SERVICE_KEY;
if (!key) {
  console.log("Falta SUPABASE_SERVICE_KEY en el entorno.");
  process.exit(1);
}
const ref = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64").toString()).ref;
const url = `https://${ref}.supabase.co`;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// --- 1. Contratos que Deriv reconoce como abiertos AHORA ---
const adapter = new DerivDemoAdapter(derivConfigFromEnv());
await adapter.connect();
const abiertosEnBroker = await adapter.openContracts();
await adapter.disconnect();

const idsVivos = new Set(abiertosEnBroker.map((c) => String(c.contractId)));
console.log(`Deriv reporta ${abiertosEnBroker.length} contratos abiertos.`);

const resPos = await fetch(`${url}/rest/v1/atlas_positions?select=*`, { headers });
const posiciones = (await resPos.json()) as Array<Record<string, any>>;
console.log(`El panel muestra ${posiciones.length} posiciones.\n`);

const fantasmas = posiciones.filter((p) => !idsVivos.has(String(p.contract_id ?? p.id)));
for (const p of fantasmas) {
  console.log(
    `  FANTASMA · ${String(p.symbol).padEnd(8)} ${p.side} · abierta ${String(p.opened_at).slice(0, 10)} · ` +
      `P&L ${p.profit} · el broker no la reconoce`,
  );
}

// --- 2. Operaciones simuladas del nuevo registro ---
const resSim = await fetch(`${url}/rest/v1/atlas_sleeve_trades?select=id&simulada=eq.true`, { headers });
const simuladas = (await resSim.json()) as Array<{ id: string }>;
console.log(`\n  ${simuladas.length} operaciones en dry-run (simuladas) en atlas_sleeve_trades.`);

if (!CONFIRMAR) {
  console.log("\n(simulacro — nada borrado). Añade --confirmar para aplicarlo.");
  process.exit(0);
}

for (const p of fantasmas) {
  const r = await fetch(`${url}/rest/v1/atlas_positions?id=eq.${p.id}`, { method: "DELETE", headers });
  console.log(`  borrada posición ${p.id} (${p.symbol}) → HTTP ${r.status}`);
}
if (simuladas.length > 0) {
  const r = await fetch(`${url}/rest/v1/atlas_sleeve_trades?simulada=eq.true`, { method: "DELETE", headers });
  console.log(`  borradas ${simuladas.length} operaciones simuladas → HTTP ${r.status}`);
}
console.log("\nListo. El panel ya solo mostrará posiciones que el broker confirma.");
