import 'server-only'
import { createHash } from 'crypto'

// Meta Conversions API: envía el "Lead" desde el servidor (no lo bloquean los adblockers) con el
// mismo event_id que el Pixel del navegador para que Meta lo deduplique.
// Solo se llama si el visitante aceptó cookies de publicidad.
// Variables: META_PIXEL_ID (= NEXT_PUBLIC_META_PIXEL_ID) y META_CAPI_TOKEN (Events Manager →
// Configuración → Generar token de acceso).
const sha256 = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex')

export async function sendMetaLead(input: {
  eventId: string
  email: string
  phone?: string | null
  ip?: string | null
  userAgent?: string | null
  fbp?: string
  fbc?: string
  sourceUrl: string
}) {
  const pixel = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_TOKEN
  if (!pixel || !token) return

  const phone = input.phone?.replace(/[^\d]/g, '')
  const body = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.sourceUrl,
        user_data: {
          em: [sha256(input.email)],
          ...(phone ? { ph: [sha256(phone)] } : {}),
          ...(input.ip ? { client_ip_address: input.ip } : {}),
          ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
        },
      },
    ],
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error('Meta CAPI:', res.status, (await res.text()).slice(0, 300))
  } catch (e) {
    console.error('Meta CAPI:', e)
  }
}
