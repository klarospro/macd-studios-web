'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'

export type ActionState = { error?: string } | undefined

const AccountSchema = z.object({
  platform: z.string().trim().min(1),
  account_size: z.coerce.number().positive(),
  account_type: z.enum(['evaluation', 'funded', 'blown']),
  status: z.enum(['active', 'passed', 'failed', 'payout_pending', 'closed']),
  purchase_date: z.string().min(1),
  purchase_cost: z.coerce.number().min(0),
  funded_date: z.string().optional(),
  notes: z.string().trim().optional(),
})

export async function createTradingAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = AccountSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data

  const { data: account, error } = await supabase
    .from('trading_accounts')
    .insert({
      platform: values.platform,
      account_size: values.account_size,
      account_type: values.account_type,
      status: values.status,
      purchase_date: values.purchase_date,
      purchase_cost: values.purchase_cost,
      funded_date: values.funded_date || null,
      notes: values.notes || null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  if (values.purchase_cost > 0) {
    await supabase.from('transactions').insert({
      date: values.purchase_date,
      type: 'expense',
      category: 'Prop Firm Evaluation',
      description: `Evaluación ${values.platform} — ${values.account_size} USD`,
      amount: values.purchase_cost,
      currency: 'USD',
      usd_amount: values.purchase_cost,
      exchange_rate: 1.0,
      trading_account_id: account.id,
    })
  }

  revalidatePath('/admin/trading')
  redirect(`/admin/trading/${account.id}`)
}

export async function updateTradingAccount(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = AccountSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data

  const { error } = await supabase
    .from('trading_accounts')
    .update({
      platform: values.platform,
      account_size: values.account_size,
      account_type: values.account_type,
      status: values.status,
      purchase_date: values.purchase_date,
      purchase_cost: values.purchase_cost,
      funded_date: values.funded_date || null,
      notes: values.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/trading')
  revalidatePath(`/admin/trading/${id}`)
  redirect(`/admin/trading/${id}`)
}

export async function deleteTradingAccount(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('trading_accounts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trading')
  return undefined
}

const PnlSchema = z.object({
  date: z.string().min(1),
  gross_profit: z.coerce.number(),
  fees: z.coerce.number().min(0).default(0),
  is_payout: z.string().optional(),
  payout_status: z.enum(['pending', 'received', 'rejected']).optional(),
  notes: z.string().trim().optional(),
})

export async function recordTradingPnl(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = PnlSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const values = parsed.data
  const isPayout = values.is_payout === 'on'

  const { data: account } = await supabase.from('trading_accounts').select('platform').eq('id', accountId).single()

  const { error } = await supabase.from('trading_pnl').insert({
    account_id: accountId,
    date: values.date,
    gross_profit: values.gross_profit,
    fees: values.fees,
    is_payout: isPayout,
    payout_status: isPayout ? values.payout_status ?? 'pending' : null,
    notes: values.notes || null,
  })
  if (error) return { error: error.message }

  if (isPayout && values.payout_status === 'received') {
    const netProfit = values.gross_profit - values.fees
    await supabase.from('transactions').insert({
      date: values.date,
      type: 'income',
      category: 'Trading Profit',
      description: `Payout recibido — ${account?.platform ?? 'cuenta de trading'}`,
      amount: netProfit,
      currency: 'USD',
      usd_amount: netProfit,
      exchange_rate: 1.0,
      trading_account_id: accountId,
    })
  }

  revalidatePath(`/admin/trading/${accountId}`)
  revalidatePath('/admin/trading')
  return undefined
}
