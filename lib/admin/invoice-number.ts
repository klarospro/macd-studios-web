import type { SupabaseClient } from '@supabase/supabase-js'

/** Llama a la función SQL next_invoice_number() (atómica, ver supabase/migrations/0001). */
export async function generateInvoiceNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('next_invoice_number')
  if (error) throw new Error(`No se pudo generar el número de factura: ${error.message}`)
  return data as string
}
