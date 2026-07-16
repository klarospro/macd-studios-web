import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atlasDb } from '@/lib/atlas-supabase'

// Mismo gate de admin que el resto del panel (ATLAS_ADMIN_SECRET / 'atlas-dev' en dev).
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

const STATUSES = new Set(['pending', 'approved', 'paid', 'rejected'])

export async function GET(req: NextRequest) {
  if (!authed(req.nextUrl.searchParams.get('token')))
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await atlasDb()
    .from('atlas_withdrawals')
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

  const { error } = await atlasDb()
    .from('atlas_withdrawals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
