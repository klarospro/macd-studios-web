import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Construcción diferida: el cliente se crea la primera vez que se USA (en tiempo de
// request), no al importar el módulo. Así el build (`next build` → "collect page data")
// puede importar las rutas que dependen de esto sin exigir las credenciales presentes.
// El comportamiento en runtime es idéntico al de antes (falla igual si faltan las envs,
// pero solo cuando una petición realmente toca Supabase, no al compilar).
let client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  }
  return client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = c[prop as keyof SupabaseClient]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(c) : value
  },
})
