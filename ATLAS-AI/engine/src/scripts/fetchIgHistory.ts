/**
 * Descarga histórico de IG con BID/ASK para los cinco instrumentos del plan.
 *
 * Se hace en dos tandas y mirando la cuota entre medias, porque IG raciona los
 * puntos históricos por semana: si se agota, no se puede volver a medir nada
 * hasta que renueve. Primero lo diario (barato y suficiente para las
 * estrategias de tendencia), y solo si sobra cuota, lo intradía.
 *
 * Guarda el SPREAD REAL de cada vela. Ese es el punto entero del ejercicio:
 * los backtests anteriores asumían 10 bps por lado y el spread medido en IG
 * está entre 0,33 y 1,14 bps. Un orden de magnitud de diferencia cambia
 * cualquier conclusión sobre estrategias que operan mucho.
 *
 * Uso: npm run fetch:ig
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { IgClient, igConfigDesdeEnv, ResolucionIg, VelaIg } from "../broker/igClient";

const DESTINO = fileURLToPath(new URL("../backtest/data/ig/", import.meta.url));

/** Epics verificados contra la cuenta demo Z6DHEP el 2026-08-13. */
export const EPICS: Record<string, string> = {
  eurusd: "CS.D.EURUSD.MINI.IP",
  oro: "CS.D.CFDGOLD.CFDGC.IP",
  usdjpy: "CS.D.USDJPY.MINI.IP",
  us30: "IX.D.DOW.IFD.IP",
  nasdaq: "IX.D.NASDAQ.IFD.IP",
};

/** Reserva de cuota que no se toca: deja margen para diagnosticar otro día. */
const RESERVA = 900;

function resumen(velas: VelaIg[]): string {
  if (velas.length === 0) return "sin datos";
  const spreads = velas.map((v) => v.spread).filter((s) => Number.isFinite(s) && s >= 0);
  const medio = spreads.reduce((a, b) => a + b, 0) / (spreads.length || 1);
  const cierre = velas[velas.length - 1]!.mid.close;
  const bps = (medio / cierre) * 10_000;
  const desde = new Date(velas[0]!.epoch * 1000).toISOString().slice(0, 10);
  const hasta = new Date(velas[velas.length - 1]!.epoch * 1000).toISOString().slice(0, 10);
  return `${velas.length} velas · ${desde}→${hasta} · spread medio ${medio.toFixed(5)} (${bps.toFixed(2)} bps)`;
}

async function main(): Promise<void> {
  const cliente = new IgClient(igConfigDesdeEnv());
  await cliente.conectar();
  console.log(`Conectado · cuenta ${cliente.accountId} · ${cliente.currency} · entorno ${cliente.base.includes("demo") ? "DEMO" : "LIVE"}\n`);

  mkdirSync(DESTINO, { recursive: true });

  // La cuota semanal es finita y ya se gastó una parte. Prioridad: lo DIARIO de
  // los cinco (base de las estrategias de tendencia, que son las únicas con
  // resultado positivo medido) y lo intradía SOLO del oro, que es el
  // instrumento con el que ya existe una comparativa contra la que contrastar.
  const tandas: Array<{ etiqueta: string; resolucion: ResolucionIg; puntos: number; epics: string[] }> = [
    { etiqueta: "diario", resolucion: "DAY", puntos: 300, epics: Object.keys(EPICS) },
    { etiqueta: "m15", resolucion: "MINUTE_15", puntos: 900, epics: ["oro"] },
  ];

  let cuotaRestante = Infinity;

  for (const tanda of tandas) {
    const coste = tanda.puntos * tanda.epics.length;
    if (cuotaRestante - coste < RESERVA) {
      console.log(`\n[!] Se omite la tanda "${tanda.etiqueta}": costaría ~${coste} puntos y solo quedan ${cuotaRestante}.`);
      console.log(`    Se reserva un colchón de ${RESERVA} para poder diagnosticar otro día.`);
      continue;
    }

    console.log(`── ${tanda.etiqueta.toUpperCase()} (${tanda.resolucion}, ${tanda.puntos} puntos × ${tanda.epics.length}) ──`);
    for (const nombre of tanda.epics) {
      const epic = EPICS[nombre]!;
      try {
        const { velas, cuota } = await cliente.historial(epic, tanda.resolucion, tanda.puntos);
        writeFileSync(`${DESTINO}${nombre}-${tanda.etiqueta}.json`, JSON.stringify(velas), "utf8");
        if (cuota) cuotaRestante = cuota.restante;
        console.log(`  ${nombre.padEnd(8)} ${resumen(velas)}${cuota ? ` · cuota ${cuota.restante}/${cuota.total}` : ""}`);
      } catch (e) {
        console.log(`  ${nombre.padEnd(8)} ERROR: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.log(`\nCuota restante: ${cuotaRestante === Infinity ? "desconocida" : cuotaRestante} puntos.`);
  await cliente.desconectar();
}

main().catch((e) => {
  console.error(`FALLO: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
