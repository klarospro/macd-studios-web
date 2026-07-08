// Crea las tablas del motor en Supabase vía Management API (DDL).
// Usa SUPABASE_ACCESS_TOKEN (PAT) — NUNCA lo imprime. Ejecutar con --env-file.
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? "yahqhdzvvagvyiozrxfy";

if (!token) {
  console.log("❌ Falta SUPABASE_ACCESS_TOKEN en .env.local (PAT de Supabase).");
  process.exit(1);
}

const sql = readFileSync(new URL("../../db/001_trading_audit_log.sql", import.meta.url), "utf8");

console.log(`Ejecutando DDL en el proyecto ${ref} vía Management API...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}`);
if (res.ok) {
  console.log("✅ DDL ejecutado. Tablas creadas (o ya existían).");
} else {
  console.log(`Respuesta: ${body.slice(0, 500)}`);
  if (res.status === 401) console.log("⚠️ 401 → el PAT no es válido o no tiene permiso de escritura.");
}
