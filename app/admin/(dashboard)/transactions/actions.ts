'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'
import { convertToUsd } from '@/lib/admin/exchange-rate'
import { getCategoryType } from '@/lib/admin/types'
import { uploadDocument } from '@/lib/admin/storage'
import { getMercuryAccounts, getMercuryTransactions, suggestCategory } from '@/lib/mercury'

export type ActionState = { error?: string; success?: boolean } | undefined

const TransactionSchema = z.object({
  date: z.string().min(1),
  category: z.string().min(1),
  description: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'EUR']),
  is_related_party: z.string().optional(),
  related_party_name: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export async function createTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = TransactionSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data

  const { usdAmount, rate } = await convertToUsd(values.amount, values.currency)
  const isRelatedParty = values.is_related_party === 'on'

  const { error } = await supabase.from('transactions').insert({
    date: values.date,
    type: getCategoryType(values.category),
    category: values.category,
    description: values.description,
    amount: values.amount,
    currency: values.currency,
    usd_amount: usdAmount,
    exchange_rate: rate,
    is_related_party: isRelatedParty,
    related_party_name: isRelatedParty ? values.related_party_name || null : null,
    notes: values.notes || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/transactions')
  return { success: true }
}

export async function deleteTransaction(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/transactions')
  return undefined
}

export async function uploadTransactionReceipt(id: string, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Selecciona un archivo' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = await uploadDocument(supabase, 'receipts', file.name, buffer, file.type || 'application/octet-stream')

  const { error } = await supabase.from('transactions').update({ receipt_url: path }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/transactions')
  return { success: true }
}

/**
 * Descarga las últimas transacciones de todas las cuentas Mercury y las inserta como
 * transacciones "sin categorizar" (category = 'Uncategorized'), marcadas mercury_synced,
 * evitando duplicados por mercury_transaction_id.
 */
export async function syncFromMercury(): Promise<ActionState & { imported?: number }> {
  const { supabase } = await requireSession()

  let accounts
  try {
    accounts = await getMercuryAccounts()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo conectar con Mercury' }
  }

  let imported = 0
  for (const account of accounts) {
    const txs = await getMercuryTransactions(account.id, 100)
    for (const tx of txs) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('mercury_transaction_id', tx.id)
        .maybeSingle()
      if (existing) continue

      const description = tx.bankDescription || tx.counterpartyName || tx.note || 'Transacción Mercury'
      const suggestion = suggestCategory(description)
      const type = tx.amount >= 0 ? 'income' : 'expense'
      const amount = Math.abs(tx.amount)

      await supabase.from('transactions').insert({
        date: (tx.postedAt ?? tx.createdAt).slice(0, 10),
        type: suggestion?.type ?? type,
        category: suggestion?.category ?? 'Uncategorized',
        description,
        amount,
        currency: 'USD',
        usd_amount: amount,
        exchange_rate: 1.0,
        mercury_transaction_id: tx.id,
        mercury_synced: true,
      })
      imported++
    }
  }

  revalidatePath('/admin/transactions')
  return { success: true, imported }
}
