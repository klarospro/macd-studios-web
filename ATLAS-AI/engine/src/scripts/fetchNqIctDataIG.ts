import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// Descarga velas OHLC de NQ desde la IG REST Trading API (broker), en vez de Yahoo Finance
// (que solo da ~71 días de 5M gratis). Aprobado explícitamente por Moisés esta noche.
//
//   node --env-file=../.env.local --import tsx src/scripts/fetchNqIctDataIG.ts
//
// Credenciales: NUNCA en este archivo ni en el chat. Se leen de variables de entorno (mismo
// patrón que DERIV_API_TOKEN en `.env.local` — ver `.env.example`):
//   IG_API_KEY        API key de "My IG" > Settings > API keys
//   IG_USERNAME        usuario de la cuenta (DEMO recomendado, regla de oro: paper/demo primero)
//   IG_PASSWORD        contraseña de la cuenta
//   IG_ACCOUNT_TYPE     "DEMO" (default) o "LIVE" — NO usar LIVE para esto
//
// AVISO IMPORTANTE (sin confirmar del todo, documentación oficial de IG no accesible esta noche
// — labs.ig.com devolvió error 500 al intentar consultarla; esto se armó con la referencia
// pública de la librería `trading-ig` y conocimiento general de la API, NO verificado línea a
// línea contra la doc oficial de IG):
//   - IG ofrece el Nasdaq 100 como CFD/spread bet (índice IG), NO el futuro NQ de CME en sí.
//     El "point value" y las horas de sesión pueden diferir de NQ real — ver 05_PREGUNTAS_ABIERTAS.md.
//   - El epic exacto del instrumento no se adivina: este script primero BUSCA por nombre
//     ("Nasdaq"/"US Tech 100") vía /markets y lista los candidatos encontrados, para elegir el
//     correcto a mano (o fijarlo con IG_NQ_EPIC) en vez de arriesgar un epic equivocado.
//   - Si algo de este script no coincide con el comportamiento real de la API, falla con el
//     mensaje/status HTTP tal cual — no se inventa ni se rellena nada silenciosamente.

const ACCOUNT_TYPE = (process.env.IG_ACCOUNT_TYPE ?? "DEMO").toUpperCase();
const BASE_URL = ACCOUNT_TYPE === "LIVE" ? "https://api.ig.com/gateway/deal" : "https://demo-api.ig.com/gateway/deal";
const API_KEY = process.env.IG_API_KEY;
const USERNAME = process.env.IG_USERNAME;
const PASSWORD = process.env.IG_PASSWORD;
const FORCED_EPIC = process.env.IG_NQ_EPIC; // opcional: fija el epic si ya se conoce, salta la búsqueda

const OUT_DIR = new URL("../backtest/data/", import.meta.url);

interface Session {
  cst: string;
  securityToken: string;
}

async function login(): Promise<Session> {
  if (!API_KEY || !USERNAME || !PASSWORD) {
    throw new Error(
      "Faltan credenciales de IG en el entorno. Definir IG_API_KEY, IG_USERNAME, IG_PASSWORD en engine/../.env.local " +
        "(NUNCA en el chat ni en el código) y correr con --env-file=../.env.local.",
    );
  }
  const res = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: {
      "X-IG-API-KEY": API_KEY,
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json; charset=UTF-8",
      Version: "2",
    },
    body: JSON.stringify({ identifier: USERNAME, password: PASSWORD, encryptedPassword: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login IG falló: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  const cst = res.headers.get("cst");
  const securityToken = res.headers.get("x-security-token");
  if (!cst || !securityToken) throw new Error("Login IG: respuesta 200 pero faltan headers CST/X-SECURITY-TOKEN — formato inesperado.");
  return { cst, securityToken };
}

function authHeaders(session: Session, version: string): Record<string, string> {
  return {
    "X-IG-API-KEY": API_KEY!,
    CST: session.cst,
    "X-SECURITY-TOKEN": session.securityToken,
    Accept: "application/json; charset=UTF-8",
    Version: version,
  };
}

interface MarketSearchItem {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  expiry: string;
}

async function searchMarkets(session: Session, term: string): Promise<MarketSearchItem[]> {
  const res = await fetch(`${BASE_URL}/markets?searchTerm=${encodeURIComponent(term)}`, { headers: authHeaders(session, "1") });
  if (!res.ok) throw new Error(`Búsqueda de mercados "${term}" falló: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { markets?: MarketSearchItem[] };
  return body.markets ?? [];
}

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface IgPricePoint {
  snapshotTime: string; // formato "yyyy:MM:dd-HH:mm:ss" (sin confirmar la zona horaria exacta — ver aviso arriba)
  openPrice?: { bid?: number; ask?: number };
  closePrice?: { bid?: number; ask?: number };
  highPrice?: { bid?: number; ask?: number };
  lowPrice?: { bid?: number; ask?: number };
}

function mid(p?: { bid?: number; ask?: number }): number | null {
  if (!p || p.bid == null || p.ask == null) return null;
  return (p.bid + p.ask) / 2;
}

/** `snapshotTime` de IG no trae zona horaria explícita en el formato clásico "yyyy:MM:dd-HH:mm:ss"
 *  — se asume hora del servidor de IG (UTC no confirmado). Ver aviso en la cabecera del archivo. */
function parseIgTime(snapshotTime: string): number {
  const iso = snapshotTime.replace(/^(\d{4}):(\d{2}):(\d{2})-/, "$1-$2-$3T") + "Z";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`No se pudo parsear snapshotTime de IG: "${snapshotTime}"`);
  return Math.floor(ms / 1000);
}

async function fetchHistoricalPrices(session: Session, epic: string, resolution: string, max: number): Promise<Candle[]> {
  const url = `${BASE_URL}/prices/${encodeURIComponent(epic)}?resolution=${resolution}&max=${max}&pageSize=0`;
  const res = await fetch(url, { headers: authHeaders(session, "3") });
  if (!res.ok) throw new Error(`Prices ${epic} ${resolution} falló: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { prices?: IgPricePoint[] };
  const points = body.prices ?? [];

  const candles: Candle[] = [];
  for (const p of points) {
    const o = mid(p.openPrice);
    const h = mid(p.highPrice);
    const l = mid(p.lowPrice);
    const c = mid(p.closePrice);
    if (o == null || h == null || l == null || c == null) continue; // barra sin bid/ask completo -> se descarta, no se rellena
    candles.push({ t: parseIgTime(p.snapshotTime), o, h, l, c });
  }
  return candles.sort((a, b) => a.t - b.t);
}

function toCsv(candles: Candle[]): string {
  return ["t,o,h,l,c", ...candles.map((c) => `${c.t},${c.o},${c.h},${c.l},${c.c}`)].join("\n");
}

function writeCsv(fileName: string, candles: Candle[], label: string): void {
  if (candles.length === 0) {
    console.log(`${label.padEnd(28)} 0 velas — NO se escribe el archivo (nada que guardar).`);
    return;
  }
  const path = new URL(fileName, OUT_DIR);
  writeFileSync(path, toCsv(candles));
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  console.log(
    `${label.padEnd(28)} ${String(candles.length).padStart(6)} velas · ` +
      `${new Date(first.t * 1000).toISOString().slice(0, 10)} → ${new Date(last.t * 1000).toISOString().slice(0, 10)} · ${path.pathname}`,
  );
}

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Login IG (${ACCOUNT_TYPE})...`);
  const session = await login();
  console.log("Login OK.\n");

  let epic = FORCED_EPIC;
  if (!epic) {
    console.log('Buscando epic de Nasdaq ("Nasdaq" / "US Tech 100")...');
    const candidates = [...(await searchMarkets(session, "Nasdaq")), ...(await searchMarkets(session, "US Tech 100"))];
    if (candidates.length === 0) {
      console.log("No se encontró ningún mercado. Define IG_NQ_EPIC manualmente en .env.local y vuelve a correr.");
      process.exitCode = 1;
      return;
    }
    console.log("Candidatos encontrados (elige el correcto y fíjalo con IG_NQ_EPIC si no es el primero):");
    for (const c of candidates) console.log(`  ${c.epic.padEnd(28)} ${c.instrumentType.padEnd(14)} ${c.instrumentName} (expiry: ${c.expiry || "-"})`);
    epic = candidates[0]!.epic;
    console.log(`\nUsando por defecto: ${epic} (el primer resultado) — verifica que es el correcto.\n`);
  } else {
    console.log(`Usando epic fijado por IG_NQ_EPIC: ${epic}\n`);
  }

  const nq5m = await fetchHistoricalPrices(session, epic, "MINUTE_5", 10000);
  writeCsv("nqUsdM5.csv", nq5m, "NQ(IG) 5M");

  const nqDaily = await fetchHistoricalPrices(session, epic, "DAY", 2000);
  writeCsv("nqUsdDaily.csv", nqDaily, "NQ(IG) 1D");

  let nq4h = await fetchHistoricalPrices(session, epic, "HOUR_4", 5000);
  if (nq4h.length === 0) {
    console.log("HOUR_4 vacío o no soportado por este epic — se omite (dejar 04_PLAN_BACKTEST.md con este hallazgo).");
  } else {
    writeCsv("nqUsd4h.csv", nq4h, "NQ(IG) 4H");
  }

  console.log("\nListo. Verificar manualmente el epic/instrumento antes de confiar en los datos, y luego:");
  console.log("  node --import tsx src/backtest/runIctIfvgDeepValidation.ts");
}

main().catch((error) => {
  console.error(`FALLO fetch NQ (IG): ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
