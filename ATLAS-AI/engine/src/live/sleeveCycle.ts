import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { AtlasConfig, cargarConfig, SleeveId, SLEEVE_IDS } from "../config/sleeveConfig";
import { fechaUtc, Vela } from "../domain/bars";
import { crearSleeveTradeLog, SleeveTrade } from "../audit/sleeveTrade";
import { createAuditLog } from "../audit/supabaseAuditLog";
import { detectarSolapamientos, SleevePosition } from "../portfolio/sleeveAllocator";
import { ContextoCartera, evaluarSleeve, LimitesSleeve, SleeveDecision, SleeveSignal } from "../risk/sleeveRiskGate";
import { paramsCoreDesdeConfig, senalCore, debeCerrarCore } from "../strategy/sleeveCore";
import { paramsIntradiaDesdeConfig, senalIntradia } from "../strategy/sleeveIntradia";
import {
  calendarioDesdeConfig,
  evaluarEvento,
  paramsEventScalpDesdeConfig,
} from "../strategy/sleeveEventScalp";
import {
  cargarEstado,
  EstadoCartera,
  guardarEstado,
  pnlCartera,
  quitarPosicion,
  registrarApertura,
  registrarCierre,
  rotarPeriodos,
} from "./sleeveState";
import { notificarEntradaSleeve, notificarSalidaSleeve } from "./telegramSleeve";

/**
 * Ciclo en vivo de la cartera multi-sleeve. SUSTITUYE a `dailyCycle.ts`.
 *
 * Es `oneshot`: una pasada y muere. La cadencia la pone un timer de systemd
 * cada minuto, igual que ya hacía el bot anterior con su timer diario — se
 * reutiliza el patrón que el VPS ya conoce en vez de introducir un proceso
 * residente nuevo. Un minuto basta para las tres cadencias: el Core revisa
 * velas diarias (le sobra), el Intradía trabaja sobre M5, y la ventana de
 * entrada del EventScalp es de 60-120 s tras el dato.
 *
 * DRY-RUN por defecto. Con `--execute` abre y cierra de verdad en la demo.
 */

const EXECUTE = process.argv.includes("--execute");
const RUNTIME = new URL("../../runtime/", import.meta.url);
const ESTADO_PATH = fileURLToPath(new URL("sleeves.json", RUNTIME));

const audit = createAuditLog(fileURLToPath(new URL("audit.jsonl", RUNTIME)));
const tradeLog = crearSleeveTradeLog(fileURLToPath(new URL("sleeve-trades.jsonl", RUNTIME)));

/** Instrumentos por sleeve. Salen del universo verificado en `atlas.yaml`. */
function instrumentosDe(config: AtlasConfig, sleeve: SleeveId): string[] {
  const bloque = config[sleeve] as Record<string, any>;
  const declarados = bloque.instrumentos as string[] | undefined;
  if (declarados && declarados.length > 0) return declarados;
  // Sin lista explícita, opera todo lo clasificado (fallo seguro: si no está
  // en `clase_por_simbolo`, el gate lo rechaza igualmente por ESMA).
  return Object.keys(config.esma.clasePorSimbolo);
}

function limitesDe(config: AtlasConfig, sleeve: SleeveId): LimitesSleeve {
  const bloque = config[sleeve] as Record<string, any>;
  const l = (bloque.limites ?? {}) as Record<string, any>;
  const riesgo = config.riesgo.riesgoPorTradePct;

  const base: LimitesSleeve = {
    riesgoPorTradePct: riesgo.max,
    posicionesMax: l.posiciones_max,
    posicionesMaxPorClase: l.posiciones_max_por_clase,
  };
  if (sleeve === "core") return base;

  if (sleeve === "intradia") {
    return {
      ...base,
      tradesDiaMax: l.trades_dia_max,
      tradesSemanaMax: l.trades_semana_max,
      pararTrasPerdidasConsecutivas: l.parar_tras_perdidas_iniciales,
    };
  }

  return {
    ...base,
    tradesDiaMax: l.eventos_dia_max,
    tradesSemanaMax: l.eventos_semana_max,
    breakerDrawdownPct: l.breaker_perdida_sleeve_pct,
  };
}

function contexto(config: AtlasConfig, estado: EstadoCartera, equity: number, fecha: string): ContextoCartera {
  const pnl = pnlCartera(estado);
  return {
    equityTotal: equity,
    pnlDiaCartera: pnl.dia,
    pnlSemanaCartera: pnl.semana,
    sleeves: estado.sleeves,
    fecha,
  };
}

/** Ejecuta una decisión aprobada: abre en el broker, registra y avisa. */
async function abrir(
  adapter: DerivDemoAdapter,
  estado: EstadoCartera,
  decision: Extract<SleeveDecision, { approved: true }>,
  at: string,
  etiqueta: string,
  puntuacionIa?: number,
): Promise<void> {
  const orden = decision.order;

  const posicion: SleevePosition = EXECUTE
    ? { ...(await adapter.placeOrder(orden)), sleeve: orden.sleeve }
    : {
        id: `dry-${orden.sleeve}-${orden.symbol}-${Date.now()}`,
        symbol: orden.symbol,
        side: orden.side,
        size: orden.size,
        entryPrice: orden.entryPrice,
        stopPrice: orden.stopPrice,
        riskAmount: orden.riskAmount,
        correlationGroup: orden.correlationGroup,
        sleeve: orden.sleeve,
      };

  registrarApertura(estado, posicion, orden.setupId);

  const trade: SleeveTrade = {
    id: posicion.id,
    sleeve: orden.sleeve,
    symbol: orden.symbol,
    side: orden.side,
    setupId: orden.setupId,
    abiertoEn: at,
    precioEntrada: posicion.entryPrice,
    size: orden.size,
    riskAmount: orden.riskAmount,
    nocional: orden.nocional,
    apalancamientoUsado: orden.apalancamientoUsado,
    // Slippage medido de verdad: lo que pedimos frente a lo que dio el broker.
    slippage: EXECUTE ? Math.abs(posicion.entryPrice - orden.entryPrice) : undefined,
    puntuacionIa,
    simulada: !EXECUTE,
  };

  await tradeLog.registrar(trade).catch((e) => console.log(`  aviso: no se pudo registrar el trade (${e})`));
  await audit.record({ kind: "order_placed", at, order: orden, positionId: posicion.id, venueId: "deriv-demo" });
  await notificarEntradaSleeve(orden, etiqueta, !EXECUTE);

  console.log(
    `  ${orden.sleeve.padEnd(11)} ${orden.side.toUpperCase()} ${orden.symbol} @ ${orden.entryPrice} · ` +
      `stop ${orden.stopPrice.toFixed(5)} · riesgo $${orden.riskAmount.toFixed(2)} · ` +
      `apalanc. ${orden.apalancamientoUsado.toFixed(1)}x${EXECUTE ? "" : " (dry-run)"}`,
  );
}

/** Cierra una posición: en el broker, en el estado, en la auditoría y por Telegram. */
async function cerrar(
  adapter: DerivDemoAdapter,
  estado: EstadoCartera,
  posicion: SleevePosition,
  motivo: string,
  at: string,
): Promise<void> {
  let pnl = 0;
  if (EXECUTE) {
    try {
      const { profit } = await adapter.contractPnl(posicion.id);
      pnl = profit;
    } catch {
      // Si no se puede leer el P&L, se cierra igual: dejar la posición abierta
      // por no poder medirla sería peor que no conocer la cifra exacta.
    }
    await adapter.closePosition(posicion.id);
  }

  quitarPosicion(estado, posicion.sleeve, posicion.id);
  registrarCierre(estado, posicion.sleeve, pnl);

  await tradeLog
    .actualizar(posicion.id, { cerradoEn: at, pnl, motivoSalida: motivo })
    .catch(() => null);
  await audit.record({
    kind: "position_closed",
    at,
    venueId: "deriv-demo",
    positionId: posicion.id,
    symbol: posicion.symbol,
    motivo,
  });
  await notificarSalidaSleeve(posicion.sleeve, posicion.symbol, posicion.side, motivo, pnl, !EXECUTE);

  console.log(`  ${posicion.sleeve.padEnd(11)} CIERRE ${posicion.symbol} · ${motivo} · P&L ${pnl.toFixed(2)}`);
}

// ---------------------------------------------------------------------------
// Sleeve A — Core
// ---------------------------------------------------------------------------
async function pasadaCore(
  adapter: DerivDemoAdapter,
  config: AtlasConfig,
  estado: EstadoCartera,
  equity: number,
  fecha: string,
  at: string,
): Promise<void> {
  const bloque = config.core as Record<string, any>;
  if (bloque.activo !== true) return;

  // El Core trabaja sobre velas diarias con horizonte semanal: una revisión al
  // día basta y evita 23 peticiones por minuto para releer barras idénticas.
  if (estado.ultimaPasadaCore === fecha) return;
  estado.ultimaPasadaCore = fecha;

  for (const symbol of instrumentosDe(config, "core")) {
    try {
      const { trend, volTarget } = paramsCoreDesdeConfig(bloque, symbol, "core");
      const closes = await adapter.dailyCloses(symbol, 300);
      if (closes.length < 210) continue; // sin histórico para EWMA 200
      const t = closes.length - 1;

      const abierta = estado.sleeves.core.openPositions.find((p) => p.symbol === symbol);
      if (abierta && debeCerrarCore(closes, t, trend, abierta.side)) {
        await cerrar(adapter, estado, abierta, "estructura_agotada", at);
        continue;
      }
      if (abierta) continue;

      const signal = senalCore(closes, t, trend, volTarget);
      if (!signal) continue;

      const decision = evaluarSleeve(config, contexto(config, estado, equity, fecha), signal, limitesDe(config, "core"));
      if (!decision.approved) {
        await audit.record({ kind: "order_rejected", at, signal, reason: "max_aggregate_risk", venueId: "deriv-demo" });
        continue;
      }
      await abrir(adapter, estado, decision, at, symbol);
    } catch (error) {
      console.log(`  core        ${symbol}: ${error instanceof Error ? error.message : String(error)} (se salta)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sleeve B — Intradía
// ---------------------------------------------------------------------------
async function pasadaIntradia(
  adapter: DerivDemoAdapter,
  config: AtlasConfig,
  estado: EstadoCartera,
  equity: number,
  fecha: string,
  at: string,
  minutosAEventoPorSimbolo: Map<string, number>,
): Promise<void> {
  const bloque = config.intradia as Record<string, any>;
  if (bloque.activo !== true) return;

  for (const symbol of instrumentosDe(config, "intradia")) {
    try {
      const { params } = paramsIntradiaDesdeConfig(bloque, symbol, "intradia");
      // 20 jornadas de M5 para la media de recorrido por hora + margen.
      const velas: Vela[] = await adapter.intradayCandles(symbol, 300, 5000);
      if (velas.length < 300) continue;
      const t = velas.length - 1;

      const signal = senalIntradia(velas, t, params, minutosAEventoPorSimbolo.get(symbol));
      if (!signal) continue;

      const decision = evaluarSleeve(
        config,
        contexto(config, estado, equity, fecha),
        signal,
        limitesDe(config, "intradia"),
      );
      if (!decision.approved) continue;
      await abrir(adapter, estado, decision, at, symbol);
    } catch (error) {
      console.log(`  intradia    ${symbol}: ${error instanceof Error ? error.message : String(error)} (se salta)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sleeve C — EventScalp
// ---------------------------------------------------------------------------
async function pasadaEventScalp(
  adapter: DerivDemoAdapter,
  config: AtlasConfig,
  estado: EstadoCartera,
  equity: number,
  fecha: string,
  at: string,
  ahoraEpoch: number,
): Promise<Map<string, number>> {
  const bloque = config.eventscalp as Record<string, any>;
  const minutosAEvento = new Map<string, number>();
  if (bloque.activo !== true) return minutosAEvento;

  const { params } = paramsEventScalpDesdeConfig(bloque, "macro");
  const calendario = calendarioDesdeConfig(bloque);
  // Ventana amplia: los de hoy sirven tanto para operar como para que el
  // Sleeve B sepa de qué apartarse.
  const delDia = calendario.eventos(ahoraEpoch - 12 * 3600, ahoraEpoch + 12 * 3600);

  for (const evento of delDia) {
    minutosAEvento.set(evento.symbol, (ahoraEpoch - evento.epoch) / 60);
  }

  for (const evento of delDia) {
    try {
      const velas = await adapter.intradayCandles(evento.symbol, 300, 100);
      if (velas.length < 20) continue;
      const t = velas.length - 1;

      // Precio justo antes de la publicación: última vela cerrada previa al dato.
      const previa = velas.filter((v) => v.epoch + 300 <= evento.epoch).pop();
      if (!previa) continue;

      const resultado = evaluarEvento(evento, delDia, velas, t, {
        ahoraEpoch,
        precioPublicacion: previa.close,
        precioActual: velas[t]!.close,
      }, params);

      if (!resultado.operar) {
        if (resultado.motivo !== "fuera_de_ventana") {
          console.log(`  eventscalp  ${evento.id}: descartado (${resultado.motivo})`);
        }
        continue;
      }

      const decision = evaluarSleeve(
        config,
        contexto(config, estado, equity, fecha),
        resultado.signal,
        limitesDe(config, "eventscalp"),
      );
      if (!decision.approved) {
        console.log(`  eventscalp  ${evento.id}: rechazado por riesgo (${decision.reason})`);
        continue;
      }
      await abrir(adapter, estado, decision, at, evento.tipo, resultado.puntuacion);
    } catch (error) {
      console.log(`  eventscalp  ${evento.id}: ${error instanceof Error ? error.message : String(error)} (se salta)`);
    }
  }

  return minutosAEvento;
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const config = cargarConfig();
  if (config.modo !== "demo") {
    throw new Error("SEGURIDAD: atlas.yaml no está en modo demo. Fase 1 es solo demo.");
  }

  const adapter = new DerivDemoAdapter(derivConfigFromEnv());
  await adapter.connect();

  try {
    const equity = await adapter.getEquity();
    const ahoraEpoch = Math.floor(Date.now() / 1000);
    const at = new Date(ahoraEpoch * 1000).toISOString();
    const fecha = fechaUtc(ahoraEpoch);

    const estado = cargarEstado(ESTADO_PATH, fecha, equity);
    const { diaNuevo, semanaNueva } = rotarPeriodos(estado, fecha, equity);

    const pnl = pnlCartera(estado);
    console.log(
      `Ciclo multi-sleeve · demo ${adapter.accountId} · equity $${equity.toFixed(2)} · ` +
        `${EXECUTE ? "EJECUTAR" : "DRY-RUN"} · ${at}` +
        `${diaNuevo ? " · día nuevo" : ""}${semanaNueva ? " · semana nueva" : ""}`,
    );
    console.log(
      `  P&L día ${pnl.dia.toFixed(2)} (${((pnl.dia / equity) * 100).toFixed(2)}%) · ` +
        `semana ${pnl.semana.toFixed(2)} (${((pnl.semana / equity) * 100).toFixed(2)}%)`,
    );

    // El Sleeve C va primero: sus eventos definen de qué debe apartarse el B.
    const minutosAEvento = await pasadaEventScalp(adapter, config, estado, equity, fecha, at, ahoraEpoch);
    await pasadaIntradia(adapter, config, estado, equity, fecha, at, minutosAEvento);
    await pasadaCore(adapter, config, estado, equity, fecha, at);

    // Red de seguridad: si pese a todo dos sleeves acabaron en el mismo
    // instrumento y dirección, se cierra el de menor prioridad.
    for (const solape of detectarSolapamientos(config.cartera, estado.sleeves)) {
      const posicion = estado.sleeves[solape.cerrar].openPositions.find((p) => p.id === solape.positionId);
      if (posicion) {
        console.log(`  solapamiento en ${solape.symbol} ${solape.side}: se cierra ${solape.cerrar}, se conserva ${solape.conservar}`);
        await cerrar(adapter, estado, posicion, "solapamiento_entre_sleeves", at);
      }
    }

    const abiertas = SLEEVE_IDS.map((id) => `${id} ${estado.sleeves[id].openPositions.length}`).join(" · ");
    console.log(`  Posiciones abiertas: ${abiertas}`);

    guardarEstado(ESTADO_PATH, estado);
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO ciclo multi-sleeve: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
