import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/admin/supabase-server'

/**
 * Punto de entrada de los enlaces de recuperación / magic link de Supabase
 * (Authentication → Email Templates apunta aquí). Cambia el token por una
 * sesión real (cookie) antes de mandar al usuario a poner su contraseña nueva.
 * Sin esta ruta, el enlace del correo no tiene dónde aterrizar.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      const next = type === 'recovery' ? '/admin/reset-password' : '/admin'
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=recovery_link_invalid`)
}
