/**
 * Muestra lo que el PANEL está leyendo de Supabase, para distinguir posiciones
 * vivas de fantasmas que dejó un runner anterior. Solo lee.
 *
 * Uso: npm run ver:posiciones
 */
export {}; // marca el fichero como módulo: habilita await en el nivel superior

const key = process.env.SUPABASE_SERVICE_KEY;
if (!key) {
  console.log("Falta SUPABASE_SERVICE_KEY en el entorno.");
  process.exit(1);
}
const ref = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64").toString()).ref;
const url = `https://${ref}.supabase.co`;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

for (const tabla of ["atlas_positions", "atlas_sleeve_trades", "equity_log"]) {
  const res = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=10`, { headers });
  console.log(`\n=== ${tabla} (HTTP ${res.status}) ===`);
  const filas = (await res.json()) as unknown[];
  if (!Array.isArray(filas) || filas.length === 0) {
    console.log("  (vacía)");
    continue;
  }
  for (const fila of filas) console.log(" ", JSON.stringify(fila));
}
