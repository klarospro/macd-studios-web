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

  const { error } = await atlasDb().from('atlas_applications').insert({
    name,
    email,
    phone: body.phone ? String(body.phone).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    capital: capital != null && Number.isFinite(capital) ? capital : null,
    currency: body.currency ? String(body.currency) : 'USD',
    account_type: TYPES.has(account_type) ? account_type : 'inversor',
    agenda: body.agenda ? String(body.agenda).trim() : null,
    message: body.message ? String(body.message).trim() : null,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Disparar aviso en n8n si está configurado (no bloquea la respuesta).
  if (process.env.N8N_WEBHOOK_URL) {
    fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/atlas-solicitud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.N8N_TOKEN ?? ''}`,
      },
      body: JSON.stringify({ name, email, account_type }),
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
