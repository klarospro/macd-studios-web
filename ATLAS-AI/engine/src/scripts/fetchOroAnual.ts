/**
 * Descarga un año de oro (frxXAUUSD) de Deriv: velas diarias y M15.
 *
 * Sin token: `ticks_history` es público. Se usa precisamente porque la capa de
 * OFERTAS de Deriv está caída desde el 2026-08-12 pero el FEED sigue vivo —
 * distinción medida, no supuesta (ver `vigilanciaVenue.ts`).
 *
 * Deriv corta cada respuesta en 5.000 velas, así que el M15 (~35.000 en un año)
 * se pagina hacia atrás con `end`. Uso: npm run fetch:oro
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const SIMBOLO = "frxXAUUSD";
const DIAS = 365;
const MAX_POR_PETICION = 5000;
const DESTINO = fileURLToPath(new URL("../backtest/data/", import.meta.url));

interface VelaCruda {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function abrir(): Promise<{
  pedir: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  cerrar: () => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089&l=EN");
    let id = 0;
    const pendientes = new Map<number, { ok: (v: any) => void; ko: (e: Error) => void }>();

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      const p = pendientes.get(msg.req_id);
      if (!p) return;
      pendientes.delete(msg.req_id);
      if (msg.error) p.ko(new Error(`${msg.error.code}: ${msg.error.message}`));
      else p.ok(msg);
    });
    ws.on("error", (e) => reject(e));
    ws.on("open", () =>
      resolve({
        pedir: (payload) =>
          new Promise((ok, ko) => {
            const req_id = ++id;
            pendientes.set(req_id, { ok, ko });
            ws.send(JSON.stringify({ ...payload, req_id }));
            setTimeout(() => ko(new Error("timeout")), 30000);
          }),
        cerrar: () => ws.close(),
      }),
    );
  });
}

async function bajar(
  pedir: (p: Record<string, unknown>) => Promise<Record<string, unknown>>,
  granularity: number,
  desde: number,
  hasta: number,
): Promise<VelaCruda[]> {
  const todas: VelaCruda[] = [];
  let fin = hasta;

  // Se pagina hacia ATRÁS: cada respuesta acaba donde empieza la anterior.
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const r = await pedir({
      ticks_history: SIMBOLO,
      adjust_start_time: 1,
      count: MAX_POR_PETICION,
      end: String(fin),
      start: desde,
      style: "candles",
      granularity,
    });
    const lote = ((r.candles as VelaCruda[]) ?? []).filter((c) => c && Number.isFinite(c.close));
    if (lote.length === 0) break;

    todas.unshift(...lote.filter((c) => c.epoch < (todas[0]?.epoch ?? Infinity)));
    const primero = lote[0]!.epoch;
    process.stdout.write(`\r  ${granularity}s: ${todas.length} velas (hasta ${new Date(primero * 1000).toISOString().slice(0, 10)})   `);
    if (primero <= desde || lote.length < MAX_POR_PETICION) break;
    fin = primero - 1;
  }
  process.stdout.write("\n");
  return todas;
}

async function main(): Promise<void> {
  const hasta = Math.floor(Date.now() / 1000);
  const desde = hasta - DIAS * 86400;
  console.log(`Oro ${SIMBOLO} · ${new Date(desde * 1000).toISOString().slice(0, 10)} → ${new Date(hasta * 1000).toISOString().slice(0, 10)}\n`);

  const { pedir, cerrar } = await abrir();
  try {
    const diarias = await bajar(pedir, 86400, desde, hasta);
    const m15 = await bajar(pedir, 900, desde, hasta);

    mkdirSync(DESTINO, { recursive: true });
    writeFileSync(`${DESTINO}oroDiario1y.json`, JSON.stringify(diarias), "utf8");
    writeFileSync(`${DESTINO}oroM15_1y.json`, JSON.stringify(m15), "utf8");

    const cierres = diarias.map((c) => c.close);
    console.log(`\nGuardado:`);
    console.log(`  oroDiario1y.json · ${diarias.length} velas · ${cierres[0]} → ${cierres[cierres.length - 1]}`);
    console.log(`  oroM15_1y.json   · ${m15.length} velas`);
    if (diarias.length < 200) console.log(`\n[!] Menos de 200 velas diarias: el backtest anual no será fiable.`);
  } finally {
    cerrar();
  }
}

main().catch((e) => {
  console.error(`FALLO: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
