import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

/**
 * ¿Qué mercados puede operar de verdad esta cuenta demo?
 *
 * La Tarea 2 pide 12-15 mercados (índices, oro, petróleo, gas, FX mayores).
 * `active_symbols` devuelve vacío en esta cuenta, así que se comprueba por la
 * vía dura: pedir velas de cada candidato. Si Deriv responde con datos, el
 * símbolo existe; si no, no está.
 *
 * Uso: npm run sonda:universo
 */

const CANDIDATOS: Array<{ symbol: string; etiqueta: string; clase: string }> = [
  // FX mayores
  { symbol: "frxEURUSD", etiqueta: "EUR/USD", clase: "fx_mayor" },
  { symbol: "frxGBPUSD", etiqueta: "GBP/USD", clase: "fx_mayor" },
  { symbol: "frxUSDJPY", etiqueta: "USD/JPY", clase: "fx_mayor" },
  { symbol: "frxUSDCHF", etiqueta: "USD/CHF", clase: "fx_mayor" },
  { symbol: "frxAUDUSD", etiqueta: "AUD/USD", clase: "fx_mayor" },
  { symbol: "frxUSDCAD", etiqueta: "USD/CAD", clase: "fx_mayor" },
  { symbol: "frxNZDUSD", etiqueta: "NZD/USD", clase: "fx_mayor" },
  // FX cruces
  { symbol: "frxEURGBP", etiqueta: "EUR/GBP", clase: "fx_menor" },
  { symbol: "frxEURJPY", etiqueta: "EUR/JPY", clase: "fx_menor" },
  { symbol: "frxGBPJPY", etiqueta: "GBP/JPY", clase: "fx_menor" },
  // Metales
  { symbol: "frxXAUUSD", etiqueta: "Oro", clase: "oro" },
  { symbol: "frxXAGUSD", etiqueta: "Plata", clase: "materia_prima" },
  { symbol: "frxXPTUSD", etiqueta: "Platino", clase: "materia_prima" },
  { symbol: "frxXPDUSD", etiqueta: "Paladio", clase: "materia_prima" },
  // Energía
  { symbol: "frxBROUSD", etiqueta: "Petróleo Brent", clase: "materia_prima" },
  { symbol: "frxWTIUSD", etiqueta: "Petróleo WTI", clase: "materia_prima" },
  { symbol: "frxNGSUSD", etiqueta: "Gas natural", clase: "materia_prima" },
  // Cripto
  { symbol: "cryBTCUSD", etiqueta: "BTC/USD", clase: "cripto" },
  { symbol: "cryETHUSD", etiqueta: "ETH/USD", clase: "cripto" },
  // Índices bursátiles (la investigación previa decía que NO están)
  { symbol: "OTC_SPC", etiqueta: "S&P 500", clase: "indice_mayor" },
  { symbol: "OTC_NDX", etiqueta: "Nasdaq 100", clase: "indice_mayor" },
  { symbol: "OTC_DJI", etiqueta: "Dow Jones", clase: "indice_mayor" },
  { symbol: "OTC_GDAXI", etiqueta: "DAX", clase: "indice_mayor" },
  { symbol: "OTC_FTSE", etiqueta: "FTSE 100", clase: "indice_mayor" },
  { symbol: "OTC_N225", etiqueta: "Nikkei 225", clase: "indice_menor" },
];

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  console.log(`Conectado a la demo ${adapter.accountId}\n`);
  console.log("Símbolo       Etiqueta            Clase            Velas diarias  Estado");
  console.log("-".repeat(88));

  const disponibles: typeof CANDIDATOS = [];

  try {
    for (const c of CANDIDATOS) {
      let estado = "";
      let velas = 0;
      try {
        const closes = await adapter.dailyCloses(c.symbol, 300);
        velas = closes.length;
        estado = velas >= 250 ? "DISPONIBLE" : velas > 0 ? `parcial (${velas})` : "sin datos";
        if (velas >= 250) disponibles.push(c);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        estado = /not found|unavailable|invalid/i.test(mensaje) ? "NO EXISTE" : `error: ${mensaje.slice(0, 30)}`;
      }
      console.log(
        `${c.symbol.padEnd(13)} ${c.etiqueta.padEnd(19)} ${c.clase.padEnd(16)} ${String(velas).padStart(9)}      ${estado}`,
      );
    }

    console.log("-".repeat(88));
    console.log(`\nOPERABLES con histórico suficiente: ${disponibles.length} de ${CANDIDATOS.length}`);

    const porClase = new Map<string, string[]>();
    for (const d of disponibles) {
      const lista = porClase.get(d.clase) ?? [];
      lista.push(d.symbol);
      porClase.set(d.clase, lista);
    }
    for (const [clase, lista] of porClase) {
      console.log(`  ${clase.padEnd(16)} ${lista.length}: ${lista.join(", ")}`);
    }

    console.log("\nBloque listo para pegar en atlas.yaml (esma.clase_por_simbolo):");
    for (const d of disponibles) console.log(`    ${d.symbol}: ${d.clase}`);
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO sonda: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
