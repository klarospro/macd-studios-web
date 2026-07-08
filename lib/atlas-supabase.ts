import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Cliente Supabase de Atlas (service_role · SOLO servidor).
 *
 * Resolución de credenciales (lazy, en la primera llamada):
 *  1. process.env (producción/Vercel — lo normal).
 *  2. Fallback DEV: lee el .env.local del motor (ATLAS-AI/) que ya tiene la key,
 *     porque en local la key vive ahí y no en el .env.local del web. En producción
 *     este fallback nunca se ejecuta (process.env ya la trae).
 * La URL se deriva del propio JWT si falta (el claim `ref` no es secreto).
 */
function fromEngineEnv(name: string): string | undefined {
  try {
    const txt = readFileSync(join(process.cwd(), 'ATLAS-AI', '.env.local'), 'utf8')
    const m = txt.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
  } catch {
    return undefined
  }
}

function deriveUrl(key?: string): string | undefined {
  if (!key) return undefined
  try {
    const part = key.split('.')[1]
    if (!part) return undefined
    const payload = JSON.parse(Buffer.from(part, 'base64').toString('utf8'))
    return payload.ref ? `https://${payload.ref}.supabase.co` : undefined
  } catch {
    return undefined
  }
}

// Trata cadenas vacías/espacios como ausentes (el .env del web tiene claves en blanco).
const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)

let cached: SupabaseClient | null = null

export function atlasDb(): SupabaseClient {
  if (cached) return cached
  const key = clean(process.env.SUPABASE_SERVICE_KEY) ?? fromEngineEnv('SUPABASE_SERVICE_KEY')
  // La URL se deriva de la KEY resuelta para que ambas apunten SIEMPRE al mismo
  // proyecto (el env del web trae una SUPABASE_URL vieja de otro proyecto).
  const url = deriveUrl(key) ?? clean(process.env.SUPABASE_URL) ?? fromEngineEnv('SUPABASE_URL')
  if (!key || !url) {
    throw new Error(
      `Atlas Supabase: faltan credenciales · key=${key ? 'len' + key.length : 'MISSING'} · url=${url ?? 'MISSING'}`,
    )
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
