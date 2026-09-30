'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/admin/dal'
import { uploadDocument, clientDocTag } from '@/lib/admin/storage'

export type ActionState = { error?: string } | undefined

const ClientSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  company: z.string().trim().optional(),
  tax_id: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().default('US'),
  zip_code: z.string().trim().optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  phone: z.string().trim().optional(),
  preferred_currency: z.enum(['USD', 'EUR']).default('USD'),
  notes: z.string().trim().optional(),
})

function parseClientForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const parsed = ClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos de cliente inválidos' } as const
  }
  const data = parsed.data
  return {
    values: {
      ...data,
      company: data.company || null,
      tax_id: data.tax_id || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    },
  } as const
}

export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseClientForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { data, error } = await supabase.from('clients').insert(parsed.values).select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  redirect(`/admin/clients/${data.id}`)
}

export async function updateClient(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSession()
  const parsed = parseClientForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('clients')
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
  redirect(`/admin/clients/${id}`)
}

export async function deleteClient(id: string): Promise<ActionState> {
  const { supabase } = await requireSession()
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  return undefined
}

const CLIENT_DOC_KINDS = ['contracts', 'invoices', 'receipts'] as const

export async function uploadClientDocument(
  clientId: string,
  formData: FormData
): Promise<ActionState & { success?: boolean }> {
  const { supabase } = await requireSession()
  const file = formData.get('file') as File | null
  const kind = z.enum(CLIENT_DOC_KINDS).safeParse(formData.get('kind'))
  if (!file || file.size === 0) return { error: 'Selecciona un archivo' }
  if (!kind.success) return { error: 'Tipo de documento inválido' }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await uploadDocument(
      supabase,
      kind.data,
      `${clientDocTag(clientId)}${file.name}`,
      buffer,
      file.type || 'application/octet-stream'
    )
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo subir el documento' }
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath('/admin/documents')
  return { success: true }
}
