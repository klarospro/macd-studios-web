import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Puntuacion } from "../strategy/orderFlow";

/**
 * Registro de TODAS las señales evaluadas, se operen o no.
 *
 * Es la Fase 15 del brief de microestructura: *"para una operación rechazada
 * también guardar REJECTED + EXACT_REASON. Quiero poder reconstruir después
 * por qué el sistema tomó o rechazó cada operación."*
 *
 * Y es lo que convierte una semana de demo en datos utilizables. Guardar solo
 * las operadas sesga la muestra hacia las que pasaron los filtros: para saber
 * si la PUNTUACIÓN predice hay que anotar también las que se descartaron, con
 * su nota y su desglose. Sin eso, dentro de una semana tendríamos las mismas
 * 44 señales de ahora y la misma imposibilidad de concluir nada.
 */

export interface SenalRegistrada {
  at: string;
  venueId: string;
  symbol: string;
  side: "buy" | "sell";
  /** Puntuación total 0-100. */
  score: number;
  /** Desglose por componente: por qué obtuvo esa nota. */
  componentes: Record<string, number>;
  regimen: string;
  precio: number;
  spread: number;
  /** `null` si se operó; si no, el motivo exacto del rechazo. */
  rechazo: string | null;
  /** Precio N barras después, para evaluar la señal a posteriori. Se rellena luego. */
  resultadoBps?: number;
}

export interface RegistroSenales {
  anotar(s: SenalRegistrada): Promise<void>;
}

/** Sink de fichero: una línea JSON por señal. Simple y suficiente para analizar. */
export class FicheroRegistroSenales implements RegistroSenales {
  constructor(private readonly ruta: string) {}

  async anotar(s: SenalRegistrada): Promise<void> {
    mkdirSync(dirname(this.ruta), { recursive: true });
    appendFileSync(this.ruta, `${JSON.stringify(s)}\n`, "utf8");
  }
}

/** Sink de Supabase, para que el panel pueda mostrar el embudo de señales. */
export class SupabaseRegistroSenales implements RegistroSenales {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly respaldo: RegistroSenales,
  ) {}

  async anotar(s: SenalRegistrada): Promise<void> {
    try {
      const r = await fetch(`${this.url}/rest/v1/atlas_senales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          at: s.at, venue_id: s.venueId, symbol: s.symbol, side: s.side,
          score: s.score, componentes: s.componentes, regimen: s.regimen,
          precio: s.precio, spread: s.spread, rechazo: s.rechazo,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch {
      // Perder una señal por un fallo de red arruinaría la muestra de la semana:
      // siempre queda la copia local.
      await this.respaldo.anotar(s);
    }
  }
}

function derivarUrl(key: string): string | undefined {
  try {
    const parte = key.split(".")[1];
    if (!parte) return undefined;
    const payload = JSON.parse(Buffer.from(parte, "base64").toString("utf8"));
    return payload.ref ? `https://${payload.ref}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

export function crearRegistroSenales(rutaRespaldo: string): RegistroSenales {
  const fichero = new FicheroRegistroSenales(rutaRespaldo);
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.SUPABASE_URL ?? (key ? derivarUrl(key) : undefined);
  // Se escribe SIEMPRE en local además de en Supabase: la muestra de la semana
  // es el activo y no puede depender de que la red aguante siete días.
  if (url && key) return new SupabaseRegistroSenales(url, key, fichero);
  return fichero;
}

/** Construye la ficha a partir de una puntuación del motor de flujo. */
export function desdePuntuacion(
  p: Puntuacion,
  datos: { at: string; venueId: string; symbol: string; precio: number; spread: number; rechazo: string | null },
): SenalRegistrada {
  return {
    at: datos.at,
    venueId: datos.venueId,
    symbol: datos.symbol,
    side: p.side,
    score: p.total,
    componentes: p.componentes,
    regimen: p.regimen,
    precio: datos.precio,
    spread: datos.spread,
    rechazo: datos.rechazo,
  };
}
