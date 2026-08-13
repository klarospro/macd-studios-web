/**
 * Vigilancia del venue: detectar que el bróker ha dejado de ofrecer mercado.
 *
 * Nace de un fallo real (2026-08-12): durante 17 horas el ciclo rechazó 2.382
 * órdenes con "This trade is temporarily unavailable" y lo registró como
 * "mercados cerrados", que es lo que dice ese mismo error un domingo. El bot
 * parecía trabajar. No abrió una sola posición y nadie se enteró.
 *
 * La señal que separa un caso del otro NO es el error de la proposal —es el
 * mismo texto en ambos— sino cuántos símbolos ofrece el bróker:
 *
 *   fin de semana  → active_symbols devuelve la lista COMPLETA, con
 *                    exchange_is_open = 0 en cada uno. Normal, no se avisa.
 *   venue caído    → active_symbols devuelve CERO símbolos. Anómalo siempre,
 *                    porque los índices sintéticos de Deriv no cierran nunca.
 *
 * Un bot que aparenta operar mientras rechaza todo es más peligroso que un bot
 * caído: el caído se ve. Por eso esto avisa, y por eso el aviso es explícito.
 */

export interface EstadoVigilancia {
  /** Pasadas consecutivas en las que el bróker no ofreció ni un símbolo. */
  ciclosSinOfertas: number;
  /** Ya se avisó de esta caída: no repetir cada 5 minutos. */
  avisoEnviado: boolean;
}

export type AccionVigilancia = "ninguna" | "avisar_caido" | "avisar_recuperado";

export interface DecisionVigilancia extends EstadoVigilancia {
  /** ¿Tiene sentido intentar operar en esta pasada? */
  operable: boolean;
  accion: AccionVigilancia;
}

/**
 * Ciclos consecutivos en fallo antes de avisar. El timer corre cada 5 minutos,
 * así que 3 ciclos = 15 minutos: suficiente para no gritar por un corte de red
 * de un minuto, poco para no repetir las 17 horas de silencio.
 */
export const CICLOS_PARA_AVISAR = 3;

/**
 * Decide el estado de la vigilancia a partir de cuántos símbolos ofrece el
 * bróker. Función pura: toda la lógica de aviso es testeable sin red.
 */
export function evaluarSalud(
  simbolosOfrecidos: number,
  previo: EstadoVigilancia,
  umbral: number = CICLOS_PARA_AVISAR,
): DecisionVigilancia {
  if (simbolosOfrecidos > 0) {
    // El bróker responde con catálogo: sano. Si veníamos de una caída avisada,
    // hay que cerrar el incidente — un aviso de caída sin su recuperación deja
    // al operador sin saber si sigue roto.
    return {
      operable: true,
      ciclosSinOfertas: 0,
      avisoEnviado: false,
      accion: previo.avisoEnviado ? "avisar_recuperado" : "ninguna",
    };
  }

  const ciclosSinOfertas = previo.ciclosSinOfertas + 1;
  const debeAvisar = ciclosSinOfertas >= umbral && !previo.avisoEnviado;
  return {
    operable: false,
    ciclosSinOfertas,
    avisoEnviado: previo.avisoEnviado || debeAvisar,
    accion: debeAvisar ? "avisar_caido" : "ninguna",
  };
}

/** Minutos que lleva caído el venue, para que el aviso diga desde cuándo. */
export function minutosCaido(ciclos: number, minutosPorCiclo = 5): number {
  return ciclos * minutosPorCiclo;
}
