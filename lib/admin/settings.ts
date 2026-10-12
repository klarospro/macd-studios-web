import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Ajustes del negocio guardados en la tabla `settings` (migración 0007).
 * Se leen de la base de datos para poder cambiarlos sin desplegar; si la fila no
 * existe todavía o la query falla, se devuelve el valor por defecto para que la
 * web y los agentes nunca se queden sin plazo que decir.
 */

export type PlazoEntrega = {
  diasMaximo: number
  /** 'datos_del_cliente' = el contador arranca cuando el cliente entrega textos, logo y accesos. */
  cuentaDesde: string
  garantiaPublica: string
}

export const PLAZO_ENTREGA_POR_DEFECTO: PlazoEntrega = {
  diasMaximo: 15,
  cuentaDesde: 'datos_del_cliente',
  garantiaPublica: 'funcionando en 15 días o el primer mes es gratis',
}

export async function getPlazoEntrega(
  supabase: SupabaseClient
): Promise<PlazoEntrega> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'plazo_entrega')
    .maybeSingle()

  if (error || !data?.value) return PLAZO_ENTREGA_POR_DEFECTO

  const v = data.value as Record<string, unknown>
  return {
    diasMaximo:
      typeof v.dias_maximo === 'number'
        ? v.dias_maximo
        : PLAZO_ENTREGA_POR_DEFECTO.diasMaximo,
    cuentaDesde:
      typeof v.cuenta_desde === 'string'
        ? v.cuenta_desde
        : PLAZO_ENTREGA_POR_DEFECTO.cuentaDesde,
    garantiaPublica:
      typeof v.garantia_publica === 'string'
        ? v.garantia_publica
        : PLAZO_ENTREGA_POR_DEFECTO.garantiaPublica,
  }
}
