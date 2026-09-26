import 'server-only'
import { getToken, saveToken, secondsFromNow } from './tokens'

// TikTok Login Kit + Display API + Content Posting API.
// IMPORTANTE: mientras TikTok no apruebe la app (auditoría), todo lo que se publique por
// API queda en privado (SELF_ONLY). Se hace público desde la app con un toque. Cuando la
// auditoría esté aprobada, poner TIKTOK_AUDITED=true en Vercel.
const API = 'https://open.tiktokapis.com/v2'

export const TT_SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish'].join(',')

export function ttConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
}

export function ttAuthorizeUrl(redirectUri: string, state: string) {
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/')
  u.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY!)
  u.searchParams.set('scope', TT_SCOPES)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  return u.toString()
}

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  refresh_expires_in: number
  scope: string
  open_id: string
  error?: string
  error_description?: string
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || body.error) throw new Error(`TikTok (token): ${body.error_description || body.error || res.status}`)
  await saveToken({
    platform: 'tiktok',
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: secondsFromNow(body.expires_in),
    refresh_expires_at: secondsFromNow(body.refresh_expires_in),
    scopes: body.scope,
  })
  return body
}

export function ttExchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri })
}

// El token de acceso dura 24 h y el de renovación 365 días.
async function ttAccessToken() {
  const t = await getToken('tiktok')
  if (!t) throw new Error('TikTok no está conectado.')
  const expires = t.expires_at ? new Date(t.expires_at).getTime() : 0
  if (expires - Date.now() < 10 * 60_000) {
    if (!t.refresh_token) throw new Error('TikTok: el token caducó. Vuelve a conectar la cuenta.')
    const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
    return r.access_token
  }
  return t.access_token
}

async function tt<T>(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
  const token = await ttAccessToken()
  const u = new URL(`${API}${path}`)
  for (const [k, v] of Object.entries(init.query ?? {})) u.searchParams.set(k, v)
  const res = await fetch(u, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.error && body.error.code && body.error.code !== 'ok')) {
    throw new Error(`TikTok (${path}): ${body.error?.message || body.error?.code || res.status}`)
  }
  return body.data as T
}

export type TtUser = {
  open_id: string
  username?: string
  display_name?: string
  avatar_url?: string
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
}

export async function ttUser() {
  const d = await tt<{ user: TtUser }>('/user/info/', {
    query: {
      fields: 'open_id,username,display_name,avatar_url,follower_count,following_count,likes_count,video_count',
    },
  })
  return d.user
}

export type TtVideo = {
  id: string
  title?: string
  video_description?: string
  create_time: number
  cover_image_url?: string
  share_url?: string
  duration?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

export async function ttRecentVideos(max = 20) {
  const d = await tt<{ videos: TtVideo[] }>('/video/list/', {
    method: 'POST',
    query: {
      fields:
        'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count',
    },
    body: { max_count: max },
  })
  return d.videos ?? []
}

// Publicación directa subiendo el archivo (FILE_UPLOAD): no exige verificar el dominio
// del que sale el video, a diferencia de PULL_FROM_URL.
export async function ttPublishVideo(videoUrl: string, caption: string) {
  const file = await fetch(videoUrl)
  if (!file.ok) throw new Error(`No se pudo descargar el video (${file.status}).`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > 64 * 1024 * 1024) throw new Error('El video pesa más de 64 MB; renderízalo más liviano.')

  const creator = await tt<{ privacy_level_options: string[] }>('/post/publish/creator_info/query/', { method: 'POST' })
  const wantPublic = process.env.TIKTOK_AUDITED === 'true'
  const privacy =
    wantPublic && creator.privacy_level_options.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY'

  const init = await tt<{ publish_id: string; upload_url: string }>('/post/publish/video/init/', {
    method: 'POST',
    body: {
      post_info: { title: caption.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
      source_info: { source: 'FILE_UPLOAD', video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 },
    },
  })

  const put = await fetch(init.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(bytes.length),
      'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}`,
    },
    body: bytes,
  })
  if (!put.ok) throw new Error(`TikTok rechazó la subida del video (${put.status}).`)
  return { publishId: init.publish_id, privacy }
}
