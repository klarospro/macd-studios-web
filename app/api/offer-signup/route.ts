import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HONEYPOT_FIELD, isHoneypotTriggered } from '@/lib/antiSpam'
import { sendAuditConfirmationEmail } from '@/lib/admin/email'
import { sendMetaLead } from '@/lib/meta-capi'

const CONTACTOS = ['whatsapp', 'llamada', 'email'] as const

// Origen del lead (UTM, fbclid, página de entrada). Se recortan y solo se aceptan textos.
const ATTR_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'landing', 'referrer', 'fbclid'] as const
function cleanAttribution(raw: unknown) {
  const out: Partial<Record<(typeof ATTR_FIELDS)[number], string>> = {}
  if (raw && typeof raw === 'object') {
    for (const k of ATTR_FIELDS) {
      const v = (raw as Record<string, unknown>)[k]
      if (typeof v === 'string' && v) out[k] = v.slice(0, 300)
    }
  }
  return out
}
type Contacto = (typeof CONTACTOS)[number]

// Links de un toque para que Moisés contacte al lead desde la notificación de Telegram.
function contactLinks(telefono: string | null, email: string): string {
  const lines = [`✉️ ${email}`]
  const digits = telefono?.replace(/\D/g, '')
  if (digits) lines.unshift(`💬 https://wa.me/${digits}`, `📞 +${digits}`)
  return lines.join('\n')
}

// El aviso sale por n8n (workflow "Aviso auditoría web → Telegram"), que ya tiene la
// credencial del bot y el chat de Moisés. La URL del webhook vive solo en Vercel porque
// el repo es público y cualquiera con ella podría llenar el Telegram de spam.
async function notifyMoises(text: string) {
  const webhook = process.env.N8N_AUDITORIA_WEBHOOK
  if (!webhook) {
    console.error('offer-signup: falta N8N_AUDITORIA_WEBHOOK, no se avisó a Moisés')
    return
  }
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch((e) => console.error('offer-signup: falló el aviso a n8n', e))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nombre, email, telefono, sector } = body
  const contacto: Contacto = CONTACTOS.includes(body.contacto) ? body.contacto : 'email'

  if (isHoneypotTriggered(body[HONEYPOT_FIELD])) return NextResponse.json({ ok: true })
  if (!email || !nombre) return NextResponse.json({ error: 'Nombre y email requeridos' }, { status: 400 })
  if (contacto !== 'email' && !telefono) {
    return NextResponse.json({ error: 'Teléfono requerido para WhatsApp o llamada' }, { status: 400 })
  }

  const attribution = cleanAttribution(body.attribution)
  const { error } = await supabase.from('bot_leads').insert({
    nombre,
    email,
    telefono: telefono || null,
    sector: sector || null,
    problema: `Auditoría gratis (web) — prefiere contacto por ${contacto}`,
    estado: 'nuevo',
    canal: attribution.utm_source ? `web · ${attribution.utm_source}` : 'web',
    ...attribution,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Conversions API de Meta: solo si el visitante aceptó cookies de publicidad.
  const tracking = body.tracking
  const metaLead =
    tracking?.consent === true && typeof tracking.eventId === 'string'
      ? sendMetaLead({
          eventId: tracking.eventId.slice(0, 64),
          email,
          phone: telefono || null,
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent'),
          fbp: typeof tracking.fbp === 'string' ? tracking.fbp : undefined,
          fbc: typeof tracking.fbc === 'string' ? tracking.fbc : undefined,
          sourceUrl: `${req.nextUrl.origin}${attribution.landing ?? '/'}`,
        })
      : Promise.resolve()

  // El lead ya quedó guardado: si falla el aviso o el correo, no se le muestra error.
  await Promise.all([
    metaLead,
    notifyMoises(
      `🔥 Nueva auditoría gratis (web)\n\n👤 ${nombre}\n🏢 ${sector || 'sin sector'}\n📌 Prefiere: ${contacto}${
        attribution.utm_campaign
          ? `\n📣 Campaña: ${attribution.utm_campaign}${attribution.utm_content ? ` · ${attribution.utm_content}` : ''}`
          : ''
      }\n\n${contactLinks(telefono || null, email)}`
    ),
    sendAuditConfirmationEmail({ to: email, nombre, contacto }).catch((e) =>
      console.error('offer-signup: fallo el correo de confirmacion', e)
    ),
  ])

  return NextResponse.json({ ok: true })
}
