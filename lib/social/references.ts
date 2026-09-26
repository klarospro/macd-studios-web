import 'server-only'

// Escáner de cuentas de referencia con Instagram Business Discovery.
// Requisito de Meta: esta API SOLO existe en "Instagram API con Facebook Login" (cuenta
// profesional de IG vinculada a una Página de Facebook). La conexión con "Instagram Login" que
// usa /admin/redes para publicar no la incluye. Por eso usa su propio par de variables:
//   IG_DISCOVERY_TOKEN   → token de usuario de Facebook con instagram_basic + pages_show_list
//   IG_DISCOVERY_USER_ID → ID de la cuenta de Instagram Business vinculada a tu Página
// Solo lee datos públicos de cuentas Business/Creator (no personales).
const GRAPH = 'https://graph.facebook.com/v23.0'

export function discoveryConfigured() {
  return Boolean(process.env.IG_DISCOVERY_TOKEN && process.env.IG_DISCOVERY_USER_ID)
}

export type ReferencePost = {
  caption?: string
  media_type: string
  media_product_type?: string
  like_count?: number
  comments_count?: number
  timestamp: string
  permalink: string
}

export type ReferenceScan = {
  username: string
  name?: string
  biography?: string
  website?: string
  followers_count: number
  follows_count?: number
  media_count: number
  posts: ReferencePost[]
}

export async function scanReference(username: string): Promise<ReferenceScan> {
  const clean = username.replace(/^@/, '').trim().toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(clean)) throw new Error('Usuario de Instagram no válido.')

  const fields = `business_discovery.username(${clean}){username,name,biography,website,followers_count,follows_count,media_count,media.limit(40){caption,media_type,media_product_type,like_count,comments_count,timestamp,permalink}}`
  const u = new URL(`${GRAPH}/${process.env.IG_DISCOVERY_USER_ID}`)
  u.searchParams.set('fields', fields)
  u.searchParams.set('access_token', process.env.IG_DISCOVERY_TOKEN!)

  const res = await fetch(u, { cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `HTTP ${res.status}`
    throw new Error(
      /cannot be found|not.*business/i.test(msg)
        ? `@${clean} no existe o no es cuenta profesional (Business Discovery solo lee cuentas Business/Creator).`
        : `Instagram: ${msg}`
    )
  }
  const bd = body.business_discovery
  return { ...bd, posts: bd.media?.data ?? [] }
}

// Resumen numérico que se le pasa al agente (evita que invente métricas).
export function summarizeScan(s: ReferenceScan) {
  const posts = s.posts
  const eng = (p: ReferencePost) => (p.like_count ?? 0) + (p.comments_count ?? 0)
  const avg = posts.length ? posts.reduce((a, p) => a + eng(p), 0) / posts.length : 0
  const byFormat: Record<string, { n: number; eng: number }> = {}
  for (const p of posts) {
    const f = p.media_product_type === 'REELS' ? 'REEL' : p.media_type
    byFormat[f] ??= { n: 0, eng: 0 }
    byFormat[f].n++
    byFormat[f].eng += eng(p)
  }
  const days =
    posts.length > 1
      ? (new Date(posts[0].timestamp).getTime() - new Date(posts[posts.length - 1].timestamp).getTime()) / 86400_000
      : 0
  const top = [...posts].sort((a, b) => eng(b) - eng(a))

  return [
    `@${s.username} (${s.name ?? ''}) · seguidores=${s.followers_count} · publicaciones=${s.media_count}`,
    `Bio: ${s.biography ?? '—'} · Web: ${s.website ?? '—'}`,
    `Últimas ${posts.length} publicaciones en ${days.toFixed(0)} días → ${days ? (posts.length / days * 7).toFixed(1) : '?'} por semana`,
    `Interacción media (likes+comentarios) = ${avg.toFixed(0)} → ${s.followers_count ? ((avg / s.followers_count) * 100).toFixed(2) : '?'}% de sus seguidores`,
    `Por formato: ${Object.entries(byFormat).map(([f, v]) => `${f} ${v.n} pubs, media ${(v.eng / v.n).toFixed(0)}`).join(' · ')}`,
    'TOP 8:',
    ...top.slice(0, 8).map(
      (p) => `- [${p.media_product_type === 'REELS' ? 'REEL' : p.media_type} ${p.timestamp.slice(0, 10)}] ${eng(p)} interacciones · "${(p.caption ?? '').replace(/\s+/g, ' ').slice(0, 220)}"`
    ),
    'PEORES 4:',
    ...top.slice(-4).map((p) => `- [${p.media_type}] ${eng(p)} · "${(p.caption ?? '').replace(/\s+/g, ' ').slice(0, 120)}"`),
  ].join('\n')
}
