import { NextRequest, NextResponse } from 'next/server'
import { atlasDb } from '@/lib/atlas-supabase'

const PERIODS = new Set(['trimestral', 'anual'])

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  if (name.length < 2) return NextResponse.json({ error: 'Indica tu nombre completo.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: 'Correo no válido.' }, { status: 400 })

  const period_type = PERIODS.has(String(body.period_type)) ? String(body.period_type) : 'trimestral'
  const period_label = body.period_label ? String(body.period_label).trim() : null
  const currency = body.currency ? String(body.currency) : 'USD'
  const rawAmt = String(body.amount ?? '').replace(/[^\d.]/g, '')
  const amount = rawAmt ? Number(rawAmt) : null
  const amountNum = amount != null && Number.isFinite(amount) ? amount : null
  const notes = body.notes ? String(body.notes).trim() : null

  const { error } = await atlasDb().from('atlas_withdrawals').insert({
    name,
    email,
    period_type,
    period_label,
    amount: amountNum,
    currency,
    notes,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ---- Aviso a Moisés (n8n principal + Telegram directo de respaldo). Best-effort. ----
  const submittedAt = new Date().toISOString()
  const importe = amountNum != null ? `${amountNum.toLocaleString('es-ES')} ${currency}` : 'sin especificar'
  const notifText =
    `💸 Solicitud de RETIRO — ATLAS\n` +
    `👤 ${name}\n` +
    `✉️ ${email}\n` +
    `🗓️ Periodo: ${period_type}${period_label ? ` (${period_label})` : ''}\n` +
    `💰 Importe: ${importe}\n` +
    (notes ? `📝 ${notes}\n` : '') +
    `🕒 ${submittedAt}`

  if (process.env.N8N_WEBHOOK_URL) {
    fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/atlas-retiro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.N8N_TOKEN ?? ''}`,
      },
      body: JSON.stringify({
        name,
        email,
        period_type,
        period_label,
        amount: amountNum,
        currency,
        importe,
        notes,
        submitted_at: submittedAt,
        text: notifText,
      }),
    }).catch(() => null)
  }

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
