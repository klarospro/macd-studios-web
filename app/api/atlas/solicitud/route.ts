import { NextRequest, NextResponse } from 'next/server'
import { atlasDb } from '@/lib/atlas-supabase'

const TYPES = new Set(['inversor', 'accionista', 'plantilla'])

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const account_type = String(body.account_type ?? 'inversor')

  if (name.length < 2) return NextResponse.json({ error: 'Indica tu nombre completo.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: 'Correo no válido.' }, { status: 400 })

  const rawCap = String(body.capital ?? '').replace(/[^\d.]/g, '')
  const capital = rawCap ? Number(rawCap) : null
  const capitalNum = capital != null && Number.isFinite(capital) ? capital : null

  const accountType = TYPES.has(account_type) ? account_type : 'inversor'
  const currency = body.currency ? String(body.currency) : 'USD'
  const phone = body.phone ? String(body.phone).trim() : null
  const address = body.address ? String(body.address).trim() : null
  const agenda = body.agenda ? String(body.agenda).trim() : null
  const agendaDate = body.agenda_date ? String(body.agenda_date).trim() : null
  const agendaSlot = body.agenda_slot ? String(body.agenda_slot).trim() : null
  const message = body.message ? String(body.message).trim() : null

  const { error } = await atlasDb().from('atlas_applications').insert({
    name,
    email,
    phone,
    address,
    capital: capitalNum,
    currency,
    account_type: accountType,
    agenda,
    message,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ---- Aviso a Moisés (n8n como canal principal + Telegram directo de respaldo) ----
  // Best-effort: no bloquea la respuesta al cliente.
  const submittedAt = new Date().toISOString()
  const importe =
    capitalNum != null ? `${capitalNum.toLocaleString('es-ES')} ${currency}` : 'sin especificar'
  const notifText =
    `🔔 Nueva solicitud ATLAS\n` +
    `👤 ${name}\n` +
    `✉️ ${email}\n` +
    (phone ? `📞 ${phone}\n` : '') +
    (address ? `📍 ${address}\n` : '') +
    `🎯 Perfil: ${accountType}\n` +
    `💰 Importe: ${importe}\n` +
    `🗓️ Llamada: ${agenda ?? 'sin especificar'}\n` +
    (message ? `📝 ${message}\n` : '') +
    `🕒 ${submittedAt}`

  // 1) n8n: recibe todos los datos + el texto ya formateado para reenviar a Telegram.
  if (process.env.N8N_WEBHOOK_URL) {
    fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/atlas-solicitud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.N8N_TOKEN ?? ''}`,
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        account_type: accountType,
        capital: capitalNum,
        currency,
        importe,
        agenda,
        agenda_date: agendaDate,
        agenda_slot: agendaSlot,
        message,
        submitted_at: submittedAt,
        text: notifText,
      }),
    }).catch(() => null)
  }

  // 2) Telegram directo (respaldo) si el entorno web tiene el bot configurado.
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: notifText, disable_web_page_preview: true }),
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
