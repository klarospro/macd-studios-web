/**
 * Reglas de contratación de cada instrumento en IG: qué es "1 de tamaño",
 * cuánto vale un punto, el escalón mínimo y la distancia mínima del stop.
 *
 * Hace falta porque el tamaño de posición del motor nació contra Deriv, donde
 * el "size" es dinero apostado. En IG el size son CONTRATOS y lo que arriesgas
 * depende del valor del punto de cada epic. Sin estos números, el cálculo de
 * riesgo no significa nada aquí.
 */
import { EPIC_POR_SIMBOLO } from "../broker/igAdapter";
import { IgClient, igConfigDesdeEnv } from "../broker/igClient";

const cliente = new IgClient(igConfigDesdeEnv());
await cliente.conectar();

for (const [symbol, epic] of Object.entries(EPIC_POR_SIMBOLO)) {
  const r = await fetch(`${cliente.base}/markets/${encodeURIComponent(epic)}`, {
    headers: cliente.cabeceras("3"),
  });
  if (!r.ok) {
    console.log(`${symbol}: error ${r.status}`);
    continue;
  }
  const j = (await r.json()) as Record<string, any>;
  const i = j.instrument ?? {};
  const d = j.dealingRules ?? {};
  const s = j.snapshot ?? {};
  console.log(
    [
      symbol.padEnd(10),
      `precio ${s.bid}/${s.offer}`,
      `lotSize ${i.lotSize}`,
      `contractSize ${i.contractSize}`,
      `1 pip = ${i.valueOfOnePip} (mov ${i.onePipMeans})`,
      `minSize ${d.minDealSize?.value}`,
      `minStop ${d.minNormalStopOrLimitDistance?.value} ${d.minNormalStopOrLimitDistance?.unit}`,
      `margen ${i.marginFactor}${i.marginFactorUnit === "PERCENTAGE" ? "%" : ""}`,
      `divisa ${(i.currencies ?? []).map((c: any) => c.code).join("/")}`,
    ].join(" · "),
  );
}

await cliente.desconectar();
