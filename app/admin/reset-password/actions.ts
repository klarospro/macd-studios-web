'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/admin/supabase-server'

export type ResetPasswordState = { error?: string } | undefined

export async function updatePassword(
  _state: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login?error=recovery_link_invalid')
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: 'No se pudo actualizar la contraseña. Vuelve a pedir el enlace de recuperación.' }
  }

  redirect('/admin')
}
