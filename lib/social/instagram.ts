import 'server-only'
import { getToken, saveToken, secondsFromNow } from './tokens'

// Instagram API con "Instagram Login" (cuenta profesional: Business o Creator). En modo
// desarrollo de la app de Meta funciona con la propia cuenta sin App Review.
// Docs: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
const GRAPH = 'https://graph.instagram.com/v23.0'

export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments',
].join(',')

export function igConfigured() {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
}

export function igAuthorizeUrl(redirectUri: string, state: string) {
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', process.env.INSTAGRAM_APP_ID!)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', IG_SCOPES)
  u.searchParams.set('state', state)
  return u.toString()
}

async function json<T>(res: Response, what: string): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const msg = body.error?.message || body.error_message || JSON.stringify(body).slice(0, 300)
    throw new Error(`Instagram (${what}): ${msg}`)
  }
  return body as T
}

// code → token corto → token largo (60 días), y se guarda.
export async function igExchangeCode(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const short = await json<{ access_token: string; user_id: number; permissions?: string[] }>(
    await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form }),
    'token corto'
  )
  const long = await json<{ access_token: string; expires_in: number }>(
    await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
        process.env.INSTAGRAM_APP_SECRET!
      )}&access_token=${encodeURIComponent(short.access_token)}`
    ),
    'token largo'
  )
  await saveToken({
    platform: 'instagram',
    access_token: long.access_token,
    refresh_token: null,
    expires_at: secondsFromNow(long.expires_in),
    refresh_expires_at: null,
    scopes: short.permissions?.join(',') ?? IG_SCOPES,
  })
}

// Devuelve un token válido; si caduca en menos de 7 días lo renueva (otro ciclo de 60).
async function igAccessToken() {
  const t = await getToken('instagram')
  if (!t) throw new Error('Instagram no está conectado.')
  const expires = t.expires_at ? new Date(t.expires_at).getTime() : Infinity
  if (expires - Date.now() < 7 * 86400_000) {
    const r = await json<{ access_token: string; expires_in: number }>(
      await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
          t.access_token
        )}`
      ),
      'renovar token'
    )
    await saveToken({ ...t, access_token: r.access_token, expires_at: secondsFromNow(r.expires_in) })
    return r.access_token
  }
  return t.access_token
}

async function igGet<T>(path: string, params: Record<string, string> = {}) {
  const token = await igAccessToken()
  const u = new URL(`${GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  u.searchParams.set('access_token', token)
  return json<T>(await fetch(u, { cache: 'no-store' }), `GET ${path}`)
}

async function igPost<T>(path: string, params: Record<string, string>) {
  const token = await igAccessToken()
  const body = new URLSearchParams({ ...params, access_token: token })
  return json<T>(await fetch(`${GRAPH}${path}`, { method: 'POST', body }), `POST ${path}`)
}

export type IgProfile = {
  user_id: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
}

export function igProfile() {
  return igGet<IgProfile>('/me', {
    fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count',
  })
}

export type IgMedia = {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  permalink: string
  thumbnail_url?: string
  media_url?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export async function igRecentMedia(limit = 30) {
  const r = await igGet<{ data: IgMedia[] }>('/me/media', {
    fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
    limit: String(limit),
  })
  return r.data
}

// Métricas por publicación. Cada tipo acepta métricas distintas y Meta cambia la lista a
// menudo, así que se piden por separado y lo que falle se deja en null.
export async function igMediaInsights(mediaId: string) {
  const out: Record<string, number> = {}
  for (const metric of ['views', 'reach', 'saved', 'shares']) {
    try {
      const r = await igGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        `/${mediaId}/insights`,
        { metric }
      )
      const m = r.data[0]
      const v = m?.total_value?.value ?? m?.values?.[0]?.value
      if (typeof v === 'number') out[metric] = v
    } catch {
      // métrica no disponible para este tipo de publicación
    }
  }
  return out
}

// Métricas de la cuenta del último día completo.
export async function igAccountInsights() {
  const out: Record<string, number> = {}
  for (const metric of ['reach', 'views', 'profile_views', 'accounts_engaged']) {
    try {
      const r = await igGet<{ data: { name: string; total_value?: { value: number } }[] }>('/me/insights', {
        metric,
        period: 'day',
        metric_type: 'total_value',
      })
      const v = r.data[0]?.total_value?.value
      if (typeof v === 'number') out[metric] = v
    } catch {
      // se ignora: la cuenta puede no tener datos suficientes todavía
    }
  }
  return out
}

// ── Publicar ────────────────────────────────────────────────────────────
async function waitContainer(id: string) {
  for (let i = 0; i < 30; i++) {
    const s = await igGet<{ status_code: string; status?: string }>(`/${id}`, { fields: 'status_code,status' })
    if (s.status_code === 'FINISHED') return
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED')
      throw new Error(`Instagram rechazó el archivo: ${s.status ?? s.status_code}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('Instagram tardó demasiado en procesar el archivo (más de 2,5 min).')
}

export async function igPublishReel(videoUrl: string, caption: string, coverUrl?: string) {
  const c = await igPost<{ id: string }>('/me/media', {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: 'true',
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  })
  await waitContainer(c.id)
  const p = await igPost<{ id: string }>('/me/media_publish', { creation_id: c.id })
  return p.id
}

export async function igPublishCarousel(imageUrls: string[], caption: string) {
  if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error('Un carrusel necesita entre 2 y 10 imágenes.')
  const children: string[] = []
  for (const url of imageUrls) {
    const c = await igPost<{ id: string }>('/me/media', { image_url: url, is_carousel_item: 'true' })
    children.push(c.id)
  }
  const parent = await igPost<{ id: string }>('/me/media', {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  })
  await waitContainer(parent.id)
  const p = await igPost<{ id: string }>('/me/media_publish', { creation_id: parent.id })
  return p.id
}
