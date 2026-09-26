import 'server-only'
import { supabase as serviceDb } from '@/lib/supabase'

export type Platform = 'instagram' | 'tiktok'

export type StoredToken = {
  platform: Platform
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  refresh_expires_at: string | null
  scopes: string | null
}

// social_tokens tiene RLS sin políticas: solo el service role la lee/escribe. Nunca se
// devuelve un token al navegador ni se loguea.
export async function getToken(platform: Platform): Promise<StoredToken | null> {
  const { data, error } = await serviceDb.from('social_tokens').select('*').eq('platform', platform).maybeSingle()
  if (error) throw new Error(`No se pudo leer el token de ${platform}: ${error.message}`)
  return data
}

export async function saveToken(t: StoredToken) {
  const { error } = await serviceDb
    .from('social_tokens')
    .upsert({ ...t, updated_at: new Date().toISOString() }, { onConflict: 'platform' })
  if (error) throw new Error(`No se pudo guardar el token de ${t.platform}: ${error.message}`)
}

export async function deleteToken(p: Platform) {
  await serviceDb.from('social_tokens').delete().eq('platform', p)
}

export function secondsFromNow(s: number | null | undefined) {
  return s ? new Date(Date.now() + s * 1000).toISOString() : null
}
