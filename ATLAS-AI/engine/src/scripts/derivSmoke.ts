import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { Order } from "../domain/types";

// Orden de prueba: stake mínimo (1 unidad) en el índice sintético Volatility 100 (R_100),
// que cotiza 24/7. Es SOLO para el smoke test contra la cuenta demo.
const testOrder: Order = {
  symbol: "R_100",
  side: "buy",
  size: 1,
  entryPrice: 0,
  stopPrice: 0,
  riskAmount: 1,
  correlationGroup: "smoke",
};

async function main(): Promise<void> {
  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();
  const before = await adapter.getEquity();
  console.log(`OK · cuenta demo ${adapter.accountId} · balance: ${before}`);

  const position = await adapter.placeOrder(testOrder);
  console.log(`OK · orden abierta · contract_id ${position.id} · ${position.side} ${position.symbol}`);

  await adapter.closePosition(position.id);
  console.log(`OK · contrato ${position.id} cerrado`);

  const after = await adapter.getEquity();
  console.log(`OK · balance tras cerrar: ${after}`);
  await adapter.disconnect();
}

main().catch((error) => {
  console.error(`FALLO smoke Deriv: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
