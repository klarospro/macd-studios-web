import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { cargarConfig } from "../config/sleeveConfig";

/**
 * ¿Qué símbolos se pueden OPERAR de verdad, no solo consultar?
 *
 * `sonda:universo` comprueba que haya histórico de precios. No es lo mismo:
 * NZD/USD, platino y paladio devuelven velas diarias perfectas y aun así Deriv
 * responde "Trading is not offered for this asset" al pedir una proposal de
 * Multipliers. Tener datos no implica poder operar.
 *
 * Distingue tres estados:
 *   OPERABLE     — la proposal se acepta.
 *   NO OFRECIDO  — permanente: el símbolo no admite Multipliers. Quitar del YAML.
 *   CERRADO      — temporal (horario de mercado). Reintentar en otro momento.
 *
 * IMPORTANTE: ejecutar con los mercados ABIERTOS. Fuera de horario todo sale
 * como CERRADO y la sonda no distingue nada.
 *
 * Uso: npm run sonda:operabilidad
 */

async function main(): Promise<void> {
  const config = cargarConfig();
  const simbolos = Object.keys(config.esma.clasePorSimbolo);

  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  console.log(`Conectado a la demo ${adapter.accountId} · ${new Date().toISOString()}\n`);
  console.log(`Probando una proposal real (sin comprar) de ${simbolos.length} símbolos:\n`);

  const operables: string[] = [];
  const noOfrecidos: string[] = [];
  const cerrados: string[] = [];

  try {
    for (const symbol of simbolos) {
      try {
        await adapter.costeApertura(symbol, 10);
        operables.push(symbol);
        console.log(`  ${symbol.padEnd(12)} OPERABLE`);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        if (/not offered/i.test(mensaje)) {
          noOfrecidos.push(symbol);
          console.log(`  ${symbol.padEnd(12)} NO OFRECIDO (permanente) — quitar del YAML`);
        } else if (/temporarily unavailable|market is closed/i.test(mensaje)) {
          cerrados.push(symbol);
          console.log(`  ${symbol.padEnd(12)} cerrado ahora (temporal)`);
        } else {
          console.log(`  ${symbol.padEnd(12)} ERROR: ${mensaje.slice(0, 50)}`);
        }
      }
    }

    console.log(
      `\nResumen: ${operables.length} operables · ${noOfrecidos.length} no ofrecidos · ${cerrados.length} cerrados ahora`,
    );

    if (cerrados.length === simbolos.length) {
      console.log(
        "\n[!] TODOS salieron cerrados: los mercados están cerrados a esta hora.\n" +
          "    La sonda no puede distinguir nada. Repetir con mercados abiertos.",
      );
    }
    if (noOfrecidos.length > 0) {
      console.log(`\nQuitar de esma.clase_por_simbolo en atlas.yaml:\n  ${noOfrecidos.join(", ")}`);
    }
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO sonda: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
