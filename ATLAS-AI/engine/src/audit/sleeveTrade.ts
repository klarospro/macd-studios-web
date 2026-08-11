import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SleeveId } from "../config/sleeveConfig";
import { Side } from "../domain/types";

/**
 * Registro de operaciones por sleeve (Tarea 6 de 27_SCALPING/04).
 *
 * Es una tabla APARTE de `trading_audit_log`: aquella es un registro WORM de
 * eventos del motor (orden colocada, rechazada, fallida), y esta es la ficha
 * de la OPERACIÓN con todo lo que la Fase 1 necesita medir. Mezclarlas
 * obligaría a reconstruir cada trade uniendo eventos sueltos, que es
 * exactamente el trabajo que no quieres hacer al evaluar los criterios de paso.
 *
 * Se registra spread y slippage porque son las dos cifras que decidieron el
 * NO-GO de las estrategias intradía anteriores. Sin medirlas en demo, la
 * decisión de la Fase 2 volvería a tomarse a ciegas.
 */
export interface SleeveTrade {
  id: string;
  sleeve: SleeveId;
  symbol: string;
  side: Side;
  /** Setup que originó la entrada (`orb:...`, `evento:...`, `core:...`). */
  setupId?: string;
  abiertoEn: string;
  cerradoEn?: string;
  precioEntrada: number;
  precioSalida?: number;
  size: number;
  riskAmount: number;
  nocional: number;
  apalancamientoUsado: number;
  /** Spread pagado en la entrada, en unidades de precio. */
  spreadEntrada?: number;
  /** Diferencia entre el precio esperado y el ejecutado. */
  slippage?: number;
  /** P&L realizado en moneda de cuenta. Undefined mientras esté abierta. */
  pnl?: number;
  /** Puntuación de la sorpresa que dio la IA (solo Sleeve C). */
  puntuacionIa?: number;
  motivoSalida?: string;
  /** true en dry-run: permite excluirlas de las métricas de Fase 1. */
  simulada: boolean;
}

export interface SleeveTradeLog {
  registrar(trade: SleeveTrade): Promise<void>;
  actualizar(id: string, cambios: Partial<SleeveTrade>): Promise<void>;
}

/** Convierte la ficha al esquema de columnas de Supabase (snake_case). */
export function aFila(trade: SleeveTrade): Record<string, unknown> {
  return {
    id: trade.id,
    sleeve: trade.sleeve,
    symbol: trade.symbol,
    side: trade.side,
    setup_id: trade.setupId ?? null,
    abierto_en: trade.abiertoEn,
    cerrado_en: trade.cerradoEn ?? null,
    precio_entrada: trade.precioEntrada,
    precio_salida: trade.precioSalida ?? null,
    size: trade.size,
    risk_amount: trade.riskAmount,
    nocional: trade.nocional,
    apalancamiento_usado: trade.apalancamientoUsado,
    spread_entrada: trade.spreadEntrada ?? null,
    slippage: trade.slippage ?? null,
    pnl: trade.pnl ?? null,
    puntuacion_ia: trade.puntuacionIa ?? null,
    motivo_salida: trade.motivoSalida ?? null,
    simulada: trade.simulada,
  };
}

/** Sink contra Supabase (PostgREST), tabla `atlas_sleeve_trades`. */
export class SupabaseSleeveTradeLog implements SleeveTradeLog {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly tabla: string,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      ...extra,
    };
  }

  async registrar(trade: SleeveTrade): Promise<void> {
    const response = await fetch(`${this.url}/rest/v1/${this.tabla}`, {
      method: "POST",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(aFila(trade)),
    });
    if (!response.ok) throw new Error(`Supabase sleeve_trades ${response.status}: ${await response.text()}`);
  }

  async actualizar(id: string, cambios: Partial<SleeveTrade>): Promise<void> {
    const parcial = aFila({ ...cambios, id } as SleeveTrade);
    // Solo se envían las columnas realmente presentes en `cambios`.
    const cuerpo: Record<string, unknown> = {};
    for (const clave of Object.keys(cambios)) {
      const columna = COLUMNA_POR_CAMPO[clave];
      if (columna) cuerpo[columna] = parcial[columna];
    }
    if (Object.keys(cuerpo).length === 0) return;

    const response = await fetch(`${this.url}/rest/v1/${this.tabla}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: this.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(cuerpo),
    });
    if (!response.ok) throw new Error(`Supabase sleeve_trades PATCH ${response.status}: ${await response.text()}`);
  }
}

const COLUMNA_POR_CAMPO: Record<string, string> = {
  cerradoEn: "cerrado_en",
  precioSalida: "precio_salida",
  pnl: "pnl",
  motivoSalida: "motivo_salida",
  slippage: "slippage",
  spreadEntrada: "spread_entrada",
  puntuacionIa: "puntuacion_ia",
};

/** Respaldo local en JSONL cuando no hay credenciales de Supabase. */
export class FicheroSleeveTradeLog implements SleeveTradeLog {
  constructor(private readonly ruta: string) {}

  private escribir(linea: unknown): void {
    mkdirSync(dirname(this.ruta), { recursive: true });
    appendFileSync(this.ruta, `${JSON.stringify(linea)}\n`, "utf8");
  }

  async registrar(trade: SleeveTrade): Promise<void> {
    this.escribir({ op: "insert", ...aFila(trade) });
  }

  async actualizar(id: string, cambios: Partial<SleeveTrade>): Promise<void> {
    this.escribir({ op: "update", id, cambios });
  }
}

/**
 * Elige el destino igual que hace `createAuditLog`: Supabase si hay
 * credenciales, fichero local si no. Nunca credenciales en código.
 */
export function crearSleeveTradeLog(rutaRespaldo: string, tabla = "atlas_sleeve_trades"): SleeveTradeLog {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.SUPABASE_URL ?? (key ? derivarUrl(key) : undefined);
  if (url && key) return new SupabaseSleeveTradeLog(url, key, tabla);
  return new FicheroSleeveTradeLog(rutaRespaldo);
}

function derivarUrl(key: string): string | undefined {
  try {
    const part = key.split(".")[1];
    if (!part) return undefined;
    const payload = JSON.parse(Buffer.from(part, "base64").toString("utf8"));
    return payload.ref ? `https://${payload.ref}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}
