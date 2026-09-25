import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atlasDb } from '@/lib/atlas-supabase'
import { renderContrato, renderCorreoAprobacion, type AtlasApplicant } from '@/lib/atlas-templates'

// Secreto de admin. Prod: ATLAS_ADMIN_SECRET (env). Dev: valor por defecto
// 'atlas-dev' para poder entrar en local sin configurar nada.
function adminSecret(): string | undefined {
  const fromEnv = process.env.ATLAS_ADMIN_SECRET?.trim()
  if (fromEnv) return fromEnv
  try {
    const txt = readFileSync(join(process.cwd(), 'ATLAS-AI', '.env.local'), 'utf8')
    const m = txt.match(/^ATLAS_ADMIN_SECRET=(.*)$/m)
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    /* noop */
  }
  return process.env.NODE_ENV !== 'production' ? 'atlas-dev' : undefined
}

function authed(token: string | null): boolean {
  const secret = adminSecret()
  return !!secret && token === secret
}

const STATUSES = new Set(['pending', 'approved', 'rejected'])

export async function GET(req: NextRequest) {
  if (!authed(req.nextUrl.searchParams.get('token')))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await atlasDb()
    .from('atlas_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!authed(body.token)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(body.id)
  const status = String(body.status)
  if (!Number.isInteger(id) || !STATUSES.has(status))
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { data: updated, error } = await atlasDb()
    .from('atlas_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Al APROBAR: disparar correo de aprobación (vía n8n) + confirmación por Telegram.
  // Best-effort, no bloquea la respuesta.
  if (status === 'approved' && updated) {
    const app = updated as AtlasApplicant
    const correo = renderCorreoAprobacion(app)
    const contrato = renderContrato(app)

    if (process.env.ATLAS_N8N_WEBHOOK_URL) {
      await fetch(`${process.env.ATLAS_N8N_WEBHOOK_URL}/webhook/atlas-aprobacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.N8N_TOKEN ?? ''}`,
        },
        body: JSON.stringify({
          name: app.name,
          email: app.email,
          subject: correo.subject,
          email_body: correo.body,
          contrato,
        }),
      }).catch(() => null)
    }

    const tgToken = process.env.ATLAS_TELEGRAM_BOT_TOKEN
    const tgChat = process.env.ATLAS_TELEGRAM_CHAT_ID
    if (tgToken && tgChat) {
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChat,
          text: `✅ Solicitud aprobada: ${app.name} (${app.email}). Correo de aprobación enviado.`,
          disable_web_page_preview: true,
        }),
      }).catch(() => null)
    }
  }

  return NextResponse.json({ ok: true })
}
