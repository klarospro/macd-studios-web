import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

// Exporta el estado REAL de la cuenta demo (balance, posiciones abiertas, últimas
// transacciones) a runtime/account.json, para que el dashboard muestre el historial real.
//   node --env-file=../.env.local --import tsx src/scripts/exportAccountData.ts
async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  try {
    const [balance, open, statement] = await Promise.all([
      adapter.getEquity(),
      adapter.openContracts(),
      adapter.statement(25),
    ]);
    const data = {
      generatedAt: new Date().toISOString(),
      accountId: adapter.accountId,
      balance,
      open,
      statement,
    };
    const outDir = fileURLToPath(new URL("../../runtime/", import.meta.url));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(fileURLToPath(new URL("../../runtime/account.json", import.meta.url)), JSON.stringify(data, null, 2));
    console.log(`Cuenta ${adapter.accountId} · balance $${balance} · ${open.length} abiertas · ${statement.length} transacciones`);
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO export cuenta: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
