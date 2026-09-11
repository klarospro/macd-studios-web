'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { getEurUsdRate } from '@/lib/admin/exchange-rate'
import { renderInvoicePdf } from '@/lib/admin/pdf/InvoiceDocument'
import { sendInvoiceEmail } from '@/lib/admin/email'
import { uploadDocument } from '@/lib/admin/storage'
import { computeTotals, createInvoiceRecord, recordInvoicePaymentTransaction } from '@/lib/admin/invoice-core'
import type { InvoiceStatus } from '@/lib/admin/types'

export type ActionState = { error?: string } | undefined

const ItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).default(0),
})

const InvoiceSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  issue_date: z.string().min(1),
  due_date: z.string().min(1),
  currency: z.enum(['USD', 'EUR']),
  payment_method: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  items: z.array(ItemSchema).min(1, 'Añade al menos una línea de servicio'),
})

function parseInvoiceForm(formData: FormData) {
  const itemsRaw = formData.get('items')
  let items: unknown = []
  try {
    items = itemsRaw ? JSON.parse(String(itemsRaw)) : []
  } catch {
    return { error: 'Líneas de factura inválidas' } as const
  }

  const raw = { ...Object.fromEntries(formData.entries()), items }
  const parsed = InvoiceSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos de factura inválidos' } as const
  }
  return { values: parsed.data } as const
}

export async function createInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseInvoiceForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  let invoice
  try {
    invoice = await createInvoiceRecord(supabase, parsed.values)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear la factura' }
  }

  revalidatePath('/admin/invoices')
  redirect(`/admin/invoices/${invoice.id}`)
}

export async function updateInvoice(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseInvoiceForm(formData)
  if ('error' in parsed) return { error: parsed.error }
  const { values } = parsed

  const { subtotal, taxTotal, total } = computeTotals(values.items)
  const exchangeRate = values.currency === 'EUR' ? await getEurUsdRate() : 1.0

  const { data: existing } = await supabase.from('invoices').select('status').eq('id', id).single()

  const { error } = await supabase
    .from('invoices')
    .update({
      client_id: values.client_id,
      issue_date: values.issue_date,
      due_date: values.due_date,
      currency: values.currency,
      exchange_rate: exchangeRate,
      subtotal,
      tax_total: taxTotal,
      total,
      status: values.status,
      payment_method: values.payment_method || null,
      notes: values.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('invoice_items').delete().eq('invoice_id', id)
  const { error: itemsError } = await supabase.from('invoice_items').insert(
    values.items.map((item, i) => ({
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      sort_order: i,
    }))
  )
  if (itemsError) return { error: itemsError.message }

  if (values.status === 'paid' && existing?.status !== 'paid') {
    await recordInvoicePaymentTransaction(supabase, id)
  }

  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${id}`)
  redirect(`/admin/invoices/${id}`)
}

export async function deleteInvoice(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/invoices')
  return undefined
}

export async function duplicateInvoice(id: string): Promise<{ error?: string; newId?: string }> {
  const { supabase } = await requireSession()

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (!invoice) return { error: 'Factura no encontrada' }

  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)
  const today = new Date().toISOString().slice(0, 10)

  try {
    const newInvoice = await createInvoiceRecord(supabase, {
      client_id: invoice.client_id,
      issue_date: today,
      due_date: invoice.due_date,
      currency: invoice.currency,
      status: 'draft',
      payment_method: invoice.payment_method,
      notes: invoice.notes,
      items: (items ?? []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
      })),
    })
    revalidatePath('/admin/invoices')
    return { newId: newInvoice.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo duplicar la factura' }
  }
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { data: existing } = await supabase.from('invoices').select('status').eq('id', id).single()

  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  if (status === 'paid' && existing?.status !== 'paid') {
    await recordInvoicePaymentTransaction(supabase, id)
  }

  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${id}`)
  return undefined
}

export async function sendInvoice(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (!invoice) return { error: 'Factura no encontrada' }

  const { data: client } = await supabase.from('clients').select('*').eq('id', invoice.client_id).single()
  if (!client?.email) return { error: 'El cliente no tiene email configurado' }

  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order')

  const pdfBuffer = await renderInvoicePdf(invoice, client, items ?? [])

  try {
    await uploadDocument(supabase, 'invoices', `${invoice.invoice_number}.pdf`, pdfBuffer, 'application/pdf')
  } catch {
    // No bloqueamos el envío si falla el archivado en Storage.
  }

  try {
    await sendInvoiceEmail({
      to: client.email,
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      pdfBuffer,
      payLink: invoice.stripe_payment_link ?? undefined,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo enviar el email' }
  }

  if (invoice.status === 'draft') {
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
  }

  revalidatePath(`/admin/invoices/${id}`)
  return undefined
}
