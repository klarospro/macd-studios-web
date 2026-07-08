// Diagnóstico ENMASCARADO de la conexión Supabase + ping a trading_audit_log.
// Se ejecuta con --env-file. NUNCA imprime el valor de la key.
export {};

function mask(v: string | undefined): string {
  if (v === undefined) return "<no definida>";
  const len = v.length;
  const lead = v.length !== v.trimStart().length ? " ⚠️espacio-al-inicio" : "";
  const trail = v.length !== v.trimEnd().length ? " ⚠️espacio-al-final" : "";
  const quotes = /^["']|["']$/.test(v) ? " ⚠️comillas" : "";
  return `presente · ${len} chars${lead}${trail}${quotes}`;
}

let url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

console.log("=== Diagnóstico Supabase (enmascarado) ===");
console.log(`SUPABASE_URL:         ${mask(url)}`);
console.log(`SUPABASE_SERVICE_KEY: ${mask(key)}`);

if (!key) {
  console.log("\n❌ Falta SUPABASE_SERVICE_KEY → el motor caería a auditoría por fichero local.");
  process.exit(1);
}

// Si falta la URL, derivar el project ref desde el JWT (el 'ref' NO es secreto: sale en toda URL pública).
if (!url) {
  try {
    const part = key.split(".")[1] ?? "";
    const payload = JSON.parse(Buffer.from(part, "base64").toString("utf8"));
    if (payload.ref) {
      url = `https://${payload.ref}.supabase.co`;
      console.log(`\nℹ️  SUPABASE_URL no está en .env.local, pero la derivé del JWT:`);
      console.log(`    ➡️  Añade esta línea al .env.local:  SUPABASE_URL=${url}`);
    }
  } catch {
    console.log("\n⚠️ No pude derivar la URL del JWT (¿la key no es una service_role JWT clásica?).");
  }
}

if (!url) {
  console.log("\n❌ Sin SUPABASE_URL no puedo probar. Añádela al .env.local.");
  process.exit(1);
}

const base = url.replace(/\/+$/, "");
console.log(`\nProbando ${base}/rest/v1/trading_audit_log ...`);

const res = await fetch(`${base}/rest/v1/trading_audit_log?select=id&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

console.log(`HTTP ${res.status} ${res.statusText}`);
if (res.ok) {
  console.log("✅ Conexión OK y la tabla trading_audit_log existe y responde.");
} else {
  const body = await res.text();
  console.log(`Respuesta: ${body.slice(0, 300)}`);
  if (res.status === 404 || /does not exist|Could not find the table/i.test(body)) {
    console.log("⚠️ La tabla no existe → falta correr engine/db/001_trading_audit_log.sql en el SQL Editor.");
  } else if (res.status === 401) {
    console.log("⚠️ 401 → la key no es válida (¿pegaste la anon/public en vez de la service_role/secret?).");
  }
}
