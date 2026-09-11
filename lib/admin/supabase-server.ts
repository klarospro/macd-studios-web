import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase ligado a la sesión del usuario (cookies), usa la anon key.
 * A diferencia de lib/supabase.ts (service-role), este SÍ respeta RLS —
 * es el que deben usar todas las queries de /admin.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se llama desde un Server Component en el que no se pueden setear cookies
            // (ya las refresca el proxy en la próxima request). Se ignora a propósito.
          }
        },
      },
    }
  )
}
