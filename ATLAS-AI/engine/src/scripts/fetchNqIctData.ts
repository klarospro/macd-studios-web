import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// Descarga velas OHLC REALES de NQ (E-mini Nasdaq futures, ticker "NQ=F") y ES (E-mini S&P 500,
// "ES=F") desde el endpoint público de gráficos de Yahoo Finance — Deriv NO ofrece Nasdaq en su
// Native API (ver 27_SCALPING/00_RESUMEN.md y 28_ESTRATEGIA_ICT_IFVG/04_PLAN_BACKTEST.md), así
// que esta es la fuente aprobada por Moisés para el backtest de ICT IFVG.
//
//   node --import tsx src/scripts/fetchNqIctData.ts
//
// Limitación conocida de Yahoo (gratis, sin API key): el intervalo 5m solo sirve ~60 días de
// histórico hacia atrás. 1D y 1H llegan mucho más lejos. Yahoo NO ofrece intervalo 4H nativo:
// se agregan 4 velas de 1H consecutivas en una vela 4H (agregación causal simple, sin solapes).
// Todo esto queda documentado en la cabecera de cada CSV de salida.

interface YahooChartResult {
  timestamp?: number[];
  indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
}

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

const OUT_DIR = new URL("../backtest/data/", import.meta.url);
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Yahoo respondió ${res.status} para ${symbol} ${interval}/${range}`);
  const body = (await res.json()) as { chart: { result: YahooChartResult[] | null; error: unknown } };
  if (body.chart.error) throw new Error(`Yahoo error para ${symbol} ${interval}/${range}: ${JSON.stringify(body.chart.error)}`);
  const result = body.chart.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) throw new Error(`Sin datos de ${symbol} ${interval}/${range}`);

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const t = timestamps[i];
    // Yahoo devuelve `null` en barras sin operativa (huecos de mercado cerrado) — se descartan.
    if (t == null || o == null || h == null || l == null || c == null) continue;
    candles.push({ t, o, h, l, c });
  }
  return candles.sort((a, b) => a.t - b.t);
}

/** Agrega velas 1H consecutivas en velas 4H (agrupación causal simple por bloques de 4, sin
 *  alinear a un reloj de mercado específico — ver limitación declarada en la cabecera del archivo). */
function aggregate4h(hourly: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i + 3 < hourly.length; i += 4) {
    const block = hourly.slice(i, i + 4);
    out.push({
      t: block[0]!.t,
      o: block[0]!.o,
      h: Math.max(...block.map((b) => b.h)),
      l: Math.min(...block.map((b) => b.l)),
      c: block[block.length - 1]!.c,
    });
  }
  return out;
}

function toCsv(candles: Candle[]): string {
  const lines = ["t,o,h,l,c"];
  for (const c of candles) lines.push(`${c.t},${c.o},${c.h},${c.l},${c.c}`);
  return lines.join("\n");
}

function writeCsv(fileName: string, candles: Candle[], label: string): void {
  const path = new URL(fileName, OUT_DIR);
  writeFileSync(path, toCsv(candles));
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  console.log(
    `${label.padEnd(28)} ${String(candles.length).padStart(6)} velas · ` +
      `${new Date(first.t * 1000).toISOString().slice(0, 10)} → ${new Date(last.t * 1000).toISOString().slice(0, 10)} · ${path.pathname}`,
  );
}

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log("Descargando datos reales de Yahoo Finance (NQ=F, ES=F) — fuente aprobada explícitamente por Moisés esta noche.\n");

  const nq5m = await fetchYahooChart("NQ=F", "5m", "60d");
  writeCsv("nqUsdM5.csv", nq5m, "NQ 5M");

  const nqDaily = await fetchYahooChart("NQ=F", "1d", "5y");
  writeCsv("nqUsdDaily.csv", nqDaily, "NQ 1D");

  const nqHourly = await fetchYahooChart("NQ=F", "60m", "730d");
  const nq4h = aggregate4h(nqHourly);
  writeCsv("nqUsd4h.csv", nq4h, "NQ 4H (agregado de 1H)");

  try {
    const es5m = await fetchYahooChart("ES=F", "5m", "60d");
    writeCsv("esUsdM5.csv", es5m, "ES 5M (opcional, SMT)");
  } catch (error) {
    console.log(`ES 5M: no se pudo descargar (${error instanceof Error ? error.message : String(error)}) — no bloquea, SMT no está activo en v1.`);
  }

  console.log("\nListo. Correr ahora: node --import tsx src/backtest/runIctIfvg.ts");
}

main().catch((error) => {
  console.error(`FALLO fetch NQ/ES: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
