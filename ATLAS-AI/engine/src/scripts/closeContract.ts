import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";

// Herramienta de operaciones: cierra (sell) un contrato demo por su contract_id.
//   node --env-file=../.env.local --import tsx src/scripts/closeContract.ts <contract_id>
async function main(): Promise<void> {
  const contractId = process.argv[2];
  if (!contractId) throw new Error("Uso: closeContract.ts <contract_id>");

  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  console.log(`Conectado a demo ${adapter.accountId}. Cerrando contrato ${contractId}...`);
  await adapter.closePosition(contractId);
  console.log(`OK · contrato ${contractId} cerrado`);
  await adapter.disconnect();
}

main().catch((error) => {
  console.error(`FALLO cerrar contrato: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
