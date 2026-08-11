import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

/**
 * ¿Sirve el recuento de ticks de Deriv como proxy de volumen?
 *
 * Todo el Sleeve B se apoya en "volumen > 1.5x la media de la misma hora". Si
 * Deriv emite ticks a cadencia fija (p. ej. uno por segundo) en vez de uno por
 * transacción real, ese recuento no mide participación y el filtro nunca
 * dispararía —o dispararía al azar—. Esta sonda lo comprueba midiendo la
 * DISPERSIÓN de ticks por minuto: si es ~0, el proxy no vale.
 *
 * Uso: npm run sonda:volumen
 */

const SIMBOLOS = ["frxEURUSD", "frxXAUUSD", "cryBTCUSD"];
const HORAS = 3;

function resumen(valores: number[]): { media: number; min: number; max: number; desviacion: number; cv: number } {
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / Math.max(1, valores.length - 1);
  const desviacion = Math.sqrt(varianza);
  return {
    media,
    min: Math.min(...valores),
    max: Math.max(...valores),
    desviacion,
    cv: media > 0 ? desviacion / media : 0,
  };
}

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  console.log(`Conectado a la demo ${adapter.accountId}\n`);
  console.log(`¿El recuento de ticks de Deriv mide participación real?\n`);

  try {
    // Primero, el universo real de símbolos (sin filtro de product_type).
    const symbols = await adapter.activeSymbols();
    console.log(`=== UNIVERSO OPERABLE (${symbols.length} símbolos) ===`);
    const porMercado = new Map<string, string[]>();
    for (const s of symbols) {
      const lista = porMercado.get(s.mercado) ?? [];
      lista.push(s.symbol);
      porMercado.set(s.mercado, lista);
    }
    for (const [mercado, lista] of [...porMercado].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${mercado.padEnd(22)} ${String(lista.length).padStart(3)} · ${lista.slice(0, 8).join(", ")}${lista.length > 8 ? "…" : ""}`);
    }

    console.log(`\n=== DISPERSIÓN DE TICKS POR MINUTO (${HORAS} h) ===`);
    const ahora = Math.floor(Date.now() / 1000);

    for (const símbolo of SIMBOLOS) {
      const porMinuto: number[] = [];

      // Se pide hora a hora: cada respuesta está topada y así no se trunca.
      for (let h = HORAS; h > 0; h--) {
        const desde = ahora - h * 3600;
        const hasta = ahora - (h - 1) * 3600;
        let times: number[] = [];
        try {
          times = await adapter.ticksEntre(símbolo, desde, hasta);
        } catch (error) {
          console.log(`  ${símbolo}: error pidiendo ticks — ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
        if (times.length === 0) continue;

        const cubos = new Map<number, number>();
        for (const t of times) {
          const minuto = Math.floor(t / 60);
          cubos.set(minuto, (cubos.get(minuto) ?? 0) + 1);
        }
        porMinuto.push(...cubos.values());
      }

      if (porMinuto.length === 0) {
        console.log(`  ${símbolo.padEnd(12)} sin datos`);
        continue;
      }

      const r = resumen(porMinuto);
      // Coeficiente de variación: desviación relativa a la media. En un mercado
      // real el volumen por minuto varía muchísimo (CV típico > 0,5).
      const veredicto =
        r.cv < 0.05
          ? "CADENCIA FIJA -> NO sirve como volumen"
          : r.cv < 0.3
            ? "poca variación -> proxy débil"
            : "varía -> proxy utilizable";

      console.log(
        `  ${símbolo.padEnd(12)} ${String(porMinuto.length).padStart(4)} min · ` +
          `media ${r.media.toFixed(1)} · min ${r.min} · max ${r.max} · ` +
          `CV ${r.cv.toFixed(3)} · ${veredicto}`,
      );
    }
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO sonda: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
