import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvoiceNumber } from './invoice-number'
import { getEurUsdRate, convertToUsd } from './exchange-rate'
import type { InvoiceStatus } from './types'

export interface InvoiceItemInput {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
}

export function computeTotals(items: InvoiceItemInput[]) {
  let subtotal = 0
  let taxTotal = 0
  for (const item of items) {
    const lineSubtotal = item.quantity * item.unit_price
    subtotal += lineSubtotal
    taxTotal += lineSubtotal * (item.tax_rate / 100)
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round((subtotal + taxTotal) * 100) / 100,
  }
}

/** Crea la transacción de ingreso (Revenue > Client Payment) al marcar una factura como pagada. */
export async function recordInvoicePaymentTransaction(supabase: SupabaseClient, invoiceId: string) {
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (!invoice) return

  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('category', 'Client Payment')
    .maybeSingle()
  if (existingTx) return

  const { usdAmount, rate } = await convertToUsd(invoice.total, invoice.currency)

  await supabase.from('transactions').insert({
    date: new Date().toISOString().slice(0, 10),
    type: 'income',
    category: 'Client Payment',
    description: `Pago factura ${invoice.invoice_number}`,
    amount: invoice.total,
    currency: invoice.currency,
    usd_amount: usdAmount,
    exchange_rate: rate,
    invoice_id: invoiceId,
  })
}

export async function createInvoiceRecord(
  supabase: SupabaseClient,
  input: {
    client_id: string
    issue_date: string
    due_date: string
    currency: 'USD' | 'EUR'
    status?: InvoiceStatus
    payment_method?: string | null
    notes?: string | null
    items: InvoiceItemInput[]
  }
) {
  const { subtotal, taxTotal, total } = computeTotals(input.items)
  const exchangeRate = input.currency === 'EUR' ? await getEurUsdRate() : 1.0
  const invoiceNumber = await generateInvoiceNumber(supabase)
  const status = input.status ?? 'draft'

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      client_id: input.client_id,
      invoice_number: invoiceNumber,
      issue_date: input.issue_date,
      due_date: input.due_date,
      currency: input.currency,
      exchange_rate: exchangeRate,
      subtotal,
      tax_total: taxTotal,
      total,
      status,
      payment_method: input.payment_method || null,
      notes: input.notes || null,
    })
    .select('id, invoice_number')
    .single()

  if (error) throw new Error(error.message)

  const { error: itemsError } = await supabase.from('invoice_items').insert(
    input.items.map((item, i) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      sort_order: i,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  if (status === 'paid') {
    await recordInvoicePaymentTransaction(supabase, invoice.id)
  }

  return invoice
}
