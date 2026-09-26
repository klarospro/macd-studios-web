'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'

export async function saveBudget(formData: FormData) {
  const { supabase } = await requireSession()
  const provider = String(formData.get('provider') || '').trim().toLowerCase()
  const monthly = Number(formData.get('monthly_usd'))
  if (!provider || !Number.isFinite(monthly) || monthly < 0) return
  await supabase
    .from('ai_budgets')
    .upsert({ provider, monthly_usd: monthly, updated_at: new Date().toISOString() }, { onConflict: 'provider' })
  revalidatePath('/admin/consumo')
}
