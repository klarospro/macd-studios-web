'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { convertToUsd } from '@/lib/admin/exchange-rate'
import { uploadDocument } from '@/lib/admin/storage'

export type ActionState = { error?: string } | undefined

const InvestmentSchema = z.object({
  investor_name: z.string().trim().min(1),
  relationship: z.enum(['owner', 'family', 'external']),
  type: z.enum(['capital_contribution', 'loan']),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'EUR']),
  date: z.string().min(1),
  interest_rate: z.coerce.number().optional(),
  repayment_due_date: z.string().optional(),
  repayment_schedule: z.string().trim().optional(),
  status: z.enum(['active', 'fully_repaid', 'converted_to_equity', 'defaulted']),
  notes: z.string().trim().optional(),
})

function parseInvestmentForm(formData: FormData) {
  const parsed = InvestmentSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' } as const
  return { values: parsed.data } as const
}

export async function createInvestment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseInvestmentForm(formData)
  if ('error' in parsed) return { error: parsed.error }
  const values = parsed.values

  const { data: investment, error } = await supabase
    .from('investments')
    .insert({
      investor_name: values.investor_name,
      relationship: values.relationship,
      type: values.type,
      amount: values.amount,
      currency: values.currency,
      date: values.date,
      interest_rate: values.interest_rate ?? null,
      repayment_due_date: values.repayment_due_date || null,
      repayment_schedule: values.repayment_schedule || null,
      status: values.status,
      notes: values.notes || null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const contractFile = formData.get('contract') as File | null
  if (contractFile && contractFile.size > 0) {
    const buffer = Buffer.from(await contractFile.arrayBuffer())
    const path = await uploadDocument(supabase, 'contracts', `${investment.id}-${contractFile.name}`, buffer, contractFile.type || 'application/pdf')
    await supabase.from('investments').update({ contract_url: path }).eq('id', investment.id)
  }

  const isRelatedParty = values.relationship === 'owner' || values.relationship === 'family'
  const { usdAmount, rate } = await convertToUsd(values.amount, values.currency)

  await supabase.from('transactions').insert({
    date: values.date,
    type: 'income',
    category: values.type === 'capital_contribution' ? 'Owner Investment' : loanCategory(values.relationship),
    description: `${values.type === 'capital_contribution' ? 'Aporte de capital' : 'Préstamo recibido'} de ${values.investor_name}`,
    amount: values.amount,
    currency: values.currency,
    usd_amount: usdAmount,
    exchange_rate: rate,
    investment_id: investment.id,
    is_related_party: isRelatedParty,
    related_party_name: isRelatedParty ? values.investor_name : null,
  })

  revalidatePath('/admin/investments')
  redirect(`/admin/investments/${investment.id}`)
}

function loanCategory(relationship: 'owner' | 'family' | 'external') {
  if (relationship === 'family') return 'Family Loan'
  if (relationship === 'external') return 'Investor Loan'
  return 'Business Loan'
}

export async function updateInvestment(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseInvestmentForm(formData)
  if ('error' in parsed) return { error: parsed.error }
  const values = parsed.values

  const { error } = await supabase
    .from('investments')
    .update({
      investor_name: values.investor_name,
      relationship: values.relationship,
      type: values.type,
      amount: values.amount,
      currency: values.currency,
      date: values.date,
      interest_rate: values.interest_rate ?? null,
      repayment_due_date: values.repayment_due_date || null,
      repayment_schedule: values.repayment_schedule || null,
      status: values.status,
      notes: values.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  const contractFile = formData.get('contract') as File | null
  if (contractFile && contractFile.size > 0) {
    const buffer = Buffer.from(await contractFile.arrayBuffer())
    const path = await uploadDocument(supabase, 'contracts', `${id}-${contractFile.name}`, buffer, contractFile.type || 'application/pdf')
    await supabase.from('investments').update({ contract_url: path }).eq('id', id)
  }

  revalidatePath('/admin/investments')
  revalidatePath(`/admin/investments/${id}`)
  redirect(`/admin/investments/${id}`)
}

export async function deleteInvestment(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/investments')
  return undefined
}

const DistributionSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  concept: z.string().trim().optional(),
})

/**
 * Registra un pago/repago sobre una inversión: crea la fila en `distributions` y la
 * transacción contable correspondiente (Loan Repayment si es préstamo, Distribution si es
 * capital), vinculada por investment_id — "todo registrado" (requisito del usuario).
 */
export async function recordDistribution(investmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = DistributionSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data

  const { data: investment } = await supabase.from('investments').select('*').eq('id', investmentId).single()
  if (!investment) return { error: 'Inversión no encontrada' }

  const { error } = await supabase.from('distributions').insert({
    investment_id: investmentId,
    date: values.date,
    amount: values.amount,
    currency: investment.currency,
    concept: values.concept || null,
  })
  if (error) return { error: error.message }

  const isRelatedParty = investment.relationship === 'owner' || investment.relationship === 'family'
  const { usdAmount, rate } = await convertToUsd(values.amount, investment.currency)

  await supabase.from('transactions').insert({
    date: values.date,
    type: 'expense',
    category: investment.type === 'loan' ? 'Principal Repayment' : 'Investor Payout',
    description: values.concept || `Pago a ${investment.investor_name}`,
    amount: values.amount,
    currency: investment.currency,
    usd_amount: usdAmount,
    exchange_rate: rate,
    investment_id: investmentId,
    is_related_party: isRelatedParty,
    related_party_name: isRelatedParty ? investment.investor_name : null,
  })

  revalidatePath(`/admin/investments/${investmentId}`)
  revalidatePath('/admin/investments')
  return undefined
}
