// Publicador LIGERO de estado en vivo (equity + P&L de posiciones abiertas) a Supabase,
// para el dashboard en tiempo real. Pensado para correr en bucle cada ~30-60s.
// NO toma decisiones de estrategia (eso lo hace dailyCycle una vez al día).
import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { loadState } from "./state";
import { publishSnapshot } from "./supabaseLive";

const STATE_PATH = fileURLToPath(new URL("../../runtime/state.json", import.meta.url));

/** Lee equity + P&L en vivo de cada posición y publica el snapshot. Reutilizable. */
export async function publishLiveSnapshot(adapter: DerivDemoAdapter, venueId: string, statePath: string): Promise<{ equity: number; totalPnl: number; count: number }> {
  const equity = await adapter.getEquity();
  const state = loadState(statePath);
  const pnl: Record<string, { profit: number; currentSpot: number }> = {};
  let totalPnl = 0;
  for (const [name, held] of Object.entries(state)) {
    try {
      const p = await adapter.contractPnl(held.contractId);
      pnl[name] = p;
      totalPnl += p.profit;
    } catch {
      /* si un contrato ya no existe, se ignora */
    }
  }
  await publishSnapshot(venueId, equity, state, pnl);
  return { equity, totalPnl, count: Object.keys(state).length };
}

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  try {
    const r = await publishLiveSnapshot(adapter, "deriv-demo", STATE_PATH);
    console.log(`Publicado · equity $${r.equity.toFixed(2)} · P&L abierto $${r.totalPnl.toFixed(2)} · ${r.count} posiciones`);
  } finally {
    await adapter.disconnect();
  }
}

// Solo ejecuta main() si se invoca directamente (no al importar la función).
if (process.argv[1] && process.argv[1].endsWith("publishLive.ts")) {
  main().catch((e) => {
    console.error(`FALLO publishLive: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
