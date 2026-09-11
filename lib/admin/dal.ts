import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './supabase-server'

/**
 * Verificación "real" de sesión (no solo la cookie que ya miró proxy.ts) — se llama en el
 * layout de /admin y en cada Server Action / Route Handler que mute datos. Además de exigir
 * sesión válida, exige que el email coincida con ADMIN_EMAIL: este proyecto Supabase no tiene
 * registro público, pero si algún día existiera más de un usuario, esto evita que cualquier
 * cuenta autenticada entre al panel.
 */
export const requireSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect('/admin/login?error=unauthorized')
  }

  return { user, supabase }
})
