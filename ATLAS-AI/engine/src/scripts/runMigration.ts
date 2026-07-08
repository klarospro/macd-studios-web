// Ejecuta un fichero SQL de db/ contra Supabase vía Management API (DDL).
// Uso: node --env-file=../.env.local --import tsx src/scripts/runMigration.ts db/002_atlas_applications.sql
// Usa SUPABASE_ACCESS_TOKEN (PAT) — NUNCA lo imprime.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? "yahqhdzvvagvyiozrxfy";
const file = process.argv[2];

if (!token) {
  console.log("❌ Falta SUPABASE_ACCESS_TOKEN en .env.local (PAT de Supabase).");
  process.exit(1);
}
if (!file) {
  console.log("❌ Indica el fichero SQL: ... runMigration.ts db/002_atlas_applications.sql");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), file), "utf8");
console.log(`Ejecutando ${file} en proyecto ${ref}...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}`);
if (res.ok) console.log("✅ Migración aplicada.");
else console.log(`Respuesta: ${body.slice(0, 500)}`);
