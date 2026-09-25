import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HONEYPOT_FIELD, isHoneypotTriggered } from '@/lib/antiSpam'
import { sendAuditConfirmationEmail } from '@/lib/admin/email'

const CONTACTOS = ['whatsapp', 'llamada', 'email'] as const
type Contacto = (typeof CONTACTOS)[number]

// Links de un toque para que Moisés contacte al lead desde la notificación de Telegram.
function contactLinks(telefono: string | null, email: string): string {
  const lines = [`✉️ ${email}`]
  const digits = telefono?.replace(/\D/g, '')
  if (digits) lines.unshift(`💬 https://wa.me/${digits}`, `📞 +${digits}`)
  return lines.join('\n')
}

async function notifyMoises(text: string) {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (!tgToken || !tgChat) return
  await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgChat, text, disable_web_page_preview: true }),
  }).catch(() => null)
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

  const { error } = await supabase.from('bot_leads').insert({
    nombre,
    email,
    telefono: telefono || null,
    sector: sector || null,
    problema: `Auditoría gratis (web) — prefiere contacto por ${contacto}`,
    estado: 'nuevo',
    canal: 'web',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // El lead ya quedó guardado: si falla el aviso o el correo, no se le muestra error.
  await Promise.all([
    notifyMoises(
      `🔥 Nueva auditoría gratis (web)\n\n👤 ${nombre}\n🏢 ${sector || 'sin sector'}\n📌 Prefiere: ${contacto}\n\n${contactLinks(telefono || null, email)}`
    ),
    sendAuditConfirmationEmail({ to: email, nombre, contacto }).catch((e) =>
      console.error('offer-signup: fallo el correo de confirmacion', e)
    ),
  ])

  return NextResponse.json({ ok: true })
}
