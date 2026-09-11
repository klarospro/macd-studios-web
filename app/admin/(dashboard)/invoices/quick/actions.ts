'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'
import { createInvoiceRecord } from '@/lib/admin/invoice-core'

export type ActionState = { error?: string } | undefined

const QuickSchema = z.object({
  client_id: z.string().optional(),
  new_client_name: z.string().trim().optional(),
  new_client_email: z.union([z.email(), z.literal('')]).optional(),
  amount: z.coerce.number().positive('El monto debe ser mayor que 0'),
  concept: z.string().trim().min(1, 'Describe el concepto del pago'),
  currency: z.enum(['USD', 'EUR']),
})

export async function createQuickPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = QuickSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data

  let clientId = values.client_id
  if (!clientId) {
    if (!values.new_client_name) return { error: 'Selecciona un cliente o escribe el nombre de uno nuevo' }
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({ name: values.new_client_name, email: values.new_client_email || null })
      .select('id')
      .single()
    if (error) return { error: error.message }
    clientId = newClient.id
  }

  if (!clientId) return { error: 'No se pudo determinar el cliente' }

  const today = new Date().toISOString().slice(0, 10)

  let invoiceId: string
  try {
    const invoice = await createInvoiceRecord(supabase, {
      client_id: clientId,
      issue_date: today,
      due_date: today,
      currency: values.currency,
      status: 'paid',
      payment_method: null,
      notes: null,
      items: [{ description: values.concept, quantity: 1, unit_price: values.amount, tax_rate: 0 }],
    })
    invoiceId = invoice.id
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear el pago' }
  }

  revalidatePath('/admin/invoices')
  redirect(`/admin/invoices/${invoiceId}`)
}
