import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

/**
 * Sonda de capacidades de Deriv sobre la cuenta DEMO. No opera: solo pregunta.
 *
 * Responde con datos reales a cuatro cosas que el diseño multi-sleeve da por
 * supuestas y que conviene no asumir:
 *   1. Qué mercados ofrece de verdad la cuenta (la Tarea 2 pide 12-15).
 *   2. Si las velas intradía traen o no volumen.
 *   3. Si se pueden contar ticks por intervalo (proxy de volumen del Sleeve B).
 *   4. Qué cifra de coste devuelve la proposal (la regla de "spread" del gate).
 *
 * Uso: npm run sonda:deriv
 */

const SIMBOLOS_INTERES = [
  "frxEURUSD",
  "frxGBPUSD",
  "frxUSDJPY",
  "frxXAUUSD",
  "frxXAGUSD",
  "cryBTCUSD",
  "cryETHUSD",
];

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  console.log(`Conectado a la demo ${adapter.accountId}\n`);

  try {
    // --- 1. Universo operable ---
    const symbols = await adapter.activeSymbols();
    const porMercado = new Map<string, number>();
    for (const s of symbols) porMercado.set(s.mercado, (porMercado.get(s.mercado) ?? 0) + 1);

    console.log("=== 1. MERCADOS DISPONIBLES ===");
    for (const [mercado, total] of [...porMercado].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${mercado.padEnd(20)} ${total} símbolos`);
    }

    console.log("\n  Submercados de forex y materias primas:");
    const relevantes = symbols.filter((s) => s.mercado === "forex" || s.mercado === "commodities");
    const porSub = new Map<string, string[]>();
    for (const s of relevantes) {
      const lista = porSub.get(s.submercado) ?? [];
      lista.push(s.symbol);
      porSub.set(s.submercado, lista);
    }
    for (const [sub, lista] of porSub) {
      console.log(`  ${sub.padEnd(24)} ${lista.length}: ${lista.slice(0, 6).join(", ")}${lista.length > 6 ? "…" : ""}`);
    }

    console.log("\n  ¿Están los símbolos que necesitamos?");
    for (const símbolo of SIMBOLOS_INTERES) {
      const encontrado = symbols.find((s) => s.symbol === símbolo);
      console.log(
        `  ${símbolo.padEnd(12)} ${encontrado ? `SÍ · ${encontrado.nombre} · ${encontrado.abierto ? "abierto" : "cerrado"}` : "NO DISPONIBLE"}`,
      );
    }

    const indices = symbols.filter((s) => s.mercado === "indices" || s.submercado.includes("index"));
    console.log(`\n  Índices bursátiles ofrecidos: ${indices.length}`);
    if (indices.length > 0) {
      console.log(`  ${indices.slice(0, 12).map((s) => s.symbol).join(", ")}`);
    }

    // --- 2. Velas intradía: ¿traen volumen? ---
    console.log("\n=== 2. VELAS INTRADÍA (M5) ===");
    const velas = await adapter.intradayCandles("frxEURUSD", 300, 5);
    console.log(`  Recibidas ${velas.length} velas M5 de frxEURUSD`);
    if (velas[0]) {
      console.log(`  Campos de la primera vela: ${Object.keys(velas[0]).join(", ")}`);
      console.log(`  Ejemplo: ${JSON.stringify(velas[velas.length - 1])}`);
    }
    console.log(`  ¿Incluye volumen? ${velas[0] && "volume" in velas[0] ? "SÍ" : "NO — hace falta el proxy por ticks"}`);

    // --- 3. Conteo de ticks (proxy de volumen) ---
    console.log("\n=== 3. TICKS POR INTERVALO (proxy de volumen) ===");
    const ahora = Math.floor(Date.now() / 1000);
    const haceUnaHora = ahora - 3600;
    const times = await adapter.ticksEntre("frxEURUSD", haceUnaHora, ahora);
    console.log(`  Ticks devueltos en la última hora: ${times.length}`);
    if (times.length > 0) {
      const cubre = (times[times.length - 1]! - times[0]!) / 60;
      console.log(`  Cubren ${cubre.toFixed(1)} minutos (de ${new Date(times[0]! * 1000).toISOString()})`);
      console.log(`  Densidad: ${(times.length / Math.max(1, cubre)).toFixed(1)} ticks/minuto`);
      console.log(`  -> Un día de ticks ≈ ${Math.round((times.length / Math.max(1, cubre)) * 1440)} ticks`);
    }

    // --- 4. Coste real que reporta la proposal ---
    console.log("\n=== 4. COSTE DE APERTURA (regla de 'spread' del gate) ===");
    for (const símbolo of ["frxEURUSD", "frxXAUUSD", "cryBTCUSD"]) {
      try {
        const coste = await adapter.costeApertura(símbolo, 10);
        console.log(
          `  ${símbolo.padEnd(12)} commission=${coste.commission ?? "no reportada"} · spot=${coste.spot ?? "n/d"}`,
        );
      } catch (error) {
        console.log(`  ${símbolo.padEnd(12)} ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO sonda: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
