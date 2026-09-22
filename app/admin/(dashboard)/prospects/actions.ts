'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/admin/dal'

export type ActionState = { error?: string } | undefined

const STATUSES = ['prospecto', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'] as const

const ProspectSchema = z.object({
  client_name: z.string().trim().min(1, 'El nombre es obligatorio'),
  contact: z.string().trim().optional(),
  service: z.string().trim().optional(),
  amount: z.union([z.coerce.number(), z.literal('')]).optional(),
  status: z.enum(STATUSES).default('prospecto'),
  notes: z.string().trim().optional(),
})

export async function createProspect(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const raw = Object.fromEntries(formData.entries())
  const parsed = ProspectSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const { client_name, contact, service, amount, status, notes } = parsed.data
  const { error } = await supabase.from('prospects').insert({
    client_name,
    contact: contact || null,
    service: service || null,
    amount: amount === '' || amount === undefined ? null : amount,
    status,
    notes: notes || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/prospects')
}

export async function updateProspectStatus(id: string, status: string) {
  const { supabase } = await requireSession()
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { error: 'Estado inválido' }

  const { error } = await supabase
    .from('prospects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/prospects')
}

export async function deleteProspect(id: string) {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('prospects').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/prospects')
}
