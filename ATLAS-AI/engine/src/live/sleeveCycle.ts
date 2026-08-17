import { fileURLToPath } from "node:url";
import { DerivDemoAdapter, derivConfigFromEnv } from "../broker/derivDemoAdapter";
import { PaperDerivAdapter } from "../broker/paperDerivAdapter";
import { EPIC_POR_SIMBOLO, IgAdapter } from "../broker/igAdapter";
import { igConfigDesdeEnv } from "../broker/igClient";
import { AtlasConfig, cargarConfig, SleeveId, SLEEVE_IDS } from "../config/sleeveConfig";
import { fechaUtc, Vela } from "../domain/bars";
import { crearSleeveTradeLog, SleeveTrade } from "../audit/sleeveTrade";
import { createAuditLog } from "../audit/supabaseAuditLog";
import { capitalDeSleeve, detectarSolapamientos, SleevePosition } from "../portfolio/sleeveAllocator";
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
import {
  notificarEntradaSleeve,
  notificarSalidaSleeve,
  notificarVenueCaido,
  notificarVenueRecuperado,
} from "./telegramSleeve";
import { evaluarSalud, minutosCaido } from "./vigilanciaVenue";
import { puntuarSetup, VelaFlujo } from "../strategy/orderFlow";
import { crearRegistroSenales, desdePuntuacion } from "../audit/registroSenales";
import { permiteExposicion, PiernaExpuesta } from "../risk/exposicionDivisa";
import { publishSnapshot } from "./supabaseLive";
import { HeldPosition } from "./state";

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
/**
 * `--paper`: mismas estrategias y mismo riesgo, pero la ejecución se simula
 * sobre el feed de precios real (ver `paperDerivAdapter.ts`). Existe porque el
 * 2026-08-12 Deriv dejó de ofrecer contratos mientras seguía publicando precios:
 * sin esto, un bróker medio caído deja la cartera sin nada que enseñar.
 * Su estado y su venue van SEPARADOS del real: mezclar las dos curvas de equity
 * en el panel sería la peor forma posible de equivocarse.
 */
const PAPER = process.argv.includes("--paper");
/**
 * `--ig`: opera contra IG Markets en vez de Deriv. Es el venue que sustituye a
 * Deriv tras el incidente del 2026-08-12 — bid/ask reales, índices operables y
 * volumen por vela. La cuenta va en EUR, no en USD: eso importa para el neteo
 * de exposición por divisa.
 */
const IG = process.argv.includes("--ig");
const VENUE_ID = IG ? "ig-demo" : PAPER ? "deriv-paper" : "deriv-demo";
const RUNTIME = new URL("../../runtime/", import.meta.url);
const ESTADO_PATH = fileURLToPath(new URL(IG ? "sleeves-ig.json" : PAPER ? "sleeves-paper.json" : "sleeves.json", RUNTIME));
const CUENTA_PAPEL_PATH = fileURLToPath(new URL("paper.json", RUNTIME));

/**
 * Lo que el ciclo necesita de un bróker. `DerivDemoAdapter` (real) y
 * `PaperDerivAdapter` (simulado) lo cumplen: el ciclo no distingue cuál lleva.
 */
type AdaptadorCiclo = DerivDemoAdapter | PaperDerivAdapter | IgAdapter;

const audit = createAuditLog(fileURLToPath(new URL("audit.jsonl", RUNTIME)));
const tradeLog = crearSleeveTradeLog(fileURLToPath(new URL("sleeve-trades.jsonl", RUNTIME)));
const registroSenales = crearRegistroSenales(fileURLToPath(new URL("senales.jsonl", RUNTIME)));

/** Instrumentos por sleeve. Salen del universo verificado en `atlas.yaml`. */
function instrumentosDe(config: AtlasConfig, sleeve: SleeveId): string[] {
  const bloque = config[sleeve] as Record<string, any>;
  const declarados = bloque.instrumentos as string[] | undefined;
  const universo = declarados && declarados.length > 0 ? declarados : null;
  // En IG solo se opera lo que tiene epic VERIFICADO contra la cuenta. Un
  // símbolo de Deriv sin equivalente en IG no se intenta a ciegas.
  if (IG) {
    const conEpic = Object.keys(EPIC_POR_SIMBOLO);
    return universo ? universo.filter((s) => conEpic.includes(s)) : conEpic;
  }
  if (universo) return universo;
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

/**
 * Marco temporal del sleeve Intradía y cuántas velas pedir.
 *
 * Con Deriv eran M5 y 5.000 velas porque el histórico era gratis. En IG cada
 * vela cuesta cuota: 5.000 x 5 símbolos = 25.000 puntos por pasada, dos veces
 * y media el límite SEMANAL entero. De ahí el `exceeded-account-historical-
 * data-allowance` que dejó el sleeve parado.
 *
 * M15 con 300 velas cubre ~3 días de sesión, que es de sobra para rangos de
 * apertura y rupturas horarias. Y la estrategia deduce el marco de las propias
 * velas (`minutosPorVela`), así que no hay que tocar su lógica: los umbrales
 * se recalculan solos sobre el nuevo marco.
 */
const GRANULARIDAD_INTRADIA = IG ? 900 : 300;
const VELAS_INTRADIA = IG ? 300 : 5000;

/**
 * Tope de exposición neta por divisa, en moneda de cuenta.
 *
 * Se calcula sobre el EQUITY, no sobre el riesgo de la señal candidata. Con lo
 * segundo el tope encogía con la señal —una entrada de oro a $6,49 de riesgo
 * generaba un tope de $12,98 y se bloqueaba a sí misma— y la cartera se quedaba
 * sin poder diversificar. Medido en la primera pasada con el límite activo.
 */
function topeDivisa(config: AtlasConfig, equity: number): number {
  // Desde el 2026-08-17 sale DIRECTO de `riesgo.tope_por_bloque_pct` (2% del
  // equity, decisión de Moisés). Antes se derivaba del riesgo por operación y
  // del número de posiciones equivalentes, lo que hacía imposible responder a
  // "¿cuánto puedo perder si el dólar se mueve en mi contra?" sin recalcularlo
  // a mano. Un límite que el operador no puede leer de un vistazo no protege.
  return equity * config.riesgo.topePorBloquePct;
}

/**
 * Divisa de la cuenta. IG opera en EUR y Deriv en USD; aplicar el tope
 * ampliado a la divisa equivocada dejaría la de verdad sin protección.
 */
function divisaCuenta(): string {
  return IG ? "EUR" : "USD";
}

/** Todas las posiciones abiertas de la cartera, de todos los sleeves. */
function piernasAbiertas(estado: EstadoCartera): PiernaExpuesta[] {
  return SLEEVE_IDS.flatMap((id) =>
    estado.sleeves[id].openPositions.map((p) => ({ symbol: p.symbol, side: p.side, riskAmount: p.riskAmount })),
  );
}

/** Ejecuta una decisión aprobada: abre en el broker, registra y avisa. */
async function abrir(
  adapter: AdaptadorCiclo,
  estado: EstadoCartera,
  decision: Extract<SleeveDecision, { approved: true }>,
  at: string,
  etiqueta: string,
  topePorDivisa: number,
  puntuacionIa?: number,
): Promise<void> {
  const orden = decision.order;

  // Último filtro, y deliberadamente aquí: `abrir` es el ÚNICO camino por el
  // que se abre una posición, así que ninguna ruta futura podrá saltárselo.
  // El tope por clase ESMA es regulatorio y no ve que USD/JPY, EUR/JPY y
  // GBP/JPY son la misma apuesta contra el yen.
  const veredicto = permiteExposicion(
    piernasAbiertas(estado),
    { symbol: orden.symbol, side: orden.side, riskAmount: orden.riskAmount },
    topePorDivisa,
    { divisaCuenta: divisaCuenta() },
  );
  if (!veredicto.permitido) {
    console.log(
      `  ${orden.sleeve.padEnd(11)} ${orden.symbol}: rechazada · exposición neta en ${veredicto.divisa} ` +
        `llegaría a $${Math.abs(veredicto.expuestoTras ?? 0).toFixed(2)} (tope $${veredicto.limite?.toFixed(2)})`,
    );
    await audit.record({ kind: "order_rejected", at, signal: orden, reason: "max_aggregate_risk", venueId: VENUE_ID });
    return;
  }

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
  await audit.record({ kind: "order_placed", at, order: orden, positionId: posicion.id, venueId: VENUE_ID });
  await notificarEntradaSleeve(orden, etiqueta, !EXECUTE);

  console.log(
    `  ${orden.sleeve.padEnd(11)} ${orden.side.toUpperCase()} ${orden.symbol} @ ${orden.entryPrice} · ` +
      `stop ${orden.stopPrice.toFixed(5)} · riesgo $${orden.riskAmount.toFixed(2)} · ` +
      `apalanc. ${orden.apalancamientoUsado.toFixed(1)}x${EXECUTE ? "" : " (dry-run)"}`,
  );
}

/** Cierra una posición: en el broker, en el estado, en la auditoría y por Telegram. */
async function cerrar(
  adapter: AdaptadorCiclo,
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
    venueId: VENUE_ID,
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
  adapter: AdaptadorCiclo,
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

  // El día NO se marca aquí sino al final, y solo si el broker llegó a
  // atendernos. Marcarlo antes hacía que una pasada caída en la ventana de
  // rollover —cuando Deriv suspende Multipliers y rechaza todo— consumiera la
  // revisión del día entero y dejara al Core parado hasta mañana.
  let brokerRespondio = false;

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
        await audit.record({ kind: "order_rejected", at, signal, reason: "max_aggregate_risk", venueId: VENUE_ID });
        continue;
      }
      await abrir(adapter, estado, decision, at, symbol, topeDivisa(config, equity));
      brokerRespondio = true;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      // "temporarily unavailable" = mercado cerrado ahora: NO gasta la revisión
      // del día. "not offered" = permanente: ese símbolo no admite Multipliers
      // y no tiene sentido reintentarlo, así que no bloquea el resto.
      if (!/temporarily unavailable|market is closed/i.test(mensaje)) brokerRespondio = true;
      console.log(`  core        ${symbol}: ${mensaje} (se salta)`);
    }
  }

  if (brokerRespondio) {
    estado.ultimaPasadaCore = fecha;
  } else {
    console.log("  core        mercados cerrados: se reintentará en la próxima pasada");
  }
}

// ---------------------------------------------------------------------------
// Sleeve B — Intradía
// ---------------------------------------------------------------------------
async function pasadaIntradia(
  adapter: AdaptadorCiclo,
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
      const velas: Vela[] = await adapter.intradayCandles(symbol, GRANULARIDAD_INTRADIA, VELAS_INTRADIA);
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
      await abrir(adapter, estado, decision, at, symbol, topeDivisa(config, equity));
    } catch (error) {
      console.log(`  intradia    ${symbol}: ${error instanceof Error ? error.message : String(error)} (se salta)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sleeve C — EventScalp
// ---------------------------------------------------------------------------
async function pasadaEventScalp(
  adapter: AdaptadorCiclo,
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
      const velas = await adapter.intradayCandles(evento.symbol, GRANULARIDAD_INTRADIA, 100);
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
      await abrir(adapter, estado, decision, at, evento.tipo, topeDivisa(config, equity), resultado.puntuacion);
    } catch (error) {
      console.log(`  eventscalp  ${evento.id}: ${error instanceof Error ? error.message : String(error)} (se salta)`);
    }
  }

  return minutosAEvento;
}

/**
 * Publica el estado en las tablas que lee el PANEL (`equity_log` y
 * `atlas_positions`), reutilizando `publishSnapshot` en vez de duplicarlo.
 *
 * Hace falta porque el panel nació leyendo esas tablas del runner anterior: sin
 * esto, sustituir el bot lo dejaba ciego aunque el motor estuviera operando.
 * La clave de cada posición lleva el sleeve delante (`core · frxEURUSD`) para
 * que en el panel se vea de dónde viene cada una.
 */
async function publicarParaPanel(
  adapter: AdaptadorCiclo,
  estado: EstadoCartera,
  equity: number,
): Promise<void> {
  const posiciones: Record<string, HeldPosition> = {};
  const pnl: Record<string, { profit: number; currentSpot: number }> = {};

  for (const id of SLEEVE_IDS) {
    for (const p of estado.sleeves[id].openPositions) {
      const clave = `${id} · ${p.symbol}`;
      posiciones[clave] = {
        contractId: p.id,
        side: p.side,
        entryPrice: p.entryPrice,
        stopPrice: p.stopPrice,
        size: p.size,
        riskAmount: p.riskAmount,
        openedAt: new Date().toISOString(),
      };
      if (EXECUTE) {
        try {
          pnl[clave] = await adapter.contractPnl(p.id);
        } catch {
          // Un contrato que ya no existe no debe impedir publicar el resto.
        }
      }
    }
  }

  // El panel refleja la cuenta real. Un ensayo no la ha tocado, así que
  // tampoco puede tocar lo que ve el operador.
  if (!EXECUTE) return;
  await publishSnapshot(VENUE_ID, equity, posiciones, pnl).catch(() => null);
}

/**
 * Comprueba que el bróker siga ofreciendo mercado y gestiona el aviso.
 *
 * Devuelve si tiene sentido operar en esta pasada. Muta `estado` con los
 * contadores de la vigilancia; el guardado lo hace el llamador.
 */
async function vigilar(
  adapter: AdaptadorCiclo,
  estado: EstadoCartera,
  at: string,
): Promise<{ operable: boolean; simbolos: number }> {
  // Un fallo de red aquí cuenta como "sin ofertas": es indistinguible desde
  // fuera y, ante la duda, no se opera.
  const simbolos = await adapter.activeSymbols().catch(() => []);

  const decision = evaluarSalud(simbolos.length, {
    ciclosSinOfertas: estado.ciclosSinOfertas ?? 0,
    avisoEnviado: estado.avisoVenueEnviado ?? false,
  });
  const minutos = minutosCaido(decision.ciclosSinOfertas);

  if (decision.accion === "avisar_caido") {
    console.error(
      `  [!] VENUE CAÍDO: Deriv lleva ${minutos} min sin ofrecer símbolos (${decision.ciclosSinOfertas} ciclos). ` +
        `No se ha abierto nada. ${at}`,
    );
    await notificarVenueCaido(minutos, "active_symbols devuelve 0 símbolos").catch(() => null);
  } else if (decision.accion === "avisar_recuperado") {
    const minutosPrevios = minutosCaido(estado.ciclosSinOfertas ?? 0);
    console.log(`  [ok] Venue recuperado tras ~${minutosPrevios} min: ${simbolos.length} símbolos.`);
    await notificarVenueRecuperado(minutosPrevios, simbolos.length).catch(() => null);
  } else if (!decision.operable) {
    // Todavía por debajo del umbral: se registra, no se grita.
    console.log(`  venue sin ofertas (${decision.ciclosSinOfertas}/${3} ciclos) — se reintenta en la próxima pasada`);
  }

  estado.ciclosSinOfertas = decision.ciclosSinOfertas;
  estado.avisoVenueEnviado = decision.avisoEnviado;
  return { operable: decision.operable, simbolos: simbolos.length };
}

/**
 * Puntúa los setups de microestructura y los ANOTA todos, se operen o no.
 *
 * Usa las velas M15 del propio bróker (las que ya están en caché), no una
 * serie construida aparte. No abre posiciones: su única misión es acumular
 * señales con su nota y su desglose para poder decidir, con muestra suficiente,
 * si la puntuación predice algo. Un fallo aquí nunca puede romper el ciclo.
 */
async function observarFlujo(adapter: AdaptadorCiclo, at: string): Promise<void> {
  for (const symbol of Object.keys(EPIC_POR_SIMBOLO)) {
    try {
      const velas = await adapter.intradayCandles(symbol, 900, 120);
      if (velas.length < 40) continue;

      const flujo: VelaFlujo[] = velas.map((v) => ({
        epoch: v.epoch, open: v.open, high: v.high, low: v.low, close: v.close,
        // Las velas del bróker traen volumen; el tipo `Vela` no lo expone, así
        // que se toma de la propia vela cuando está.
        volumen: (v as unknown as { volumen?: number | null }).volumen ?? null,
      }));

      const t = flujo.length - 1;
      const p = puntuarSetup(flujo, t);
      if (!p) continue;

      const ultima = velas[t]!;
      await registroSenales.anotar(
        desdePuntuacion(p, {
          at,
          venueId: VENUE_ID,
          symbol,
          precio: ultima.close,
          spread: 0,
          // En observación TODO se marca como no operado: el motor aún no tiene
          // ventaja demostrada y no debe tocar la cartera.
          rechazo: "observacion_sin_ventaja_demostrada",
        }),
      );
      console.log(`  flujo       ${symbol}: ${p.side.toUpperCase()} score ${p.total} · ${p.regimen}`);
    } catch {
      // Sin velas para ese símbolo (cuota agotada, mercado nuevo): se ignora.
    }
  }
}

/**
 * Una pasada completa de la cartera sobre el adaptador que se le pase.
 *
 * Extraída de `main` para que Deriv, el modo papel e IG compartan EXACTAMENTE
 * la misma lógica de decisión. Si cada venue tuviera su copia, dos de ellas
 * envejecerían mal y las comparaciones entre venues dejarían de significar nada.
 */
async function ejecutarCiclo(adapter: AdaptadorCiclo, config: AtlasConfig): Promise<void> {
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

  // El bróker manda: lo que él no tenga abierto, el motor no lo tiene.
  if (IG && adapter instanceof IgAdapter) await conciliarConBroker(adapter, estado);

  // ANTES de intentar nada: ¿el bróker ofrece mercado? Un catálogo vacío no
  // es "mercados cerrados" —un domingo el catálogo llega entero con
  // exchange_is_open=0— sino el venue caído. Distinguirlo evita repetir el
  // 2026-08-12: 17 horas rechazando órdenes y anotándolo como normalidad.
  const salud = await vigilar(adapter, estado, at);
  if (!salud.operable) {
    // Sin catálogo no hay nada que decidir: 13 proposals condenadas a fallar
    // cada 5 minutos solo ensucian el log y gastan cuota de la API.
    // Observación del motor de flujo. NO opera: puntúa y registra.
    // Es lo que convierte una semana de demo en una muestra utilizable —
    // guardar solo lo operado sesgaría los datos hacia lo que pasó los filtros,
    // y con 44 señales no se puede distinguir ventaja de azar.
    if (IG) await observarFlujo(adapter, at);

    await publicarParaPanel(adapter, estado, equity);
    persistir(estado);
    return;
  }

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

  await publicarParaPanel(adapter, estado, equity);
  persistir(estado);
}

/**
 * Concilia lo que el motor cree tener con lo que el bróker tiene de verdad.
 *
 * La cuenta del bróker es la única fuente de verdad sobre qué está abierto: el
 * estado del motor y las tablas del panel son copias suyas. Si una posición no
 * está en IG, se cae del estado —da igual por qué: una orden que se creyó
 * aceptada, un stop que saltó en el bróker, un ensayo que ensució el fichero—.
 * Sin esto, el panel puede enseñar durante días posiciones que no existen, que
 * es exactamente lo que pasó el 2026-08-17.
 */
async function conciliarConBroker(adapter: IgAdapter, estado: EstadoCartera): Promise<void> {
  let reales: Set<string>;
  try {
    reales = await adapter.dealIdsAbiertos();
  } catch (e) {
    // Sin respuesta del bróker no se concilia: borrar posiciones buenas por un
    // corte de red sería peor que la enfermedad.
    console.log(`  aviso: no se pudo conciliar con IG (${e instanceof Error ? e.message : e})`);
    return;
  }

  for (const id of SLEEVE_IDS) {
    const sleeve = estado.sleeves[id];
    const fantasmas = sleeve.openPositions.filter((p) => !reales.has(p.id));
    if (fantasmas.length === 0) continue;
    for (const f of fantasmas) {
      console.log(`  ${id.padEnd(11)} ${f.symbol}: IG no la tiene abierta · se descarta del estado`);
    }
    sleeve.openPositions = sleeve.openPositions.filter((p) => reales.has(p.id));
  }
}

/**
 * Guarda el estado SOLO si la pasada era real.
 *
 * Un dry-run se ejecutó el 2026-08-17 para comprobar el arreglo de precios y
 * dejó cuatro posiciones inventadas en el mismo fichero que usa la corrida de
 * verdad; el siguiente ciclo real las dio por buenas, las publicó en el panel y
 * se saltó la revisión del Core porque el ensayo ya la había marcado como hecha.
 * Un ensayo que cambia el mundo no es un ensayo.
 */
function persistir(estado: EstadoCartera): void {
  if (!EXECUTE) {
    console.log("  (dry-run: no se guarda estado ni se toca el panel)");
    return;
  }
  guardarEstado(ESTADO_PATH, estado);
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const config = cargarConfig();
  if (config.modo !== "demo") {
    throw new Error("SEGURIDAD: atlas.yaml no está en modo demo. Fase 1 es solo demo.");
  }

  // IG es un venue completo por sí mismo: no necesita a Deriv ni para precios.
  if (IG) {
    const ig = new IgAdapter(igConfigDesdeEnv());
    await ig.connect();
    try {
      await ejecutarCiclo(ig, config);
    } finally {
      await ig.disconnect();
    }
    return;
  }

  const real = new DerivDemoAdapter(derivConfigFromEnv());
  // En papel, el adaptador real queda dentro como FUENTE DE PRECIOS: las velas
  // son las mismas que usaría la cuenta demo, solo cambia quién ejecuta.
  await real.connect();
  const adapter: AdaptadorCiclo = PAPER
    ? new PaperDerivAdapter(
        real,
        CUENTA_PAPEL_PATH,
        // Semilla del equity de papel: el saldo real de la demo, para que las
        // dos curvas arranquen del mismo sitio y sean comparables.
        await real.getEquity().catch(() => 10_000),
        Object.keys(config.esma.clasePorSimbolo),
      )
    : real;

  try {
    await ejecutarCiclo(adapter, config);
  } finally {
    await adapter.disconnect();
  }
}

main().catch((error) => {
  console.error(`FALLO ciclo multi-sleeve: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
