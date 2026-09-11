'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/admin/supabase-server'

export type LoginState = { error?: string } | undefined

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Introduce email y contraseña.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciales incorrectas.' }
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && email.toLowerCase() !== adminEmail.toLowerCase()) {
    await supabase.auth.signOut()
    return { error: 'Este usuario no tiene acceso al panel.' }
  }

  redirect('/admin')
}
