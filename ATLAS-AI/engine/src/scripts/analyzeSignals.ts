// Preview de las notificaciones de entrada (Telegram) para los activos foco de Moisés:
// Oro, BTC y Nasdaq. Baja velas REALES de Deriv demo, calcula la señal TSMOM y la enriquece
// con porqué + probabilidad + duración. NO ejecuta nada; solo imprime la tarjeta.
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { TsmomParams } from "../strategy/tsmom";
import { analyzeSignal, InstrumentStats, toTelegramCard } from "../analysis/signalAnalysis";

// Foco pedido por Moisés. Stats = win-rate y holding medio del backtest (honestos).
const FOCUS: Array<{ label: string; derivSymbol: string; stats: InstrumentStats }> = [
  { label: "Oro (XAU/USD)", derivSymbol: "frxXAUUSD", stats: { winRatePct: 75, avgHoldDays: 120, horizon: "largo" } },
  { label: "BTC/USD", derivSymbol: "cryBTCUSD", stats: { winRatePct: 39, avgHoldDays: 28, horizon: "medio" } },
  { label: "Nasdaq (NDX)", derivSymbol: "OTC_NDX", stats: { winRatePct: 29, avgHoldDays: 30, horizon: "medio" } },
];

const LOOKBACK = 60;
const RISK_PCT = 1;

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  try {
    console.log("=== Preview de notificaciones de entrada (datos reales · dry-run) ===\n");
    for (const { label, derivSymbol, stats } of FOCUS) {
      const closes = await adapter.dailyCloses(derivSymbol, 300);
      const params: TsmomParams = {
        symbol: derivSymbol,
        correlationGroup: "multi",
        lookback: LOOKBACK,
        atrPeriod: 14,
        atrMult: 2,
      };
      const analysis = analyzeSignal(closes, params, stats, label);
      if (!analysis) {
        console.log(`— ${label}: sin señal ahora mismo (${closes.length} velas)\n`);
        continue;
      }
      // Tarjeta en texto plano (sin tags HTML) para verla en consola.
      const card = toTelegramCard(analysis, label, RISK_PCT).replace(/<\/?b>/g, "");
      console.log(card);
      console.log("\n" + "─".repeat(64) + "\n");
    }
  } finally {
    await adapter.disconnect();
  }
}

main().catch((e) => {
  console.error(`FALLO analyze: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
